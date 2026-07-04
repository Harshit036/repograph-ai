import json
from app.core.user_context import get_user_id
from app.services.embedding_service import generate_embedding
from app.services.graph_retrieval_service import get_graph_neighbors, _to_relative_path
from app.services.hybrid_retrieval_service import hybrid_search
from app.services.llm_service import generate_response, stream_response
from app.services.reranking_service import neural_rerank, semantic_deduplicate, mmr


def _get_repo_summary() -> str:
    """Load the active repo's summary from the in-memory registry."""
    try:
        from app.storage.user_stores import get_active_repo
        repo = get_active_repo(get_user_id())
        return repo.get("summary", "") if repo else ""
    except Exception:
        return ""


def _expand_query(user_query: str) -> list[str]:
    """Use the LLM to generate 2 alternative search phrasings for better recall."""
    try:
        prompt = f"""You are a code search assistant. Given a developer's question about a codebase, generate 2 alternative search queries that would help retrieve relevant code.
Return ONLY a JSON array of 2 strings, no explanation.

Question: {user_query}
Output:"""
        raw = generate_response(prompt)
        # Extract JSON array from response
        start = raw.find('[')
        end = raw.rfind(']') + 1
        if start != -1 and end > start:
            variants = json.loads(raw[start:end])
            return [str(v) for v in variants[:2]]
    except Exception:
        pass
    return []


def _build_prompt(user_query: str, context: str, history: list[dict], repo_summary: str) -> str:
    history_block = ""
    if history:
        lines = []
        for m in history[-6:]:  # last 6 turns
            role = "User" if m["role"] == "user" else "Assistant"
            lines.append(f"{role}: {m['content'][:400]}")
        history_block = "\nConversation History:\n" + "\n".join(lines) + "\n"

    summary_block = f"\nRepository Overview:\n{repo_summary}\n" if repo_summary else ""

    return f"""You are RepoGraph AI, an expert code analysis assistant. Answer clearly and thoroughly using the repository context below.

Formatting rules:
- Use **bold** for important terms, function names, and file names
- Use `backticks` for inline code, variable names, and paths
- Use numbered or bullet lists for steps and multiple items
- Use code blocks with language tags (```python, ```typescript, etc.) for code snippets
- Use headers (##, ###) to organize long answers
- Cite sources inline with [Source N] notation
- If the answer is not in the context, say: "I could not find relevant repository information for this."
{summary_block}{history_block}
Repository Context:
{context}

Question: {user_query}

Answer:"""


def generate_rag_response(user_query: str, messages: list[dict] | None = None,
                          repo_ids: list[str] | None = None) -> dict:
    query_embedding = generate_embedding(user_query)

    # Query expansion: merge results from original + expanded queries
    all_pairs: list[tuple] = []
    seen_docs: set[str] = set()
    for q in [user_query] + _expand_query(user_query):
        emb = generate_embedding(q) if q != user_query else query_embedding
        for pair in hybrid_search(q, emb, top_k=8, repo_ids=repo_ids or None):
            if pair[0] not in seen_docs:
                seen_docs.add(pair[0])
                all_pairs.append(pair)

    pairs = neural_rerank(user_query, all_pairs, top_k=8)
    pairs = semantic_deduplicate(pairs)
    pairs = mmr(user_query, pairs)

    context_parts = []
    citations = []
    for idx, (doc, meta) in enumerate(pairs):
        source_id = idx + 1
        file_name = meta.get("file_name", "unknown")
        file_path = meta.get("file_path", "")
        context_parts.append(f"[Source {source_id}: {file_name}]\n{doc}")
        citations.append({
            "source_id": source_id,
            "file": file_name,
            "file_path": file_path,
            "rel_path": _to_relative_path(file_path),
            "start_line": meta.get("start_line", 0),
            "end_line": meta.get("end_line", 0),
            "preview": doc[:200],
            "chunk_text": doc,
        })
        neighbors = get_graph_neighbors(file_path)
        if neighbors:
            context_parts.append(f"Related imports: {', '.join(neighbors)}")

    context = "\n\n".join(context_parts)
    repo_summary = _get_repo_summary()
    prompt = _build_prompt(user_query, context, messages or [], repo_summary)
    response = generate_response(prompt)
    return {"response": response, "citations": citations}


def stream_rag_response(user_query: str, messages: list[dict] | None = None,
                        repo_ids: list[str] | None = None):
    """Generator that yields SSE-formatted events: steps, citations, then tokens."""
    def _step(msg: str):
        return f"data: {json.dumps({'type': 'step', 'content': msg})}\n\n"

    yield _step("Expanding query…")
    query_embedding = generate_embedding(user_query)
    extra_queries = _expand_query(user_query)

    yield _step(f"Searching codebase ({1 + len(extra_queries)} query variants)…")
    all_pairs: list[tuple] = []
    seen_docs: set[str] = set()
    for q in [user_query] + extra_queries:
        emb = generate_embedding(q) if q != user_query else query_embedding
        for pair in hybrid_search(q, emb, top_k=8, repo_ids=repo_ids or None):
            if pair[0] not in seen_docs:
                seen_docs.add(pair[0])
                all_pairs.append(pair)

    yield _step(f"Reranking {len(all_pairs)} results…")
    pairs = neural_rerank(user_query, all_pairs, top_k=8)
    pairs = semantic_deduplicate(pairs)
    pairs = mmr(user_query, pairs)

    citations = []
    context_parts = []
    for idx, (doc, meta) in enumerate(pairs):
        source_id = idx + 1
        file_name = meta.get("file_name", "unknown")
        file_path = meta.get("file_path", "")
        context_parts.append(f"[Source {source_id}: {file_name}]\n{doc}")
        citations.append({
            "source_id": source_id,
            "file": file_name,
            "file_path": file_path,
            "rel_path": _to_relative_path(file_path),
            "start_line": meta.get("start_line", 0),
            "end_line": meta.get("end_line", 0),
            "preview": doc[:200],
            "chunk_text": doc,
        })
        neighbors = get_graph_neighbors(file_path)
        if neighbors:
            context_parts.append(f"Related imports: {', '.join(neighbors)}")

    # Emit citations so the frontend can display them
    yield f"data: {json.dumps({'type': 'citations', 'data': citations})}\n\n"

    yield _step("Generating response…")
    context = "\n\n".join(context_parts)
    repo_summary = _get_repo_summary()
    prompt = _build_prompt(user_query, context, messages or [], repo_summary)

    for token in stream_response(prompt):
        yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
