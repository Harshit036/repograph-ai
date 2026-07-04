from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services.embedding_service import generate_embedding
from app.services.vector_db_service import search_similar_chunks

router = APIRouter()


class SearchRequest(BaseModel):
    query: str


@router.post("/search")
def search(request: SearchRequest):
    query_embedding = generate_embedding(request.query)
    return search_similar_chunks(query_embedding)


@router.get("/search/global")
def global_search(q: str = Query(..., min_length=1)):
    """Search file names, function names, and code across all ingested repos."""
    from app.core.user_context import get_user_id
    from app.core.config import get_settings
    from app.db.neo4j import get_driver
    from app.services.graph_retrieval_service import _to_relative_path

    user_id  = get_user_id()
    settings = get_settings()
    q_lower  = q.lower()

    # ── 1. File name search (Neo4j File nodes) ────────────────────────────────
    file_results: list[dict] = []
    try:
        with get_driver().session() as session:
            result = session.run(
                """
                MATCH (f:File {user_id: $uid})
                WHERE f.path IS NOT NULL AND toLower(f.path) CONTAINS $q
                RETURN DISTINCT f.path AS path
                ORDER BY f.path LIMIT 20
                """,
                uid=user_id, q=q_lower,
            )
            for row in result:
                rel = _to_relative_path(row["path"])
                lang = rel.rsplit(".", 1)[-1] if "." in rel else "text"
                file_results.append({"file_path": row["path"], "display": rel, "language": lang})
    except Exception as e:
        print(f"global_search file error: {e}")

    # ── 2. Function / class name search (Neo4j) ────────────────────────────────
    func_results: list[dict] = []
    try:
        with get_driver().session() as session:
            result = session.run(
                """
                MATCH (f:Function {user_id: $uid})
                WHERE toLower(f.name) CONTAINS $q
                  AND f.file_path IS NOT NULL AND f.file_path <> 'unknown'
                RETURN f.name AS name, f.file_path AS file_path, f.start_line AS line
                ORDER BY f.name LIMIT 20
                """,
                uid=user_id, q=q_lower,
            )
            for row in result:
                func_results.append({
                    "name": row["name"],
                    "file_path": row["file_path"],
                    "display": _to_relative_path(row["file_path"]),
                    "line": row["line"] or 0,
                })
    except Exception as e:
        print(f"global_search function error: {e}")

    # ── 3. Semantic code search (pgvector top-5) ───────────────────────────────
    code_results: list[dict] = []
    try:
        emb  = generate_embedding(q)
        hits = search_similar_chunks(emb, user_id=user_id, top_k=5)
        for doc, meta in zip(hits["documents"][0], hits["metadatas"][0]):
            code_results.append({
                "file_path": meta.get("file_path", ""),
                "display":   _to_relative_path(meta.get("file_path", "")),
                "line":      meta.get("start_line", 0),
                "snippet":   doc[:300],
            })
    except Exception as e:
        print(f"global_search code error: {e}")

    return {"files": file_results, "functions": func_results, "code": code_results}
