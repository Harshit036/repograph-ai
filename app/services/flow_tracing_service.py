from app.core.user_context import get_user_id
from app.services.graph_retrieval_service import get_active_graph


def trace_execution_flow(keyword: str):
    flow = []
    keyword = keyword.lower()

    for file_path, node in get_active_graph(get_user_id()).items():
        calls = node.get("calls", {})
        for function_name, called in calls.items():
            if keyword in function_name.lower():
                flow.append(
                    {"file": file_path, "function": function_name, "calls": called}
                )

    return flow
