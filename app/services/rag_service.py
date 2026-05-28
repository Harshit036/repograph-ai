from app.services.embedding_service import generate_embedding
from app.services.graph_retrieval_service import get_graph_neighbors
from app.services.hybrid_retrieval_service import hybrid_search
from app.services.llm_service import generate_response
from app.services.reranking_service import neural_rerank
from app.services.reranking_service import neural_rerank, semantic_deduplicate, mmr


def deduplicate_pairs(pairs: list) -> list:
    seen = set()
    result = []
    for doc, meta in pairs:
        if doc not in seen:
            seen.add(doc)
            result.append((doc, meta))
    return result


def rerank_pairs(query: str, pairs: list) -> list:
    query_words = set(query.lower().split())

    def score(pair):
        doc_words = set(pair[0].lower().split())
        return len(query_words & doc_words)

    return sorted(pairs, key=score, reverse=True)


def generate_rag_response(user_query: str):
    query_embedding = generate_embedding(user_query)
    pairs = hybrid_search(user_query, query_embedding, top_k=10)
    pairs = neural_rerank(user_query, pairs, top_k=8)
    pairs = semantic_deduplicate(pairs)
    pairs = mmr(user_query, pairs)

    # pairs = deduplicate_pairs(pairs)
    # pairs = rerank_pairs(user_query, pairs)[:5]

    context_parts = []
    citations = []

    for idx, (doc, meta) in enumerate(pairs):
        source_id = idx + 1
        file_name = meta.get("file_name", "unknown")
        file_path = meta.get("file_path", "")

        context_parts.append(f"[Source {source_id}: {file_name}]\n{doc}")
        citations.append(
            {
                "source_id": source_id,
                "file": file_name,
                "file_path": file_path,
                "preview": doc[:200],
            }
        )

        neighbors = get_graph_neighbors(file_path)
        if neighbors:
            context_parts.append(f"Related imports: {', '.join(neighbors)}")

    context = "\n\n".join(context_parts)

    prompt = f"""You are RepoGraph AI, an expert repository analysis assistant.

Answer using ONLY the repository context below.
When referencing code or making a claim, cite the source inline using [Source N] notation.
If the answer is not in the context, say "I could not find relevant repository information."

Repository Context:
{context}

Question: {user_query}"""

    response = generate_response(prompt)
    return {"response": response, "citations": citations}
