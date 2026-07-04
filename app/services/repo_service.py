import hashlib
import os
import shutil
import subprocess
import tempfile
import uuid
from git import Repo

from app.services.embedding_service import generate_embedding
from app.services.vector_db_service import store_chunk
from app.services.chunking_service import chunk_file
from app.storage.user_stores import get_chunks

SUPPORTED_EXTENSIONS = [".py", ".js", ".ts", ".java", ".kt", ".cpp", ".c", ".go",
                        ".jsx", ".tsx", ".rs", ".rb", ".php", ".swift", ".cs", ".md"]

_LANG_MAP = {
    ".py": "python", ".js": "javascript", ".jsx": "javascript",
    ".ts": "typescript", ".tsx": "typescript", ".go": "go",
    ".java": "java", ".kt": "kotlin", ".rs": "rust", ".rb": "ruby",
    ".php": "php", ".swift": "swift", ".cs": "csharp",
    ".cpp": "cpp", ".c": "c", ".md": "markdown",
}
IGNORE_DIRECTORIES   = ["node_modules", ".git", "dist", "build", "__pycache__", ".venv", "venv"]


def repo_id_from_url(repo_url: str) -> str:
    """Stable short ID derived from the repo URL."""
    return hashlib.sha256(repo_url.strip().lower().encode()).hexdigest()[:16]


def _inject_token(repo_url: str, token: str) -> str:
    """Inject a GitHub token into a HTTPS URL for private repo access."""
    from urllib.parse import urlparse, urlunparse
    parsed = urlparse(repo_url)
    if parsed.scheme in ("http", "https") and token:
        return urlunparse(parsed._replace(netloc=f"{token}@{parsed.netloc}"))
    return repo_url


def get_remote_head_sha(repo_url: str, github_token: str = "") -> str | None:
    """Check the remote HEAD commit SHA without cloning (fast)."""
    try:
        authed_url = _inject_token(repo_url, github_token)
        result = subprocess.run(
            ["git", "ls-remote", authed_url, "HEAD"],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split()[0]
    except Exception as e:
        print(f"get_remote_head_sha failed: {e}")
    return None


def clone_repository(repo_url: str, github_token: str = "") -> tuple[str, bool]:
    tmp = tempfile.mkdtemp(prefix="repograph_")
    authed_url = _inject_token(repo_url, github_token)
    Repo.clone_from(authed_url, tmp)
    return tmp, True


def cleanup_repository(path: str) -> None:
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception as e:
        print(f"Cleanup warning: {e}")


def scan_repository(repo_path: str, user_id: str, repo_id: str, commit_sha: str) -> list:
    repository_data = []
    chunks = get_chunks(user_id)

    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRECTORIES]
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext not in SUPPORTED_EXTENSIONS:
                continue

            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                file_chunks = chunk_file(content, ext)

                if file_chunks:
                    for chunk in file_chunks:
                        embedding = generate_embedding(chunk["content"])
                        chunk_id  = str(uuid.uuid4())
                        metadata  = {
                            "file_path":  file_path,
                            "file_name":  file,
                            "user_id":    user_id,
                            "repo_id":    repo_id,
                            "commit_sha": commit_sha or "",
                            "start_line": chunk.get("start_line", 0),
                            "end_line":   chunk.get("end_line", 0),
                        }
                        store_chunk(chunk_id=chunk_id, embedding=embedding,
                                    content=chunk["content"], metadata=metadata)
                        chunks.append({"content": chunk["content"], "metadata": metadata})

                repository_data.append({
                    "file_name": file,
                    "file_path": file_path,
                    "content":   content,
                    "chunks":    file_chunks,
                })
            except Exception as e:
                print(f"Failed to read {file_path}: {e}")

    return repository_data
