import chromadb

# Create persistent Chroma client
client = chromadb.PersistentClient(path="chroma_db")

collection = client.get_or_create_collection(name="repository_chunks")


def store_chunk(chunk_id, embedding, content, metadata):

    collection.add(
        ids=[chunk_id],
        embeddings=[embedding],
        documents=[content],
        metadatas=[metadata],
    )


def search_similar_chunks(query_embedding, top_k=5):

    results = collection.query(query_embeddings=[query_embedding], n_results=top_k)

    return results
