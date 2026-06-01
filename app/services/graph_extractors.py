"""Tree-sitter graph extraction for JS/TS/Go.

Extracts functions, classes (with inheritance), imports, and call edges —
the same entities the Python ast extractor pulls, but for non-Python files.
Uses the same tree-sitter-language-pack API as chunking_service.py.
"""
from tree_sitter_language_pack import get_parser

_LANG_MAP = {
    ".js": "javascript", ".jsx": "javascript",
    ".ts": "typescript", ".tsx": "typescript",
    ".go": "go",
}


def _cb(content: str) -> bytes:
    return content.encode("utf-8")


def _text(node, cb: bytes) -> str:
    return cb[node.start_byte():node.end_byte()].decode("utf-8", errors="replace")


def _collect_calls(node, cb: bytes) -> list[str]:
    """Recursively collect all called function/method names under a node."""
    results: list[str] = []
    if node.kind() == "call_expression":
        func = node.child_by_field_name("function")
        if func:
            if func.kind() == "identifier":
                results.append(_text(func, cb))
            elif func.kind() == "member_expression":
                prop = func.child_by_field_name("property")
                if prop:
                    results.append(_text(prop, cb))
    for i in range(node.named_child_count()):
        results.extend(_collect_calls(node.named_child(i), cb))
    return results


# ── JS / TS ─────────────────────────────────────────────────────────────────────

def _walk_js_ts(node, cb: bytes, data: dict) -> None:
    kind = node.kind()

    if kind == "import_statement":
        # import ... from 'module-name'
        for i in range(node.named_child_count()):
            child = node.named_child(i)
            if child.kind() == "string":
                mod = _text(child, cb).strip("'\"")
                if mod:
                    data["imports"].append(mod)
                break
        return  # no need to recurse into imports

    elif kind in ("function_declaration", "generator_function_declaration"):
        name_node = node.child_by_field_name("name")
        if name_node:
            name = _text(name_node, cb)
            data["functions"].append({
                "name": name,
                "start_line": node.start_position().row + 1,
                "end_line": node.end_position().row + 1,
            })
            data["calls"][name] = _collect_calls(node, cb)
        return  # body already covered by _collect_calls above

    elif kind == "method_definition":
        name_node = node.child_by_field_name("name")
        if name_node:
            name = _text(name_node, cb)
            data["functions"].append({
                "name": name,
                "start_line": node.start_position().row + 1,
                "end_line": node.end_position().row + 1,
            })
            body = node.child_by_field_name("body")
            data["calls"][name] = _collect_calls(body, cb) if body else []
        return

    elif kind == "class_declaration":
        name_node = node.child_by_field_name("name")
        if name_node:
            class_name = _text(name_node, cb)
            parents: list[str] = []
            heritage = node.child_by_field_name("heritage")
            if heritage:
                for i in range(heritage.named_child_count()):
                    child = heritage.named_child(i)
                    if child.kind() == "extends_clause":
                        for j in range(child.named_child_count()):
                            gc = child.named_child(j)
                            if gc.kind() == "identifier":
                                parents.append(_text(gc, cb))
            data["classes"].append({"name": class_name, "parents": parents})
        # recurse into class body to pick up method_definition nodes
        body = node.child_by_field_name("body")
        if body:
            for i in range(body.named_child_count()):
                _walk_js_ts(body.named_child(i), cb, data)
        return

    elif kind == "export_statement":
        # Unwrap: export function foo() {} / export class Bar {}
        decl = node.child_by_field_name("declaration")
        if decl:
            _walk_js_ts(decl, cb, data)
        return

    for i in range(node.named_child_count()):
        _walk_js_ts(node.named_child(i), cb, data)


def extract_js_ts(file_path: str, content: str, ext: str) -> dict:
    lang = _LANG_MAP.get(ext.lower(), "javascript")
    data: dict = {"language": lang, "imports": [], "functions": [], "classes": [], "calls": {}}
    try:
        parser = get_parser(lang)
        tree = parser.parse(content)
        _walk_js_ts(tree.root_node(), _cb(content), data)
    except Exception as e:
        print(f"JS/TS extraction error {file_path}: {e}")
    return data


# ── Go ───────────────────────────────────────────────────────────────────────────

def _walk_go(node, cb: bytes, data: dict) -> None:
    kind = node.kind()

    if kind == "import_spec":
        path_node = node.child_by_field_name("path")
        if path_node:
            mod = _text(path_node, cb).strip('"')
            if mod:
                data["imports"].append(mod)

    elif kind in ("function_declaration", "method_declaration"):
        name_node = node.child_by_field_name("name")
        if name_node:
            name = _text(name_node, cb)
            data["functions"].append({
                "name": name,
                "start_line": node.start_position().row + 1,
                "end_line": node.end_position().row + 1,
            })
            data["calls"][name] = _collect_calls(node, cb)
        return

    for i in range(node.named_child_count()):
        _walk_go(node.named_child(i), cb, data)


def extract_go(file_path: str, content: str) -> dict:
    data: dict = {"language": "go", "imports": [], "functions": [], "classes": [], "calls": {}}
    try:
        parser = get_parser("go")
        tree = parser.parse(content)
        _walk_go(tree.root_node(), _cb(content), data)
    except Exception as e:
        print(f"Go extraction error {file_path}: {e}")
    return data
