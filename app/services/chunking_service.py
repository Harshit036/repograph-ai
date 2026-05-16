import ast


def extract_chunks(node, content, chunks):
    if isinstance(node, ast.FunctionDef):
        chunk_text = ast.get_source_segment(content, node)
        chunks.append(
            {
                "type": "function",
                "name": node.name,
                "content": chunk_text,
                "start_line": node.lineno,
                "end_line": node.end_lineno,
            }
        )
    elif isinstance(node, ast.ClassDef):
        chunk_text = ast.get_source_segment(content, node)
        chunks.append(
            {
                "type": "class",
                "name": node.name,
                "content": chunk_text,
                "start_line": node.lineno,
                "end_line": node.end_lineno,
            }
        )

    # Recursively traverse child nodes
    for child in ast.iter_child_nodes(node):
        extract_chunks(child, content, chunks)


def chunk_python_code(content: str):
    try:
        tree = ast.parse(content)
        chunks = []
        extract_chunks(tree, content, chunks)
        return chunks
    except Exception as e:
        print(f"Chunking failed: {e}")
        return []
