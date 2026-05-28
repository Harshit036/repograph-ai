from app.agents.tools import TOOLS, semantic_search
from app.services.llm_service import generate_response


def extract_facts(step: str, results: list) -> list:
    if not results:
        return []

    context = "\n".join(results[:3])

    prompt = f"""Extract 1-2 key facts from this repository evidence.

Investigation step: {step}

Evidence:
{context}

Return ONLY brief factual statements, one per line.
Example: "generate_embedding uses all-MiniLM-L6-v2 model"
Example: "rag_service calls embedding_service and vector_db_service"
"""
    response = generate_response(prompt)
    return [line.strip() for line in response.strip().split("\n") if line.strip()]


def generate_plan(user_query: str, memory: dict = None):
    known = (
        "\n".join(memory["discovered_facts"])
        if memory and memory["discovered_facts"]
        else "Nothing yet."
    )
    searched = (
        ", ".join(memory["searched_queries"])
        if memory and memory["searched_queries"]
        else "None."
    )

    prompt = f"""You are an autonomous repository analysis planner.

What I already know:
{known}

Queries already searched (do NOT repeat these):
{searched}

Generate a short investigation plan targeting MISSING information.

Rules:
- Concise steps
- Focus on repository analysis
- Maximum 4 steps
- One step per line
- Do not repeat already searched queries

User Request:
{user_query}"""

    response = generate_response(prompt)
    return response.split("\n")


def choose_tool(user_query: str):
    prompt = f"""You are an AI repository agent.

Choose ONE tool.

Available tools:

1. semantic_search
Use for broad conceptual repository search.

2. keyword_search
Use for exact keyword matching.

Return ONLY this format:
tool_name:input

Examples:
semantic_search:routing flow
keyword_search:middleware

User request:
{user_query}"""

    response = generate_response(prompt)
    return response.strip()


def reflect_on_observations(user_query: str, observations: list, memory: dict = None):
    known = (
        "\n".join(memory["discovered_facts"])
        if memory and memory["discovered_facts"]
        else ""
    )
    context = "\n\n".join(observations[:5])

    prompt = f"""You are evaluating repository evidence.

User Goal:
{user_query}

Known facts:
{known}

Additional Repository Evidence:
{context}

Answer ONLY:
YES → enough information exists
NO → more investigation needed"""

    response = generate_response(prompt)
    return "YES" in response.upper()


def replan(user_query: str, observations: list, memory: dict = None):
    known = (
        "\n".join(memory["discovered_facts"])
        if memory and memory["discovered_facts"]
        else "Nothing yet."
    )
    searched = (
        ", ".join(memory["searched_queries"])
        if memory and memory["searched_queries"]
        else "None."
    )
    context = "\n\n".join(observations[:3])

    prompt = f"""You are an autonomous repository agent. The investigation is incomplete.

User Goal:
{user_query}

What I already know:
{known}

Already searched (do NOT repeat):
{searched}

Current Evidence:
{context}

Generate a NEW investigation plan targeting MISSING information.

Rules:
- Maximum 3 steps
- One step per line
- Focus on missing information
- Do not repeat already searched queries"""

    response = generate_response(prompt)
    return response.split("\n")


def self_correct(user_query: str, observations: list, memory: dict = None) -> dict:
    known = (
        "\n".join(memory["discovered_facts"])
        if memory and memory["discovered_facts"]
        else "Nothing yet."
    )
    context = "\n\n".join(observations[:5])

    prompt = f"""You are a critical reviewer of a repository investigation.

User Goal:
{user_query}

Known Facts:
{known}

Current Evidence:
{context}

Critically analyze this investigation. Identify:
1. GAPS: What important information is still missing?
2. CONTRADICTIONS: Are there any conflicting pieces of evidence?
3. FOLLOW_UP: List 1-2 specific search queries that would fill the most critical gaps.

Return in this exact format:
GAPS: <comma-separated list, or "none">
CONTRADICTIONS: <comma-separated list, or "none">
FOLLOW_UP: <comma-separated search queries, or "none">"""

    response = generate_response(prompt)

    result = {"gaps": [], "contradictions": [], "follow_up_queries": []}

    for line in response.strip().split("\n"):
        line = line.strip()
        if line.upper().startswith("GAPS:"):
            value = line[5:].strip()
            if value.lower() != "none":
                result["gaps"] = [g.strip() for g in value.split(",") if g.strip()]
        elif line.upper().startswith("CONTRADICTIONS:"):
            value = line[15:].strip()
            if value.lower() != "none":
                result["contradictions"] = [
                    c.strip() for c in value.split(",") if c.strip()
                ]
        elif line.upper().startswith("FOLLOW_UP:"):
            value = line[10:].strip()
            if value.lower() != "none":
                result["follow_up_queries"] = [
                    q.strip() for q in value.split(",") if q.strip()
                ]

    return result


def repository_agent(user_query: str):
    memory = {"discovered_facts": [], "searched_queries": []}
    observations = []
    actions = []

    current_plan = generate_plan(user_query, memory)
    actions.append("Generated initial plan")

    for iteration in range(3):
        actions.append(f"Iteration {iteration + 1}")

        for step in current_plan:
            step = step.strip()
            if not step:
                continue

            tool_decision = choose_tool(step)
            try:
                tool_name, tool_input = tool_decision.split(":", 1)
                tool_input = tool_input.strip()
            except ValueError:
                continue

            if tool_input in memory["searched_queries"]:
                actions.append(f"Skipped (already searched): {tool_input}")
                continue

            actions.append(f"Tool: {tool_name} | Input: {tool_input}")
            memory["searched_queries"].append(tool_input)

            try:
                if tool_name == "keyword_search":
                    repository_chunks = semantic_search(user_query)
                    result = TOOLS[tool_name](tool_input, repository_chunks)
                else:
                    result = TOOLS[tool_name](tool_input)
            except Exception:
                actions.append("Tool execution failed")
                continue

            observations.extend(result)

            facts = extract_facts(step, result)
            memory["discovered_facts"].extend(facts)
            actions.append(f"Learned: {'; '.join(facts)}")

        critique = self_correct(user_query, observations, memory)

    if critique["gaps"]:
        actions.append(f"Gaps: {'; '.join(critique['gaps'])}")
    if critique["contradictions"]:
        actions.append(f"Contradictions: {'; '.join(critique['contradictions'])}")

    for follow_up in critique["follow_up_queries"]:
        follow_up = follow_up.strip()
        if not follow_up or follow_up in memory["searched_queries"]:
            continue

        actions.append(f"Self-correction search: {follow_up}")
        memory["searched_queries"].append(follow_up)

        try:
            result = TOOLS["semantic_search"](follow_up)
            observations.extend(result)
            facts = extract_facts(follow_up, result)
            memory["discovered_facts"].extend(facts)
            actions.append(f"Correction learned: {'; '.join(facts)}")
        except Exception:
            actions.append(f"Self-correction search failed: {follow_up}")

    enough = reflect_on_observations(user_query, observations, memory)
    if enough:
        actions.append("Reflection: enough evidence")
    else:
        actions.append("Reflection: replanning")
        current_plan = replan(user_query, observations, memory)

    known_facts = "\n".join(memory["discovered_facts"])
    context = "\n\n".join(list(set(observations))[:8])

    prompt = f"""You are RepoGraph AI Agent.

Discovered Facts:
{known_facts}

Repository Evidence:
{context}

User Question:
{user_query}

Provide:
- implementation explanation
- architecture insights
- execution flow"""

    response = generate_response(prompt)
    return {"response": response, "actions": actions, "memory": memory}
