from contextvars import ContextVar
from dataclasses import dataclass


@dataclass
class LLMConfig:
    provider: str
    model: str
    api_key: str | None


_llm_config: ContextVar[LLMConfig | None] = ContextVar("llm_config", default=None)


def set_llm_config(config: LLMConfig) -> None:
    _llm_config.set(config)


def get_llm_config() -> LLMConfig | None:
    return _llm_config.get()
