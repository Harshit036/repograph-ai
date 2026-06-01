"""Orientation service — Phase 1 of the knowledge pipeline.

Reads README and manifest files before full AST scanning to give the LLM
richer context about the project (stack, dependencies, entry points).
"""
import json
import os

_README_NAMES = ["README.md", "README.rst", "README.txt", "readme.md"]
_MANIFEST_NAMES = [
    "package.json",
    "pyproject.toml",
    "setup.py",
    "Cargo.toml",
    "go.mod",
    "pom.xml",
]
_ENTRY_POINTS = [
    "src/main.py", "main.py", "app/main.py",
    "src/index.ts", "index.ts", "src/index.js", "index.js",
    "cmd/main.go", "main.go",
]


def _read_safe(path: str, limit: int = 4000) -> str:
    try:
        with open(path, encoding="utf-8", errors="ignore") as f:
            return f.read(limit)
    except Exception:
        return ""


def _parse_package_json(content: str) -> dict:
    try:
        d = json.loads(content)
        return {
            "name": d.get("name", ""),
            "description": d.get("description", ""),
            "main": d.get("main", ""),
            "scripts": list(d.get("scripts", {}).keys())[:8],
            "dependencies": list(d.get("dependencies", {}).keys())[:15],
        }
    except Exception:
        return {}


def _parse_pyproject_toml(content: str) -> dict:
    """Best-effort parse without tomllib dependency."""
    result: dict = {}
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("name") and "=" in line:
            result["name"] = line.split("=", 1)[1].strip().strip("\"'")
        elif line.startswith("description") and "=" in line:
            result["description"] = line.split("=", 1)[1].strip().strip("\"'")
        elif line.startswith("[tool.poetry.dependencies]") or line.startswith("[project]"):
            result.setdefault("section", line)
    return result


def _parse_go_mod(content: str) -> dict:
    result: dict = {}
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("module "):
            result["name"] = line[7:].strip()
        elif line.startswith("go "):
            result["go_version"] = line[3:].strip()
    return result


def read_orientation_data(repo_path: str) -> dict:
    """Scan the repo root for README + manifest and return structured context."""
    result = {
        "readme": "",
        "manifest": {},
        "manifest_file": "",
        "entry_points": [],
    }

    # README
    for name in _README_NAMES:
        path = os.path.join(repo_path, name)
        if os.path.exists(path):
            result["readme"] = _read_safe(path, 3000)
            break

    # Manifest
    for name in _MANIFEST_NAMES:
        path = os.path.join(repo_path, name)
        if os.path.exists(path):
            content = _read_safe(path, 5000)
            result["manifest_file"] = name
            if name == "package.json":
                result["manifest"] = _parse_package_json(content)
            elif name == "pyproject.toml":
                result["manifest"] = _parse_pyproject_toml(content)
            elif name == "go.mod":
                result["manifest"] = _parse_go_mod(content)
            else:
                result["manifest"] = {"raw_snippet": content[:400]}
            break

    # Entry points
    result["entry_points"] = [
        ep for ep in _ENTRY_POINTS
        if os.path.exists(os.path.join(repo_path, ep))
    ]

    return result


def build_orientation_context(orientation: dict) -> str:
    """Format orientation data into a text block for the repo summary prompt."""
    parts: list[str] = []

    if orientation.get("readme"):
        parts.append(f"README (first 2000 chars):\n{orientation['readme'][:2000]}")

    m = orientation.get("manifest", {})
    mf = orientation.get("manifest_file", "")
    if m and mf and "raw_snippet" not in m:
        lines = [f"Manifest ({mf}):"]
        if m.get("name"):         lines.append(f"  Name: {m['name']}")
        if m.get("description"):  lines.append(f"  Description: {m['description']}")
        if m.get("go_version"):   lines.append(f"  Go version: {m['go_version']}")
        if m.get("dependencies"): lines.append(f"  Key dependencies: {', '.join(m['dependencies'][:10])}")
        if m.get("scripts"):      lines.append(f"  Scripts: {', '.join(m['scripts'][:8])}")
        if m.get("main"):         lines.append(f"  Entry point: {m['main']}")
        parts.append("\n".join(lines))

    if orientation.get("entry_points"):
        parts.append(f"Detected entry points: {', '.join(orientation['entry_points'])}")

    return "\n\n".join(parts)
