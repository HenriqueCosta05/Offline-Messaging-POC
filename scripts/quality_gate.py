"""Runs every quality check of the repo and exits non-zero if any fails.
Rules enforced: docs/CONVENTIONS.md#quality-gate."""
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable


@dataclass(frozen=True)
class Check:
    package: str
    name: str
    command: list[str] | None
    cwd: str = "."
    pending_reason: str = ""


def npm_command(*args: str) -> list[str]:
    npm = shutil.which("npm")
    if npm:
        return [npm, *args]
    if shutil.which("fnm"):
        shell = ["cmd", "/c"] if os.name == "nt" else []
        return ["fnm", "exec", "--using=default", *shell, "npm", *args]
    raise SystemExit("quality_gate: npm não encontrado (instale Node ou fnm)")


def checks() -> list[Check]:
    pytest = [PY, "-m", "pytest", "bridge/tests", "-c", "bridge/pytest.ini", "--rootdir=.", "-q",
              "--cov=bridge", "--cov-branch", "--cov-report=term-missing", "--cov-fail-under=80"]
    return [
        Check("bridge", "complexidade + clean code (ruff)", [PY, "-m", "ruff", "check", "."]),
        Check("bridge", "camadas DDD", [PY, "scripts/check_layers.py"]),
        Check("bridge", "testes + cobertura 80%", pytest),
        Check("repo", "comentários <= 2 linhas", [PY, "scripts/check_comments.py"]),
        Check("repo", "testes dos scripts do gate", [PY, "-m", "pytest", "scripts/tests", "-q"]),
        Check("web", "complexidade + clean code (oxlint)", npm_command("run", "lint"), "web"),
        Check("web", "testes + cobertura 80%", npm_command("run", "test:coverage"), "web"),
        Check("mobile", "complexidade + clean code + camadas (eslint)",
              npm_command("run", "lint", "--", "--max-warnings=0"), "mobile"),
        Check("mobile", "tipos (tsc)", npm_command("run", "typecheck"), "mobile"),
        Check("mobile", "testes + cobertura 80%", npm_command("run", "test:coverage"), "mobile"),
    ]


def run(check: Check) -> str:
    if check.command is None:
        return "pendente"
    print(f"\n=== {check.package}: {check.name} ===", flush=True)
    result = subprocess.run(check.command, cwd=ROOT / check.cwd, check=False)
    return "ok" if result.returncode == 0 else "FALHOU"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    results = [(check, run(check)) for check in checks()]
    print("\n=== quality gate ===")
    for check, status in results:
        note = f"  ({check.pending_reason})" if check.pending_reason else ""
        print(f"{status:<9} {check.package:<7} {check.name}{note}")
    return 1 if any(status == "FALHOU" for _, status in results) else 0


if __name__ == "__main__":
    sys.exit(main())
