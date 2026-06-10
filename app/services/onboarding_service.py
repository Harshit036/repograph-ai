from app.core.user_context import get_user_id
from app.services.graph_retrieval_service import get_active_graph, _get_latest_repo, _to_relative_path
from app.services.llm_service import generate_response
from app.services.orientation_service import read_orientation_data
from app.core.config import get_settings


def _get_readme_for_repo(user_id: str) -> str:
    """Fetch README content stored during ingest, falling back to empty string."""
    try:
        from app.db.migrations import get_repo_file_content, _get_conn
        settings = get_settings()
        repo = _get_latest_repo(user_id)
        if not repo:
            return ""
        # Try common README paths stored in repo_files
        for readme_name in ("README.md", "readme.md", "README.rst", "README.txt"):
            conn = _get_conn(settings.database_url)
            cur = conn.cursor()
            cur.execute(
                "SELECT content FROM repo_files WHERE user_id = %s AND repo_id = %s AND file_path LIKE %s LIMIT 1",
                (user_id, repo["repo_id"], f"%{readme_name}"),
            )
            row = cur.fetchone()
            cur.close()
            conn.close()
            if row:
                return row[0][:4000]
    except Exception:
        pass
    return ""


def generate_onboarding_guide() -> dict:
    user_id = get_user_id()
    graph   = get_active_graph(user_id)
    if not graph:
        return {
            "guide": "⚠️ Graph data is not available. Please click **Analyze** on your repository in the left panel to rebuild the index.",
            "entry_points": [],
        }

    readme = _get_readme_for_repo(user_id)

    # Detect entry points from graph
    entry_points = []
    for file_path, node in graph.items():
        reasons = []
        func_names = [
            f if isinstance(f, str) else f.get("name", "")
            for f in node.get("functions", [])
        ]
        imports = node.get("imports", [])
        if "main" in func_names:
            reasons.append("has main function")
        if "__main__" in func_names:
            reasons.append("has __main__ block")
        if len(imports) <= 2 and func_names:
            reasons.append("minimal dependencies")
        if "APIRouter" in str(imports):
            reasons.append("route entry point")
        if reasons:
            entry_points.append({
                "file": _to_relative_path(file_path),
                "reasons": reasons,
            })

    entry_text = (
        "\n".join(f"- {ep['file']} ({', '.join(ep['reasons'])})" for ep in entry_points)
        or "None detected"
    )

    readme_section = f"\nREADME content:\n{readme}\n" if readme else ""

    prompt = f"""You are an engineering mentor helping a new developer get started with a codebase.

Entry points detected:
{entry_text}
{readme_section}
Write a practical onboarding guide with these sections:

## What this project does
2–3 sentences describing the project and its purpose.

## Prerequisites
List the required tools, runtimes, and package managers (e.g. Python 3.11+, Node 18+, Docker). Use inline `code` for version strings and tool names.

## How to run locally
Numbered step-by-step setup instructions. Extract commands directly from the README when available. Wrap every shell command in a fenced code block:

```bash
# example
npm install && npm run dev
```

## Key files to explore first
4–6 files, each with one sentence explaining its role. Use inline `code` for file paths.

Use markdown throughout. Fenced code blocks for all commands and code snippets. Inline `backticks` for file paths, environment variables, and function names."""

    guide = generate_response(prompt)
    return {"guide": guide, "entry_points": entry_points}


def stream_onboarding_guide():
    """Generator yielding SSE event dicts: entry_points first, then guide tokens."""
    from app.services.llm_service import stream_response
    user_id = get_user_id()
    graph   = get_active_graph(user_id)
    if not graph:
        yield {"type": "entry_points", "data": []}
        yield {"type": "token", "content": "⚠️ Graph data is not available. Please click **Analyze** on your repository in the left panel."}
        return

    readme = _get_readme_for_repo(user_id)

    entry_points = []
    for file_path, node in graph.items():
        reasons = []
        func_names = [f if isinstance(f, str) else f.get("name", "") for f in node.get("functions", [])]
        imports = node.get("imports", [])
        if "main" in func_names: reasons.append("has main function")
        if "__main__" in func_names: reasons.append("has __main__ block")
        if len(imports) <= 2 and func_names: reasons.append("minimal dependencies")
        if "APIRouter" in str(imports): reasons.append("route entry point")
        if reasons:
            entry_points.append({"file": _to_relative_path(file_path), "reasons": reasons})

    yield {"type": "entry_points", "data": entry_points}

    entry_text = (
        "\n".join(f"- {ep['file']} ({', '.join(ep['reasons'])})" for ep in entry_points)
        or "None detected"
    )
    readme_section = f"\nREADME content:\n{readme}\n" if readme else ""

    prompt = f"""You are an engineering mentor helping a new developer get started with a codebase.

Entry points detected:
{entry_text}
{readme_section}
Write a practical onboarding guide with these sections:

## What this project does
2–3 sentences describing the project and its purpose.

## Prerequisites
List the required tools, runtimes, and package managers (e.g. Python 3.11+, Node 18+, Docker). Use inline `code` for version strings and tool names.

## How to run locally
Numbered step-by-step setup instructions. Extract commands directly from the README when available. Wrap every shell command in a fenced code block:

```bash
# example
npm install && npm run dev
```

## Key files to explore first
4–6 files, each with one sentence explaining its role. Use inline `code` for file paths.

Use markdown throughout. Fenced code blocks for all commands and code snippets. Inline `backticks` for file paths, environment variables, and function names."""

    yield from ({"type": "token", "content": chunk} for chunk in stream_response(prompt))
