from app.core.user_context import get_user_id
from app.services.graph_retrieval_service import get_active_graph, _get_latest_repo, _to_relative_path
from app.services.llm_service import generate_response


# Paths that should never be treated as entry points.
_SKIP_PATHS = (
    "node_modules", "/venv/", "/.venv/", "site-packages",
    "__pycache__", "/dist/", "/build/", "/vendor/", "/.tox/",
    ".egg-info", "/eggs/", "/migrations/",
)

# Filenames that are conventional application entry points.
_ENTRY_FILENAMES = {
    "main.py", "__main__.py", "app.py", "manage.py", "cli.py", "wsgi.py", "asgi.py",
    "index.ts", "index.js", "server.ts", "server.js", "main.ts", "main.go",
}


def _is_test_path(path: str) -> bool:
    p = path.lower()
    return "test" in p or "spec" in p or "/conftest" in p


def _get_readme_for_repo(user_id: str) -> str:
    """README captured during ingest, stored on the in-memory active repo record."""
    try:
        repo = _get_latest_repo(user_id)
        return (repo or {}).get("readme", "")[:4000]
    except Exception:
        return ""


def _detect_entry_points(graph: dict) -> list[dict]:
    """Detect real entry points from the graph.

    Deliberately excludes test files and vendored code. The old "minimal
    dependencies" heuristic was dropped because it flagged every small test
    file — low import count is not a signal of being an entry point.
    """
    entry_points: list[dict] = []
    for file_path, node in graph.items():
        if _is_test_path(file_path) or any(s in file_path for s in _SKIP_PATHS):
            continue

        rel = _to_relative_path(file_path)
        filename = rel.split("/")[-1].lower()
        func_names = [
            f if isinstance(f, str) else f.get("name", "")
            for f in node.get("functions", [])
        ]
        imports = node.get("imports", [])

        reasons: list[str] = []
        if "main" in func_names:
            reasons.append("has main() function")
        if "__main__" in func_names:
            reasons.append("has __main__ block")
        if filename in _ENTRY_FILENAMES:
            reasons.append("conventional entry-point filename")
        if "APIRouter" in str(imports) or "FastAPI" in str(imports) or "Flask" in str(imports):
            reasons.append("web route / app entry point")

        if reasons:
            entry_points.append({"file": rel, "reasons": reasons})

    return entry_points


def _build_prompt(entry_points: list[dict], readme: str) -> str:
    entry_text = (
        "\n".join(f"- {ep['file']} ({', '.join(ep['reasons'])})" for ep in entry_points)
        or "None detected"
    )
    readme_section = f"\nREADME content:\n{readme}\n" if readme else ""

    return f"""You are an engineering mentor helping a new developer get started with a codebase.

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


def generate_onboarding_guide() -> dict:
    user_id = get_user_id()
    graph   = get_active_graph(user_id)
    if not graph:
        return {
            "guide": "⚠️ Graph data is not available. Please click **Analyze** on your repository in the left panel to rebuild the index.",
            "entry_points": [],
        }

    entry_points = _detect_entry_points(graph)
    readme = _get_readme_for_repo(user_id)
    guide = generate_response(_build_prompt(entry_points, readme))
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

    entry_points = _detect_entry_points(graph)
    yield {"type": "entry_points", "data": entry_points}

    readme = _get_readme_for_repo(user_id)
    prompt = _build_prompt(entry_points, readme)
    yield from ({"type": "token", "content": chunk} for chunk in stream_response(prompt))
