from app.agents.tools import TOOLS, semantic_search

from app.services.llm_service import generate_response


def reflect_on_observations(user_query, observations):

    context = "\n\n".join(observations[:5])

    prompt = f"""
        You are evaluating repository evidence.

        User Goal:
        {user_query}

        Repository Evidence:
        {context}

        Answer ONLY:

        YES → enough information exists

        NO → more investigation needed
        """

    response = generate_response(prompt)
    return "YES" in response.upper()


def generate_plan(user_query: str):

    prompt = f"""
        You are an autonomous repository analysis planner.

        Given the user's request,
        generate a short investigation plan.

        Rules:
        - Use concise steps
        - Focus on repository analysis
        - Maximum 4 steps
        - One step per line

        User Request:
        {user_query}
        """

    response = generate_response(prompt)
    return response.split("\n")


def choose_tool(user_query: str):
    prompt = f"""
        You are an AI repository agent.

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
        {user_query}
        """

    response = generate_response(prompt)

    return response.strip()


def replan(user_query, observations):

    context = "\n\n".join(observations[:5])

    prompt = f"""
        You are an autonomous repository agent.

        The investigation is incomplete.

        User Goal:
        {user_query}

        Current Repository Evidence:
        {context}

        Generate a NEW investigation plan.

        Rules:
        - Maximum 3 steps
        - One step per line
        - Focus on missing information
        """

    response = generate_response(prompt)

    return response.split("\n")


def repository_agent(user_query: str):

    agent_memory = []
    observations = []
    current_plan = generate_plan(user_query)
    agent_memory.append("Generated initial plan")
    max_iterations = 3

    for iteration in range(max_iterations):
        agent_memory.append(f"Iteration {iteration+1}")
        for step in current_plan:
            step = step.strip()
            if not step:
                continue
            tool_decision = choose_tool(step)
            try:
                tool_name, tool_input = tool_decision.split(":", 1)
            except ValueError:
                continue

            agent_memory.append(f"Tool: {tool_name}")
            try:
                if tool_name == "keyword_search":
                    repository_chunks = semantic_search(user_query)
                    result = TOOLS[tool_name](tool_input, repository_chunks)
                else:
                    result = TOOLS[tool_name](tool_input)
            except Exception:
                agent_memory.append("Tool execution failed")
                continue
            observations.extend(result)

        enough_information = reflect_on_observations(user_query, observations)
        if enough_information:
            agent_memory.append("Reflection: enough evidence")
            break
        else:
            agent_memory.append("Reflection: replanning")
            current_plan = replan(user_query, observations)

    observations = list(set(observations))
    context = "\n\n".join(observations[:8])
    memory_context = "\n".join(agent_memory)
    prompt = f"""
        You are RepoGraph AI Agent.

        Actions Taken:
        {memory_context}

        Repository Evidence:
        {context}

        User Question:
        {user_query}

        Provide:
        - implementation explanation
        - architecture insights
        - execution flow
        """

    response = generate_response(prompt)
    return {"response": response, "actions": agent_memory}
