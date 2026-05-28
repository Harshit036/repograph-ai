from app.services.llm_service import generate_response


def reflect(context: dict) -> bool:
    memory = context["memory"]
    known = "\n".join(memory["discovered_facts"]) if memory["discovered_facts"] else ""
    evidence = "\n\n".join(context["observations"][:5])

    prompt = f"""You are evaluating repository evidence.

User Goal: {context["query"]}

Known facts:
{known}

Evidence:
{evidence}

Answer ONLY:
YES → enough information exists
NO → more investigation needed"""

    return "YES" in generate_response(prompt).upper()


def critique(context: dict) -> dict:
    memory = context["memory"]
    known = (
        "\n".join(memory["discovered_facts"])
        if memory["discovered_facts"]
        else "Nothing yet."
    )
    evidence = "\n\n".join(context["observations"][:5])

    prompt = f"""You are a critical reviewer of a repository investigation.

User Goal: {context["query"]}

Known Facts:
{known}

Current Evidence:
{evidence}

Identify:
GAPS: <comma-separated missing information, or "none">
CONTRADICTIONS: <comma-separated conflicts, or "none">
FOLLOW_UP: <1-2 search queries to fill gaps, or "none">"""

    response = generate_response(prompt)
    result = {"gaps": [], "contradictions": [], "follow_up_queries": []}

    for line in response.strip().split("\n"):
        line = line.strip()
        if line.upper().startswith("GAPS:"):
            v = line[5:].strip()
            if v.lower() != "none":
                result["gaps"] = [g.strip() for g in v.split(",") if g.strip()]
        elif line.upper().startswith("CONTRADICTIONS:"):
            v = line[15:].strip()
            if v.lower() != "none":
                result["contradictions"] = [
                    c.strip() for c in v.split(",") if c.strip()
                ]
        elif line.upper().startswith("FOLLOW_UP:"):
            v = line[10:].strip()
            if v.lower() != "none":
                result["follow_up_queries"] = [
                    q.strip() for q in v.split(",") if q.strip()
                ]

    return result
