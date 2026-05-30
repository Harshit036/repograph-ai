from app.core.user_context import get_user_id
from app.storage.user_stores import get_graph


def get_graph_neighbors(file_path: str):
    node = get_graph(get_user_id()).get(file_path, {})
    return node.get("imports", [])
