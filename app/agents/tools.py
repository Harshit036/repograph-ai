from app.services.embedding_service import generate_embedding

from app.services.vector_db_service import search_similar_chunks


def semantic_search(query: str):
    query_embedding = generate_embedding(query)
    results = search_similar_chunks(query_embedding)
    return results["documents"][0]


def keyword_search(keyword: str, chunks):
    matches = []
    keyword = keyword.lower()
    for chunk in chunks:
        if keyword in chunk.lower():
            matches.append(chunk)

    return matches


TOOLS = {"semantic_search": semantic_search, "keyword_search": keyword_search}
