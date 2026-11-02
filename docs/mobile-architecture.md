# Arquitetura do mobile

O app (`mobile/`, Expo 58) separa regra de negócio de framework por pastas; o ESLint garante a direção dos imports (`docs/CONVENTIONS.md#mobile`).

```
app/ (telas, composição) ──▶ state/ (React) ──▶ application/ ──▶ ports/ ──▶ domain/
                   └──────▶ adapters/ (SDK Matrix, expo-*, HTTP) ──▶ ports/
```

- `domain/`: TypeScript puro, sem React nem Expo.
- `application/`: serviços com estado imutável e `subscribe`, testados com fakes das portas.
- `adapters/`: implementações reais e demo; o demo roda no Expo Go e na web.
- `state/`: liga um serviço ao React com `useSyncExternalStore`.
- `app/_layout.tsx` é o único lugar que escolhe adaptadores concretos.
