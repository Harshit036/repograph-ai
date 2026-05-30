from app.core.config import get_settings


def generate_response(prompt: str) -> str:
    settings = get_settings()

    if settings.llm_provider == "groq":
        return _groq_response(prompt, settings)
    return _ollama_response(prompt, settings)


def _ollama_response(prompt: str, settings) -> str:
    import ollama
    client = ollama.Client(host=settings.ollama_base_url)
    response = client.chat(
        model=settings.ollama_model,
        messages=[{"role": "user", "content": prompt}],
    )
    return response["message"]["content"]


def _groq_response(prompt: str, settings) -> str:
    from groq import Groq
    client = Groq(api_key=settings.groq_api_key)
    response = client.chat.completions.create(
        model=settings.groq_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    return response.choices[0].message.content
