import ollama


def generate_response(prompt: str):

    response = ollama.chat(
        model="qwen2.5-coder:7b", messages=[{"role": "user", "content": prompt}]
    )

    return response["message"]["content"]
