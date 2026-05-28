import ollama
from app.core.config import get_settings


def generate_response(prompt: str):
    settings = get_settings()
    client = ollama.Client(host=settings.ollama_base_url)
    response = client.chat(
        model=settings.ollama_model,
        messages=[{"role": "user", "content": prompt}],
    )
    return response["message"]["content"]

