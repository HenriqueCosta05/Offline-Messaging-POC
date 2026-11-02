# Instruções para agentes

- Leia `docs/CONVENTIONS.md` antes de escrever código: quality gate, camadas DDD e linguagem ubíqua.
- Aplique a skill `clean-code` em todo código novo ou alterado.
- Complexidade ciclomática ≤ 10, comentários e docstrings ≤ 2 linhas; detalhe vai para `docs/`.
- Toda função nova tem teste. Cobertura mínima de 80% em `bridge/` e `web/`.
- Rode `python scripts/quality_gate.py` e só declare a tarefa pronta se ele passar.
