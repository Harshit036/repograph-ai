from app.agents.tools import TOOLS, semantic_search
from app.services.llm_service import generate_response


def _choose_tool(step: str) -> tuple:
    prompt = f"""Choose ONE tool for this repository investigation step.

Available tools:
1. semantic_search - broad conceptual search
2. keyword_search  - exact keyword matching

Return ONLY: tool_name:input
Examples:
semantic_search:embedding pipeline
keyword_search:generate_embedding

Step: {step}"""

    try:
        tool_name, tool_input = generate_response(prompt).strip().split(":", 1)
        return tool_name.strip(), tool_input.strip()
    except ValueError:
        return "semantic_search", step


def _extract_facts(step: str, results: list) -> list:
    if not results:
        return []
    prompt = f"""Extract 1-2 key facts from this repository evidence.

Step: {step}
Evidence:
{chr(10).join(results[:3])}

Return ONLY brief factual statements, one per line."""
    response = generate_response(prompt)
    return [l.strip() for l in response.strip().split("\n") if l.strip()]


def retrieve(step: str, context: dict) -> None:
    memory = context["memory"]
    tool_name, tool_input = _choose_tool(step)

    if tool_input in memory["searched_queries"]:
        context["actions"].append(f"Skipped (already searched): {tool_input}")
        return

    context["actions"].append(f"Retriever — {tool_name}: {tool_input}")
    memory["searched_queries"].append(tool_input)

    try:
        if tool_name == "keyword_search":
            chunks = semantic_search(context["query"])
            results = TOOLS["keyword_search"](tool_input, chunks)
        else:
            results = TOOLS["semantic_search"](tool_input)
    except Exception:
        context["actions"].append("Retriever: tool execution failed")
        return

    context["observations"].extend(results)
    facts = _extract_facts(step, results)
    context["memory"]["discovered_facts"].extend(facts)
    context["actions"].append(f"Retriever learned: {'; '.join(facts)}")
