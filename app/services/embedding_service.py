from sentence_transformers import SentenceTransformer
from app.core.config import get_settings

_settings = get_settings()
embedding_model = SentenceTransformer(_settings.embedding_model)


def generate_embedding(text: str) -> list:
    return embedding_model.encode(text).tolist()

