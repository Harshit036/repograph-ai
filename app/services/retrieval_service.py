def deduplicate_chunks(chunks):

    seen = set()
    unique_chunks = []

    for chunk in chunks:
        if chunk not in seen:
            seen.add(chunk)
            unique_chunks.append(chunk)

    return unique_chunks


def rerank_chunks(query, chunks):

    scored_chunks = []
    query_words = set(query.lower().split())

    for chunk in chunks:
        chunk_words = set(chunk.lower().split())
        overlap_score = len(query_words.intersection(chunk_words))
        scored_chunks.append((chunk, overlap_score))

    scored_chunks.sort(key=lambda x: x[1], reverse=True)
    reranked = [chunk for chunk, score in scored_chunks]

    return reranked
