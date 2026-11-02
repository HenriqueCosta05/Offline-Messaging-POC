# Login Matrix e onboarding mobile — design

Data: 2026-11-02 · Status: aguardando revisão do usuário

## Objetivo

O app mobile ganha um onboarding de três etapas (telefone, username, permissões) que termina com o usuário autenticado no Matrix pelo `@unomed/react-native-matrix-sdk` em modo senha. A bridge Python provisiona a conta no homeserver e devolve as credenciais ao app.

## Decisões

| Tema | Decisão |
|---|---|
| Quem cria a conta | A bridge, via `/register` com `m.login.registration_token` |
| Senha | `HMAC-SHA256(PROVISION_SECRET, telefone)` em base64url; a bridge não guarda senha |
| Identidade | Telefone E.164 é a chave; o MXID é `@<username escolhido>:<servidor>` |
| Memória da bridge | Só o mapa telefone → MXID em `<state_root>/phones.json` (sem segredos) |
| Transporte app → bridge | HTTP (`aiohttp.web`) em porta própria, `Authorization: Bearer <PROVISION_TOKEN>` |
| WebSocket do browser | Inalterado: loopback e checagem de Origin |
| Login no app | Senha só em memória durante o login; sessão (token, device) no `expo-secure-store` |
| Display name | Igual ao username, definido após o login |
| Permissões | Bluetooth/nearby, notificações, microfone, contatos; nenhuma bloqueia o avanço |
| Relação com o gateway | Independente de `2026-11-02-matrix-gateway-design.md`; não usa `matrix-nio` |
| Direção visual | "Uma tela por vez" (ver Direction contract) |

## Fluxo

```
Etapa 1 telefone ──POST /lookup {phone}──▶ bridge ──▶ {user_id | null}
   conhecido ──▶ POST /provision {phone, username existente} ──▶ login ──▶ Etapa 3
   novo      ──▶ Etapa 2
Etapa 2 username ──POST /provision {phone, username}──▶ bridge
   bridge: valida → GET /register/available → POST /register (2 fases, inhibit_login)
           → grava phones.json → {user_id, homeserver, password}
   app: MatrixAuthPort.login → setDisplayName(username) → CredentialStore.save(sessão)
Etapa 3 permissões ──▶ finish() grava onboarded=true ──▶ (tabs)
```

## Bridge

### Módulos

| Módulo | Camada | Responsabilidade |
|---|---|---|
| `bridge/provisioning.py` | Domínio (entra em `DOMAIN_MODULES` de `scripts/check_layers.py`) | `normalize_phone`, `validate_username`, `derive_password`; Protocols `Registrar` e `PhoneDirectory`; `ProvisioningService` com `lookup` e `provision`; `ProvisionError(code, message)` |
| `bridge/registrar.py` | Adaptador | `HttpRegistrar` (aiohttp `ClientSession`) e `FakeRegistrar` (memória) |
| `bridge/phone_directory.py` | Adaptador | `JsonPhoneDirectory` com escrita atômica (`tmp` + `os.replace`); arquivo corrompido vira `.bak` e o mapa começa vazio |
| `bridge/provision_http.py` | Adaptador | `create_app(service, token) -> web.Application` com `POST /lookup` e `POST /provision` |
| `bridge/__main__.py` | Composição | Flags e variáveis abaixo; sobe o servidor HTTP junto com o WebSocket |

### Regras de domínio

- `normalize_phone(raw)`: remove espaços, `-`, `(`, `)`, `.`; exige `+` seguido de 8 a 15 dígitos, o primeiro diferente de 0.
- `validate_username(raw)`: minúsculas após `strip`; `^[a-z0-9._=-]{3,32}$`; não começa nem termina com `.`.
- Os casos válidos e inválidos dos dois vivem em `docs/fixtures/identity-cases.json`, lido pelos testes da bridge e do mobile.
- `provision(phone, username)`:

| Estado do telefone | Username | Resultado |
|---|---|---|
| Conhecido | Igual ao gravado | Devolve credenciais (idempotente) |
| Conhecido | Diferente | `ProvisionError("phone_taken")` com o MXID existente |
| Novo | Livre | Registra, grava o mapa, devolve credenciais |
| Novo | Ocupado | `ProvisionError("username_taken")` |

### `HttpRegistrar`

- `is_available(username)`: `GET /_matrix/client/v3/register/available?username=`; `M_USER_IN_USE` → `False`.
- `register(username, password)`: `POST /_matrix/client/v3/register` com `{username, password, inhibit_login: true}`; o `401` traz `session`; repete com `auth: {type: "m.login.registration_token", token, session}`.
- `M_LIMIT_EXCEEDED`: espera `retry_after_ms` uma vez; se falhar de novo, `homeserver_unavailable`.
- Logs nunca incluem senha, `PROVISION_SECRET`, `PROVISION_TOKEN` nem o registration token.

### API HTTP

Corpo e respostas em JSON. Erro: `{"code": "...", "message": "..."}`.

| Rota | Corpo | 200 |
|---|---|---|
| `POST /lookup` | `{"phone"}` | `{"user_id": "@x:srv" \| null}` |
| `POST /provision` | `{"phone", "username"}` | `{"user_id", "homeserver", "password"}` |

| Situação | Status / `code` |
|---|---|
| Token ausente ou errado (`hmac.compare_digest`) | `401 unauthorized` |
| JSON inválido ou campo ausente | `400 bad_request` |
| Telefone ou username inválido | `422 invalid_phone` / `invalid_username` |
| Username ocupado / telefone já com outro username | `409 username_taken` / `409 phone_taken` (com `user_id`) |
| Registration token recusado | `502 registration_rejected` |
| Homeserver inacessível ou rate limit persistente | `503 homeserver_unavailable` |

`homeserver` na resposta é `--matrix-public-url`, o endereço que o celular alcança.

### Configuração

| Flag / variável | Padrão | Uso |
|---|---|---|
| `--matrix-homeserver URL` | — | Onde a bridge registra contas |
| `--matrix-public-url URL` | igual a `--matrix-homeserver` | Devolvido ao app |
| `--provision-host` | `127.0.0.1` | `0.0.0.0` para aceitar o celular na LAN |
| `--provision-port` | `8766` | |
| `--fake-matrix` | desligado | Usa `FakeRegistrar` |
| `PROVISION_TOKEN`, `PROVISION_SECRET`, `MATRIX_REGISTRATION_TOKEN` | — | Só por ambiente |

`scripts/check_layers.py` passa a barrar também `aiohttp` em módulos de domínio.

O provisionamento sobe só com `--matrix-homeserver` ou `--fake-matrix`. Faltando qualquer variável exigida, o processo encerra com mensagem clara. `requirements.txt` ganha `aiohttp` e `pytest-aiohttp`.

## Mobile

### Camadas

| Camada | Arquivo | Conteúdo |
|---|---|---|
| Domínio | `domain/onboarding.ts` | `normalizePhone`, `validateUsername`, `OnboardingStep`, transições, `PermissionKind`, `PermissionStatus`, `OnboardingErrorCode`, `MatrixCredentials`, `MatrixSession` |
| Portas | `ports/provisioning-port.ts`, `ports/matrix-auth-port.ts`, `ports/permissions-port.ts`, `ports/credential-store.ts` | Contratos abaixo |
| Aplicação | `application/onboarding-flow.ts` | `OnboardingFlow` com estado imutável e `subscribe`, no padrão do `MeshSession` |
| Adaptadores | `adapters/provisioning/`, `adapters/matrix/`, `adapters/permissions/`, `adapters/credentials/`, `adapters/create-auth.ts` | Real e demo de cada porta |
| Estado de UI | `queries/onboarding-provider.tsx`, `queries/use-onboarding.ts` | Chave `['onboarding']`; mutações `useSubmitPhone`, `useSubmitUsername`, `useRequestPermission`, `useFinishOnboarding` |
| Composição | `app/_layout.tsx` | Instancia `createAuthServices()`; `Stack.Protected` separa `(onboarding)` de `(tabs)` |

### Portas

```ts
ProvisioningPort { lookup(phone): Promise<string | null>; provision(phone, username): Promise<MatrixCredentials> }
MatrixAuthPort   { login(creds): Promise<MatrixSession>; restore(session): Promise<void>; setDisplayName(name): Promise<void> }
PermissionsPort  { check(kind): Promise<PermissionStatus>; request(kind): Promise<PermissionStatus> }
CredentialStore  { load(): Promise<StoredAccount | null>; save(account): Promise<void>; clear(): Promise<void> }
```

`StoredAccount = { session: MatrixSession; onboarded: boolean }`. `MatrixSession` tem `userId`, `homeserver`, `accessToken`, `deviceId`; nunca a senha.

### `OnboardingFlow`

- `boot()`: `load()`; sem conta → `phone`; com conta → `restore`, depois `done` se `onboarded`, senão `permissions`; `restore` falhou → `clear()` e `phone`.
- `submitPhone(raw)`: valida; `lookup`; conhecido → `provision` com o localpart existente → login → `permissions`; novo → `username`.
- `submitUsername(raw)`: valida; `provision` → `login` → `setDisplayName` (falha só loga) → `save({session, onboarded: false})` → `permissions`.
- `requestPermission(kind)`: atualiza o status daquela permissão.
- `finish()`: `save({session, onboarded: true})` → `done`.

### Adaptadores

| Porta | Real (dev client) | Demo (Expo Go e web) |
|---|---|---|
| Provisioning | `HttpProvisioning`: `fetch` com timeout de 10 s, `EXPO_PUBLIC_PROVISION_URL` e `EXPO_PUBLIC_PROVISION_TOKEN` | `DemoProvisioning` com latência simulada |
| Matrix | `SdkMatrixAuth`: `ClientBuilder` com homeserver e session paths no diretório de documentos, `login` em modo senha | `DemoMatrixAuth` |
| Permissões | `ExpoPermissions`: nearby reusa `adapters/mesh/android-permissions.ts`; no iOS dispara o prompt do Bluetooth iniciando o mesh brevemente; `expo-notifications`, `expo-audio`, `expo-contacts` | `DemoPermissions` (sempre `granted`) |
| Credenciais | `SecureCredentialStore` (`expo-secure-store`) | Memória |

`createAuthServices()` escolhe real ou demo pela presença do módulo nativo, como `createMesh`. Dependências novas via `npx expo install`: `@unomed/react-native-matrix-sdk`, `expo-secure-store`, `expo-notifications`, `expo-audio`, `expo-contacts`. O `app.json` ganha as descrições de uso do iOS e as permissões do Android.

## UI

### Direction contract

- **THESIS:** cada etapa é a tela inteira; recusa o formulário branco com indicador "1/3" no canto.
- **OWN-WORLD:** fundo ameixa `#2f2235` de borda a borda nos dois temas; texto branco; campo `#3f3244`; CTA branco com texto ameixa; trilho de três traços à direita; tipografia do sistema com escala dinâmica.
- **STORY:** o avaliador entende que só três respostas o separam do app, responde uma por vez e entra autenticado.
- **FIRST VIEWPORT:** metade superior vazia (folga do teclado); rótulo "1 de 3", título de 34 pt, subtítulo, campo e CTA largo ancorados embaixo; trilho centrado verticalmente à direita.
- **FORM:** desafiante "vertical video feed surface", escolhido na segunda rodada; seed: cfee59d7.
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

### Tokens (`constants/theme.ts`, objeto `Brand`)

| Token | Valor | Uso |
|---|---|---|
| `ground` | `#2f2235` | Fundo do onboarding |
| `field` | `#3f3244` | Fundo dos campos |
| `accent` | `#60495a` | Foco do campo, trilho |
| `onGround` | `#ffffff` | Texto principal (14:1) |
| `muted` | `#bfc3ba` | Subtítulo, traço concluído (8:1) |
| `pending` | `#a9aca9` | Placeholder, permissão não decidida (6.6:1) |
| `cta` / `onCta` | `#ffffff` / `#2f2235` | Botão principal |
| `error` | `#ffb4ab` | Mensagens de erro (9:1) |

### Componentes (`components/onboarding/`)

| Pasta | Arquivos |
|---|---|
| `step-frame/` | `index.tsx` (RN): fundo, safe area, trilho, bloco que sobe com o teclado |
| `step-rail/` | `index.tsx` (RN): três traços, `accessibilityLabel` "Etapa N de 3" |
| `text-entry/` | `index.ios.tsx` → `swift/text-entry.tsx`; `index.android.tsx` → `compose/text-entry.tsx`; `index.tsx` (web) |
| `primary-button/` | `swift/` (`Button` prominent + `ProgressView`); `compose/` (`Button` filled + `LoadingIndicator`); `index.tsx` (web) |
| `permission-row/` | `swift/` (`LabeledContent` + `Button`); `compose/` (`ListItem` + botão tonal); `index.tsx` (web) |

Componentes não têm regra de negócio: recebem valor, erro e callbacks.

### Telas (`app/(onboarding)/`)

| Tela | Título | Detalhes |
|---|---|---|
| `phone.tsx` | "Qual é o seu número?" | `phone-pad`, autofill de telefone |
| `username.tsx` | "Escolha seu nome" | `@` fixo antes, `:servidor` depois; sem consulta enquanto digita |
| `permissions.tsx` | "O que o app pode usar" | Quatro linhas com o porquê; "Concluir" sempre habilitado |

### Movimento e acessibilidade

- iOS: push padrão (o voltar pela borda continua funcionando). Android: shared axis Y do Material 3. Reduce Motion / Remove animations: crossfade.
- Erros aparecem abaixo do campo em `error` e são anunciados pelo leitor de tela; sem modal.
- Alvos de toque de 44 pt (iOS) e 48 dp (Android).

## Tratamento de erros

| Origem | `OnboardingErrorCode` | Fica em | Mensagem |
|---|---|---|---|
| Telefone inválido (domínio) | `invalid_phone` | phone | "Use o formato com DDI, por exemplo +55 11 99999-0000." |
| Username inválido (domínio) | `invalid_username` | username | "Use 3 a 32 caracteres: letras minúsculas, números, ponto ou traço." |
| `409 username_taken` | `username_taken` | username | "Esse nome já está em uso. Tente outro." |
| `409 phone_taken` | — | — | Reprovisiona com o username existente e segue para o login |
| `fetch` falhou, timeout, `401`, `502`, `503` | `bridge_unreachable` | atual | "Não deu para falar com o servidor. Tente de novo." + botão |
| Login recusado pelo SDK | `login_failed` | username | "A conta foi criada, mas o login falhou. Tente de novo." |
| `restore` falhou no boot | — | phone | Limpa o store e reinicia |
| `setDisplayName` falhou | — | segue | Só log |

O `401` vai para o log com o motivo real. Repetir após `login_failed` é seguro porque o provisionamento é idempotente.

## Segurança e privacidade

- `PROVISION_SECRET` é a chave mestra: quem o tem calcula a senha de todas as contas. Nunca é logado nem aceito por argumento.
- `EXPO_PUBLIC_PROVISION_TOKEN` vai embutido no bundle: impede uso por estranhos na LAN, não por quem tem o app.
- A senha trafega em HTTP puro na LAN. Aceito para a PoC; o README marca como inadequado para produção.
- O telefone não é verificado (sem OTP): qualquer pessoa com o app e um número que não é dela cria conta com ele.
- `phones.json` liga telefone a MXID: dado pessoal, fica em `.bridge-state/` (já fora do git).

## Testes

### Bridge (pytest, cobertura ≥ 80%)

- `test_provisioning.py`: tabela de `docs/fixtures/identity-cases.json`; `derive_password` determinística e diferente por telefone; os quatro casos de `provision`; `lookup`.
- `test_registrar.py`: servidor aiohttp de teste simulando `available`, o `401` com `session` e o `200`; `M_USER_IN_USE`; `M_LIMIT_EXCEEDED` com uma nova tentativa; token recusado.
- `test_phone_directory.py`: ida e volta em `tmp_path`; arquivo corrompido vira `.bak`.
- `test_provision_http.py` (`aiohttp_client`): `401` sem token e com token errado; `400`, `422`, `409`, `502`, `503`; resposta de sucesso.

### Mobile (Vitest, cobertura ≥ 80% nas camadas de lógica)

- `domain/onboarding.test.ts`: a mesma tabela compartilhada e as transições.
- `application/onboarding-flow.test.ts` com `FakeProvisioning`, `FakeMatrixAuth`, `FakePermissions`, `FakeCredentialStore` em `src/test/fakes.ts`: caminho feliz, telefone conhecido, cada linha da tabela de erros, boot com e sem sessão, `restore` falhando, e a garantia de que a senha nunca chega ao `CredentialStore`.
- Adaptadores com `vi.mock`: `HttpProvisioning` (status, timeout), `SdkMatrixAuth`, `ExpoPermissions` (ramo por plataforma), `SecureCredentialStore`, `createAuthServices`.
- `queries/onboarding-queries.test.tsx` em jsdom com `waitFor`.
- Telas e componentes ficam fora da cobertura; verificação por screenshot no emulador Android e no simulador iOS, temas claro e escuro, fonte grande.

### Manual ponta a ponta

continuwuity em Docker com registration token → `python -m bridge --fake --matrix-homeserver … --matrix-public-url http://<ip-lan>:<porta> --provision-host 0.0.0.0` → onboarding no aparelho com dev client → login no Element Web com o `@username`. Resultado no README como Verificado / Não verificado.

## Fora de escopo

OTP ou verificação do telefone, TLS no provisionamento, rate limit na bridge, logout e troca de conta, mensagens e salas pelo SDK Matrix no app, integração com o gateway-bot, edição de display name depois do onboarding.
