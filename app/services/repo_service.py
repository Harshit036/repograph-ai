import os
from git import Repo
import uuid

from app.services.embedding_service import generate_embedding

from app.services.vector_db_service import store_chunk

from app.services.chunking_service import chunk_python_code

REPO_BASE_PATH = "repositories"

SUPPORTED_EXTENSIONS = [".py", ".js", ".ts", ".java", ".kt", ".cpp", ".c", ".go"]

IGNORE_DIRECTORIES = ["node_modules", ".git", "dist", "build", "__pycache__"]


def clone_repository(repo_url: str):
    os.makedirs(REPO_BASE_PATH, exist_ok=True)
    repo_name = repo_url.split("/")[-1].replace(".git", "")
    local_path = os.path.join(REPO_BASE_PATH, repo_name)
    # Avoid recloning
    if os.path.exists(local_path):
        return local_path

    Repo.clone_from(repo_url, local_path)
    return local_path


def scan_repository(repo_path: str):
    repository_data = []
    for root, dirs, files in os.walk(repo_path):
        # Ignore unnecessary folders
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRECTORIES]
        for file in files:
            # Ignore unsupported files
            if not any(file.endswith(ext) for ext in SUPPORTED_EXTENSIONS):
                continue

            file_path = os.path.join(root, file)

            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    chunks = []
                    # Chunk Python files
                    if file.endswith(".py"):
                        chunks = chunk_python_code(content)
                        for chunk in chunks:
                            embedding = generate_embedding(chunk["content"])
                            chunk_id = str(uuid.uuid4())
                            metadata = {
                                "file_path": file_path,
                                "file_name": file,
                            }
                            store_chunk(
                                chunk_id=chunk_id,
                                embedding=embedding,
                                content=chunk["content"],
                                metadata=metadata,
                            )

                    repository_data.append(
                        {
                            "file_name": file,
                            "file_path": file_path,
                            "content": content,
                            "chunks": chunks,
                        }
                    )
            except Exception as e:
                print(f"Failed to read {file_path}: {e}")

    return repository_data
