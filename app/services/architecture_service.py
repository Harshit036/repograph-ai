from app.core.user_context import get_user_id
from app.services.graph_retrieval_service import get_active_graph, _to_relative_path
from app.services.llm_service import generate_response


def _module_of(rel_path: str) -> str:
    """Containing module/directory for a repo-relative path.

    app/services/x.py → app/services;  app/main.py → app;  main.py → (root).
    """
    dirs = rel_path.split("/")[:-1]  # drop the filename
    if not dirs:
        return "(root)"
    # Cap at two leading segments so app/services and app/routes stay distinct
    # without exploding into deep nested module names.
    return "/".join(dirs[:2])


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


def build_module_mermaid(graph: dict, max_nodes: int = 12) -> str:
    """Deterministically build a module-level dependency diagram from the graph.

    Aggregates file→import edges up to the module (top-two-segment) level so the
    diagram is always valid Mermaid and reflects real imports rather than
    LLM-authored guesses.
    """
    edges: set[tuple[str, str]] = set()
    modules: set[str] = set()

    # Map imported module names to a repo module when they resolve to a repo path.
    file_modules = {_to_relative_path(fp): _module_of(_to_relative_path(fp)) for fp in graph}

    for file_path, node in graph.items():
        src_mod = _module_of(_to_relative_path(file_path))
        modules.add(src_mod)
        for imp in node.get("imports", []) or []:
            imp_norm = str(imp).replace(".", "/")
            target = None
            for rel, mod in file_modules.items():
                if imp_norm and (imp_norm in rel or rel.startswith(imp_norm)):
                    target = mod
                    break
            if target and target != src_mod:
                edges.add((src_mod, target))
                modules.add(target)

    # Cap node count: keep the most-connected modules.
    if len(modules) > max_nodes:
        degree: dict[str, int] = {m: 0 for m in modules}
        for a, b in edges:
            degree[a] = degree.get(a, 0) + 1
            degree[b] = degree.get(b, 0) + 1
        keep = set(sorted(modules, key=lambda m: degree.get(m, 0), reverse=True)[:max_nodes])
        modules = keep
        edges = {(a, b) for (a, b) in edges if a in keep and b in keep}

    if not modules:
        return ""

    ids = {m: f"n{i}" for i, m in enumerate(sorted(modules))}
    lines = ["```mermaid", "graph TD"]
    for m in sorted(modules):
        lines.append(f'    {ids[m]}["{m}"]')
    for a, b in sorted(edges):
        lines.append(f"    {ids[a]} --> {ids[b]}")
    lines.append("```")
    return "\n".join(lines)


_PROMPT_TEMPLATE = """You are a software architect reviewing a codebase.

Given the repository structure below, write a well-formatted architecture summary with these sections:

## Overview
2–3 sentences describing the system's purpose and primary use case.

## Module Responsibilities
For each key file or module, one sentence on its role. Use inline `code` for file/directory names.

## Key Design Patterns
Notable patterns used (e.g. service layer, repository pattern, event-driven, MVC).

## Insights
3–5 sharp observations a senior engineer would flag: coupling hotspots, modules with too many responsibilities, likely layering violations, and concrete refactor suggestions. Be specific and reference `module` names.

Repository structure:
{formatted}

Use markdown throughout. Wrap all file paths in backticks. Do NOT draw a diagram — a dependency diagram is rendered separately."""


def _no_graph_message() -> str:
    return (
        "⚠️ Graph data is not available. "
        "Please click **Analyze** on your repository in the left panel to rebuild the index."
    )


def generate_architecture_summary() -> dict:
    graph = get_active_graph(get_user_id())
    if not graph:
        return {"summary": _no_graph_message()}

    formatted = format_graph_for_prompt(graph)
    summary = generate_response(_PROMPT_TEMPLATE.format(formatted=formatted))
    diagram = build_module_mermaid(graph)
    parts = ["## Architecture Diagram", diagram, "", summary] if diagram else [summary]
    return {"summary": "\n".join(parts)}


def stream_architecture_summary():
    """Generator that yields the deterministic diagram first, then LLM insight tokens."""
    from app.services.llm_service import stream_response
    graph = get_active_graph(get_user_id())
    if not graph:
        yield _no_graph_message()
        return

    diagram = build_module_mermaid(graph)
    if diagram:
        yield "## Architecture Diagram\n\n"
        yield diagram
        yield "\n\n"

    formatted = format_graph_for_prompt(graph)
    yield from stream_response(_PROMPT_TEMPLATE.format(formatted=formatted))
