"""Fails when a comment block or docstring is longer than MAX_LINES.
Rationale and rules: docs/CONVENTIONS.md#comentários."""
import ast
import io
import sys
import tokenize
from dataclasses import dataclass
from pathlib import Path

MAX_LINES = 2
ROOT = Path(__file__).resolve().parent.parent
PY_DIRS = ("bridge", "scripts")
TS_DIRS = ("web/src", "mobile/src")
SKIP_PARTS = {"node_modules", "dist", ".expo", "__pycache__"}


@dataclass(frozen=True)
class Comment:
    line: int
    text: str
    inline: bool


@dataclass(frozen=True)
class Violation:
    path: Path
    line: int
    size: int
    kind: str

    def __str__(self) -> str:
        rel = self.path.relative_to(ROOT).as_posix()
        return f"{rel}:{self.line}: {self.kind} com {self.size} linhas (máx. {MAX_LINES}); mova o detalhe para docs/"


def long_blocks(comments: list[Comment], limit: int) -> list[tuple[int, int]]:
    """Groups consecutive full-line comments and returns (first_line, size) of each block above `limit`.
    Inline comments (code before them) never start or extend a block."""
    blocks: list[list[int]] = []
    for comment in (c for c in comments if not c.inline):
        if blocks and comment.line == sum(blocks[-1]):
            blocks[-1][1] += 1
        else:
            blocks.append([comment.line, 1])
    return [(start, size) for start, size in blocks if size > limit]


def python_comments(source: str) -> list[Comment]:
    tokens = tokenize.generate_tokens(io.StringIO(source).readline)
    return [
        Comment(tok.start[0], tok.string, bool(tok.line[: tok.start[1]].strip()))
        for tok in tokens
        if tok.type == tokenize.COMMENT and not tok.string.startswith("#!")
    ]


def python_docstrings(source: str) -> list[tuple[int, int]]:
    owners = (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
    spans = []
    for node in ast.walk(ast.parse(source)):
        body = getattr(node, "body", None)
        if isinstance(node, owners) and body and _is_docstring(body[0]):
            spans.append((body[0].lineno, body[0].end_lineno - body[0].lineno + 1))
    return spans


def _is_docstring(stmt: ast.stmt) -> bool:
    return isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant) and isinstance(stmt.value.value, str)


class _TsScanner:
    """Walks TS/TSX source once, skipping string and template literals."""

    def __init__(self, source: str):
        self.src, self.i, self.line = source, 0, 1
        self.code_on_line = False
        self.comments: list[Comment] = []

    def scan(self) -> list[Comment]:
        while self.i < len(self.src):
            self._step()
        return self.comments

    def _step(self) -> None:
        pair = self.src[self.i : self.i + 2]
        if pair == "//":
            self._line_comment()
        elif pair == "/*":
            self._block_comment()
        elif self.src[self.i] in "'\"`":
            self._string(self.src[self.i])
        else:
            self._advance()

    def _advance(self) -> None:
        char = self.src[self.i]
        if char == "\n":
            self.line, self.code_on_line = self.line + 1, False
        elif not char.isspace():
            self.code_on_line = True
        self.i += 1

    def _line_comment(self) -> None:
        end = self.src.find("\n", self.i)
        end = len(self.src) if end == -1 else end
        self.comments.append(Comment(self.line, self.src[self.i : end], self.code_on_line))
        self.i = end

    def _block_comment(self) -> None:
        end = self.src.find("*/", self.i + 2)
        end = len(self.src) if end == -1 else end + 2
        inline = self.code_on_line
        for offset, text in enumerate(self.src[self.i : end].split("\n")):
            self.comments.append(Comment(self.line + offset, text, inline and offset == 0))
        self.line += self.src.count("\n", self.i, end)
        self.i = end

    def _string(self, quote: str) -> None:
        self._advance()
        while self.i < len(self.src) and self.src[self.i] != quote:
            if self.src[self.i] == "\\":
                self._advance()
            self._advance()
        self._advance()


def check_file(path: Path) -> list[Violation]:
    source = path.read_text(encoding="utf-8")
    if path.suffix == ".py":
        comments = python_comments(source)
        spans = python_docstrings(source)
        docs = [Violation(path, line, size, "docstring") for line, size in spans if size > MAX_LINES]
    else:
        comments, docs = _TsScanner(source).scan(), []
    blocks = [Violation(path, line, size, "comentário") for line, size in long_blocks(comments, MAX_LINES)]
    return docs + blocks


def source_files() -> list[Path]:
    found = [p for d in PY_DIRS for p in (ROOT / d).rglob("*.py")]
    found += [p for d in TS_DIRS for pattern in ("*.ts", "*.tsx") for p in (ROOT / d).rglob(pattern)]
    return sorted(p for p in found if not SKIP_PARTS.intersection(p.parts) and not p.name.endswith(".d.ts"))


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    violations = [v for path in source_files() for v in check_file(path)]
    for violation in violations:
        print(violation)
    print(f"check_comments: {len(violations)} violação(ões)")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
