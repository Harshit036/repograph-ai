import os
from collections import Counter
from app.core.user_context import get_user_id
from app.services.graph_retrieval_service import get_active_graph
from app.services.llm_service import generate_response
from app.services.architecture_service import format_graph_for_prompt


def find_entry_points(graph: dict) -> list:
    entry_points = []

    for file_path, node in graph.items():
        reasons = []
        # functions may be strings (Neo4j) or dicts (legacy) — normalise
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
                "file": os.path.relpath(file_path) if file_path != "unknown" else file_path,
                "reasons": reasons,
            })

    return entry_points


def compute_in_degree(graph: dict) -> dict:
    counter = Counter()

    for _, node in graph.items():
        for imp in node.get("imports", []):
            counter[imp] += 1

    return dict(counter)


def generate_onboarding_guide() -> dict:
    graph = get_active_graph(get_user_id())
    if not graph:
        return {
            "guide": "⚠️ Graph data is not available. Please click **Analyze** on your repository in the left panel to rebuild the index.",
            "entry_points": [],
        }

    entry_points = find_entry_points(graph)
    in_degree    = compute_in_degree(graph)

    top_core = sorted(in_degree.items(), key=lambda x: x[1], reverse=True)[:10]

    entry_text = (
        "\n".join(f"- {ep['file']} ({', '.join(ep['reasons'])})" for ep in entry_points)
        or "None detected"
    )

    core_text = "\n".join(
        f"- {module} (imported {count} times)" for module, count in top_core
    )

    structure = format_graph_for_prompt(graph, limit=15)

    prompt = f"""You are an engineering mentor onboarding a new developer to a codebase.

Entry points (where the system starts):
{entry_text}

Core modules (most depended-upon):
{core_text}

Repository structure:
{structure}

Write a practical onboarding guide that includes:
1. What this codebase does in 2-3 sentences
2. Where to start reading and why
3. A suggested file reading order (5-8 files) with one line explaining each
4. Key concepts a new engineer needs to understand"""

    guide = generate_response(prompt)
    return {"guide": guide, "entry_points": entry_points}
