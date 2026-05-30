import threading
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.user_context import get_user_id
from app.db.migrations import (
    delete_repo_embeddings, get_repo_entry, get_user_repos,
    upsert_repo_entry, upsert_user, save_graph_for_user,
)
from app.services.graph_service import build_repository_graph
from app.services.repo_service import (
    cleanup_repository, clone_repository, get_remote_head_sha,
    repo_id_from_url, scan_repository,
)
from app.services.llm_service import generate_response
from app.storage.user_stores import clear_user_repo, get_graph, set_graph


router = APIRouter()


def _generate_and_save_summary(database_url: str, user_id: str, repo_url: str,
                                rid: str, repository_data: list) -> None:
    """Run in a background thread — generate repo summary and update DB row."""
    try:
        lines = [f"Repository: {repo_url}", f"Total files: {len(repository_data)}", ""]
        for f in repository_data[:30]:
            fns = [c.get("function_name") for c in f.get("chunks", []) if c.get("function_name")]
            fn_str = ", ".join(fns[:8]) if fns else "(no functions)"
            lines.append(f"- {f['file_name']}: {fn_str}")
        manifest = "\n".join(lines)

        prompt = f"""Summarise this software repository in 150-200 words for a code analysis assistant.
Cover: what the project does, its main technology stack, key modules/services, and overall architecture pattern.
Be specific and factual. Do not use markdown headers.

Repository manifest:
{manifest}

Summary:"""
        summary = generate_response(prompt)

        import psycopg2
        url = database_url.replace("postgresql+psycopg2://", "")
        user_pass, rest = url.split("@")
        user, password = user_pass.split(":")
        host_port, dbname = rest.split("/")
        host, port = (host_port.split(":") + ["5432"])[:2]
        conn = psycopg2.connect(host=host, port=int(port), dbname=dbname,
                                user=user, password=password)
        cur = conn.cursor()
        cur.execute(
            "UPDATE user_repos SET repo_summary = %s WHERE user_id = %s AND repo_id = %s",
            (summary, user_id, rid)
        )
        conn.commit()
        cur.close()
        conn.close()
        print(f"Repo summary saved for {repo_url}")
    except Exception as e:
        print(f"Background summary error: {e}")


class RepoRequest(BaseModel):
    repo_url: str
    github_login: str = ""
    avatar_url: str = ""


@router.post("/ingest-repo")
def ingest_repo(request: RepoRequest):
    user_id  = get_user_id()
    repo_url = request.repo_url.strip()
    rid      = repo_id_from_url(repo_url)
    settings = get_settings()

    if request.github_login:
        upsert_user(settings.database_url, user_id, request.github_login, request.avatar_url)

    remote_sha = get_remote_head_sha(repo_url)
    existing   = get_repo_entry(settings.database_url, user_id, rid)

    if existing and remote_sha and existing["commit_sha"] == remote_sha:
        return {
            "skipped":     True,
            "message":     "Repository is up to date — no new commits since last ingest.",
            "total_files": existing["file_count"],
            "files":       [],
        }

    delete_repo_embeddings(settings.database_url, user_id, rid)
    clear_user_repo(user_id, rid)

    repo_path, is_temp = clone_repository(repo_url)
    try:
        repository_data = scan_repository(repo_path, user_id, rid, remote_sha or "")
        graph_data = build_repository_graph(repository_data)
        merged_graph = {**get_graph(user_id), **graph_data}
        set_graph(user_id, merged_graph)
        # Persist graph to DB so it survives container restarts
        save_graph_for_user(settings.database_url, user_id, merged_graph)
    finally:
        if is_temp:
            cleanup_repository(repo_path)

    file_count  = len(repository_data)
    chunk_count = sum(len(f["chunks"]) for f in repository_data)

    # Save without summary first so the response returns immediately
    upsert_repo_entry(
        settings.database_url, user_id, repo_url, rid,
        remote_sha or "", file_count, chunk_count, "",
    )

    # Generate summary in background — doesn't block the response
    threading.Thread(
        target=_generate_and_save_summary,
        args=(settings.database_url, user_id, repo_url, rid, repository_data),
        daemon=True,
    ).start()

    return {
        "skipped":     False,
        "total_files": file_count,
        "files": [
            {"file_name": f["file_name"], "total_chunks": len(f["chunks"])}
            for f in repository_data
        ],
    }


@router.get("/my-repos")
def my_repos():
    user_id  = get_user_id()
    settings = get_settings()
    return get_user_repos(settings.database_url, user_id)


@router.delete("/repo/{repo_id}")
def delete_repo(repo_id: str):
    user_id  = get_user_id()
    settings = get_settings()
    # Remove embeddings from pgvector
    delete_repo_embeddings(settings.database_url, user_id, repo_id)
    # Remove from user_repos table
    _delete_repo_row(settings.database_url, user_id, repo_id)
    # Clear in-memory stores
    clear_user_repo(user_id, repo_id)
    return {"deleted": True}


def _delete_repo_row(database_url: str, user_id: str, repo_id: str) -> None:
    import psycopg2
    try:
        url = database_url.replace("postgresql+psycopg2://", "")
        user_pass, rest = url.split("@")
        user, password = user_pass.split(":")
        host_port, dbname = rest.split("/")
        host, port = (host_port.split(":") + ["5432"])[:2]
        conn = psycopg2.connect(host=host, port=int(port), dbname=dbname, user=user, password=password)
        cur = conn.cursor()
        cur.execute("DELETE FROM user_repos WHERE user_id = %s AND repo_id = %s", (user_id, repo_id))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"delete_repo_row error: {e}")
