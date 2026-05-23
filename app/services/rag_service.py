from app.services.embedding_service import generate_embedding

from app.services.graph_retrieval_service import get_graph_neighbors
from app.services.vector_db_service import search_similar_chunks

from app.services.llm_service import generate_response

from app.services.retrieval_service import deduplicate_chunks, rerank_chunks


def build_context(query, results):

    documents = results["documents"][0]
    # Remove duplicates
    documents = deduplicate_chunks(documents)

    # Rerank retrieved chunks
    documents = rerank_chunks(query, documents)

    # Limit final context
    documents = documents[:5]

    formatted_chunks = []

    for idx, chunk in enumerate(documents):
        formatted_chunks.append(f"""
            Chunk {idx + 1}:
            {chunk}
            """)

    context = "\n\n".join(formatted_chunks)

    return context


def generate_rag_response(user_query: str):

    # Generate query embedding
    query_embedding = generate_embedding(user_query)

    # Retrieve relevant chunks
    results = search_similar_chunks(query_embedding)

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]

    expanded_context = []

    for metadata, chunk in zip(metadatas, documents):
        expanded_context.append(chunk)
        file_path = metadata.get("file_path")

        if not file_path:
            continue

        neighbors = get_graph_neighbors(file_path)

        if neighbors:
            expanded_context.append(f"""
                                    Related imports:
                                    {", ".join(neighbors)}
                                    """)

    # Build context
    context = "\n\n".join(expanded_context)

    # Construct grounded prompt
    prompt = f"""
        You are RepoGraph AI,
        an expert repository analysis assistant.

        Analyze the repository context carefully.

        Answer ONLY using repository context.

        If the answer is not present in the context,
        say:
        "I could not find relevant repository information."

        Repository Context:
        {context}

        User Question:
        {user_query}
        """

    # Generate grounded response
    response = generate_response(prompt)

    return {"response": response, "retrieved_chunks": results["documents"][0]}
