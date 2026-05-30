from app.services.llm_service import generate_response


def summarize(context: dict) -> str:
    known_facts = "\n".join(context["memory"]["discovered_facts"])
    evidence = "\n\n".join(list(set(context["observations"]))[:8])

    history_block = ""
    if context.get("history"):
        lines = []
        for m in context["history"][-6:]:
            role = "User" if m["role"] == "user" else "Assistant"
            lines.append(f"{role}: {m['content'][:400]}")
        history_block = "\nConversation History:\n" + "\n".join(lines) + "\n"

    prompt = f"""You are RepoGraph AI Agent — an expert code analyst that synthesises multi-step investigation results into clear, thorough answers.

Formatting rules:
- Use **bold** for function names, file names, and important concepts
- Use `backticks` for inline code, variable names, and paths
- Use code blocks with language tags for code examples (```python, ```typescript, etc.)
- Use numbered lists for sequential steps and bullet lists for grouped items
- Use ## and ### headers to organise long answers
- Be specific: reference actual function names, file paths, and patterns found in evidence
{history_block}
Discovered Facts:
{known_facts}

Repository Evidence:
{evidence}

User Question: {context["query"]}

Provide a thorough answer covering:
- What the code does and how it works
- Key implementation details and patterns
- Relevant file/function relationships
- Any important caveats or edge cases found"""

    return generate_response(prompt)
