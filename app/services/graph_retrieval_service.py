from app.storage.repository_graph import repository_graph


def get_graph_neighbors(file_path: str):
    node = repository_graph.get(file_path, {})
    return node.get("imports", [])
