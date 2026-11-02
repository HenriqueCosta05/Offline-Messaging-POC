---
name: fix-quality-gate
description: Roda `python scripts/quality_gate.py`, lê cada violação e corrige no código até o gate passar, sem afrouxar regra nenhuma. Use quando pedirem "rode o gate e corrija", "conserte o quality gate", "deixe o gate verde", ou quando o gate falhar antes de declarar uma tarefa pronta. Não serve para mudar as regras do gate (isso é decisão do usuário, em docs/CONVENTIONS.md).
---

# Corrigir o quality gate

As regras e os limites estão em `docs/CONVENTIONS.md`. Leia esse arquivo antes de corrigir; esta skill só diz **como** chegar ao verde.

## Regra de ouro: corrija o código, nunca a régua

Nada disso vale como correção:

- desligar regra (`eslint-disable`, `# noqa`, `oxlint-disable`, `// @ts-ignore`, `# type: ignore`) ou editar `ruff.toml`, `.oxlintrc.json`, `eslint.config.js`, `vitest.config.*` ou `bridge/pytest.ini`;
- baixar o limite de cobertura, mexer em `exclude` ou `omit`, ou tirar um check de `scripts/quality_gate.py`;
- apagar ou pular testes (`skip`, `xfail`, `.only`), ou escrever teste sem asserção só para cobrir linha;
- tirar uma pasta da lista de `scripts/check_comments.py` ou de `scripts/check_layers.py`.

Se a única saída for mudar uma regra, pare e pergunte ao usuário.

## Fluxo

1. **Base.** Rode `git status --short` e anote o que já estava modificado: são mudanças do usuário, que você preserva. Procure `TODO(human)` com `rg "TODO\(human\)"`. Código assim é do usuário: não implemente. Diga que o check depende dele.
2. **Diagnóstico.** Rode `python scripts/quality_gate.py` a partir da raiz. O resumo final traz `FALHOU <pacote> <check>`. Para cada falha, rode só aquele comando (tabela abaixo) e liste as violações com `arquivo:linha`.
3. **Ordem.** Corrija das mais baratas às mais caras, porque as primeiras mexem no código que as últimas medem: comentários, depois lint e camadas, depois tipos, depois testes que falham, e por último cobertura.
4. **Corrija um check por vez** e rode de novo só aquele comando até ele passar.
5. **Feche** rodando o gate inteiro. Se um check que passava passou a falhar, volte ao passo 4. Faça no máximo 3 voltas e, se não fechar, reporte o que restou.
6. **Relate** cada violação com `arquivo:linha`, o que foi feito e o que ficou pendente (e por quê). Não faça commit sem o usuário pedir.

## Como corrigir cada check

| Check | Comando isolado | Correção |
|---|---|---|
| bridge: ruff | `python -m ruff check .` | Rode `ruff check --fix` primeiro. Complexidade (`C901`, `PLR0912/0915`): extraia funções com nome de intenção, troque `if` aninhado por guard clause e cadeias de `if/elif` por dicionário de despacho. `E501`: quebre a expressão, não o nome. |
| bridge: camadas | `python scripts/check_layers.py` | Mova o import de adaptador para trás de uma porta (`Protocol`) em `bridge/protocol.py` e injete a implementação em `bridge/__main__.py`. |
| bridge/web/mobile: cobertura | ver abaixo | Leia o relatório `term-missing` ou v8 e escreva testes de comportamento para as linhas e branches que faltam. Siga `~/.claude/prompts/generate-tests.md` e use os fakes que já existem (`mobile/src/test/fakes.ts`). |
| repo: comentários | `python scripts/check_comments.py` | Encurte o bloco para até 2 linhas com o porquê. Mova o detalhe para `docs/` e deixe uma linha apontando para ele (`# Ver docs/X.md#secao.`). Em docstring, a linha em branco também conta. |
| repo: testes dos scripts | `python -m pytest scripts/tests -q` | Corrija o script, não o teste, a menos que o teste contradiga `docs/CONVENTIONS.md`. |
| web: oxlint | `npm run lint` em `web/` | Mesmas técnicas do ruff. Parsers com muitos `case` viram um mapa `tipo → função`. |
| mobile: eslint | `npm run lint -- --max-warnings=0` em `mobile/` | Import fora da camada: siga a tabela "Mobile" em `docs/CONVENTIONS.md` e mova a lógica para a camada certa, ou crie uma porta. Ternário aninhado: extraia função ou use mapa. |
| mobile: tsc | `npm run typecheck` em `mobile/` | Corrija o tipo na origem. Não use `any` nem `as` para calar o erro. |
| testes (pytest/vitest) | `test:coverage` / pytest | Descubra se o bug está no código ou no teste. Corrija o código quando o teste descreve o comportamento documentado. |

Comandos de cobertura:
- **bridge:** `python -m pytest bridge/tests -c bridge/pytest.ini --rootdir=. --cov=bridge --cov-branch --cov-report=term-missing`
- **web/mobile:** `npm run test:coverage`

O `npm` pode não estar no PATH. Nesse caso use `fnm exec --using=default cmd /c "npm run <script>"`, que é o mesmo fallback do `quality_gate.py`.

## Ao refatorar

- Preserve o comportamento: rode os testes do pacote antes e depois de cada extração.
- Toda função nova ganha teste (regra do `CLAUDE.md`).
- Nomes seguem a linguagem ubíqua de `docs/CONVENTIONS.md` (Peer, Neighbor, Frame…).
- Comentários novos também têm até 2 linhas.
