# Convenções do projeto

Este documento é a fonte das regras que o quality gate aplica e do vocabulário de domínio. Explicações longas que não cabem num comentário de 2 linhas moram aqui ou em outro arquivo de `docs/`.

## Quality gate

Um comando roda tudo e sai com código ≠ 0 se qualquer check falhar:

```bash
python scripts/quality_gate.py
```

Ative o hook uma vez por clone para o gate rodar antes de cada commit:

```bash
git config core.hooksPath .githooks
```

| Regra | bridge/ e scripts/ (Python) | web/ (TS) | mobile/ (TS) |
|---|---|---|---|
| Complexidade ciclomática ≤ 10 | ruff `C901` (`ruff.toml`) | oxlint `complexity` (`.oxlintrc.json`) | ESLint `complexity` (`eslint.config.js`) |
| Clean code | ruff `N`, `B`, `SIM`, `PLR0912/0913/0915` (máx. 4 argumentos, 10 branches, 40 statements) | `max-params 4`, `max-depth 3`, `max-lines-per-function 40`, `no-nested-ternary` | idem |
| Camadas DDD | `scripts/check_layers.py` | revisão | ESLint `no-restricted-imports` por camada (`eslint.config.js`) |
| Tipos | — | `npm run typecheck` (fora do gate) | `npm run typecheck` (`tsc --noEmit`) |
| Testes | pytest + cobertura de linhas e branches ≥ 80% | vitest + cobertura v8 ≥ 80% | vitest + cobertura v8 ≥ 80% nas camadas de lógica |
| Comentários ≤ 2 linhas | `scripts/check_comments.py` | idem | idem |

No mobile a cobertura mede `domain/`, `ports/`, `application/`, `adapters/`, `queries/` e `lib/`. Telas (`app/`) e componentes precisam de um renderer nativo, então ficam fora; por isso a lógica não mora neles.

O web usa oxlint em vez de ESLint porque `typescript-eslint` ainda não suporta TypeScript 7.

Arquivos de teste podem ter funções longas (blocos `describe`), mas seguem as demais regras.

## Comentários

- Um bloco é uma sequência de linhas de comentário consecutivas. Blocos e docstrings têm no máximo 2 linhas.
- O comentário explica o porquê; o nome da função e das variáveis explica o quê.
- Precisa de mais? Escreva em `docs/` e aponte com uma linha: `# Ver docs/CONVENTIONS.md#camadas.`

## Clean code

Aplique a skill `clean-code`: nomes que revelam intenção, funções pequenas com uma responsabilidade, guard clauses no lugar de `if` aninhado, sem códigos de erro mágicos. Os limites numéricos acima são o piso automático; a revisão cobre o resto.

## Camadas

Cada módulo pertence a uma camada. Dependências só apontam para dentro.

```
adaptadores (SDK, WebSocket, Matrix, CLI) ──▶ portas (Protocols) ──▶ domínio (regras puras)
```

| Camada | Pode importar | Módulos atuais |
|---|---|---|
| Domínio + portas | stdlib, outros módulos de domínio | `bridge/protocol.py` (`MeshPort`, validação de frames) |
| Adaptadores | domínio, portas, bibliotecas externas | `bridge/manager.py` (SDK), `bridge/server.py` (WebSocket) |
| Composição | tudo | `bridge/__main__.py` |

Um módulo novo de domínio entra em `DOMAIN_MODULES` em `scripts/check_layers.py`. O check falha se ele importar `offline_protocol_sdk`, `websockets`, `nio` ou um adaptador.

### Mobile

A camada é a pasta em `mobile/src/`. O ESLint falha quando um import sai do que a tabela permite; testes (`*.test.ts[x]`) são isentos. Detalhes e fluxo de dados: `docs/mobile-architecture.md`.

| Camada | Pasta | Pode importar |
|---|---|---|
| Domínio | `domain/` | só `@/domain` |
| Portas | `ports/` | `@/domain`, `@/ports` |
| Aplicação | `application/` | `@/domain`, `@/ports`, `@/application` |
| Adaptadores | `adapters/` | `@/domain`, `@/ports`, `@/adapters`, `react-native`, SDK |
| Estado de UI | `queries/` | `@/domain`, `@/ports`, `@/application`, `@/queries`, `react`, TanStack Query |
| Composição e UI | `app/`, `components/`, `hooks/`, `lib/` | tudo |

## Linguagem ubíqua

| Termo | Significado |
|---|---|
| Mesh | Rede Offline Protocol entre dispositivos próximos (BLE, Wi-Fi Direct) ou via relay |
| Peer | Participante do mesh, identificado pelo `user_id` (profile do SDK) |
| Neighbor | Peer alcançável diretamente agora (`neighbor_discovered` / `neighbor_lost`) |
| Bridge | Processo Python que hospeda o SDK e o expõe ao browser por WebSocket |
| Frame | Mensagem JSON entre browser e bridge (`send_message`, `message_received`, …) |
| Delivery status | Estado de entrega de uma mensagem: `pending`, `sent`, `delivered`, `failed` |
| Gateway | Componente da bridge que encaminha mensagens entre mesh e Matrix |
| Room | Sala Matrix; no gateway, uma DM por par (usuário Matrix, peer) |
