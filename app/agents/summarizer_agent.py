from app.services.llm_service import generate_response


def summarize(context: dict) -> str:
    known_facts = "\n".join(context["memory"]["discovered_facts"])
    evidence = "\n\n".join(list(set(context["observations"]))[:8])

    prompt = f"""You are RepoGraph AI Agent.

Discovered Facts:
{known_facts}

Repository Evidence:
{evidence}

User Question:
{context["query"]}

Provide:
- implementation explanation
- architecture insights
- execution flow"""

    return generate_response(prompt)
