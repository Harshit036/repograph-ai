from app.services.llm_service import generate_response


def plan(context: dict) -> list:
    memory = context["memory"]
    known = (
        "\n".join(memory["discovered_facts"])
        if memory["discovered_facts"]
        else "Nothing yet."
    )
    searched = (
        ", ".join(memory["searched_queries"]) if memory["searched_queries"] else "None."
    )

    prompt = f"""You are an autonomous repository analysis planner.

What I already know:
{known}

Queries already searched (do NOT repeat these):
{searched}

Generate a short investigation plan targeting MISSING information.

Rules:
- Concise steps, one per line
- Maximum 4 steps
- Do not repeat already searched queries

User Request:
{context["query"]}"""

    return [s.strip() for s in generate_response(prompt).split("\n") if s.strip()]


def replan(context: dict) -> list:
    memory = context["memory"]
    known = (
        "\n".join(memory["discovered_facts"])
        if memory["discovered_facts"]
        else "Nothing yet."
    )
    searched = (
        ", ".join(memory["searched_queries"]) if memory["searched_queries"] else "None."
    )
    evidence = "\n\n".join(context["observations"][:3])

    prompt = f"""You are an autonomous repository agent. The investigation is incomplete.

User Goal:
{context["query"]}

What I already know:
{known}

Already searched (do NOT repeat):
{searched}

Current Evidence:
{evidence}

Generate a NEW investigation plan targeting MISSING information.
- Maximum 3 steps, one per line
- Do not repeat already searched queries"""

    return [s.strip() for s in generate_response(prompt).split("\n") if s.strip()]
