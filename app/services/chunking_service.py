"""AST-based code chunking via Tree-sitter.

Each chunk is a semantic unit (full function or class body) with enriched
content: [type: name] + docstring (if any) + code body.
The enriched format improves both embedding quality and BM25 recall because
the function name and docstring appear explicitly in the text.
"""
from tree_sitter_language_pack import get_parser

LANGUAGE_MAP = {
    ".py":  "python",
    ".js":  "javascript",
    ".jsx": "javascript",
    ".ts":  "typescript",
    ".tsx": "typescript",
    ".go":  "go",
}

CHUNK_NODE_TYPES = {
    "python":     {"function_definition", "class_definition"},
    "javascript": {"function_declaration", "class_declaration", "method_definition"},
    "typescript": {"function_declaration", "class_declaration", "method_definition"},
    "go":         {"function_declaration", "method_declaration"},
}

TYPE_LABEL = {
    "function_definition":           "function",
    "class_definition":              "class",
    "function_declaration":          "function",
    "class_declaration":             "class",
    "method_definition":             "method",
    "method_declaration":            "method",
    "generator_function_declaration":"function",
}


def _extract_name(node, cb: bytes) -> str:
    name_node = node.child_by_field_name("name")
    if name_node:
        return cb[name_node.start_byte():name_node.end_byte()].decode("utf-8", errors="replace")
    return "<anonymous>"


def _extract_docstring(node, cb: bytes) -> str:
    """Extract Python docstring from the first statement of a function/class body."""
    body = node.child_by_field_name("body")
    if not body or body.named_child_count() == 0:
        return ""
    first = body.named_child(0)
    if first.kind() != "expression_statement" or first.named_child_count() == 0:
        return ""
    maybe_str = first.named_child(0)
    if maybe_str.kind() != "string":
        return ""
    raw = cb[maybe_str.start_byte():maybe_str.end_byte()].decode("utf-8", errors="replace").strip()
    # Strip triple or single quotes
    for q in ('"""', "'''", '"', "'"):
        if raw.startswith(q) and raw.endswith(q) and len(raw) > 2 * len(q):
            return raw[len(q):-len(q)].strip()
    return raw


def _walk(node, cb: bytes, target_types: set, chunks: list) -> None:
    kind = node.kind()
    if kind in target_types:
        name = _extract_name(node, cb)
        code  = cb[node.start_byte():node.end_byte()].decode("utf-8", errors="replace")
        label = TYPE_LABEL.get(kind, kind)

        # Enrich: prepend [type: name] and docstring so the embedding captures
        # semantic meaning even when the function body is generic-looking code.
        docstring = _extract_docstring(node, cb) if kind in ("function_definition", "class_definition") else ""
        prefix = f"[{label}: {name}]"
        if docstring:
            prefix += f"\n{docstring}"
        enriched = f"{prefix}\n{code}"

        chunks.append({
            "type":       label,
            "name":       name,
            "content":    enriched,
            "start_line": node.start_position().row + 1,
            "end_line":   node.end_position().row + 1,
        })
        # Still recurse: nested classes/functions inside a class body
    for i in range(node.named_child_count()):
        _walk(node.named_child(i), cb, target_types, chunks)


def _chunk_with_treesitter(content: str, language: str) -> list:
    try:
        parser = get_parser(language)
        tree   = parser.parse(content)
        cb     = content.encode("utf-8")
        target = CHUNK_NODE_TYPES.get(language, set())
        chunks: list = []
        _walk(tree.root_node(), cb, target, chunks)
        return chunks
    except Exception as e:
        print(f"Tree-sitter chunking failed ({language}): {e}")
        return []


def _chunk_raw(content: str, block_size: int = 50) -> list:
    lines = content.splitlines()
    chunks = []
    for i in range(0, len(lines), block_size):
        block = lines[i:i + block_size]
        chunks.append({
            "type":       "raw",
            "name":       f"block_{i // block_size + 1}",
            "content":    "\n".join(block),
            "start_line": i + 1,
            "end_line":   min(i + block_size, len(lines)),
        })
    return chunks


def chunk_file(content: str, file_extension: str) -> list:
    if not content.strip():
        return []
    language = LANGUAGE_MAP.get(file_extension.lower())
    if language:
        return _chunk_with_treesitter(content, language)
    return _chunk_raw(content)


def chunk_python_code(content: str) -> list:
    return chunk_file(content, ".py")
