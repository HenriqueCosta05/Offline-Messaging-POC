"""Fails when a domain module imports infrastructure (SDK, network, Matrix) or an adapter.
Layer map and rationale: docs/CONVENTIONS.md#camadas."""
import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOMAIN_MODULES = ("bridge/protocol.py",)
FORBIDDEN = ("offline_protocol_sdk", "websockets", "nio", "bridge.manager", "bridge.server", "bridge.__main__")


def imported_modules(tree: ast.AST) -> list[tuple[int, str]]:
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found += [(node.lineno, alias.name) for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module:
            prefix = "bridge." if node.level else ""
            found.append((node.lineno, prefix + node.module))
    return found


def is_forbidden(module: str) -> bool:
    return any(module == banned or module.startswith(banned + ".") for banned in FORBIDDEN)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    violations = []
    for rel in DOMAIN_MODULES:
        tree = ast.parse((ROOT / rel).read_text(encoding="utf-8"))
        bad = [(line, mod) for line, mod in imported_modules(tree) if is_forbidden(mod)]
        violations += [f"{rel}:{line}: domínio importa '{mod}'" for line, mod in bad]
    for violation in violations:
        print(violation)
    print(f"check_layers: {len(violations)} violação(ões)")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
