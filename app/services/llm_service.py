import ollama


def generate_response(user_message: str):
    response = ollama.chat(
        model="qwen2.5-coder:7b",
        messages=[
            {
                "role": "system",
                "content": "You are RepoGraph AI, an intelligent repository analysis assistant.",
            },
            {"role": "user", "content": user_message},
        ],
    )

    return response["message"]["content"]
