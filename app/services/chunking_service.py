from tree_sitter_language_pack import get_parser

LANGUAGE_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".go": "go",
}

# Node types that represent extractable code units per language
CHUNK_NODE_TYPES = {
    "python": {"function_definition", "class_definition"},
    "javascript": {"function_declaration", "class_declaration", "method_definition"},
    "typescript": {"function_declaration", "class_declaration", "method_definition"},
    "go": {"function_declaration", "method_declaration"},
}

TYPE_LABEL = {
    "function_definition": "function",
    "class_definition": "class",
    "function_declaration": "function",
    "class_declaration": "class",
    "method_definition": "method",
    "method_declaration": "method",
}


def _extract_name(node, content_bytes: bytes) -> str:
    name_node = node.child_by_field_name("name")
    if name_node:
        return content_bytes[name_node.start_byte() : name_node.end_byte()].decode("utf-8", errors="replace")
    return "<anonymous>"


def _walk(node, content_bytes: bytes, target_types: set, chunks: list):
    kind = node.kind()
    if kind in target_types:
        name = _extract_name(node, content_bytes)
        content_text = content_bytes[node.start_byte() : node.end_byte()].decode("utf-8", errors="replace")
        chunks.append(
            {
                "type": TYPE_LABEL.get(kind, kind),
                "name": name,
                "content": content_text,
                "start_line": node.start_position().row + 1,
                "end_line": node.end_position().row + 1,
            }
        )
    for i in range(node.named_child_count()):
        _walk(node.named_child(i), content_bytes, target_types, chunks)


def _chunk_with_treesitter(content: str, language: str) -> list:
    try:
        parser = get_parser(language)
        tree = parser.parse(content)
        root = tree.root_node()
        content_bytes = content.encode("utf-8")
        target_types = CHUNK_NODE_TYPES.get(language, set())
        chunks: list = []
        _walk(root, content_bytes, target_types, chunks)
        return chunks
    except Exception as e:
        print(f"Tree-sitter chunking failed ({language}): {e}")
        return []


def _chunk_raw(content: str, file_extension: str, block_size: int = 50) -> list:
    lines = content.splitlines()
    chunks = []
    for i in range(0, len(lines), block_size):
        block = lines[i : i + block_size]
        chunks.append(
            {
                "type": "raw",
                "name": f"block_{i // block_size + 1}",
                "content": "\n".join(block),
                "start_line": i + 1,
                "end_line": min(i + block_size, len(lines)),
            }
        )
    return chunks


def chunk_file(content: str, file_extension: str) -> list:
    if not content.strip():
        return []
    language = LANGUAGE_MAP.get(file_extension.lower())
    if language:
        return _chunk_with_treesitter(content, language)
    return _chunk_raw(content, file_extension)


def chunk_python_code(content: str) -> list:
    return chunk_file(content, ".py")
