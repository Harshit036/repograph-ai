import os
from app.core.user_context import get_user_id
from app.services.graph_retrieval_service import get_active_graph
from app.services.llm_service import generate_response


def format_graph_for_prompt(graph: dict, limit: int = 20) -> str:
    scored = []
    for file_path, node in graph.items():
        funcs = node.get("functions", [])
        # functions may be strings (Neo4j) or dicts (legacy) — normalise to strings
        func_names = [f if isinstance(f, str) else f.get("name", "") for f in funcs]
        if func_names:
            scored.append((file_path, node, func_names))

    scored.sort(key=lambda x: len(x[2]), reverse=True)

    lines = []
    for file_path, node, func_names in scored[:limit]:
        name    = os.path.relpath(file_path) if file_path != "unknown" else file_path
        imports = ", ".join(set(node.get("imports", [])))
        lines += [
            f"File: {name}",
            f"  Functions: {', '.join(func_names)}",
            f"  Imports: {imports}",
            "",
        ]
    return "\n".join(lines)


def generate_architecture_summary() -> dict:
    graph = get_active_graph(get_user_id())
    if not graph:
        return {
            "summary": (
                "⚠️ Graph data is not available. "
                "Please click **Analyze** on your repository in the left panel to rebuild the index."
            )
        }

    formatted = format_graph_for_prompt(graph)
    prompt = f"""You are a software architect reviewing a codebase.

Given the repository structure below, provide:
1. A brief description of what each module/file is responsible for
2. How the modules depend on each other
3. The overall data flow from entry point to output

Repository structure:
{formatted}

Write a clear, concise architecture summary."""

    return {"summary": generate_response(prompt)}
