from app.core.user_context import get_user_id
from app.services.graph_retrieval_service import get_active_graph, _to_relative_path
from app.services.llm_service import generate_response


def format_graph_for_prompt(graph: dict, limit: int = 20) -> str:
    scored = []
    for file_path, node in graph.items():
        funcs = node.get("functions", [])
        func_names = [f if isinstance(f, str) else f.get("name", "") for f in funcs]
        if func_names:
            scored.append((file_path, node, func_names))

    scored.sort(key=lambda x: len(x[2]), reverse=True)

    lines = []
    for file_path, node, func_names in scored[:limit]:
        name    = _to_relative_path(file_path)
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

Given the repository structure below, write a well-formatted architecture summary with these sections:

## Overview
2–3 sentences describing the system's purpose and primary use case.

## Module Responsibilities
For each key file or module, one sentence on its role. Use inline `code` for file/directory names.

## Dependencies & Data Flow
How the main modules connect. Describe the flow from entry point to output. Use a simple ASCII diagram if it helps clarity.

## Key Design Patterns
Notable patterns used (e.g. service layer, repository pattern, event-driven, MVC).

Repository structure:
{formatted}

Use markdown throughout. Wrap all file paths in backticks. Use fenced code blocks (``` ) for any shell commands or code examples."""

    return {"summary": generate_response(prompt)}


def stream_architecture_summary():
    """Generator that yields LLM tokens for the architecture summary."""
    from app.services.llm_service import stream_response
    graph = get_active_graph(get_user_id())
    if not graph:
        yield "⚠️ Graph data is not available. Please click **Analyze** on your repository in the left panel to rebuild the index."
        return

    formatted = format_graph_for_prompt(graph)
    prompt = f"""You are a software architect reviewing a codebase.

Given the repository structure below, write a well-formatted architecture summary with these sections:

## Overview
2–3 sentences describing the system's purpose and primary use case.

## Module Responsibilities
For each key file or module, one sentence on its role. Use inline `code` for file/directory names.

## Dependencies & Data Flow
How the main modules connect. Describe the flow from entry point to output.

## Key Design Patterns
Notable patterns used (e.g. service layer, repository pattern, event-driven, MVC).

## Dependency Graph

After the written summary, output a Mermaid diagram showing the high-level module dependency flow. Use `graph TD` direction. Include only the top-level modules or directories (max 12 nodes). Name nodes by their folder/module name (no file extensions). Example format:

```mermaid
graph TD
    A[api] --> B[services]
    B --> C[db]
    A --> D[routes]
```

Repository structure:
{formatted}

Use markdown throughout. Wrap all file paths in backticks."""

    yield from stream_response(prompt)
