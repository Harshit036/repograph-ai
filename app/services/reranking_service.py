import numpy as np
from app.services.embedding_service import generate_embedding
from sentence_transformers import CrossEncoder

cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def neural_rerank(query: str, pairs: list, top_k: int = 5) -> list:
    if not pairs:
        return pairs

    inputs = [(query, doc) for doc, _ in pairs]
    scores = cross_encoder.predict(inputs)

    scored = sorted(zip(scores, pairs), key=lambda x: x[0], reverse=True)
    return [pair for _, pair in scored[:top_k]]


def semantic_deduplicate(pairs: list, threshold: float = 0.92) -> list:
    if len(pairs) <= 1:
        return pairs

    embeddings = np.array([generate_embedding(doc) for doc, _ in pairs])
    norms = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)

    kept = []
    kept_indices = []

    for i, pair in enumerate(pairs):
        too_similar = False
        for j in kept_indices:
            if float(norms[i] @ norms[j]) > threshold:
                too_similar = True
                break
        if not too_similar:
            kept.append(pair)
            kept_indices.append(i)

    return kept


def mmr(query: str, pairs: list, top_k: int = 5, lambda_param: float = 0.7) -> list:
    if len(pairs) <= top_k:
        return pairs

    query_embedding = np.array(generate_embedding(query))
    doc_embeddings = np.array([generate_embedding(doc) for doc, _ in pairs])

    query_norm = query_embedding / np.linalg.norm(query_embedding)
    doc_norms = doc_embeddings / np.linalg.norm(doc_embeddings, axis=1, keepdims=True)

    relevance_scores = doc_norms @ query_norm

    selected_indices = []
    remaining_indices = list(range(len(pairs)))

    while len(selected_indices) < top_k and remaining_indices:
        if not selected_indices:
            best_idx = remaining_indices[
                int(np.argmax([relevance_scores[i] for i in remaining_indices]))
            ]
        else:
            selected_norms = doc_norms[selected_indices]
            best_score = -float("inf")
            best_idx = remaining_indices[0]

            for idx in remaining_indices:
                relevance = float(relevance_scores[idx])
                redundancy = float(np.max(doc_norms[idx] @ selected_norms.T))
                score = lambda_param * relevance - (1 - lambda_param) * redundancy
                if score > best_score:
                    best_score = score
                    best_idx = idx

        selected_indices.append(best_idx)
        remaining_indices.remove(best_idx)

    return [pairs[i] for i in selected_indices]
