import os
from app.core.user_context import get_user_id
from app.storage.user_stores import get_graph
from app.services.llm_service import generate_response


def format_graph_for_prompt(graph: dict, limit: int = 20) -> str:
    scored = []
    for file_path, node in graph.items():
        func_count = len(node.get("functions", []))
        if func_count > 0:
            scored.append((file_path, node, func_count))

    scored.sort(key=lambda x: x[2], reverse=True)
    top_files = scored[:limit]

    lines = []
    for file_path, node, _ in top_files:
        name = os.path.relpath(file_path)
        functions = ", ".join(node.get("functions", []))
        imports = ", ".join(set(node.get("imports", [])))
        lines.append(f"File: {name}")
        lines.append(f"  Functions: {functions}")
        lines.append(f"  Imports: {imports}")
        lines.append("")

    return "\n".join(lines)


def generate_architecture_summary() -> dict:
    graph = get_graph(get_user_id())
    if not graph:
        return {"summary": "⚠️ Graph data is not available. Please click **Analyze** on your repository in the left panel to rebuild the index."}

    formatted = format_graph_for_prompt(graph)

    prompt = f"""You are a software architect reviewing a codebase.

Given the repository structure below, provide:
1. A brief description of what each module/file is responsible for
2. How the modules depend on each other
3. The overall data flow from entry point to output

Repository structure:
{formatted}

Write a clear, concise architecture summary."""

    summary = generate_response(prompt)
    return {"summary": summary}
