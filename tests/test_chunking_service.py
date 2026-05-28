from app.services.chunking_service import chunk_file, chunk_python_code


class TestPythonChunking:
    def test_function(self):
        code = "def hello():\n    return 42\n"
        chunks = chunk_file(code, ".py")
        assert len(chunks) == 1
        assert chunks[0]["type"] == "function"
        assert chunks[0]["name"] == "hello"
        assert chunks[0]["start_line"] == 1

    def test_class(self):
        code = "class Foo:\n    pass\n"
        chunks = chunk_file(code, ".py")
        assert any(c["name"] == "Foo" and c["type"] == "class" for c in chunks)

    def test_nested_method_extracted(self):
        code = "class Foo:\n    def bar(self):\n        pass\n"
        chunks = chunk_file(code, ".py")
        names = [c["name"] for c in chunks]
        assert "Foo" in names
        assert "bar" in names

    def test_backward_compat_alias(self):
        code = "def greet(): pass\n"
        assert chunk_python_code(code) == chunk_file(code, ".py")

    def test_empty_returns_empty(self):
        assert chunk_file("", ".py") == []
        assert chunk_file("   \n  ", ".py") == []


class TestJavaScriptChunking:
    def test_function_declaration(self):
        code = "function greet(name) { return name; }\n"
        chunks = chunk_file(code, ".js")
        assert any(c["name"] == "greet" and c["type"] == "function" for c in chunks)

    def test_class_declaration(self):
        code = "class Foo { bar() { return 1; } }\n"
        chunks = chunk_file(code, ".js")
        assert any(c["name"] == "Foo" and c["type"] == "class" for c in chunks)

    def test_jsx_extension(self):
        code = "function Button() { return null; }\n"
        chunks = chunk_file(code, ".jsx")
        assert any(c["name"] == "Button" for c in chunks)

    def test_typescript_extension(self):
        code = "function add(a: number, b: number): number { return a + b; }\n"
        chunks = chunk_file(code, ".ts")
        assert any(c["name"] == "add" for c in chunks)


class TestGoChunking:
    def test_function_declaration(self):
        code = "package main\nfunc Hello(name string) string {\n    return name\n}\n"
        chunks = chunk_file(code, ".go")
        assert any(c["name"] == "Hello" and c["type"] == "function" for c in chunks)


class TestRawFallback:
    def test_unsupported_extension_produces_raw_blocks(self):
        code = "some content\n" * 60
        chunks = chunk_file(code, ".rb")
        assert len(chunks) >= 2  # 60 lines / 50 per block = 2 blocks
        assert all(c["type"] == "raw" for c in chunks)

    def test_raw_chunk_content_is_subset_of_input(self):
        code = "\n".join(f"line {i}" for i in range(10))
        chunks = chunk_file(code, ".md")
        all_content = "\n".join(c["content"] for c in chunks)
        assert "line 0" in all_content
        assert "line 9" in all_content
