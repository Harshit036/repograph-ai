from app.storage.repository_graph import repository_graph


def trace_execution_flow(keyword: str):
    flow = []
    keyword = keyword.lower()

    for file_path, node in repository_graph.items():
        calls = node.get("calls", {})
        for function_name, called in calls.items():
            if keyword in function_name.lower():
                flow.append(
                    {"file": file_path, "function": function_name, "calls": called}
                )

    return flow
