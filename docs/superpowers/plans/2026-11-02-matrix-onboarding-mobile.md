# Onboarding mobile com login Matrix — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O app mobile, recomeçado do template Expo 58, ganha o onboarding de três etapas (telefone, username, permissões) que termina autenticado no Matrix via `@unomed/react-native-matrix-sdk`, com componentes nativos SwiftUI/Compose e a direção visual "Uma tela por vez".

**Architecture:** Regras puras em `domain/onboarding.ts`; quatro portas; `OnboardingFlow` em `application/` (estado imutável + `subscribe`); adaptadores reais e demo escolhidos por `createAuthServices`; `state/` expõe o fluxo ao React com `useSyncExternalStore`; componentes `components/onboarding/<nome>/{swift,compose}`; rotas `app/(onboarding)/` e `app/(app)/` separadas por `Stack.Protected`.

**Tech Stack:** Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6, Expo Router 58 (`Stack.Protected`), `@expo/ui` 58 (swift-ui, jetpack-compose), Vitest 5 + Testing Library, ESLint 9 (`eslint-config-expo`), `@unomed/react-native-matrix-sdk` 0.10, `expo-secure-store`, `expo-notifications`, `expo-audio`, `expo-contacts`, `expo-file-system`, `expo-dev-client`.

**Spec:** `docs/superpowers/specs/2026-11-02-matrix-onboarding-design.md` (seções Mobile, UI, Tratamento de erros, Testes/Mobile). Depende do plano `2026-11-02-matrix-provisioning-bridge.md` só na verificação ponta a ponta (Task 12); as Tasks 1–11 rodam com adaptadores demo.

## Global Constraints

- Ambiente: WSL, em `~/Projects/POCs/Offline-Protocol-POC`. Comandos npm dentro de `mobile/`; comandos Python na raiz com o venv ativo (`source .venv/bin/activate`).
- Sem git worktrees; branch `feat/matrix-onboarding` no checkout atual.
- Um commit por tarefa, só com os arquivos da tarefa (nunca `git add -A`). Mensagem ≤ 100 caracteres, sem coautor.
- Expo muda a cada SDK: antes de usar uma API Expo, confira a doc `https://docs.expo.dev/versions/v58.0.0/` ou os `.d.ts` em `node_modules` (ver `mobile/AGENTS.md`). Instalar libs só com `npx expo install`.
- ESLint: complexidade ≤ 10, `max-params` 4, `max-depth` 3, `max-lines-per-function` 40, sem ternário aninhado; camadas por pasta.
- Comentários e docstrings ≤ 2 linhas.
- Cobertura ≥ 80% em `domain/`, `ports/`, `application/`, `adapters/`, `state/`, `lib/`. Telas e componentes sem lógica de negócio.
- Testes Vitest ao lado do arquivo; fakes das portas em `src/test/fakes.ts`; hooks em jsdom com `waitFor`.
- Textos de UI em pt-BR, voz direta e calma, sem "mesh", "peer" ou "Matrix" para o usuário.
- A senha nunca é persistida nem logada.
- Tokens visuais só de `Brand` (`constants/theme.ts`); nenhuma cor literal em componentes.
- Learning mode: na Task 4, o corpo de `OnboardingFlow.restore()` é escrito pelo usuário (`TODO(human)`); o executor prepara o resto e pede a contribuição.
- Antes de declarar pronto: `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm run test:coverage` e, na raiz, `python scripts/quality_gate.py`.

## File Structure

| Arquivo | Camada | Responsabilidade |
|---|---|---|
| `mobile/eslint.config.js`, `mobile/vitest.config.mts` | Tooling | Limites de clean code, camadas, cobertura |
| `src/domain/onboarding.ts` | Domínio | Validação, etapas, tipos, `OnboardingFailure` |
| `src/ports/{provisioning-port,matrix-auth-port,permissions-port,credential-store,onboarding-ports}.ts` | Portas | Contratos |
| `src/application/onboarding-flow.ts` | Aplicação | Casos de uso do onboarding |
| `src/adapters/provisioning/{http,demo}-provisioning.ts` | Adaptadores | Bridge HTTP / simulação |
| `src/adapters/matrix/{sdk,demo}-matrix-auth.ts` | Adaptadores | SDK Matrix / simulação |
| `src/adapters/permissions/{permission-status,android-radios,expo-permissions,demo-permissions}.ts` | Adaptadores | Permissões do sistema |
| `src/adapters/credentials/{secure,memory}-credential-store.ts` | Adaptadores | Sessão persistida |
| `src/adapters/create-auth.ts` | Adaptadores | Escolhe real ou demo |
| `src/state/onboarding-provider.tsx`, `use-onboarding.ts` | Estado de UI | Contexto e assinatura do fluxo |
| `src/lib/onboarding-copy.ts`, `onboarding-routes.ts` | UI lib | Textos e rota por etapa |
| `src/constants/theme.ts` | UI | Tokens `Brand` |
| `src/components/onboarding/*` | UI | step-frame, step-rail, text-entry, primary-button, permission-row |
| `src/app/(onboarding)/*`, `src/app/(app)/*`, `src/app/_layout.tsx` | Composição | Telas e guarda |
| `docs/mobile-architecture.md` | Docs | Camadas e fluxo de dados do mobile |

---

### Task 1: Base do app, ferramentas de qualidade e dependências

**Files:**
- Commit à parte: o template Expo 58 já presente no working tree (`mobile/`)
- Modify: `mobile/package.json`, `mobile/package-lock.json`, `mobile/app.json`, `mobile/.gitignore`
- Create: `mobile/eslint.config.js`, `mobile/vitest.config.mts`, `mobile/eas.json`, `mobile/CLAUDE.md`, `docs/mobile-architecture.md`
- Modify: `docs/CONVENTIONS.md` (seção Mobile)

**Interfaces:**
- Produces: scripts `lint`, `typecheck`, `test`, `test:coverage`; regra de camadas `domain → ports → application → adapters/state`; alias `@/` no Vitest.

- [ ] **Step 1: Registrar o recomeço do app como base**

O working tree já tem o template Expo 58 (arquivos antigos apagados, `package.json`/`app.json` novos). Confira e commite só `mobile/`:

```bash
git status --short mobile/
git add -u mobile/
git add mobile/.gitignore mobile/AGENTS.md mobile/LICENSE mobile/.vscode
git commit -m "chore(mobile): recomeça o app a partir do template Expo 58"
```

`mobile/.claude/` fica fora (configuração local).

- [ ] **Step 2: Instalar ferramentas e dependências**

```bash
npx expo install eslint eslint-config-expo expo-dev-client @unomed/react-native-matrix-sdk expo-secure-store expo-notifications expo-audio expo-contacts expo-file-system
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react
```

Expected: tudo em `package.json`; `npx expo-doctor` sem incompatibilidades.

- [ ] **Step 3: Confirmar a API do SDK Matrix**

Run:

```bash
grep -rn "TurboModuleRegistry" node_modules/@unomed/react-native-matrix-sdk/src/*.ts
grep -n "login(\|restoreSession(\|setDisplayName(\|session()\|sessionPaths(\|homeserverUrl(" node_modules/@unomed/react-native-matrix-sdk/src/generated/matrix_sdk_ffi.ts | head -20
```

Expected: `getEnforcing<Spec>('ReactNativeMatrixSdk')` e as assinaturas `login(username, password, initialDeviceName, deviceId)`, `restoreSession(session)`, `setDisplayName(name)`, `session()`, `sessionPaths(dataPath, cachePath)`, `homeserverUrl(url)`. Se algo divergir, ajuste as Tasks 6 e 8 antes de começar.

- [ ] **Step 4: Scripts, ignores e configs**

Em `mobile/package.json`, `scripts` passa a ser:

```json
"scripts": {
  "start": "expo start",
  "android": "expo run:android",
  "ios": "expo start --dev-client",
  "web": "expo start --web",
  "lint": "expo lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

Em `mobile/.gitignore`, acrescente `coverage/`.

`mobile/eslint.config.js`:

```js
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

// Layer map: ../docs/CONVENTIONS.md#mobile. Each layer lists the @/ folders it may import.
const FRAMEWORKS = {
  react: "^react(/|$)",
  reactNative: "^react-",
  expo: "^(expo|@expo/)",
  matrix: "^@unomed/",
};

const layer = (folder, { allowed, frameworks = [] }) => ({
  files: [`src/${folder}/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        {
          regex: `^@/(?!(${allowed.join("|")})/)`,
          message: `A camada '${folder}' só importa de: ${allowed.join(", ")}. Ver docs/CONVENTIONS.md#mobile.`,
        },
        {
          regex: Object.entries(FRAMEWORKS)
            .filter(([name]) => !frameworks.includes(name))
            .map(([, pattern]) => `(${pattern})`)
            .join("|"),
          message: `A camada '${folder}' não depende deste framework. Ver docs/CONVENTIONS.md#mobile.`,
        },
        { group: ["../*"], message: "Use o alias @/ entre pastas." },
      ],
    }],
  },
});

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", "coverage/*"] },
  {
    rules: {
      complexity: ["error", 10],
      "max-params": ["error", 4],
      "max-depth": ["error", 3],
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
      "no-nested-ternary": "error",
    },
  },
  layer("domain", { allowed: ["domain"] }),
  layer("ports", { allowed: ["domain", "ports"] }),
  layer("application", { allowed: ["domain", "ports", "application"] }),
  layer("adapters", { allowed: ["domain", "ports", "adapters"], frameworks: ["reactNative", "expo", "matrix"] }),
  layer("state", { allowed: ["domain", "ports", "application", "state"], frameworks: ["react"] }),
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: { "max-lines-per-function": "off", "no-restricted-imports": "off" },
  },
]);
```

`mobile/vitest.config.mts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Logic layers only: screens and components need a native renderer, so they stay out of coverage.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/{domain,ports,application,adapters,state,lib}/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
```

`mobile/eas.json` (para o dev client da Task 12):

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" }
  }
}
```

- [ ] **Step 5: `app.json`**

Em `mobile/app.json`:
- `expo.name` → `"Offline Protocol PoC"`, `expo.scheme` → `"offlineprotocolpoc"`.
- `expo.ios`: acrescente `"bundleIdentifier": "dev.hqcosta.offlineprotocolpoc"` e

```json
"infoPlist": {
  "NSBluetoothAlwaysUsageDescription": "Para achar quem está perto e conversar sem internet.",
  "NSMicrophoneUsageDescription": "Para chamadas e mensagens de voz.",
  "NSContactsUsageDescription": "Para mostrar quais contatos já usam o app."
}
```

- `expo.android`: acrescente `"package": "dev.hqcosta.offlineprotocolpoc"`, troque `adaptiveIcon.backgroundColor` por `"#2f2235"` e acrescente

```json
"permissions": [
  "android.permission.BLUETOOTH_SCAN",
  "android.permission.BLUETOOTH_ADVERTISE",
  "android.permission.BLUETOOTH_CONNECT",
  "android.permission.NEARBY_WIFI_DEVICES",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.RECORD_AUDIO",
  "android.permission.READ_CONTACTS",
  "android.permission.POST_NOTIFICATIONS"
]
```

- `expo.plugins`: troque o `backgroundColor` do `expo-splash-screen` por `"#2f2235"` e acrescente:

```json
"expo-secure-store",
"expo-notifications",
["expo-audio", { "microphonePermission": "Para chamadas e mensagens de voz." }],
["expo-contacts", { "contactsPermission": "Para mostrar quais contatos já usam o app." }]
```

- [ ] **Step 6: Documentar camadas**

Em `docs/CONVENTIONS.md`, substitua a tabela e o parágrafo da seção `### Mobile` por:

```markdown
A camada é a pasta em `mobile/src/`. O ESLint falha quando um import sai do que a tabela permite; testes (`*.test.ts[x]`) são isentos. Detalhes e fluxo de dados: `docs/mobile-architecture.md`.

| Camada | Pasta | Pode importar |
|---|---|---|
| Domínio | `domain/` | só `@/domain` |
| Portas | `ports/` | `@/domain`, `@/ports` |
| Aplicação | `application/` | `@/domain`, `@/ports`, `@/application` |
| Adaptadores | `adapters/` | `@/domain`, `@/ports`, `@/adapters`, `react-native`, `expo-*`, SDK Matrix |
| Estado de UI | `state/` | `@/domain`, `@/ports`, `@/application`, `@/state`, `react` |
| Composição e UI | `app/`, `components/`, `constants/`, `lib/` | tudo |
```

E troque a frase de cobertura do mobile, na seção Quality gate, por: `No mobile a cobertura mede domain/, ports/, application/, adapters/, state/ e lib/.` (mantendo o resto do parágrafo).

`docs/mobile-architecture.md`:

```markdown
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
```

`mobile/CLAUDE.md`:

```markdown
# Instruções para agentes (mobile)

- Valem as regras do `CLAUDE.md` da raiz e o `AGENTS.md` desta pasta (Expo muda a cada SDK: consulte a doc versionada).
- Leia `../docs/CONVENTIONS.md#mobile` e `../docs/mobile-architecture.md` antes de criar arquivos: a pasta define a camada e o ESLint barra imports fora dela.
- Regra de negócio nova vai em `src/domain/` ou `src/application/`; telas só leem hooks de `src/state/` e chamam o serviço.
- Integração externa nova começa por uma porta em `src/ports/` e um adaptador em `src/adapters/`, instanciado só em `src/app/_layout.tsx`.
- UI nativa com `@expo/ui`; testes Vitest ao lado do arquivo; fakes em `src/test/fakes.ts`. Instale libs com `npx expo install`.
```

- [ ] **Step 7: Verificar**

Run: `npx expo config --type public > /dev/null && npm run lint -- --max-warnings=0 && npm run typecheck && npm test`
Expected: sem erros (o Vitest passa sem testes por `passWithNoTests`). Se o `expo lint` acusar o `src/app/index.tsx` do template, corrija só o necessário; ele é substituído na Task 11.

- [ ] **Step 8: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/app.json mobile/.gitignore mobile/eslint.config.js mobile/vitest.config.mts mobile/eas.json mobile/CLAUDE.md docs/CONVENTIONS.md docs/mobile-architecture.md
git commit -m "build(mobile): eslint com camadas, vitest, deps do onboarding Matrix e permissões"
```

---

### Task 2: Domínio do onboarding e gate do mobile ativo

**Files:**
- Create: `mobile/src/domain/onboarding.ts`, `mobile/src/domain/onboarding.test.ts`
- Modify: `scripts/quality_gate.py` (reativa os checks do mobile)

**Interfaces:**
- Consumes: `docs/fixtures/identity-cases.json` (criado na Task 1 do plano da bridge; se ainda não existir, crie-o agora com o conteúdo daquele plano e inclua no commit).
- Produces (todos exportados de `@/domain/onboarding`):
  - `normalizePhone(raw: string): string | null`; `validateUsername(raw: string): string | null`; `localpartOf(userId: string): string`
  - `type OnboardingStep = 'booting' | 'phone' | 'username' | 'permissions' | 'done'`
  - `type OnboardingEvent = 'phoneNew' | 'signedIn' | 'finished' | 'reset'`; `stepAfter(event): OnboardingStep`; `stepNumber(step): 1 | 2 | 3`
  - `PERMISSION_KINDS = ['nearby', 'notifications', 'microphone', 'contacts'] as const`; `type PermissionKind`; `type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'undetermined'`; `type PermissionMap = Record<PermissionKind, PermissionStatus>`; `initialPermissions(): PermissionMap`
  - `type OnboardingErrorCode = 'invalid_phone' | 'invalid_username' | 'username_taken' | 'phone_taken' | 'bridge_unreachable' | 'login_failed'`
  - `class OnboardingFailure extends Error { code; userId? }`
  - `type MatrixCredentials = { userId: string; homeserver: string; password: string }`
  - `type MatrixSession = { userId: string; homeserver: string; accessToken: string; deviceId: string }`

- [ ] **Step 1: Escrever os testes que falham**

`mobile/src/domain/onboarding.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  initialPermissions,
  localpartOf,
  normalizePhone,
  OnboardingFailure,
  stepAfter,
  stepNumber,
  validateUsername,
} from '@/domain/onboarding';

type Cases = { valid: [string, string][]; invalid: string[] };
const fixture = new URL('../../../docs/fixtures/identity-cases.json', import.meta.url);
const cases = JSON.parse(readFileSync(fileURLToPath(fixture), 'utf8')) as { phone: Cases; username: Cases };

describe('identity rules (shared with the bridge)', () => {
  it.each(cases.phone.valid)('normalizes phone %j', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });
  it.each(cases.phone.invalid)('rejects phone %j', (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
  it.each(cases.username.valid)('accepts username %j', (raw, expected) => {
    expect(validateUsername(raw)).toBe(expected);
  });
  it.each(cases.username.invalid)('rejects username %j', (raw) => {
    expect(validateUsername(raw)).toBeNull();
  });
});

describe('steps', () => {
  it('moves forward on each event', () => {
    expect(stepAfter('phoneNew')).toBe('username');
    expect(stepAfter('signedIn')).toBe('permissions');
    expect(stepAfter('finished')).toBe('done');
    expect(stepAfter('reset')).toBe('phone');
  });
  it('numbers the visible steps for the rail', () => {
    expect([stepNumber('booting'), stepNumber('phone'), stepNumber('username')]).toEqual([1, 1, 2]);
    expect([stepNumber('permissions'), stepNumber('done')]).toEqual([3, 3]);
  });
});

describe('helpers', () => {
  it('extracts the localpart of a Matrix id', () => {
    expect(localpartOf('@marina.costa:hq.local:8448')).toBe('marina.costa');
  });
  it('starts every permission undetermined', () => {
    expect(Object.values(initialPermissions())).toEqual(['undetermined', 'undetermined', 'undetermined', 'undetermined']);
  });
  it('carries the code and the existing account', () => {
    const failure = new OnboardingFailure('phone_taken', '@marina:hq.local');
    expect([failure.code, failure.userId, failure instanceof Error]).toEqual(['phone_taken', '@marina:hq.local', true]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/onboarding.test.ts`
Expected: FAIL com `Failed to resolve import "@/domain/onboarding"`

- [ ] **Step 3: Implementar**

`mobile/src/domain/onboarding.ts`:

```ts
// Same rules as bridge/provisioning.py; both test against docs/fixtures/identity-cases.json.
const PHONE_RE = /^\+[1-9]\d{7,14}$/;
const USERNAME_RE = /^[a-z0-9._=-]{3,32}$/;
const PHONE_NOISE = /[\s\-().]/g;

export type OnboardingStep = 'booting' | 'phone' | 'username' | 'permissions' | 'done';
export type OnboardingEvent = 'phoneNew' | 'signedIn' | 'finished' | 'reset';

export const PERMISSION_KINDS = ['nearby', 'notifications', 'microphone', 'contacts'] as const;
export type PermissionKind = (typeof PERMISSION_KINDS)[number];
export type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'undetermined';
export type PermissionMap = Record<PermissionKind, PermissionStatus>;

export type OnboardingErrorCode =
  | 'invalid_phone'
  | 'invalid_username'
  | 'username_taken'
  | 'phone_taken'
  | 'bridge_unreachable'
  | 'login_failed';

export type MatrixCredentials = { userId: string; homeserver: string; password: string };
export type MatrixSession = { userId: string; homeserver: string; accessToken: string; deviceId: string };

export class OnboardingFailure extends Error {
  constructor(
    readonly code: OnboardingErrorCode,
    readonly userId?: string,
  ) {
    super(code);
  }
}

const NEXT_STEP: Record<OnboardingEvent, OnboardingStep> = {
  phoneNew: 'username',
  signedIn: 'permissions',
  finished: 'done',
  reset: 'phone',
};

const STEP_NUMBER: Record<OnboardingStep, 1 | 2 | 3> = { booting: 1, phone: 1, username: 2, permissions: 3, done: 3 };

export function normalizePhone(raw: string): string | null {
  const phone = raw.trim().replace(PHONE_NOISE, '');
  return PHONE_RE.test(phone) ? phone : null;
}

export function validateUsername(raw: string): string | null {
  const username = raw.trim().toLowerCase();
  const dotted = username.startsWith('.') || username.endsWith('.');
  return USERNAME_RE.test(username) && !dotted ? username : null;
}

export const localpartOf = (userId: string) => userId.replace(/^@/, '').split(':')[0];
export const stepAfter = (event: OnboardingEvent) => NEXT_STEP[event];
export const stepNumber = (step: OnboardingStep) => STEP_NUMBER[step];

export function initialPermissions(): PermissionMap {
  return { nearby: 'undetermined', notifications: 'undetermined', microphone: 'undetermined', contacts: 'undetermined' };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/onboarding.test.ts && npm run lint -- --max-warnings=0`
Expected: PASS (todos os casos do fixture + 6 testes de etapas e helpers) e lint limpo.

- [ ] **Step 5: Reativar o gate do mobile**

Em `scripts/quality_gate.py`, apague a constante `MOBILE_PENDING` e troque os três checks pendentes do mobile por:

```python
        Check("mobile", "complexidade + clean code + camadas (eslint)",
              npm_command("run", "lint", "--", "--max-warnings=0"), "mobile"),
        Check("mobile", "tipos (tsc)", npm_command("run", "typecheck"), "mobile"),
        Check("mobile", "testes + cobertura 80%", npm_command("run", "test:coverage"), "mobile"),
```

Run (na raiz): `python scripts/quality_gate.py`
Expected: todas as linhas `ok`.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/domain/onboarding.ts mobile/src/domain/onboarding.test.ts scripts/quality_gate.py
git commit -m "feat(mobile): domínio do onboarding e gate do mobile reativado"
```

---

### Task 3: Portas e fakes

**Files:**
- Create: `mobile/src/ports/provisioning-port.ts`, `matrix-auth-port.ts`, `permissions-port.ts`, `credential-store.ts`, `onboarding-ports.ts`
- Create: `mobile/src/test/fakes.ts`, `mobile/src/test/fakes.test.ts`

**Interfaces:**
- Consumes: tipos da Task 2.
- Produces:
  - `ProvisioningPort { lookup(phone: string): Promise<string | null>; provision(phone: string, username: string): Promise<MatrixCredentials> }`
  - `MatrixAuthPort { login(credentials: MatrixCredentials): Promise<MatrixSession>; restore(session: MatrixSession): Promise<void>; setDisplayName(name: string): Promise<void> }`
  - `PermissionsPort { check(kind: PermissionKind): Promise<PermissionStatus>; request(kind: PermissionKind): Promise<PermissionStatus> }`
  - `type StoredAccount = { session: MatrixSession; onboarded: boolean }`; `CredentialStore { load(): Promise<StoredAccount | null>; save(account: StoredAccount): Promise<void>; clear(): Promise<void> }`
  - `type OnboardingPorts = { provisioning; matrix; permissions; store }` em `ports/onboarding-ports.ts`
  - Fakes: `SESSION`, `FakeProvisioning`, `FakeMatrixAuth`, `FakePermissions`, `FakeCredentialStore`, `fakeOnboardingPorts()`

- [ ] **Step 1: Escrever as portas**

`mobile/src/ports/provisioning-port.ts`:

```ts
import type { MatrixCredentials } from '@/domain/onboarding';

/** Creates or recovers the Matrix account bound to a phone number (the bridge, or a simulation). */
export interface ProvisioningPort {
  lookup(phone: string): Promise<string | null>;
  provision(phone: string, username: string): Promise<MatrixCredentials>;
}
```

`mobile/src/ports/matrix-auth-port.ts`:

```ts
import type { MatrixCredentials, MatrixSession } from '@/domain/onboarding';

/** Signs in to the homeserver and keeps the client session alive. */
export interface MatrixAuthPort {
  login(credentials: MatrixCredentials): Promise<MatrixSession>;
  restore(session: MatrixSession): Promise<void>;
  setDisplayName(name: string): Promise<void>;
}
```

`mobile/src/ports/permissions-port.ts`:

```ts
import type { PermissionKind, PermissionStatus } from '@/domain/onboarding';

export interface PermissionsPort {
  check(kind: PermissionKind): Promise<PermissionStatus>;
  request(kind: PermissionKind): Promise<PermissionStatus>;
}
```

`mobile/src/ports/credential-store.ts`:

```ts
import type { MatrixSession } from '@/domain/onboarding';

export type StoredAccount = { session: MatrixSession; onboarded: boolean };

/** Persists the signed-in session; never the password. */
export interface CredentialStore {
  load(): Promise<StoredAccount | null>;
  save(account: StoredAccount): Promise<void>;
  clear(): Promise<void>;
}
```

`mobile/src/ports/onboarding-ports.ts`:

```ts
import type { CredentialStore } from '@/ports/credential-store';
import type { MatrixAuthPort } from '@/ports/matrix-auth-port';
import type { PermissionsPort } from '@/ports/permissions-port';
import type { ProvisioningPort } from '@/ports/provisioning-port';

export type OnboardingPorts = {
  provisioning: ProvisioningPort;
  matrix: MatrixAuthPort;
  permissions: PermissionsPort;
  store: CredentialStore;
};
```

- [ ] **Step 2: Escrever o teste dos fakes (falha)**

`mobile/src/test/fakes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { OnboardingFailure } from '@/domain/onboarding';
import { fakeOnboardingPorts, SESSION } from '@/test/fakes';

describe('onboarding fakes', () => {
  it('provision registers once and lookup finds it', async () => {
    const { provisioning } = fakeOnboardingPorts();
    const creds = await provisioning.provision('+5511999990000', 'marina');
    expect(creds).toEqual({ userId: '@marina:fake.local', homeserver: 'http://fake.local', password: 'pw-+5511999990000' });
    expect(await provisioning.lookup('+5511999990000')).toBe('@marina:fake.local');
  });

  it('can be told to fail with a code', async () => {
    const ports = fakeOnboardingPorts();
    ports.provisioning.failNext = new OnboardingFailure('username_taken');
    await expect(ports.provisioning.provision('+5511999990000', 'x')).rejects.toMatchObject({ code: 'username_taken' });
    ports.matrix.failLogin = true;
    await expect(ports.matrix.login({ userId: 'u', homeserver: 'h', password: 'p' })).rejects.toThrow();
  });

  it('store keeps what it saved and counts loads', async () => {
    const { store } = fakeOnboardingPorts();
    await store.save({ session: SESSION, onboarded: true });
    expect(await store.load()).toEqual({ session: SESSION, onboarded: true });
    await store.clear();
    expect(await store.load()).toBeNull();
    expect(store.loads).toBe(2);
  });
});
```

Run: `npx vitest run src/test/fakes.test.ts`
Expected: FAIL com `Failed to resolve import "@/test/fakes"`

- [ ] **Step 3: Implementar os fakes**

`mobile/src/test/fakes.ts`:

```ts
import {
  OnboardingFailure,
  type MatrixCredentials,
  type MatrixSession,
  type PermissionKind,
  type PermissionStatus,
} from '@/domain/onboarding';
import type { CredentialStore, StoredAccount } from '@/ports/credential-store';
import type { MatrixAuthPort } from '@/ports/matrix-auth-port';
import type { OnboardingPorts } from '@/ports/onboarding-ports';
import type { PermissionsPort } from '@/ports/permissions-port';
import type { ProvisioningPort } from '@/ports/provisioning-port';

export const SESSION: MatrixSession = {
  userId: '@marina:fake.local',
  homeserver: 'http://fake.local',
  accessToken: 'token-1',
  deviceId: 'DEVICE1',
};

export class FakeProvisioning implements ProvisioningPort {
  accounts = new Map<string, string>();
  failNext: OnboardingFailure | Error | null = null;
  calls: string[] = [];

  async lookup(phone: string) {
    this.calls.push(`lookup ${phone}`);
    this.throwIfArmed();
    return this.accounts.get(phone) ?? null;
  }

  async provision(phone: string, username: string): Promise<MatrixCredentials> {
    this.calls.push(`provision ${phone} ${username}`);
    this.throwIfArmed();
    const userId = `@${username}:fake.local`;
    this.accounts.set(phone, userId);
    return { userId, homeserver: 'http://fake.local', password: `pw-${phone}` };
  }

  private throwIfArmed() {
    const failure = this.failNext;
    this.failNext = null;
    if (failure) throw failure;
  }
}

export class FakeMatrixAuth implements MatrixAuthPort {
  failLogin = false;
  failRestore = false;
  failDisplayName = false;
  loggedIn: MatrixCredentials[] = [];
  restored: MatrixSession[] = [];
  displayName: string | null = null;

  async login(credentials: MatrixCredentials) {
    if (this.failLogin) throw new Error('M_FORBIDDEN');
    this.loggedIn.push(credentials);
    return { ...SESSION, userId: credentials.userId };
  }

  async restore(session: MatrixSession) {
    if (this.failRestore) throw new Error('M_UNKNOWN_TOKEN');
    this.restored.push(session);
  }

  async setDisplayName(name: string) {
    if (this.failDisplayName) throw new Error('offline');
    this.displayName = name;
  }
}

export class FakePermissions implements PermissionsPort {
  answers: Partial<Record<PermissionKind, PermissionStatus>> = {};
  requested: PermissionKind[] = [];

  async check(kind: PermissionKind) {
    return this.answers[kind] ?? 'undetermined';
  }

  async request(kind: PermissionKind) {
    this.requested.push(kind);
    return this.answers[kind] ?? 'granted';
  }
}

export class FakeCredentialStore implements CredentialStore {
  account: StoredAccount | null = null;
  failLoad = false;
  loads = 0;
  saves: StoredAccount[] = [];

  async load() {
    this.loads++;
    if (this.failLoad) throw new Error('keychain locked');
    return this.account;
  }

  async save(account: StoredAccount) {
    this.saves.push(account);
    this.account = account;
  }

  async clear() {
    this.account = null;
  }
}

export function fakeOnboardingPorts() {
  return {
    provisioning: new FakeProvisioning(),
    matrix: new FakeMatrixAuth(),
    permissions: new FakePermissions(),
    store: new FakeCredentialStore(),
  } satisfies OnboardingPorts;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/test/fakes.test.ts && npm run lint -- --max-warnings=0 && npm run typecheck`
Expected: PASS (3 testes), lint e tipos limpos.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/ports mobile/src/test/fakes.ts mobile/src/test/fakes.test.ts
git commit -m "feat(mobile): portas do onboarding e fakes para testes"
```

---

### Task 4: `OnboardingFlow`

**Files:**
- Create: `mobile/src/application/onboarding-flow.ts`, `mobile/src/application/onboarding-flow.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces:
  - `type OnboardingState = { step: OnboardingStep; phone: string | null; userId: string | null; error: OnboardingErrorCode | null; busy: boolean; permissions: PermissionMap }`
  - `class OnboardingFlow(ports: OnboardingPorts)`: `snapshot` e `subscribe` são propriedades arrow (podem ser passadas soltas para `useSyncExternalStore`); `boot()` (idempotente), `submitPhone(raw)`, `submitUsername(raw)`, `loadPermissions()`, `requestPermission(kind)`, `finish()`, todos `Promise<void>`.

- [ ] **Step 1: Escrever os testes que falham**

`mobile/src/application/onboarding-flow.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { OnboardingFlow } from '@/application/onboarding-flow';
import { OnboardingFailure } from '@/domain/onboarding';
import { fakeOnboardingPorts, SESSION } from '@/test/fakes';

const PHONE = '+5511999990000';
let ports: ReturnType<typeof fakeOnboardingPorts>;
let flow: OnboardingFlow;

beforeEach(() => {
  ports = fakeOnboardingPorts();
  flow = new OnboardingFlow(ports);
});

describe('boot', () => {
  it('starts at the phone step without a stored account', async () => {
    await flow.boot();
    expect(flow.snapshot().step).toBe('phone');
  });

  it('restores a finished account straight to done', async () => {
    ports.store.account = { session: SESSION, onboarded: true };
    await flow.boot();
    expect(flow.snapshot()).toMatchObject({ step: 'done', userId: SESSION.userId });
    expect(ports.matrix.restored).toEqual([SESSION]);
  });

  it('resumes at permissions when onboarding was not finished', async () => {
    ports.store.account = { session: SESSION, onboarded: false };
    await flow.boot();
    expect(flow.snapshot().step).toBe('permissions');
  });

  it('clears a session the homeserver rejects and starts over', async () => {
    ports.store.account = { session: SESSION, onboarded: true };
    ports.matrix.failRestore = true;
    await flow.boot();
    expect(flow.snapshot().step).toBe('phone');
    expect(ports.store.account).toBeNull();
  });

  it('treats an unreadable store as no account', async () => {
    ports.store.failLoad = true;
    await flow.boot();
    expect(flow.snapshot().step).toBe('phone');
  });

  it('runs once even when called twice', async () => {
    await Promise.all([flow.boot(), flow.boot()]);
    expect(ports.store.loads).toBe(1);
  });
});

describe('phone step', () => {
  beforeEach(() => flow.boot());

  it('rejects an invalid phone without calling the bridge', async () => {
    await flow.submitPhone('11 99999');
    expect(flow.snapshot()).toMatchObject({ step: 'phone', error: 'invalid_phone' });
    expect(ports.provisioning.calls).toEqual([]);
  });

  it('asks for a username when the phone is new', async () => {
    await flow.submitPhone('+55 11 99999-0000');
    expect(flow.snapshot()).toMatchObject({ step: 'username', phone: PHONE, error: null });
  });

  it('signs a known phone straight in with its existing username', async () => {
    ports.provisioning.accounts.set(PHONE, '@marina:fake.local');
    await flow.submitPhone(PHONE);
    expect(flow.snapshot()).toMatchObject({ step: 'permissions', userId: '@marina:fake.local' });
    expect(ports.provisioning.calls).toEqual([`lookup ${PHONE}`, `provision ${PHONE} marina`]);
  });

  it('reports an unreachable bridge and stays put', async () => {
    ports.provisioning.failNext = new Error('Network request failed');
    await flow.submitPhone(PHONE);
    expect(flow.snapshot()).toMatchObject({ step: 'phone', error: 'bridge_unreachable' });
  });

  it('is busy only while the request runs', async () => {
    const seen: boolean[] = [];
    flow.subscribe(() => seen.push(flow.snapshot().busy));
    await flow.submitPhone(PHONE);
    expect(seen[0]).toBe(true);
    expect(flow.snapshot().busy).toBe(false);
  });
});

describe('username step', () => {
  beforeEach(async () => {
    await flow.boot();
    await flow.submitPhone(PHONE);
  });

  it('provisions, signs in, names the user and stores the session without the password', async () => {
    await flow.submitUsername(' Marina ');
    expect(flow.snapshot()).toMatchObject({ step: 'permissions', userId: '@marina:fake.local', error: null });
    expect(ports.matrix.displayName).toBe('marina');
    expect(ports.store.saves).toEqual([{ session: { ...SESSION, userId: '@marina:fake.local' }, onboarded: false }]);
    expect(JSON.stringify(ports.store.saves)).not.toContain('pw-');
  });

  it('rejects an invalid username locally', async () => {
    await flow.submitUsername('a');
    expect(flow.snapshot()).toMatchObject({ step: 'username', error: 'invalid_username' });
  });

  it('keeps the user on the step when the name is taken', async () => {
    ports.provisioning.failNext = new OnboardingFailure('username_taken');
    await flow.submitUsername('marina');
    expect(flow.snapshot()).toMatchObject({ step: 'username', error: 'username_taken' });
  });

  it('adopts the existing account when the phone is already taken', async () => {
    ports.provisioning.failNext = new OnboardingFailure('phone_taken', '@antiga:fake.local');
    await flow.submitUsername('marina');
    expect(flow.snapshot()).toMatchObject({ step: 'permissions', userId: '@antiga:fake.local' });
  });

  it('reports a failed login', async () => {
    ports.matrix.failLogin = true;
    await flow.submitUsername('marina');
    expect(flow.snapshot()).toMatchObject({ step: 'username', error: 'login_failed' });
  });

  it('signs in even if the display name cannot be set', async () => {
    ports.matrix.failDisplayName = true;
    await flow.submitUsername('marina');
    expect(flow.snapshot().step).toBe('permissions');
  });

  it('clears the previous error on a new attempt', async () => {
    await flow.submitUsername('a');
    await flow.submitUsername('marina');
    expect(flow.snapshot().error).toBeNull();
  });
});

describe('permissions step', () => {
  beforeEach(async () => {
    await flow.boot();
    await flow.submitPhone(PHONE);
    await flow.submitUsername('marina');
  });

  it('loads and requests each permission', async () => {
    ports.permissions.answers = { contacts: 'blocked' };
    await flow.loadPermissions();
    expect(flow.snapshot().permissions.contacts).toBe('blocked');
    await flow.requestPermission('microphone');
    expect(flow.snapshot().permissions.microphone).toBe('granted');
  });

  it('finishes even with denied permissions and remembers it', async () => {
    ports.permissions.answers = { nearby: 'denied' };
    await flow.requestPermission('nearby');
    await flow.finish();
    expect(flow.snapshot().step).toBe('done');
    expect(ports.store.account?.onboarded).toBe(true);
  });
});

describe('subscribe', () => {
  it('notifies on change and stops after unsubscribe', async () => {
    let calls = 0;
    const unsubscribe = flow.subscribe(() => calls++);
    await flow.boot();
    unsubscribe();
    await flow.submitPhone('x');
    expect(calls).toBe(1);
  });

  it('finish without a session does nothing', async () => {
    await flow.finish();
    expect(flow.snapshot().step).toBe('booting');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/application/onboarding-flow.test.ts`
Expected: FAIL com `Failed to resolve import "@/application/onboarding-flow"`

- [ ] **Step 3: Implementar (com a contribuição do usuário em `restore`)**

`mobile/src/application/onboarding-flow.ts`:

```ts
import {
  initialPermissions,
  localpartOf,
  normalizePhone,
  OnboardingFailure,
  PERMISSION_KINDS,
  stepAfter,
  validateUsername,
  type MatrixCredentials,
  type MatrixSession,
  type OnboardingErrorCode,
  type OnboardingStep,
  type PermissionKind,
  type PermissionMap,
} from '@/domain/onboarding';
import type { OnboardingPorts } from '@/ports/onboarding-ports';

export type OnboardingState = {
  step: OnboardingStep;
  phone: string | null;
  userId: string | null;
  error: OnboardingErrorCode | null;
  busy: boolean;
  permissions: PermissionMap;
};

const initialState = (): OnboardingState => ({
  step: 'booting',
  phone: null,
  userId: null,
  error: null,
  busy: false,
  permissions: initialPermissions(),
});

/** Application service: phone → Matrix account → permissions, on top of the onboarding ports. */
export class OnboardingFlow {
  private state = initialState();
  private session: MatrixSession | null = null;
  private booting: Promise<void> | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly ports: OnboardingPorts) {}

  // Arrow properties so React can call them detached (useSyncExternalStore).
  snapshot = (): OnboardingState => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  boot() {
    this.booting ??= this.restore();
    return this.booting;
  }

  async submitPhone(raw: string) {
    const phone = normalizePhone(raw);
    if (!phone) return this.patch({ error: 'invalid_phone' });
    await this.attempt(async () => {
      const known = await this.ports.provisioning.lookup(phone);
      this.patch({ phone });
      if (known) return this.signIn(phone, localpartOf(known));
      this.patch({ step: stepAfter('phoneNew') });
    });
  }

  async submitUsername(raw: string) {
    const username = validateUsername(raw);
    const phone = this.state.phone;
    if (!username || !phone) return this.patch({ error: 'invalid_username' });
    await this.attempt(() => this.signIn(phone, username));
  }

  async loadPermissions() {
    const statuses = await Promise.all(PERMISSION_KINDS.map((kind) => this.ports.permissions.check(kind)));
    const permissions = { ...this.state.permissions };
    PERMISSION_KINDS.forEach((kind, index) => (permissions[kind] = statuses[index]));
    this.patch({ permissions });
  }

  async requestPermission(kind: PermissionKind) {
    const status = await this.ports.permissions.request(kind);
    this.patch({ permissions: { ...this.state.permissions, [kind]: status } });
  }

  async finish() {
    if (!this.session) return;
    await this.ports.store.save({ session: this.session, onboarded: true });
    this.patch({ step: stepAfter('finished') });
  }

  private async restore() {
    const account = await this.ports.store.load().catch(() => null);
    if (!account) return this.patch({ step: stepAfter('reset') });
    try {
      await this.ports.matrix.restore(account.session);
    } catch {
      await this.ports.store.clear();
      return this.patch({ step: stepAfter('reset') });
    }
    this.session = account.session;
    this.patch({ step: account.onboarded ? 'done' : 'permissions', userId: account.session.userId });
  }

  private async signIn(phone: string, username: string) {
    const credentials = await this.provisionOrAdopt(phone, username);
    const session = await this.ports.matrix.login(credentials).catch(() => {
      throw new OnboardingFailure('login_failed');
    });
    await this.ports.matrix.setDisplayName(localpartOf(session.userId)).catch(() => {});
    await this.ports.store.save({ session, onboarded: false });
    this.session = session;
    this.patch({ step: stepAfter('signedIn'), userId: session.userId });
  }

  private async provisionOrAdopt(phone: string, username: string): Promise<MatrixCredentials> {
    try {
      return await this.ports.provisioning.provision(phone, username);
    } catch (error) {
      const existing = error instanceof OnboardingFailure && error.code === 'phone_taken' ? error.userId : undefined;
      if (!existing) throw error;
      return this.ports.provisioning.provision(phone, localpartOf(existing));
    }
  }

  private async attempt(work: () => Promise<void>) {
    this.patch({ error: null, busy: true });
    try {
      await work();
    } catch (error) {
      this.patch({ error: error instanceof OnboardingFailure ? error.code : 'bridge_unreachable' });
    } finally {
      this.patch({ busy: false });
    }
  }

  private patch(change: Partial<OnboardingState>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach((listener) => listener());
  }
}
```

**Learning mode (executor):** antes de rodar os testes, substitua o corpo de `restore()` por `// TODO(human): carregar a conta salva, restaurar a sessão e escolher a etapa inicial` e peça ao usuário para implementá-lo (um request "Learn by Doing" citando os testes de `describe('boot')`). Prossiga só quando ele terminar; a versão acima é a referência para a revisão.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/application/onboarding-flow.test.ts && npm run lint -- --max-warnings=0 && npm run typecheck`
Expected: PASS (22 testes), lint e tipos limpos.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/application
git commit -m "feat(mobile): OnboardingFlow com provisionamento, login e permissões"
```

---

### Task 5: Adaptadores de provisionamento

**Files:**
- Create: `mobile/src/adapters/provisioning/http-provisioning.ts`, `http-provisioning.test.ts`
- Create: `mobile/src/adapters/provisioning/demo-provisioning.ts`, `demo-provisioning.test.ts`

**Interfaces:**
- Consumes: `ProvisioningPort` (Task 3), `OnboardingFailure` (Task 2).
- Produces: `type ProvisioningConfig = { url: string; token: string; timeoutMs?: number }`; `HttpProvisioning(config, fetchFn = fetch)`; `failureFrom(status: number, body: ProvisionBody): OnboardingFailure`; `DemoProvisioning(latencyMs = 400)`.

- [ ] **Step 1: Escrever os testes que falham**

`mobile/src/adapters/provisioning/http-provisioning.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { failureFrom, HttpProvisioning } from '@/adapters/provisioning/http-provisioning';

const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

const client = (fetchFn: typeof fetch, timeoutMs?: number) =>
  new HttpProvisioning({ url: 'http://192.168.0.10:8766/', token: 't0ken', timeoutMs }, fetchFn);

describe('HttpProvisioning', () => {
  it('posts the phone with the bearer token and reads the user id', async () => {
    const fetchFn = reply(200, { user_id: '@marina:hq.local' });
    expect(await client(fetchFn).lookup('+5511999990000')).toBe('@marina:hq.local');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://192.168.0.10:8766/lookup');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer t0ken' });
    expect(JSON.parse(String(init.body))).toEqual({ phone: '+5511999990000' });
  });

  it('maps an unknown phone to null', async () => {
    expect(await client(reply(200, { user_id: null })).lookup('+5511999990000')).toBeNull();
  });

  it('returns credentials from provision', async () => {
    const fetchFn = reply(200, { user_id: '@m:hq', homeserver: 'http://hs', password: 'pw' });
    expect(await client(fetchFn).provision('+5511999990000', 'm')).toEqual({
      userId: '@m:hq',
      homeserver: 'http://hs',
      password: 'pw',
    });
  });

  it('passes domain errors through with the existing account', async () => {
    const fetchFn = reply(409, { code: 'phone_taken', user_id: '@old:hq' });
    await expect(client(fetchFn).provision('+5511999990000', 'm')).rejects.toMatchObject({
      code: 'phone_taken',
      userId: '@old:hq',
    });
  });

  it('turns network failures into bridge_unreachable', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(client(fetchFn).lookup('+5511999990000')).rejects.toMatchObject({ code: 'bridge_unreachable' });
  });

  it('aborts after the timeout', async () => {
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    await expect(client(fetchFn as typeof fetch, 5).lookup('+5511999990000')).rejects.toMatchObject({
      code: 'bridge_unreachable',
    });
  });
});

describe('failureFrom', () => {
  it.each([
    [422, 'invalid_phone'],
    [422, 'invalid_username'],
    [409, 'username_taken'],
  ])('keeps %i %s', (status, code) => {
    expect(failureFrom(status, { code }).code).toBe(code);
  });

  it('hides server problems behind bridge_unreachable and warns on a bad token', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(failureFrom(401, { code: 'unauthorized' }).code).toBe('bridge_unreachable');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('EXPO_PUBLIC_PROVISION_TOKEN'));
    expect(failureFrom(503, {}).code).toBe('bridge_unreachable');
    warn.mockRestore();
  });
});
```

`mobile/src/adapters/provisioning/demo-provisioning.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { DemoProvisioning } from '@/adapters/provisioning/demo-provisioning';

describe('DemoProvisioning', () => {
  it('creates an account and finds it again', async () => {
    const demo = new DemoProvisioning(0);
    expect(await demo.lookup('+5511999990000')).toBeNull();
    const creds = await demo.provision('+5511999990000', 'marina');
    expect(creds.userId).toBe('@marina:demo.local');
    expect(await demo.lookup('+5511999990000')).toBe('@marina:demo.local');
    expect(await demo.provision('+5511999990000', 'marina')).toEqual(creds);
  });

  it('refuses a taken username and a second username for a phone', async () => {
    const demo = new DemoProvisioning(0);
    await expect(demo.provision('+5511999990000', 'admin')).rejects.toMatchObject({ code: 'username_taken' });
    await demo.provision('+5511999990000', 'marina');
    await expect(demo.provision('+5511999990000', 'outra')).rejects.toMatchObject({
      code: 'phone_taken',
      userId: '@marina:demo.local',
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/adapters/provisioning`
Expected: FAIL com `Failed to resolve import`

- [ ] **Step 3: Implementar**

`mobile/src/adapters/provisioning/http-provisioning.ts`:

```ts
import { OnboardingFailure, type MatrixCredentials, type OnboardingErrorCode } from '@/domain/onboarding';
import type { ProvisioningPort } from '@/ports/provisioning-port';

export type ProvisioningConfig = { url: string; token: string; timeoutMs?: number };
type ProvisionBody = { user_id?: string | null; homeserver?: string; password?: string; code?: string };

const USER_FACING = new Set<string>(['invalid_phone', 'invalid_username', 'username_taken', 'phone_taken']);
const DEFAULT_TIMEOUT_MS = 10_000;

export function failureFrom(status: number, body: ProvisionBody): OnboardingFailure {
  if (body.code && USER_FACING.has(body.code)) {
    return new OnboardingFailure(body.code as OnboardingErrorCode, body.user_id ?? undefined);
  }
  if (status === 401) console.warn('Bridge refused the token: check EXPO_PUBLIC_PROVISION_TOKEN');
  return new OnboardingFailure('bridge_unreachable');
}

/** Talks to the bridge's provisioning endpoints over the LAN. */
export class HttpProvisioning implements ProvisioningPort {
  constructor(
    private readonly config: ProvisioningConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async lookup(phone: string) {
    const body = await this.post('/lookup', { phone });
    return body.user_id ?? null;
  }

  async provision(phone: string, username: string): Promise<MatrixCredentials> {
    const body = await this.post('/provision', { phone, username });
    return { userId: String(body.user_id), homeserver: String(body.homeserver), password: String(body.password) };
  }

  private async post(path: string, payload: object): Promise<ProvisionBody> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const response = await this.fetchFn(this.config.url.replace(/\/$/, '') + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as ProvisionBody;
      if (!response.ok) throw failureFrom(response.status, body);
      return body;
    } catch (error) {
      throw error instanceof OnboardingFailure ? error : new OnboardingFailure('bridge_unreachable');
    } finally {
      clearTimeout(timer);
    }
  }
}
```

`mobile/src/adapters/provisioning/demo-provisioning.ts`:

```ts
import { OnboardingFailure, type MatrixCredentials } from '@/domain/onboarding';
import type { ProvisioningPort } from '@/ports/provisioning-port';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Simulated bridge for Expo Go and the web: accounts live in memory. */
export class DemoProvisioning implements ProvisioningPort {
  private readonly phones = new Map<string, string>();
  private readonly taken = new Set(['admin']);

  constructor(private readonly latencyMs = 400) {}

  async lookup(phone: string) {
    await wait(this.latencyMs);
    return this.phones.get(phone) ?? null;
  }

  async provision(phone: string, username: string): Promise<MatrixCredentials> {
    await wait(this.latencyMs);
    const userId = `@${username}:demo.local`;
    const existing = this.phones.get(phone);
    if (existing && existing !== userId) throw new OnboardingFailure('phone_taken', existing);
    if (!existing && this.taken.has(username)) throw new OnboardingFailure('username_taken');
    this.phones.set(phone, userId);
    this.taken.add(username);
    return { userId, homeserver: 'http://demo.local', password: `demo-${phone}` };
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/adapters/provisioning && npm run lint -- --max-warnings=0`
Expected: PASS (13 testes) e lint limpo.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/adapters/provisioning
git commit -m "feat(mobile): HttpProvisioning com timeout e DemoProvisioning"
```

---

### Task 6: Adaptadores Matrix

**Files:**
- Create: `mobile/src/adapters/matrix/sdk-matrix-auth.ts`, `sdk-matrix-auth.test.ts`
- Create: `mobile/src/adapters/matrix/demo-matrix-auth.ts`, `demo-matrix-auth.test.ts`

**Interfaces:**
- Consumes: `MatrixAuthPort` (Task 3).
- Produces: `SdkMatrixAuth(storageRoot: string)`; `DemoMatrixAuth()`.

- [ ] **Step 1: Escrever os testes que falham**

`mobile/src/adapters/matrix/sdk-matrix-auth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const client = {
    login: vi.fn(async () => {}),
    restoreSession: vi.fn(async () => {}),
    setDisplayName: vi.fn(async () => {}),
    session: vi.fn(() => ({
      accessToken: 'tok',
      userId: '@marina:hq.local',
      deviceId: 'DEV',
      homeserverUrl: 'http://hs',
      slidingSyncVersion: 0,
    })),
  };
  const builder = {
    homeserverUrl: vi.fn(() => builder),
    sessionPaths: vi.fn(() => builder),
    build: vi.fn(async () => client),
  };
  return { client, builder };
});

vi.mock('@unomed/react-native-matrix-sdk', () => ({
  ClientBuilder: vi.fn(function ClientBuilder() {
    return sdk.builder;
  }),
  SlidingSyncVersion: { None: 0, Native: 1 },
}));

const { SdkMatrixAuth } = await import('@/adapters/matrix/sdk-matrix-auth');
const CREDS = { userId: '@marina:hq.local', homeserver: 'http://hs', password: 'pw' };

beforeEach(() => vi.clearAllMocks());

describe('SdkMatrixAuth', () => {
  it('logs in with the password and returns the session without it', async () => {
    const session = await new SdkMatrixAuth('/docs/matrix').login(CREDS);
    expect(sdk.builder.homeserverUrl).toHaveBeenCalledWith('http://hs');
    expect(sdk.builder.sessionPaths).toHaveBeenCalledWith('/docs/matrix/data', '/docs/matrix/cache');
    expect(sdk.client.login).toHaveBeenCalledWith('@marina:hq.local', 'pw', 'Offline Protocol PoC', undefined);
    expect(session).toEqual({ userId: '@marina:hq.local', homeserver: 'http://hs', accessToken: 'tok', deviceId: 'DEV' });
  });

  it('restores a stored session', async () => {
    const auth = new SdkMatrixAuth('/docs/matrix');
    await auth.restore({ userId: '@m:hq', homeserver: 'http://hs', accessToken: 'tok', deviceId: 'DEV' });
    expect(sdk.client.restoreSession).toHaveBeenCalledWith({
      accessToken: 'tok',
      userId: '@m:hq',
      deviceId: 'DEV',
      homeserverUrl: 'http://hs',
      slidingSyncVersion: 0,
    });
  });

  it('sets the display name on the signed-in client and refuses without one', async () => {
    const auth = new SdkMatrixAuth('/docs/matrix');
    await expect(auth.setDisplayName('marina')).rejects.toThrow('not signed in');
    await auth.login(CREDS);
    await auth.setDisplayName('marina');
    expect(sdk.client.setDisplayName).toHaveBeenCalledWith('marina');
  });
});
```

`mobile/src/adapters/matrix/demo-matrix-auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { DemoMatrixAuth } from '@/adapters/matrix/demo-matrix-auth';

describe('DemoMatrixAuth', () => {
  it('returns a session for the credentials and accepts restore and display name', async () => {
    const demo = new DemoMatrixAuth();
    const session = await demo.login({ userId: '@m:demo.local', homeserver: 'http://demo.local', password: 'pw' });
    expect(session).toMatchObject({ userId: '@m:demo.local', homeserver: 'http://demo.local', deviceId: 'DEMO' });
    await expect(demo.restore(session)).resolves.toBeUndefined();
    await expect(demo.setDisplayName('m')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/adapters/matrix`
Expected: FAIL com `Failed to resolve import`

- [ ] **Step 3: Implementar**

`mobile/src/adapters/matrix/sdk-matrix-auth.ts`:

```ts
import type { ClientInterface } from '@unomed/react-native-matrix-sdk';

import type { MatrixCredentials, MatrixSession } from '@/domain/onboarding';
import type { MatrixAuthPort } from '@/ports/matrix-auth-port';

const DEVICE_NAME = 'Offline Protocol PoC';
// Lazy: importing the SDK installs its Rust crate, which only exists in a development build.
const loadSdk = () => import('@unomed/react-native-matrix-sdk');

/** MatrixAuthPort backed by matrix-rust-sdk; the store lives under storageRoot. */
export class SdkMatrixAuth implements MatrixAuthPort {
  private client: ClientInterface | null = null;

  constructor(private readonly storageRoot: string) {}

  async login({ userId, homeserver, password }: MatrixCredentials): Promise<MatrixSession> {
    const client = await this.build(homeserver);
    await client.login(userId, password, DEVICE_NAME, undefined);
    this.client = client;
    const session = client.session();
    return { userId: session.userId, homeserver: session.homeserverUrl, accessToken: session.accessToken, deviceId: session.deviceId };
  }

  async restore(session: MatrixSession) {
    const { SlidingSyncVersion } = await loadSdk();
    const client = await this.build(session.homeserver);
    await client.restoreSession({
      accessToken: session.accessToken,
      userId: session.userId,
      deviceId: session.deviceId,
      homeserverUrl: session.homeserver,
      slidingSyncVersion: SlidingSyncVersion.None,
    });
    this.client = client;
  }

  async setDisplayName(name: string) {
    if (!this.client) throw new Error('not signed in');
    await this.client.setDisplayName(name);
  }

  private async build(homeserver: string): Promise<ClientInterface> {
    const { ClientBuilder } = await loadSdk();
    return new ClientBuilder()
      .homeserverUrl(homeserver)
      .sessionPaths(`${this.storageRoot}/data`, `${this.storageRoot}/cache`)
      .build();
  }
}
```

O `import type` some na compilação, então o SDK continua carregado só pelo `import()`. Se `ClientInterface` não for exportado pelo índice do pacote, confirme o nome com `grep -n "export interface Client" node_modules/@unomed/react-native-matrix-sdk/src/generated/matrix_sdk_ffi.ts` e importe-o do caminho que o pacote expõe.

`mobile/src/adapters/matrix/demo-matrix-auth.ts`:

```ts
import type { MatrixCredentials, MatrixSession } from '@/domain/onboarding';
import type { MatrixAuthPort } from '@/ports/matrix-auth-port';

/** Accepts any credentials; used where the native SDK is missing (Expo Go, web). */
export class DemoMatrixAuth implements MatrixAuthPort {
  async login({ userId, homeserver }: MatrixCredentials): Promise<MatrixSession> {
    return { userId, homeserver, accessToken: `demo-${userId}`, deviceId: 'DEMO' };
  }

  async restore() {}

  async setDisplayName() {}
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/adapters/matrix && npm run lint -- --max-warnings=0 && npm run typecheck`
Expected: PASS (4 testes), lint e tipos limpos.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/adapters/matrix
git commit -m "feat(mobile): SdkMatrixAuth com import lazy do SDK e DemoMatrixAuth"
```

---

### Task 7: Adaptadores de permissões

**Files:**
- Create: `mobile/src/adapters/permissions/permission-status.ts`, `permission-status.test.ts`
- Create: `mobile/src/adapters/permissions/android-radios.ts`
- Create: `mobile/src/adapters/permissions/expo-permissions.ts`, `expo-permissions.test.ts`
- Create: `mobile/src/adapters/permissions/demo-permissions.ts`

**Interfaces:**
- Consumes: `PermissionsPort` (Task 3).
- Produces: `toPermissionStatus(response: { status: string; canAskAgain?: boolean }): PermissionStatus`; `androidResultsStatus(results: string[]): PermissionStatus`; `androidRadios(apiLevel: number): Permission[]`; `ExpoPermissions()`; `DemoPermissions()`.

- [ ] **Step 1: Escrever os testes que falham**

`mobile/src/adapters/permissions/permission-status.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { androidResultsStatus, toPermissionStatus } from '@/adapters/permissions/permission-status';

describe('toPermissionStatus', () => {
  it.each([
    [{ status: 'granted' }, 'granted'],
    [{ status: 'denied', canAskAgain: true }, 'denied'],
    [{ status: 'denied', canAskAgain: false }, 'blocked'],
    [{ status: 'undetermined' }, 'undetermined'],
  ] as const)('maps %j', (response, expected) => {
    expect(toPermissionStatus(response)).toBe(expected);
  });
});

describe('androidResultsStatus', () => {
  it.each([
    [['granted', 'granted'], 'granted'],
    [['granted', 'denied'], 'denied'],
    [['granted', 'never_ask_again'], 'blocked'],
    [[], 'undetermined'],
  ])('reduces %j', (results, expected) => {
    expect(androidResultsStatus(results)).toBe(expected);
  });
});
```

`mobile/src/adapters/permissions/expo-permissions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  platform: { OS: 'android', Version: 34 },
  requestMultiple: vi.fn(async () => ({ a: 'granted', b: 'granted' })),
  check: vi.fn(async () => true),
  notifications: { status: 'granted', canAskAgain: true },
  audio: { status: 'denied', canAskAgain: false },
  contacts: { status: 'undetermined', canAskAgain: true },
}));

vi.mock('react-native', () => ({
  Platform: native.platform,
  PermissionsAndroid: {
    PERMISSIONS: { BLUETOOTH_SCAN: 'scan', BLUETOOTH_ADVERTISE: 'adv', BLUETOOTH_CONNECT: 'conn', NEARBY_WIFI_DEVICES: 'wifi', ACCESS_FINE_LOCATION: 'loc' },
    requestMultiple: native.requestMultiple,
    check: native.check,
  },
}));
vi.mock('expo-notifications', () => ({
  getPermissionsAsync: vi.fn(async () => native.notifications),
  requestPermissionsAsync: vi.fn(async () => native.notifications),
}));
vi.mock('expo-audio', () => ({
  getRecordingPermissionsAsync: vi.fn(async () => native.audio),
  requestRecordingPermissionsAsync: vi.fn(async () => native.audio),
}));
vi.mock('expo-contacts', () => ({
  getPermissionsAsync: vi.fn(async () => native.contacts),
  requestPermissionsAsync: vi.fn(async () => native.contacts),
}));

const { ExpoPermissions } = await import('@/adapters/permissions/expo-permissions');
const { DemoPermissions } = await import('@/adapters/permissions/demo-permissions');
const { androidRadios } = await import('@/adapters/permissions/android-radios');

beforeEach(() => {
  native.platform.OS = 'android';
  vi.clearAllMocks();
});

describe('androidRadios', () => {
  it.each([
    [30, ['loc']],
    [31, ['scan', 'adv', 'conn']],
    [34, ['scan', 'adv', 'conn', 'wifi']],
  ])('API %i asks for %j', (apiLevel, expected) => {
    expect(androidRadios(apiLevel)).toEqual(expected);
  });
});

describe('ExpoPermissions', () => {
  it('requests the radios on Android', async () => {
    expect(await new ExpoPermissions().request('nearby')).toBe('granted');
    expect(native.requestMultiple).toHaveBeenCalledWith(['scan', 'adv', 'conn', 'wifi']);
  });

  it('checks the radios on Android', async () => {
    native.check.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await new ExpoPermissions().check('nearby')).toBe('denied');
  });

  it('leaves Bluetooth to the system prompt on iOS', async () => {
    native.platform.OS = 'ios';
    expect(await new ExpoPermissions().request('nearby')).toBe('undetermined');
    expect(await new ExpoPermissions().check('nearby')).toBe('undetermined');
  });

  it('maps the expo modules', async () => {
    const permissions = new ExpoPermissions();
    expect(await permissions.request('notifications')).toBe('granted');
    expect(await permissions.request('microphone')).toBe('blocked');
    expect(await permissions.check('contacts')).toBe('undetermined');
  });
});

describe('DemoPermissions', () => {
  it('grants on request', async () => {
    const demo = new DemoPermissions();
    expect(await demo.check('contacts')).toBe('undetermined');
    expect(await demo.request('contacts')).toBe('granted');
    expect(await demo.check('contacts')).toBe('granted');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/adapters/permissions`
Expected: FAIL com `Failed to resolve import`

- [ ] **Step 3: Implementar**

`mobile/src/adapters/permissions/permission-status.ts`:

```ts
import type { PermissionStatus } from '@/domain/onboarding';

type ExpoPermissionResponse = { status: string; canAskAgain?: boolean };

export function toPermissionStatus({ status, canAskAgain }: ExpoPermissionResponse): PermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return canAskAgain === false ? 'blocked' : 'denied';
  return 'undetermined';
}

export function androidResultsStatus(results: string[]): PermissionStatus {
  if (results.length === 0) return 'undetermined';
  if (results.includes('never_ask_again')) return 'blocked';
  return results.every((result) => result === 'granted') ? 'granted' : 'denied';
}
```

`mobile/src/adapters/permissions/android-radios.ts`:

```ts
import { PermissionsAndroid, type Permission } from 'react-native';

// Android 12 split Bluetooth out of location; Android 13 added a Wi-Fi permission.
export function androidRadios(apiLevel: number): Permission[] {
  const { PERMISSIONS } = PermissionsAndroid;
  if (apiLevel < 31) return [PERMISSIONS.ACCESS_FINE_LOCATION];
  const bluetooth = [PERMISSIONS.BLUETOOTH_SCAN, PERMISSIONS.BLUETOOTH_ADVERTISE, PERMISSIONS.BLUETOOTH_CONNECT];
  return apiLevel >= 33 ? [...bluetooth, PERMISSIONS.NEARBY_WIFI_DEVICES] : bluetooth;
}
```

`mobile/src/adapters/permissions/expo-permissions.ts`:

```ts
import * as Audio from 'expo-audio';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import { PermissionsAndroid, Platform } from 'react-native';

import { androidRadios } from '@/adapters/permissions/android-radios';
import { androidResultsStatus, toPermissionStatus } from '@/adapters/permissions/permission-status';
import type { PermissionKind, PermissionStatus } from '@/domain/onboarding';
import type { PermissionsPort } from '@/ports/permissions-port';

type ExpoResponse = { status: string; canAskAgain?: boolean };
type ExpoModule = { check: () => Promise<ExpoResponse>; request: () => Promise<ExpoResponse> };

const MODULES: Record<Exclude<PermissionKind, 'nearby'>, ExpoModule> = {
  notifications: { check: Notifications.getPermissionsAsync, request: Notifications.requestPermissionsAsync },
  microphone: { check: Audio.getRecordingPermissionsAsync, request: Audio.requestRecordingPermissionsAsync },
  contacts: { check: Contacts.getPermissionsAsync, request: Contacts.requestPermissionsAsync },
};

const radios = () => androidRadios(Number(Platform.Version));

/** iOS asks for Bluetooth itself on first use, so nearby stays undetermined there. */
export class ExpoPermissions implements PermissionsPort {
  async check(kind: PermissionKind): Promise<PermissionStatus> {
    if (kind !== 'nearby') return toPermissionStatus(await MODULES[kind].check());
    if (Platform.OS !== 'android') return 'undetermined';
    const granted = await Promise.all(radios().map((permission) => PermissionsAndroid.check(permission)));
    return granted.every(Boolean) ? 'granted' : 'denied';
  }

  async request(kind: PermissionKind): Promise<PermissionStatus> {
    if (kind !== 'nearby') return toPermissionStatus(await MODULES[kind].request());
    if (Platform.OS !== 'android') return 'undetermined';
    const results = await PermissionsAndroid.requestMultiple(radios());
    return androidResultsStatus(Object.values(results));
  }
}
```

`mobile/src/adapters/permissions/demo-permissions.ts`:

```ts
import type { PermissionKind, PermissionStatus } from '@/domain/onboarding';
import type { PermissionsPort } from '@/ports/permissions-port';

export class DemoPermissions implements PermissionsPort {
  private readonly granted = new Set<PermissionKind>();

  async check(kind: PermissionKind): Promise<PermissionStatus> {
    return this.granted.has(kind) ? 'granted' : 'undetermined';
  }

  async request(kind: PermissionKind): Promise<PermissionStatus> {
    this.granted.add(kind);
    return 'granted';
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/adapters/permissions && npm run lint -- --max-warnings=0 && npm run typecheck`
Expected: PASS (16 testes), lint e tipos limpos.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/adapters/permissions
git commit -m "feat(mobile): permissões via expo e PermissionsAndroid, com status normalizado"
```

---

### Task 8: Armazenamento de credenciais e composição dos adaptadores

**Files:**
- Create: `mobile/src/adapters/credentials/secure-credential-store.ts`, `memory-credential-store.ts`, `credential-store.test.ts`
- Create: `mobile/src/adapters/create-auth.ts`, `create-auth.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 5, 6, 7.
- Produces: `SecureCredentialStore()`, `MemoryCredentialStore()`; `type AuthConfig = { provisioning: ProvisioningConfig | null; nativeMatrix: boolean; platform: string; storageRoot: string }`; `readAuthConfig(): AuthConfig`; `createAuthServices(config: AuthConfig): OnboardingPorts`.

- [ ] **Step 1: Escrever os testes que falham**

`mobile/src/adapters/credentials/credential-store.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

const secure = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => secure.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => void secure.set(key, value)),
  deleteItemAsync: vi.fn(async (key: string) => void secure.delete(key)),
}));

const { SecureCredentialStore } = await import('@/adapters/credentials/secure-credential-store');
const { MemoryCredentialStore } = await import('@/adapters/credentials/memory-credential-store');
const ACCOUNT = {
  session: { userId: '@m:hq', homeserver: 'http://hs', accessToken: 'tok', deviceId: 'DEV' },
  onboarded: true,
};

describe.each([
  ['SecureCredentialStore', () => new SecureCredentialStore()],
  ['MemoryCredentialStore', () => new MemoryCredentialStore()],
])('%s', (_name, create) => {
  it('saves, loads and clears the account', async () => {
    const store = create();
    expect(await store.load()).toBeNull();
    await store.save(ACCOUNT);
    expect(await store.load()).toEqual(ACCOUNT);
    await store.clear();
    expect(await store.load()).toBeNull();
  });
});

it('treats unreadable secure data as no account', async () => {
  secure.set('onboarding.account', '{broken');
  expect(await new SecureCredentialStore().load()).toBeNull();
});
```

`mobile/src/adapters/create-auth.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'ios', Version: '18' }, TurboModuleRegistry: { get: vi.fn(() => null) }, PermissionsAndroid: { PERMISSIONS: {} } }));
vi.mock('expo-file-system', () => ({ Paths: { document: { uri: 'file:///var/mobile/Documents/' } } }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('expo-notifications', () => ({}));
vi.mock('expo-audio', () => ({}));
vi.mock('expo-contacts', () => ({}));

const { createAuthServices, readAuthConfig } = await import('@/adapters/create-auth');

const BASE = { provisioning: null, nativeMatrix: false, platform: 'ios', storageRoot: '/docs/matrix' };

describe('createAuthServices', () => {
  it('uses demo adapters when nothing native is configured', () => {
    const ports = createAuthServices(BASE);
    expect(ports.provisioning.constructor.name).toBe('DemoProvisioning');
    expect(ports.matrix.constructor.name).toBe('DemoMatrixAuth');
    expect(ports.permissions.constructor.name).toBe('ExpoPermissions');
    expect(ports.store.constructor.name).toBe('SecureCredentialStore');
  });

  it('uses the real adapters in a configured development build', () => {
    const ports = createAuthServices({ ...BASE, provisioning: { url: 'http://pc:8766', token: 't' }, nativeMatrix: true });
    expect(ports.provisioning.constructor.name).toBe('HttpProvisioning');
    expect(ports.matrix.constructor.name).toBe('SdkMatrixAuth');
  });

  it('falls back to memory and demo permissions on the web', () => {
    const ports = createAuthServices({ ...BASE, platform: 'web' });
    expect(ports.permissions.constructor.name).toBe('DemoPermissions');
    expect(ports.store.constructor.name).toBe('MemoryCredentialStore');
  });
});

describe('readAuthConfig', () => {
  it('reads the environment and the documents directory', () => {
    vi.stubEnv('EXPO_PUBLIC_PROVISION_URL', 'http://pc:8766');
    vi.stubEnv('EXPO_PUBLIC_PROVISION_TOKEN', 't0ken');
    expect(readAuthConfig()).toEqual({
      provisioning: { url: 'http://pc:8766', token: 't0ken' },
      nativeMatrix: false,
      platform: 'ios',
      storageRoot: '/var/mobile/Documents/matrix',
    });
    vi.unstubAllEnvs();
  });

  it('skips provisioning without a URL', () => {
    vi.stubEnv('EXPO_PUBLIC_PROVISION_URL', '');
    expect(readAuthConfig().provisioning).toBeNull();
    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/adapters/credentials src/adapters/create-auth.test.ts`
Expected: FAIL com `Failed to resolve import`

- [ ] **Step 3: Implementar**

`mobile/src/adapters/credentials/secure-credential-store.ts`:

```ts
import * as SecureStore from 'expo-secure-store';

import type { CredentialStore, StoredAccount } from '@/ports/credential-store';

const KEY = 'onboarding.account';

/** Keeps the Matrix session in the Keychain / Keystore. */
export class SecureCredentialStore implements CredentialStore {
  async load(): Promise<StoredAccount | null> {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredAccount;
    } catch {
      return null;
    }
  }

  async save(account: StoredAccount) {
    await SecureStore.setItemAsync(KEY, JSON.stringify(account));
  }

  async clear() {
    await SecureStore.deleteItemAsync(KEY);
  }
}
```

`mobile/src/adapters/credentials/memory-credential-store.ts`:

```ts
import type { CredentialStore, StoredAccount } from '@/ports/credential-store';

/** Web has no secure store: the session lasts until the tab closes. */
export class MemoryCredentialStore implements CredentialStore {
  private account: StoredAccount | null = null;

  async load() {
    return this.account;
  }

  async save(account: StoredAccount) {
    this.account = account;
  }

  async clear() {
    this.account = null;
  }
}
```

`mobile/src/adapters/create-auth.ts`:

```ts
import { Paths } from 'expo-file-system';
import { Platform, TurboModuleRegistry } from 'react-native';

import { MemoryCredentialStore } from '@/adapters/credentials/memory-credential-store';
import { SecureCredentialStore } from '@/adapters/credentials/secure-credential-store';
import { DemoMatrixAuth } from '@/adapters/matrix/demo-matrix-auth';
import { SdkMatrixAuth } from '@/adapters/matrix/sdk-matrix-auth';
import { DemoPermissions } from '@/adapters/permissions/demo-permissions';
import { ExpoPermissions } from '@/adapters/permissions/expo-permissions';
import { DemoProvisioning } from '@/adapters/provisioning/demo-provisioning';
import { HttpProvisioning, type ProvisioningConfig } from '@/adapters/provisioning/http-provisioning';
import type { OnboardingPorts } from '@/ports/onboarding-ports';

export type AuthConfig = {
  provisioning: ProvisioningConfig | null;
  nativeMatrix: boolean;
  platform: string;
  storageRoot: string;
};

// EXPO_PUBLIC_* must be read with literal names: Metro inlines them at build time.
export function readAuthConfig(): AuthConfig {
  const url = process.env.EXPO_PUBLIC_PROVISION_URL;
  const token = process.env.EXPO_PUBLIC_PROVISION_TOKEN ?? '';
  const documents = decodeURI(Paths.document.uri.replace(/^file:\/\//, '')).replace(/\/$/, '');
  return {
    provisioning: url ? { url, token } : null,
    nativeMatrix: TurboModuleRegistry.get('ReactNativeMatrixSdk') != null,
    platform: Platform.OS,
    storageRoot: `${documents}/matrix`,
  };
}

export function createAuthServices(config: AuthConfig): OnboardingPorts {
  const web = config.platform === 'web';
  return {
    provisioning: config.provisioning ? new HttpProvisioning(config.provisioning) : new DemoProvisioning(),
    matrix: config.nativeMatrix ? new SdkMatrixAuth(config.storageRoot) : new DemoMatrixAuth(),
    permissions: web ? new DemoPermissions() : new ExpoPermissions(),
    store: web ? new MemoryCredentialStore() : new SecureCredentialStore(),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/adapters && npm run lint -- --max-warnings=0 && npm run typecheck`
Expected: todos os testes de adaptadores passando, lint e tipos limpos.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/adapters/credentials mobile/src/adapters/create-auth.ts mobile/src/adapters/create-auth.test.ts
git commit -m "feat(mobile): credenciais no secure store e createAuthServices real/demo"
```

---

### Task 9: Estado de UI

**Files:**
- Create: `mobile/src/state/onboarding-provider.tsx`, `mobile/src/state/use-onboarding.ts`, `mobile/src/state/onboarding-state.test.tsx`

**Interfaces:**
- Consumes: `OnboardingFlow`, `OnboardingState` (Task 4).
- Produces: `OnboardingProvider({ flow, children })` (chama `flow.boot()` ao montar); `useOnboardingFlow(): OnboardingFlow`; `useOnboarding(): OnboardingState`.

- [ ] **Step 1: Escrever os testes que falham**

`mobile/src/state/onboarding-state.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { OnboardingFlow } from '@/application/onboarding-flow';
import { OnboardingProvider, useOnboardingFlow } from '@/state/onboarding-provider';
import { useOnboarding } from '@/state/use-onboarding';
import { fakeOnboardingPorts } from '@/test/fakes';

let flow: OnboardingFlow;

const wrapper = ({ children }: { children: ReactNode }) => (
  <OnboardingProvider flow={flow}>{children}</OnboardingProvider>
);

beforeEach(() => {
  flow = new OnboardingFlow(fakeOnboardingPorts());
});

describe('OnboardingProvider', () => {
  it('boots the flow and re-renders on every change', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.step).toBe('phone'));
    await act(() => flow.submitPhone('+5511999990000'));
    expect(result.current.step).toBe('username');
  });

  it('hands the flow to the screens', () => {
    const { result } = renderHook(() => useOnboardingFlow(), { wrapper });
    expect(result.current).toBe(flow);
  });

  it('requires the provider', () => {
    expect(() => renderHook(() => useOnboardingFlow())).toThrow('inside <OnboardingProvider>');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/state`
Expected: FAIL com `Failed to resolve import "@/state/onboarding-provider"`

- [ ] **Step 3: Implementar**

`mobile/src/state/onboarding-provider.tsx`:

```tsx
import { createContext, useContext, useEffect, type ReactNode } from 'react';

import type { OnboardingFlow } from '@/application/onboarding-flow';

const FlowContext = createContext<OnboardingFlow | null>(null);

export function useOnboardingFlow() {
  const flow = useContext(FlowContext);
  if (!flow) throw new Error('useOnboardingFlow must be used inside <OnboardingProvider>');
  return flow;
}

type OnboardingProviderProps = { flow: OnboardingFlow; children: ReactNode };

/** Shares the flow with the screens and boots it once mounted. */
export function OnboardingProvider({ flow, children }: OnboardingProviderProps) {
  useEffect(() => {
    flow.boot();
  }, [flow]);

  return <FlowContext.Provider value={flow}>{children}</FlowContext.Provider>;
}
```

`mobile/src/state/use-onboarding.ts`:

```ts
import { useSyncExternalStore } from 'react';

import type { OnboardingState } from '@/application/onboarding-flow';
import { useOnboardingFlow } from '@/state/onboarding-provider';

export function useOnboarding(): OnboardingState {
  const flow = useOnboardingFlow();
  return useSyncExternalStore(flow.subscribe, flow.snapshot);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/state && npm run lint -- --max-warnings=0 && npm run typecheck && npm run test:coverage`
Expected: PASS, lint e tipos limpos, cobertura ≥ 80%.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/state
git commit -m "feat(mobile): estado do onboarding exposto ao React com useSyncExternalStore"
```

---

### Task 10: Tokens, textos e componentes nativos

**Files:**
- Create: `mobile/src/constants/theme.ts`
- Create: `mobile/src/lib/onboarding-copy.ts`, `onboarding-copy.test.ts`, `onboarding-routes.ts`, `onboarding-routes.test.ts`
- Create: `mobile/src/components/onboarding/step-frame/index.tsx`
- Create: `mobile/src/components/onboarding/step-rail/index.tsx`
- Create: `mobile/src/components/onboarding/text-entry/{types.ts,entry-shell.tsx,index.tsx,index.ios.tsx,index.android.tsx,swift/text-entry.tsx,compose/text-entry.tsx}`
- Create: `mobile/src/components/onboarding/primary-button/{types.ts,index.tsx,index.ios.tsx,index.android.tsx,swift/primary-button.tsx,compose/primary-button.tsx}`
- Create: `mobile/src/components/onboarding/permission-row/{types.ts,row-text.tsx,index.tsx,index.ios.tsx,index.android.tsx,swift/permission-row.tsx,compose/permission-row.tsx}`

**Interfaces:**
- Consumes: tipos de domínio (Task 2).
- Produces:
  - `Brand` = `{ ground, field, accent, onGround, muted, pending, cta, onCta, error }` (strings hex)
  - `errorMessage(code: OnboardingErrorCode): string`; `PERMISSION_COPY: Record<PermissionKind, { title: string; reason: string }>`; `statusLabel(status: PermissionStatus, platform: string, kind: PermissionKind): string`
  - `routeForStep(step: OnboardingStep): '/phone' | '/username' | '/permissions' | null`
  - `StepFrame({ step: 1 | 2 | 3; title: string; subtitle: string; children })`, `StepRail({ step })`
  - `TextEntry(props: TextEntryProps)` com `TextEntryProps = { kind: 'phone' | 'username'; label: string; placeholder: string; prefix?: string; error?: string | null; onChangeText(text: string): void; onSubmit(): void }`
  - `PrimaryButton({ label: string; busy?: boolean; onPress(): void })`
  - `PermissionRow({ title: string; reason: string; status: string; actionable: boolean; onRequest(): void })`

- [ ] **Step 1: Testes da lib (falham)**

`mobile/src/lib/onboarding-copy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { PERMISSION_KINDS, type OnboardingErrorCode } from '@/domain/onboarding';
import { errorMessage, PERMISSION_COPY, statusLabel } from '@/lib/onboarding-copy';

const CODES: OnboardingErrorCode[] = [
  'invalid_phone', 'invalid_username', 'username_taken', 'phone_taken', 'bridge_unreachable', 'login_failed',
];

describe('onboarding copy', () => {
  it('has a calm message for every error code', () => {
    CODES.forEach((code) => expect(errorMessage(code)).toMatch(/\.$/));
    expect(errorMessage('invalid_phone')).toContain('+55 11 99999-0000');
  });

  it('explains every permission without jargon', () => {
    PERMISSION_KINDS.forEach((kind) => {
      expect(PERMISSION_COPY[kind].reason).not.toMatch(/mesh|peer|matrix/i);
    });
  });

  it('labels statuses, with the iPhone Bluetooth exception', () => {
    expect(statusLabel('granted', 'android', 'contacts')).toBe('Permitido');
    expect(statusLabel('blocked', 'android', 'contacts')).toBe('Bloqueado nos Ajustes');
    expect(statusLabel('denied', 'android', 'contacts')).toBe('Não permitido');
    expect(statusLabel('undetermined', 'android', 'contacts')).toBe('');
    expect(statusLabel('undetermined', 'ios', 'nearby')).toBe('O iPhone pergunta na primeira conexão');
  });
});
```

`mobile/src/lib/onboarding-routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { routeForStep } from '@/lib/onboarding-routes';

describe('routeForStep', () => {
  it.each([
    ['phone', '/phone'],
    ['username', '/username'],
    ['permissions', '/permissions'],
    ['booting', null],
    ['done', null],
  ] as const)('%s → %s', (step, route) => {
    expect(routeForStep(step)).toBe(route);
  });
});
```

Run: `npx vitest run src/lib`
Expected: FAIL com `Failed to resolve import`

- [ ] **Step 2: Implementar a lib e os tokens**

`mobile/src/lib/onboarding-copy.ts`:

```ts
import type { OnboardingErrorCode, PermissionKind, PermissionStatus } from '@/domain/onboarding';

const ERRORS: Record<OnboardingErrorCode, string> = {
  invalid_phone: 'Use o formato com DDI, por exemplo +55 11 99999-0000.',
  invalid_username: 'Use 3 a 32 caracteres: letras minúsculas, números, ponto ou traço.',
  username_taken: 'Esse nome já está em uso. Tente outro.',
  phone_taken: 'Este número já tem uma conta. Entrando nela.',
  bridge_unreachable: 'Não deu para falar com o servidor. Tente de novo.',
  login_failed: 'A conta foi criada, mas o login falhou. Tente de novo.',
};

export const errorMessage = (code: OnboardingErrorCode) => ERRORS[code];

export const PERMISSION_COPY: Record<PermissionKind, { title: string; reason: string }> = {
  nearby: { title: 'Bluetooth', reason: 'Para achar quem está perto e conversar sem internet.' },
  notifications: { title: 'Notificações', reason: 'Para avisar quando chegar mensagem ou chamada.' },
  microphone: { title: 'Microfone', reason: 'Para chamadas e mensagens de voz.' },
  contacts: { title: 'Contatos', reason: 'Para mostrar quais contatos já usam o app.' },
};

const STATUS: Record<PermissionStatus, string> = {
  granted: 'Permitido',
  denied: 'Não permitido',
  blocked: 'Bloqueado nos Ajustes',
  undetermined: '',
};

export function statusLabel(status: PermissionStatus, platform: string, kind: PermissionKind) {
  if (status === 'undetermined' && platform === 'ios' && kind === 'nearby') {
    return 'O iPhone pergunta na primeira conexão';
  }
  return STATUS[status];
}
```

`mobile/src/lib/onboarding-routes.ts`:

```ts
import type { OnboardingStep } from '@/domain/onboarding';

const ROUTES = { phone: '/phone', username: '/username', permissions: '/permissions' } as const;
type OnboardingRoute = (typeof ROUTES)[keyof typeof ROUTES];

export function routeForStep(step: OnboardingStep): OnboardingRoute | null {
  return step in ROUTES ? ROUTES[step as keyof typeof ROUTES] : null;
}
```

`mobile/src/constants/theme.ts`:

```ts
// White-label palette; swap these values to rebrand. Contrast notes live in the onboarding spec.
export const Brand = {
  ground: '#2f2235',
  field: '#3f3244',
  accent: '#60495a',
  onGround: '#ffffff',
  muted: '#bfc3ba',
  pending: '#a9aca9',
  cta: '#ffffff',
  onCta: '#2f2235',
  error: '#ffb4ab',
} as const;
```

Run: `npx vitest run src/lib`
Expected: PASS.

- [ ] **Step 3: `step-rail` e `step-frame` (RN puro)**

`mobile/src/components/onboarding/step-rail/index.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/theme';

type StepRailProps = { step: 1 | 2 | 3 };

export function StepRail({ step }: StepRailProps) {
  const color = (n: number) => {
    if (n === step) return Brand.onGround;
    return n < step ? Brand.muted : Brand.field;
  };
  return (
    <View accessible accessibilityLabel={`Etapa ${step} de 3`} style={styles.rail}>
      {[1, 2, 3].map((n) => (
        <View key={n} style={[styles.dash, { backgroundColor: color(n) }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { position: 'absolute', right: 16, top: '38%', gap: 10 },
  dash: { width: 6, height: 28, borderRadius: 3 },
});
```

`mobile/src/components/onboarding/step-frame/index.tsx`:

```tsx
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepRail } from '@/components/onboarding/step-rail';
import { Brand } from '@/constants/theme';

type StepFrameProps = { step: 1 | 2 | 3; title: string; subtitle: string; children: ReactNode };

/** One step owns the whole screen: content anchored low, lifted with the keyboard. */
export function StepFrame({ step, title, subtitle, children }: StepFrameProps) {
  return (
    <SafeAreaView style={styles.ground}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fill}>
        <StepRail step={step} />
        <View style={styles.bottom}>
          <Text style={styles.kicker}>{`${step} de 3`}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: Brand.ground },
  fill: { flex: 1, justifyContent: 'flex-end' },
  bottom: { paddingHorizontal: 20, paddingRight: 44, paddingBottom: 24, gap: 10 },
  kicker: { color: Brand.muted, fontSize: 13, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: Brand.onGround, fontSize: 34, lineHeight: 40, fontWeight: '700' },
  subtitle: { color: Brand.muted, fontSize: 17, lineHeight: 22, marginBottom: 14 },
});
```

- [ ] **Step 4: `text-entry` (tipos, moldura, swift, compose, web)**

`text-entry/types.ts`:

```ts
export type TextEntryProps = {
  kind: 'phone' | 'username';
  label: string;
  placeholder: string;
  prefix?: string;
  error?: string | null;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
};
```

`text-entry/entry-shell.tsx` (moldura compartilhada: prefixo e erro anunciado):

```tsx
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import type { TextEntryProps } from '@/components/onboarding/text-entry/types';
import { Brand } from '@/constants/theme';

type EntryShellProps = Pick<TextEntryProps, 'prefix' | 'error'> & { children: ReactNode };

export function EntryShell({ prefix, error, children }: EntryShellProps) {
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);
  return (
    <View style={styles.wrap}>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        {children}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  field: { minHeight: 52, borderRadius: 12, backgroundColor: Brand.field, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  fieldError: { borderWidth: 2, borderColor: Brand.error },
  prefix: { color: Brand.muted, fontSize: 17, fontWeight: '600' },
  error: { color: Brand.error, fontSize: 14 },
});
```

`text-entry/swift/text-entry.tsx`:

```tsx
import { Host, TextField } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  foregroundStyle,
  keyboardType,
  onSubmit,
  submitLabel,
  textContentType,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';

import { EntryShell } from '@/components/onboarding/text-entry/entry-shell';
import type { TextEntryProps } from '@/components/onboarding/text-entry/types';
import { Brand } from '@/constants/theme';

export function SwiftTextEntry(props: TextEntryProps) {
  const phone = props.kind === 'phone';
  return (
    <EntryShell prefix={props.prefix} error={props.error}>
      <Host matchContents={{ vertical: true }} style={{ flex: 1 }}>
        <TextField
          autoFocus
          placeholder={props.placeholder}
          onTextChange={props.onChangeText}
          modifiers={[
            keyboardType(phone ? 'phone-pad' : 'ascii-capable'),
            textContentType(phone ? 'telephoneNumber' : 'username'),
            textInputAutocapitalization('never'),
            autocorrectionDisabled(),
            submitLabel('continue'),
            onSubmit(props.onSubmit),
            foregroundStyle(Brand.onGround),
            accessibilityLabel(props.label),
          ]}
        />
      </Host>
    </EntryShell>
  );
}
```

`text-entry/compose/text-entry.tsx`:

```tsx
import { Host, Text, TextField } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

import { EntryShell } from '@/components/onboarding/text-entry/entry-shell';
import type { TextEntryProps } from '@/components/onboarding/text-entry/types';
import { Brand } from '@/constants/theme';

const COLORS = {
  focusedContainerColor: Brand.field,
  unfocusedContainerColor: Brand.field,
  errorContainerColor: Brand.field,
  focusedTextColor: Brand.onGround,
  unfocusedTextColor: Brand.onGround,
  cursorColor: Brand.onGround,
  focusedIndicatorColor: Brand.onGround,
  unfocusedIndicatorColor: Brand.accent,
  errorIndicatorColor: Brand.error,
  focusedPlaceholderColor: Brand.pending,
  unfocusedPlaceholderColor: Brand.pending,
};

export function ComposeTextEntry(props: TextEntryProps) {
  return (
    <EntryShell prefix={props.prefix} error={props.error}>
      <Host matchContents={{ vertical: true }} style={{ flex: 1 }}>
        <TextField
          autoFocus
          singleLine
          isError={Boolean(props.error)}
          colors={COLORS}
          onValueChange={props.onChangeText}
          keyboardOptions={{
            keyboardType: props.kind === 'phone' ? 'phone' : 'ascii',
            capitalization: 'none',
            autoCorrectEnabled: false,
            imeAction: 'done',
          }}
          keyboardActions={{ onDone: props.onSubmit }}
          modifiers={[fillMaxWidth()]}>
          <TextField.Placeholder>
            <Text>{props.placeholder}</Text>
          </TextField.Placeholder>
        </TextField>
      </Host>
    </EntryShell>
  );
}
```

`text-entry/index.ios.tsx`: `export { SwiftTextEntry as TextEntry } from '@/components/onboarding/text-entry/swift/text-entry';`

`text-entry/index.android.tsx`: `export { ComposeTextEntry as TextEntry } from '@/components/onboarding/text-entry/compose/text-entry';`

`text-entry/index.tsx` (web e fallback de tipos):

```tsx
import { TextInput } from 'react-native';

import { EntryShell } from '@/components/onboarding/text-entry/entry-shell';
import type { TextEntryProps } from '@/components/onboarding/text-entry/types';
import { Brand } from '@/constants/theme';

export function TextEntry(props: TextEntryProps) {
  return (
    <EntryShell prefix={props.prefix} error={props.error}>
      <TextInput
        autoFocus
        accessibilityLabel={props.label}
        placeholder={props.placeholder}
        placeholderTextColor={Brand.pending}
        keyboardType={props.kind === 'phone' ? 'phone-pad' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={props.onChangeText}
        onSubmitEditing={props.onSubmit}
        style={{ flex: 1, color: Brand.onGround, fontSize: 17 }}
      />
    </EntryShell>
  );
}
```

- [ ] **Step 5: `primary-button`**

`primary-button/types.ts`: `export type PrimaryButtonProps = { label: string; busy?: boolean; onPress: () => void };`

`primary-button/swift/primary-button.tsx`:

```tsx
import { Button, Host, ProgressView, Text } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled, foregroundStyle, frame, tint } from '@expo/ui/swift-ui/modifiers';

import type { PrimaryButtonProps } from '@/components/onboarding/primary-button/types';
import { Brand } from '@/constants/theme';

export function SwiftPrimaryButton({ label, busy = false, onPress }: PrimaryButtonProps) {
  return (
    <Host matchContents={{ vertical: true }}>
      <Button
        onPress={onPress}
        modifiers={[buttonStyle('borderedProminent'), controlSize('large'), tint(Brand.cta), disabled(busy)]}>
        {busy ? (
          <ProgressView modifiers={[frame({ maxWidth: Infinity })]} />
        ) : (
          <Text modifiers={[foregroundStyle(Brand.onCta), frame({ maxWidth: Infinity })]}>{label}</Text>
        )}
      </Button>
    </Host>
  );
}
```

Confira a assinatura de `frame` em `node_modules/@expo/ui/build/swift-ui/modifiers/index.d.ts` (`export declare function frame(params: {...})`); se `maxWidth` não aceitar `Infinity`, use o valor que o tipo documenta para "ocupar a largura".

`primary-button/compose/primary-button.tsx`:

```tsx
import { Button, Host, LoadingIndicator, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

import type { PrimaryButtonProps } from '@/components/onboarding/primary-button/types';
import { Brand } from '@/constants/theme';

export function ComposePrimaryButton({ label, busy = false, onPress }: PrimaryButtonProps) {
  return (
    <Host matchContents={{ vertical: true }}>
      <Button
        onClick={onPress}
        enabled={!busy}
        colors={{ containerColor: Brand.cta, contentColor: Brand.onCta, disabledContainerColor: Brand.muted }}
        modifiers={[fillMaxWidth()]}>
        {busy ? <LoadingIndicator /> : <Text>{label}</Text>}
      </Button>
    </Host>
  );
}
```

`primary-button/index.ios.tsx`: `export { SwiftPrimaryButton as PrimaryButton } from '@/components/onboarding/primary-button/swift/primary-button';`

`primary-button/index.android.tsx`: `export { ComposePrimaryButton as PrimaryButton } from '@/components/onboarding/primary-button/compose/primary-button';`

`primary-button/index.tsx`:

```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import type { PrimaryButtonProps } from '@/components/onboarding/primary-button/types';
import { Brand } from '@/constants/theme';

export function PrimaryButton({ label, busy = false, onPress }: PrimaryButtonProps) {
  return (
    <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={styles.button}>
      {busy ? <ActivityIndicator color={Brand.onCta} /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: 14, backgroundColor: Brand.cta, alignItems: 'center', justifyContent: 'center' },
  label: { color: Brand.onCta, fontSize: 17, fontWeight: '600' },
});
```

- [ ] **Step 6: `permission-row`**

`permission-row/types.ts`:

```ts
export type PermissionRowProps = {
  title: string;
  reason: string;
  status: string;
  actionable: boolean;
  onRequest: () => void;
};
```

`permission-row/row-text.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';

import type { PermissionRowProps } from '@/components/onboarding/permission-row/types';
import { Brand } from '@/constants/theme';

export function RowText({ title, reason, status }: Pick<PermissionRowProps, 'title' | 'reason' | 'status'>) {
  return (
    <View style={styles.text}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.reason}>{reason}</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

export const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  webButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: Brand.field, justifyContent: 'center' },
  webLabel: { color: Brand.onGround, fontWeight: '600' },
});

const styles = StyleSheet.create({
  text: { flex: 1, gap: 2 },
  title: { color: Brand.onGround, fontSize: 17, fontWeight: '600' },
  reason: { color: Brand.muted, fontSize: 14, lineHeight: 19 },
  status: { color: Brand.pending, fontSize: 13 },
});
```

`permission-row/swift/permission-row.tsx`:

```tsx
import { Button, Host } from '@expo/ui/swift-ui';
import { buttonStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { RowText, rowStyles } from '@/components/onboarding/permission-row/row-text';
import type { PermissionRowProps } from '@/components/onboarding/permission-row/types';
import { Brand } from '@/constants/theme';

export function SwiftPermissionRow({ actionable, onRequest, ...text }: PermissionRowProps) {
  return (
    <View style={rowStyles.row}>
      <RowText {...text} />
      {actionable ? (
        <Host matchContents>
          <Button label="Permitir" onPress={onRequest} modifiers={[buttonStyle('bordered'), tint(Brand.onGround)]} />
        </Host>
      ) : null}
    </View>
  );
}
```

`permission-row/compose/permission-row.tsx`:

```tsx
import { FilledTonalButton, Host, Text } from '@expo/ui/jetpack-compose';
import { View } from 'react-native';

import { RowText, rowStyles } from '@/components/onboarding/permission-row/row-text';
import type { PermissionRowProps } from '@/components/onboarding/permission-row/types';
import { Brand } from '@/constants/theme';

export function ComposePermissionRow({ actionable, onRequest, ...text }: PermissionRowProps) {
  return (
    <View style={rowStyles.row}>
      <RowText {...text} />
      {actionable ? (
        <Host matchContents>
          <FilledTonalButton onClick={onRequest} colors={{ containerColor: Brand.field, contentColor: Brand.onGround }}>
            <Text>Permitir</Text>
          </FilledTonalButton>
        </Host>
      ) : null}
    </View>
  );
}
```

`permission-row/index.ios.tsx`: `export { SwiftPermissionRow as PermissionRow } from '@/components/onboarding/permission-row/swift/permission-row';`

`permission-row/index.android.tsx`: `export { ComposePermissionRow as PermissionRow } from '@/components/onboarding/permission-row/compose/permission-row';`

`permission-row/index.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native';

import { RowText, rowStyles } from '@/components/onboarding/permission-row/row-text';
import type { PermissionRowProps } from '@/components/onboarding/permission-row/types';

export function PermissionRow({ actionable, onRequest, ...text }: PermissionRowProps) {
  return (
    <View style={rowStyles.row}>
      <RowText {...text} />
      {actionable ? (
        <Pressable accessibilityRole="button" onPress={onRequest} style={rowStyles.webButton}>
          <Text style={rowStyles.webLabel}>Permitir</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 7: Verificar**

Run: `npm run lint -- --max-warnings=0 && npm run typecheck && npx vitest run src/lib`
Expected: limpo. Se o `tsc` acusar uma prop do `@expo/ui`, confira a assinatura em `node_modules/@expo/ui/build/<swift-ui|jetpack-compose>/<Componente>/*.d.ts` e ajuste a chamada sem trocar o componente.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/constants mobile/src/lib mobile/src/components/onboarding
git commit -m "feat(mobile): tokens Brand, textos e componentes swift/compose do onboarding"
```

---

### Task 11: Telas e composição

**Files:**
- Create: `mobile/src/app/(onboarding)/_layout.tsx`, `phone.tsx`, `username.tsx`, `permissions.tsx`
- Create: `mobile/src/app/(app)/_layout.tsx`, `mobile/src/app/(app)/index.tsx`
- Delete: `mobile/src/app/index.tsx` (tela do template)
- Modify: `mobile/src/app/_layout.tsx`

**Interfaces:**
- Consumes: Tasks 8 (`createAuthServices`, `readAuthConfig`), 9 (`OnboardingProvider`, `useOnboarding`, `useOnboardingFlow`), 10 (componentes, copy, `routeForStep`, `Brand`).

- [ ] **Step 1: Layout do grupo de onboarding**

`mobile/src/app/(onboarding)/_layout.tsx`:

```tsx
import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { routeForStep } from '@/lib/onboarding-routes';
import { useOnboarding } from '@/state/use-onboarding';

export const unstable_settings = { initialRouteName: 'phone' };

export default function OnboardingLayout() {
  const { step } = useOnboarding();
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const route = routeForStep(step);
    if (route) router.navigate(route);
  }, [step]);
  const animation = Platform.OS === 'android' ? 'fade_from_bottom' : 'default';
  return <Stack screenOptions={{ headerShown: false, animation: reduceMotion ? 'fade' : animation }} />;
}
```

- [ ] **Step 2: Telas do onboarding**

`mobile/src/app/(onboarding)/phone.tsx`:

```tsx
import { useState } from 'react';

import { PrimaryButton } from '@/components/onboarding/primary-button';
import { StepFrame } from '@/components/onboarding/step-frame';
import { TextEntry } from '@/components/onboarding/text-entry';
import { errorMessage } from '@/lib/onboarding-copy';
import { useOnboardingFlow } from '@/state/onboarding-provider';
import { useOnboarding } from '@/state/use-onboarding';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const { error, busy } = useOnboarding();
  const flow = useOnboardingFlow();
  const send = () => flow.submitPhone(phone);
  return (
    <StepFrame step={1} title="Qual é o seu número?" subtitle="Ele identifica sua conta. Não mandamos SMS.">
      <TextEntry
        kind="phone"
        label="Número de telefone"
        placeholder="+55 11 99999-0000"
        error={error ? errorMessage(error) : null}
        onChangeText={setPhone}
        onSubmit={send}
      />
      <PrimaryButton label={error === 'bridge_unreachable' ? 'Tentar de novo' : 'Continuar'} busy={busy} onPress={send} />
    </StepFrame>
  );
}
```

`mobile/src/app/(onboarding)/username.tsx`:

```tsx
import { useState } from 'react';

import { PrimaryButton } from '@/components/onboarding/primary-button';
import { StepFrame } from '@/components/onboarding/step-frame';
import { TextEntry } from '@/components/onboarding/text-entry';
import { errorMessage } from '@/lib/onboarding-copy';
import { useOnboardingFlow } from '@/state/onboarding-provider';
import { useOnboarding } from '@/state/use-onboarding';

export default function UsernameScreen() {
  const [username, setUsername] = useState('');
  const { error, busy } = useOnboarding();
  const flow = useOnboardingFlow();
  const send = () => flow.submitUsername(username);
  return (
    <StepFrame step={2} title="Escolha seu nome" subtitle="É o endereço pelo qual as pessoas te encontram. Ele não muda depois.">
      <TextEntry
        kind="username"
        label="Nome de usuário"
        placeholder="seu.nome"
        prefix="@"
        error={error ? errorMessage(error) : null}
        onChangeText={setUsername}
        onSubmit={send}
      />
      <PrimaryButton label={error === 'bridge_unreachable' ? 'Tentar de novo' : 'Continuar'} busy={busy} onPress={send} />
    </StepFrame>
  );
}
```

`mobile/src/app/(onboarding)/permissions.tsx`:

```tsx
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { PermissionRow } from '@/components/onboarding/permission-row';
import { PrimaryButton } from '@/components/onboarding/primary-button';
import { StepFrame } from '@/components/onboarding/step-frame';
import { PERMISSION_KINDS, type PermissionKind, type PermissionStatus } from '@/domain/onboarding';
import { PERMISSION_COPY, statusLabel } from '@/lib/onboarding-copy';
import { useOnboardingFlow } from '@/state/onboarding-provider';
import { useOnboarding } from '@/state/use-onboarding';

const askable = (kind: PermissionKind, status: PermissionStatus) =>
  status === 'undetermined' && !(Platform.OS === 'ios' && kind === 'nearby');

export default function PermissionsScreen() {
  const { permissions } = useOnboarding();
  const flow = useOnboardingFlow();
  useEffect(() => {
    flow.loadPermissions();
  }, [flow]);
  return (
    <StepFrame step={3} title="O que o app pode usar" subtitle="Tudo é opcional. Dá para mudar depois nos Ajustes.">
      {PERMISSION_KINDS.map((kind) => (
        <PermissionRow
          key={kind}
          {...PERMISSION_COPY[kind]}
          status={statusLabel(permissions[kind], Platform.OS, kind)}
          actionable={askable(kind, permissions[kind])}
          onRequest={() => flow.requestPermission(kind)}
        />
      ))}
      <PrimaryButton label="Concluir" onPress={() => flow.finish()} />
    </StepFrame>
  );
}
```

- [ ] **Step 3: Tela inicial pós-onboarding**

`mobile/src/app/(app)/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`mobile/src/app/(app)/index.tsx`:

```tsx
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useOnboarding } from '@/state/use-onboarding';

export default function HomeScreen() {
  const { userId } = useOnboarding();
  return (
    <SafeAreaView style={styles.ground}>
      <Text accessibilityRole="header" style={styles.title}>
        Tudo pronto
      </Text>
      <Text style={styles.subtitle}>{userId ? `Você entrou como ${userId.split(':')[0]}.` : ''}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: Brand.ground, justifyContent: 'center', paddingHorizontal: 20, gap: 10 },
  title: { color: Brand.onGround, fontSize: 34, fontWeight: '700' },
  subtitle: { color: Brand.muted, fontSize: 17 },
});
```

- [ ] **Step 4: Composição raiz**

Apague o template: `git rm mobile/src/app/index.tsx`.

Substitua `mobile/src/app/_layout.tsx` inteiro por:

```tsx
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { createAuthServices, readAuthConfig } from '@/adapters/create-auth';
import { OnboardingFlow } from '@/application/onboarding-flow';
import { OnboardingProvider } from '@/state/onboarding-provider';
import { useOnboarding } from '@/state/use-onboarding';

SplashScreen.preventAutoHideAsync();

// Composition root: the only place that picks concrete adapters for the ports.
const createFlow = () => new OnboardingFlow(createAuthServices(readAuthConfig()));

function AppStack() {
  const { step } = useOnboarding();
  useEffect(() => {
    if (step !== 'booting') SplashScreen.hideAsync();
  }, [step]);
  if (step === 'booting') return null;
  const done = step === 'done';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!done}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={done}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [flow] = useState(createFlow);
  return (
    <OnboardingProvider flow={flow}>
      <AppStack />
    </OnboardingProvider>
  );
}
```

- [ ] **Step 5: Verificar estático e na web (adaptadores demo)**

Run: `npm run lint -- --max-warnings=0 && npm run typecheck && npm run test:coverage`
Expected: limpo; cobertura ≥ 80%.

Run (em background): `npx expo start --web` e abra `http://localhost:8081` no navegador.
Expected: tela ameixa "Qual é o seu número?"; `+55 11 99999-0000` → "Escolha seu nome"; `admin` → "Esse nome já está em uso. Tente outro."; `marina` → "O que o app pode usar"; "Concluir" → "Tudo pronto".

- [ ] **Step 6: Commit**

```bash
git add "mobile/src/app/(onboarding)" "mobile/src/app/(app)" mobile/src/app/_layout.tsx mobile/src/app/index.tsx
git commit -m "feat(mobile): telas do onboarding, tela inicial e guarda com Stack.Protected"
```

---

### Task 12: Acabamento, verificação nativa e documentação

**Files:**
- Create: brief de superfície no caminho que `impeccable context` indicar; `DESIGN.md` (via `impeccable-documenter`); `mobile/.env.example`
- Modify: `README.md`, `docs/mobile-architecture.md`

- [ ] **Step 1: Registrar o contrato de direção**

Run (na raiz, com o launcher do impeccable instalado no WSL ou chamando o do Windows pelo `/mnt/c`): `impeccable context --target "mobile/src/app/(onboarding)"`
Grave a seção "Direction contract" do spec (THESIS a FINISH, literal) sob `## Direction contract` no brief de superfície que o comando apontar.

- [ ] **Step 2: Verificar nos aparelhos**

- Android: `npm run android` (gera o dev client e instala no emulador ou aparelho via `adb`). Capturas com `adb exec-out screencap -p > .impeccable/shots/android-<etapa>-<tema>.png` das três etapas, nos temas claro e escuro (`adb shell cmd uimode night yes`) e com `adb shell settings put system font_scale 1.3` (restaurar `1.0`).
- iOS: `npx eas-cli@latest build --platform ios --profile development`, baixe o `.ipa` e instale com `xtool install <arquivo>.ipa`; depois `npm run ios`. Mesmas variações. Sem aparelho iOS, registre "iOS: não verificado" no README.
- Conferir: teclado não cobre o campo nem o CTA; voltar pela borda (iOS) e Back (Android) funcionam; leitor de tela anuncia "Etapa N de 3" e os erros.

- [ ] **Step 3: Revisão final do impeccable**

Despache o subagente `impeccable:impeccable-finish-reviewer` com o spec, o brief e as capturas. Corrija a lista de ajustes materiais num único lote; no máximo uma rodada de confirmação.

- [ ] **Step 4: DESIGN.md**

Despache o subagente `impeccable:impeccable-documenter` para gerar `DESIGN.md` a partir do código entregue.

- [ ] **Step 5: Ponta a ponta com a bridge (depende do plano da bridge)**

1. `docker run -d -p 6167:6167 -e CONDUWUIT_SERVER_NAME=hq.local -e CONDUWUIT_ALLOW_REGISTRATION=true -e CONDUWUIT_REGISTRATION_TOKEN=reg ghcr.io/girlbossceo/conduwuit:latest` (ou continuwuity equivalente).
2. Na raiz: `PROVISION_TOKEN=t0ken PROVISION_SECRET=<aleatório> MATRIX_REGISTRATION_TOKEN=reg python -m bridge --fake --matrix-homeserver http://localhost:6167 --matrix-public-url http://<ip-lan>:6167 --provision-host 0.0.0.0`. No WSL 2, o IP da LAN é o do Windows: encaminhe as portas 6167 e 8766 (`netsh interface portproxy` no Windows) ou use o modo de rede espelhado do WSL.
3. `mobile/.env.local`: `EXPO_PUBLIC_PROVISION_URL=http://<ip-lan>:8766` e `EXPO_PUBLIC_PROVISION_TOKEN=t0ken`; rodar o dev client.
4. Fazer o onboarding no aparelho e confirmar com `curl http://localhost:6167/_matrix/client/v3/profile/@<username>:hq.local` que o display name foi gravado.

- [ ] **Step 6: Documentar**

`mobile/.env.example`:

```
EXPO_PUBLIC_PROVISION_URL=http://192.168.0.10:8766
EXPO_PUBLIC_PROVISION_TOKEN=change-me
```

Em `docs/mobile-architecture.md`, acrescente:

```markdown
## Onboarding e login Matrix

`OnboardingFlow` (`application/`) leva o usuário de telefone → username → permissões sobre quatro portas: `ProvisioningPort` (bridge HTTP ou demo), `MatrixAuthPort` (`@unomed/react-native-matrix-sdk` ou demo), `PermissionsPort` e `CredentialStore` (secure store). `state/` assina o fluxo com `useSyncExternalStore`. O `_layout.tsx` usa `Stack.Protected` para separar `(onboarding)` de `(app)`. A senha só existe em memória durante o login; o store guarda a sessão. Design: `docs/superpowers/specs/2026-11-02-matrix-onboarding-design.md`.
```

No `README.md`: atualize a linha de `mobile/` na tabela de pastas ("Expo 58, onboarding com login Matrix") e, na seção "Matrix account provisioning" (criada pelo plano da bridge), acrescente o passo do `.env.local` do mobile e uma linha **Verified / Not verified** com o resultado real do Step 5 e do Step 2 (Android, iOS).

- [ ] **Step 7: Gate completo**

Run (na raiz): `python scripts/quality_gate.py`
Expected: tudo `ok`. Se falhar, use a skill `fix-quality-gate` sem afrouxar regras.

- [ ] **Step 8: Commit**

```bash
git add DESIGN.md docs/mobile-architecture.md README.md mobile/.env.example <brief de superfície>
git commit -m "docs: DESIGN.md, arquitetura do onboarding e verificação ponta a ponta"
```
