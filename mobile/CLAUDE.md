# Instruções para agentes (mobile)

- Valem as regras do `CLAUDE.md` da raiz e o `AGENTS.md` desta pasta (Expo muda a cada SDK: consulte a doc versionada).
- Leia `../docs/CONVENTIONS.md#mobile` e `../docs/mobile-architecture.md` antes de criar arquivos: a pasta define a camada e o ESLint barra imports fora dela.
- Regra de negócio nova vai em `src/domain/` ou `src/application/`; telas só leem hooks de `src/state/` e chamam o serviço.
- Integração externa nova começa por uma porta em `src/ports/` e um adaptador em `src/adapters/`, instanciado só em `src/app/_layout.tsx`.
- UI nativa com `@expo/ui`; testes Vitest ao lado do arquivo; fakes em `src/test/fakes.ts`. Instale libs com `npx expo install`.
