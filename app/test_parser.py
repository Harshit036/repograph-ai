from tree_sitter import Language, Parser, Query, QueryCursor
from tree_sitter_language_pack import get_language, get_parser

# ── 1. Parse ──────────────────────────────────────────────────────────────────
parser = get_parser("python")

code = b"""
import os
from pathlib import Path

class FileProcessor:
    \"\"\"Processes files in a directory.\"\"\"

    def __init__(self, root: str):
        self.root = Path(root)

    def process(self, filename: str) -> dict:
        path = self.root / filename
        return {"path": str(path), "exists": path.exists()}

def helper(x: int, y: int = 0) -> int:
    return x + y
"""

tree = parser.parse(code)
root = tree.root_node

# ── 2. Basic info ─────────────────────────────────────────────────────────────
print("=== Tree Info ===")
print(f"Root type      : {root.type}")
print(f"Children count : {root.child_count}")
print(f"Has errors     : {root.has_error}")
print()

# ── 3. Top-level nodes ────────────────────────────────────────────────────────
print("=== Top-level Nodes ===")
for child in root.children:
    snippet = code[child.start_byte : child.end_byte].decode()
    preview = snippet.splitlines()[0][:60]
    print(f"  [{child.type}] {preview}")
print()


# ── helper: run a query and return captures ───────────────────────────────────
def run_query(lang, pattern, node):
    query = Query(lang, pattern)
    cursor = QueryCursor(query)
    return cursor.captures(node)  # returns dict: {capture_name: [nodes]}


lang = get_language("python")

# ── 4. Functions & methods ────────────────────────────────────────────────────
print("=== Functions & Methods ===")
captures = run_query(
    lang,
    """
    (function_definition
        name: (identifier) @func.name
        parameters: (parameters) @func.params)
""",
    root,
)

for name_node, params_node in zip(
    captures.get("func.name", []), captures.get("func.params", [])
):
    func_name = code[name_node.start_byte : name_node.end_byte].decode()
    func_params = code[params_node.start_byte : params_node.end_byte].decode()
    print(f"  {func_name}{func_params}  (line {name_node.start_point[0]+1})")
print()

# ── 5. Classes ────────────────────────────────────────────────────────────────
print("=== Classes ===")
captures = run_query(
    lang,
    """
    (class_definition name: (identifier) @class.name)
""",
    root,
)

for node in captures.get("class.name", []):
    print(f"  {code[node.start_byte:node.end_byte].decode()}")
print()

# ── 6. Imports ────────────────────────────────────────────────────────────────
print("=== Imports ===")
captures = run_query(
    lang,
    """
    [(import_statement) (import_from_statement)] @import
""",
    root,
)

for node in captures.get("import", []):
    print(f"  {code[node.start_byte:node.end_byte].decode().strip()}")
print()

# ── 7. Node positions ─────────────────────────────────────────────────────────
print("=== Node Positions ===")
captures = run_query(
    lang,
    """
    (function_definition name: (identifier) @func.name)
""",
    root,
)

for node in captures.get("func.name", []):
    name = code[node.start_byte : node.end_byte].decode()
    print(f"  {name!r:20} line {node.start_point[0]+1}, col {node.start_point[1]}")
