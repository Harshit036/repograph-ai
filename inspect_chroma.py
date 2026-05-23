import chromadb

client = chromadb.PersistentClient(path="chroma_db")

collection = client.get_collection(name="repository_chunks")

data = collection.get()

print("TOTAL CHUNKS:")
print(len(data["documents"]))

print("\nFIRST 3 CHUNKS:\n")

for i in range(3):

    print("=" * 50)

    print("ID:")
    print(data["ids"][i])

    print("\nMETADATA:")
    print(data["metadatas"][i])

    print("\nDOCUMENT:")
    print(data["documents"][i][:500])

    print("\n")
