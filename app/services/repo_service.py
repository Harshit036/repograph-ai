import os
import shutil
import tempfile
from git import Repo
import uuid

from app.services.embedding_service import generate_embedding
from app.services.vector_db_service import store_chunk
from app.services.chunking_service import chunk_file
from app.storage.chunk_store import chunk_store

SUPPORTED_EXTENSIONS = [".py", ".js", ".ts", ".java", ".kt", ".cpp", ".c", ".go"]
IGNORE_DIRECTORIES   = ["node_modules", ".git", "dist", "build", "__pycache__", ".venv", "venv"]


def clone_repository(repo_url: str) -> tuple[str, bool]:
    """Clone to a temp directory. Returns (path, is_temp).
    Caller must call cleanup_repository(path) when done."""
    tmp = tempfile.mkdtemp(prefix="repograph_")
    Repo.clone_from(repo_url, tmp)
    return tmp, True


def cleanup_repository(path: str) -> None:
    """Delete the cloned repo directory after embeddings are extracted."""
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception as e:
        print(f"Cleanup warning: {e}")


def scan_repository(repo_path: str) -> list:
    repository_data = []
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRECTORIES]
        for file in files:
            if not any(file.endswith(ext) for ext in SUPPORTED_EXTENSIONS):
                continue

            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                ext    = os.path.splitext(file)[1]
                chunks = chunk_file(content, ext)

                if chunks:
                    for chunk in chunks:
                        embedding  = generate_embedding(chunk["content"])
                        chunk_id   = str(uuid.uuid4())
                        metadata   = {"file_path": file_path, "file_name": file}
                        store_chunk(chunk_id=chunk_id, embedding=embedding,
                                    content=chunk["content"], metadata=metadata)
                        chunk_store.append({"content": chunk["content"], "metadata": metadata})

                repository_data.append({
                    "file_name": file,
                    "file_path": file_path,
                    "content": content,
                    "chunks": chunks,
                })
            except Exception as e:
                print(f"Failed to read {file_path}: {e}")

    return repository_data
