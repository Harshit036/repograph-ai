import threading
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.user_context import get_user_id
from app.db.migrations import delete_repo_embeddings, upsert_user
from app.services.graph_service import build_repository_graph, write_graph_to_neo4j
from app.services.orientation_service import read_orientation_data, build_orientation_context
from app.services.repo_service import (
    cleanup_repository, clone_repository, get_remote_head_sha,
    repo_id_from_url, scan_repository,
)
from app.services.llm_service import generate_response
from app.storage.user_stores import (
    clear_user_repo, set_active_repo, get_active_repo, update_active_repo_summary,
)


router = APIRouter()


def _generate_and_save_summary(user_id: str, repo_url: str, rid: str,
                                repository_data: list,
                                orientation_data: dict | None = None) -> None:
    """Run in a background thread — generate repo summary and store it in memory."""
    try:
        orientation_context = build_orientation_context(orientation_data) if orientation_data else ""

        lines = [f"Repository: {repo_url}", f"Total files: {len(repository_data)}", ""]
        for f in repository_data[:30]:
            fns = [c.get("name") for c in f.get("chunks", []) if c.get("name")]
            fn_str = ", ".join(fns[:8]) if fns else "(no functions)"
            lines.append(f"- {f['file_name']}: {fn_str}")
        manifest = "\n".join(lines)

        context_block = f"\n{orientation_context}\n" if orientation_context else ""
        prompt = f"""Summarise this software repository in 150-200 words for a code analysis assistant.
Cover: what the project does, its main technology stack, key modules/services, and overall architecture pattern.
Be specific and factual. Do not use markdown headers.
{context_block}
Repository manifest:
{manifest}

Summary:"""
        summary = generate_response(prompt)
        update_active_repo_summary(user_id, rid, summary)
        print(f"Repo summary saved for {repo_url}")
    except Exception as e:
        print(f"Background summary error: {e}")


class RepoRequest(BaseModel):
    repo_url: str
    github_login: str = ""
    avatar_url: str = ""
    github_token: str = ""


@router.get("/pr-diff")
def pr_diff(url: str):
    """Fetch changed files for a GitHub PR URL."""
    import re, httpx
    m = re.match(r'https?://github\.com/([^/]+)/([^/]+)/pull/(\d+)', url.strip())
    if not m:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/123")
    owner, repo, pr_num = m.group(1), m.group(2), m.group(3)
    api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_num}/files"
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "RepoGraphAI"}
    try:
        resp = httpx.get(api_url, headers=headers, timeout=15)
        resp.raise_for_status()
        files = resp.json()
        # Also fetch PR metadata
        pr_resp = httpx.get(f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_num}", headers=headers, timeout=10)
        pr_meta = pr_resp.json() if pr_resp.status_code == 200 else {}
        return {
            "title": pr_meta.get("title", f"PR #{pr_num}"),
            "number": int(pr_num),
            "body": pr_meta.get("body", ""),
            "repo": f"{owner}/{repo}",
            "files": [
                {
                    "filename": f["filename"],
                    "status": f["status"],          # added/modified/removed
                    "additions": f["additions"],
                    "deletions": f["deletions"],
                    "patch": f.get("patch", ""),    # unified diff text
                }
                for f in files
            ],
        }
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e}")


@router.post("/ingest-repo")
def ingest_repo(request: RepoRequest):
    user_id  = get_user_id()
    repo_url = request.repo_url.strip()
    rid      = repo_id_from_url(repo_url)
    settings = get_settings()

    if request.github_login:
        upsert_user(settings.database_url, user_id, request.github_login, request.avatar_url)

    github_token = request.github_token.strip()
    remote_sha = get_remote_head_sha(repo_url, github_token)
    existing   = get_active_repo(user_id)

    if (existing and remote_sha
            and existing.get("repo_id") == rid
            and existing.get("commit_sha") == remote_sha):
        return {
            "skipped":     True,
            "message":     "Repository is up to date — no new commits since last ingest.",
            "total_files": existing.get("file_count", 0),
            "commit_sha":  remote_sha,
            "files":       [],
        }

    delete_repo_embeddings(settings.database_url, user_id, rid)
    clear_user_repo(user_id, rid)

    repo_path, is_temp = clone_repository(repo_url, github_token)
    try:
        # Phase 1: orientation pass before full scan
        orientation_data = read_orientation_data(repo_path)

        repository_data = scan_repository(repo_path, user_id, rid, remote_sha or "")

        # Build graph, persist to Neo4j (replaces JSONB approach)
        graph_data = build_repository_graph(repository_data)
        write_graph_to_neo4j(user_id, rid, graph_data)
    finally:
        if is_temp:
            cleanup_repository(repo_path)

    file_count  = len(repository_data)
    chunk_count = sum(len(f["chunks"]) for f in repository_data)

    # Register the active repo in memory (replaces the old user_repos table).
    set_active_repo(user_id, {
        "repo_id":     rid,
        "repo_url":    repo_url,
        "commit_sha":  remote_sha or "",
        "file_count":  file_count,
        "chunk_count": chunk_count,
        "readme":      (orientation_data or {}).get("readme", ""),
        "summary":     "",
    })

    # Generate richer summary in background using orientation context
    threading.Thread(
        target=_generate_and_save_summary,
        args=(user_id, repo_url, rid, repository_data, orientation_data),
        daemon=True,
    ).start()

    return {
        "skipped":     False,
        "total_files": file_count,
        "commit_sha":  remote_sha or "",
        "files": [
            {"file_name": f["file_name"], "total_chunks": len(f["chunks"])}
            for f in repository_data
        ],
    }


@router.delete("/repo/{repo_id}")
def delete_repo(repo_id: str):
    user_id  = get_user_id()
    settings = get_settings()
    # Remove embeddings from pgvector and clear in-memory stores + Neo4j graph.
    delete_repo_embeddings(settings.database_url, user_id, repo_id)
    clear_user_repo(user_id, repo_id)
    return {"deleted": True}
