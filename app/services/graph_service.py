import ast


def build_repository_graph(repository_data):
    graph = {}

    for file in repository_data:
        file_path = file["file_path"]
        content = file["content"]
        graph[file_path] = {"imports": [], "functions": [], "calls": {}}

        try:
            tree = ast.parse(content)
            for node in ast.walk(tree):
                # imports
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        graph[file_path]["imports"].append(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        graph[file_path]["imports"].append(node.module)
                # functions
                elif isinstance(node, ast.FunctionDef):
                    function_name = node.name
                    graph[file_path]["functions"].append(function_name)
                    graph[file_path]["calls"][function_name] = []

                    for child in ast.walk(node):
                        if isinstance(child, ast.Call):
                            if isinstance(child.func, ast.Name):
                                graph[file_path]["calls"][function_name].append(
                                    child.func.id
                                )
                            elif isinstance(child.func, ast.Attribute):
                                graph[file_path]["calls"][function_name].append(
                                    child.func.attr
                                )
        except Exception:
            continue
    return graph
