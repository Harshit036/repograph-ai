from app.core.config import get_settings
from app.core.llm_context import get_llm_config


# Default models per provider (shown as suggestions in the UI)
PROVIDER_DEFAULTS: dict[str, str] = {
    "groq": "llama-3.3-70b-versatile",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-haiku-4-5-20251001",
    "ollama": "qwen2.5-coder:7b",
}


def generate_response(prompt: str) -> str:
    """Generate an LLM response using per-request config (from X-LLM-* headers)
    or fall back to server-side environment config."""
    config = get_llm_config()

    if config and config.provider:
        return _langchain_response(prompt, config.provider, config.model, config.api_key)

    settings = get_settings()
    if settings.llm_provider == "groq":
        return _langchain_response(prompt, "groq", settings.groq_model, settings.groq_api_key)
    return _langchain_response(prompt, "ollama", settings.ollama_model, None)


def stream_response(prompt: str):
    """Yield LLM response tokens as a generator."""
    config = get_llm_config()
    settings = get_settings()

    if config and config.provider:
        provider, model, api_key = config.provider, config.model, config.api_key
    elif settings.llm_provider == "groq":
        provider, model, api_key = "groq", settings.groq_model, settings.groq_api_key
    else:
        provider, model, api_key = "ollama", settings.ollama_model, None

    from langchain_core.messages import HumanMessage
    llm = _build_llm(provider, model, api_key)
    for chunk in llm.stream([HumanMessage(content=prompt)]):
        if chunk.content:
            yield chunk.content


def _langchain_response(prompt: str, provider: str, model: str, api_key: str | None) -> str:
    llm = _build_llm(provider, model, api_key)
    from langchain_core.messages import HumanMessage
    result = llm.invoke([HumanMessage(content=prompt)])
    return result.content


def _build_llm(provider: str, model: str, api_key: str | None):
    settings = get_settings()
    effective_model = model or PROVIDER_DEFAULTS.get(provider, "")

    match provider:
        case "groq":
            from langchain_groq import ChatGroq
            return ChatGroq(
                model=effective_model,
                api_key=api_key or settings.groq_api_key or None,
                temperature=0.2,
            )
        case "openai":
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model=effective_model,
                api_key=api_key,
                temperature=0.2,
            )
        case "anthropic":
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(
                model=effective_model,
                api_key=api_key,
                temperature=0.2,
            )
        case "ollama":
            from langchain_ollama import ChatOllama
            return ChatOllama(
                model=effective_model,
                base_url=settings.ollama_base_url,
                temperature=0.2,
            )
        case _:
            raise ValueError(f"Unknown LLM provider: {provider!r}")
