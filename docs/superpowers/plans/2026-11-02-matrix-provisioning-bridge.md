# Provisionamento Matrix na bridge — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bridge expõe `POST /lookup` e `POST /provision` por HTTP, cria contas Matrix com registration token e devolve credenciais com senha derivada por HMAC.

**Architecture:** Regras puras em `bridge/provisioning.py` (domínio, com Protocols `Registrar` e `PhoneDirectory`). Adaptadores: `registrar.py` (API client-server via aiohttp), `phone_directory.py` (JSON atômico), `provision_http.py` (aiohttp.web). `provision_config.py` compõe tudo a partir de flags e ambiente; `__main__.py` só o chama.

**Tech Stack:** Python 3.12+, aiohttp, pytest + pytest-asyncio + pytest-aiohttp, ruff.

**Spec:** `docs/superpowers/specs/2026-11-02-matrix-onboarding-design.md` (seções Bridge, Segurança, Testes/Bridge).

## Global Constraints

- Sem git worktrees; trabalhe no checkout atual, branch `feat/matrix-onboarding`.
- Ambiente: WSL, em `~/Projects/POCs/Offline-Protocol-POC`, com o venv ativo (`source .venv/bin/activate`). Sem venv: `uv venv --python 3.12 .venv && uv pip install -r bridge/requirements.txt`.
- Um commit por tarefa, só com os arquivos da tarefa (o working tree tem alterações alheias: nunca `git add -A`). Mensagem ≤ 100 caracteres, sem linha de coautor.
- Complexidade ciclomática ≤ 10; máx. 4 argumentos por função (ruff `PLR0913`), 10 branches, 40 statements.
- Comentários e docstrings ≤ 2 linhas (`scripts/check_comments.py`).
- Toda função nova tem teste; cobertura de linhas e branches ≥ 80% em `bridge/`.
- Domínio (`bridge/provisioning.py`) não importa `aiohttp`, `websockets`, `nio`, SDK nem adaptadores.
- Nunca logar senha, `PROVISION_SECRET`, `PROVISION_TOKEN` nem `MATRIX_REGISTRATION_TOKEN`.
- Comando de teste: `python -m pytest bridge/tests -c bridge/pytest.ini --rootdir=. -q`.
- Antes de declarar pronto: `python scripts/quality_gate.py` passa.

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `docs/fixtures/identity-cases.json` | Criar | Casos válidos/inválidos de telefone e username, compartilhados com o mobile |
| `bridge/provisioning.py` | Criar | Domínio: validação, senha, `ProvisioningService`, Protocols |
| `bridge/phone_directory.py` | Criar | `JsonPhoneDirectory` |
| `bridge/registrar.py` | Criar | `HttpRegistrar`, `FakeRegistrar`, `RegistrarSettings` |
| `bridge/provision_http.py` | Criar | `create_app(service, token)` |
| `bridge/provision_config.py` | Criar | `ProvisionOptions`, `build_app`, `start_http` |
| `bridge/__main__.py` | Modificar | Flags novas e subida do servidor HTTP |
| `scripts/check_layers.py` | Modificar | `provisioning.py` em `DOMAIN_MODULES`; barrar `aiohttp` e os adaptadores novos |
| `bridge/requirements.txt` | Modificar | `aiohttp`, `pytest-aiohttp` |
| `bridge/tests/test_provisioning.py` etc. | Criar | Um arquivo de teste por módulo |
| `README.md`, `docs/CONVENTIONS.md` | Modificar | Seção de provisionamento; tabela de camadas |

---

### Task 1: Regras de identidade e senha (domínio)

**Files:**
- Create: `docs/fixtures/identity-cases.json`
- Create: `bridge/provisioning.py`
- Create: `bridge/tests/test_provisioning.py`
- Modify: `scripts/check_layers.py:8-9`
- Modify: `bridge/requirements.txt`

**Interfaces:**
- Produces: `ProvisionError(code: str, message: str, user_id: str | None = None)` com atributos `code`, `message`, `user_id`; `normalize_phone(raw: str) -> str`; `validate_username(raw: str) -> str`; `derive_password(secret: bytes, phone: str) -> str`.

- [ ] **Step 1: Criar a tabela compartilhada**

`docs/fixtures/identity-cases.json`:

```json
{
  "phone": {
    "valid": [
      ["+55 11 99999-0000", "+5511999990000"],
      ["+1 (415) 555.0100", "+14155550100"],
      ["+4930123456", "+4930123456"]
    ],
    "invalid": ["5511999990000", "+0511999990000", "+1234567", "+1234567890123456", "+55 11 9999O-0000", ""]
  },
  "username": {
    "valid": [
      ["marina.costa", "marina.costa"],
      [" Marina_99 ", "marina_99"],
      ["a-b", "a-b"],
      ["x=y", "x=y"]
    ],
    "invalid": ["ab", ".marina", "marina.", "mar ina", "marína", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", ""]
  }
}
```

- [ ] **Step 2: Escrever os testes que falham**

`bridge/tests/test_provisioning.py`:

```python
import json
from pathlib import Path

import pytest

from bridge.provisioning import ProvisionError, derive_password, normalize_phone, validate_username

CASES = json.loads((Path(__file__).resolve().parents[2] / "docs/fixtures/identity-cases.json").read_text("utf-8"))


@pytest.mark.parametrize(("raw", "expected"), CASES["phone"]["valid"])
def test_normalize_phone_accepts_e164(raw, expected):
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize("raw", CASES["phone"]["invalid"])
def test_normalize_phone_rejects(raw):
    with pytest.raises(ProvisionError) as err:
        normalize_phone(raw)
    assert err.value.code == "invalid_phone"


@pytest.mark.parametrize(("raw", "expected"), CASES["username"]["valid"])
def test_validate_username_accepts(raw, expected):
    assert validate_username(raw) == expected


@pytest.mark.parametrize("raw", CASES["username"]["invalid"])
def test_validate_username_rejects(raw):
    with pytest.raises(ProvisionError) as err:
        validate_username(raw)
    assert err.value.code == "invalid_username"


def test_derive_password_is_deterministic_per_phone():
    first = derive_password(b"secret", "+5511999990000")
    assert first == derive_password(b"secret", "+5511999990000")
    assert first != derive_password(b"secret", "+5511999990001")
    assert first != derive_password(b"other", "+5511999990000")
    assert "=" not in first and len(first) == 43
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `python -m pytest bridge/tests/test_provisioning.py -c bridge/pytest.ini --rootdir=. -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'bridge.provisioning'`

- [ ] **Step 4: Implementar**

`bridge/provisioning.py`:

```python
"""Account provisioning rules: phone identity, Matrix username and derived password.
Contract: docs/superpowers/specs/2026-11-02-matrix-onboarding-design.md."""
import base64
import hashlib
import hmac
import re

PHONE_RE = re.compile(r"\+[1-9]\d{7,14}")
USERNAME_RE = re.compile(r"[a-z0-9._=-]{3,32}")
PHONE_NOISE = str.maketrans("", "", " -().")


class ProvisionError(Exception):
    def __init__(self, code: str, message: str, user_id: str | None = None):
        super().__init__(message)
        self.code, self.message, self.user_id = code, message, user_id


def normalize_phone(raw: str) -> str:
    phone = raw.strip().translate(PHONE_NOISE)
    if not PHONE_RE.fullmatch(phone):
        raise ProvisionError("invalid_phone", "use E.164, e.g. +5511999990000")
    return phone


def validate_username(raw: str) -> str:
    username = raw.strip().lower()
    if not USERNAME_RE.fullmatch(username) or username.startswith(".") or username.endswith("."):
        raise ProvisionError("invalid_username", "3-32 chars: a-z 0-9 . _ = -")
    return username


def derive_password(secret: bytes, phone: str) -> str:
    digest = hmac.new(secret, phone.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
```

- [ ] **Step 5: Rodar e ver passar**

Run: `python -m pytest bridge/tests/test_provisioning.py -c bridge/pytest.ini --rootdir=. -q`
Expected: PASS (21 testes)

- [ ] **Step 6: Registrar a camada e as dependências**

Em `scripts/check_layers.py`, troque as linhas de `DOMAIN_MODULES` e `FORBIDDEN` por:

```python
DOMAIN_MODULES = ("bridge/protocol.py", "bridge/provisioning.py")
FORBIDDEN = ("offline_protocol_sdk", "websockets", "nio", "aiohttp", "bridge.manager", "bridge.server",
             "bridge.__main__", "bridge.registrar", "bridge.phone_directory", "bridge.provision_http",
             "bridge.provision_config")
```

Em `bridge/requirements.txt`, acrescente:

```
aiohttp>=3.9
pytest-aiohttp>=1.0
```

Run: `uv pip install -r bridge/requirements.txt && python scripts/check_layers.py && python -m pytest scripts/tests -q`
Expected: `check_layers: 0 violação(ões)` e testes dos scripts passando.

- [ ] **Step 7: Commit**

```bash
git add docs/fixtures/identity-cases.json bridge/provisioning.py bridge/tests/test_provisioning.py scripts/check_layers.py bridge/requirements.txt
git commit -m "feat(bridge): regras de telefone, username e senha HMAC do provisionamento"
```

---

### Task 2: `ProvisioningService`

**Files:**
- Modify: `bridge/provisioning.py`
- Modify: `bridge/tests/test_provisioning.py`

**Interfaces:**
- Consumes: Task 1 (`ProvisionError`, `normalize_phone`, `validate_username`, `derive_password`).
- Produces:
  - `Credentials(user_id: str, homeserver: str, password: str)` (dataclass frozen)
  - `ProvisioningConfig(secret: bytes, public_url: str)` (dataclass frozen)
  - `class Registrar(Protocol)`: `async is_available(username: str) -> bool`; `async register(username: str, password: str) -> str` (devolve o user_id)
  - `class PhoneDirectory(Protocol)`: `get(phone: str) -> str | None`; `put(phone: str, user_id: str) -> None`
  - `ProvisioningService(registrar, directory, config)` com `lookup(raw_phone: str) -> str | None` e `async provision(raw_phone: str, raw_username: str) -> Credentials`
  - `localpart(user_id: str) -> str`

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `bridge/tests/test_provisioning.py`:

```python
from bridge.provisioning import Credentials, ProvisioningConfig, ProvisioningService, localpart

PHONE = "+5511999990000"
CONFIG = ProvisioningConfig(secret=b"s3cret", public_url="http://192.168.0.10:6167")


class MemoryDirectory:
    def __init__(self, entries=None):
        self.entries = dict(entries or {})

    def get(self, phone):
        return self.entries.get(phone)

    def put(self, phone, user_id):
        self.entries[phone] = user_id


class StubRegistrar:
    def __init__(self, taken=()):
        self.taken = set(taken)
        self.registered = []

    async def is_available(self, username):
        return username not in self.taken

    async def register(self, username, password):
        self.registered.append((username, password))
        return f"@{username}:hq.local"


def service(directory=None, registrar=None):
    return ProvisioningService(registrar or StubRegistrar(), directory or MemoryDirectory(), CONFIG)


def test_localpart_strips_sigil_and_server():
    assert localpart("@marina.costa:hq.local:8448") == "marina.costa"


def test_lookup_normalizes_and_reads_directory():
    directory = MemoryDirectory({PHONE: "@marina:hq.local"})
    assert service(directory).lookup("+55 11 99999-0000") == "@marina:hq.local"
    assert service(directory).lookup("+5511999990001") is None


async def test_new_phone_registers_and_records():
    registrar, directory = StubRegistrar(), MemoryDirectory()
    creds = await service(directory, registrar).provision("+55 11 99999-0000", "Marina")
    password = derive_password(CONFIG.secret, PHONE)
    assert creds == Credentials("@marina:hq.local", CONFIG.public_url, password)
    assert registrar.registered == [("marina", password)]
    assert directory.entries == {PHONE: "@marina:hq.local"}


async def test_known_phone_same_username_is_idempotent():
    registrar = StubRegistrar(taken={"marina"})
    directory = MemoryDirectory({PHONE: "@marina:hq.local"})
    creds = await service(directory, registrar).provision(PHONE, "marina")
    assert creds.user_id == "@marina:hq.local"
    assert registrar.registered == []


async def test_known_phone_other_username_is_phone_taken():
    directory = MemoryDirectory({PHONE: "@marina:hq.local"})
    with pytest.raises(ProvisionError) as err:
        await service(directory).provision(PHONE, "outra")
    assert (err.value.code, err.value.user_id) == ("phone_taken", "@marina:hq.local")


async def test_new_phone_taken_username_is_rejected():
    registrar = StubRegistrar(taken={"marina"})
    with pytest.raises(ProvisionError) as err:
        await service(registrar=registrar).provision(PHONE, "marina")
    assert err.value.code == "username_taken"
    assert registrar.registered == []
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest bridge/tests/test_provisioning.py -c bridge/pytest.ini --rootdir=. -q`
Expected: FAIL com `ImportError: cannot import name 'Credentials'`

- [ ] **Step 3: Implementar**

Em `bridge/provisioning.py`, acrescente aos imports `from dataclasses import dataclass` e `from typing import Protocol`, e ao fim do arquivo:

```python
@dataclass(frozen=True)
class Credentials:
    user_id: str
    homeserver: str
    password: str


@dataclass(frozen=True)
class ProvisioningConfig:
    secret: bytes
    public_url: str


class Registrar(Protocol):
    async def is_available(self, username: str) -> bool: ...
    async def register(self, username: str, password: str) -> str: ...


class PhoneDirectory(Protocol):
    def get(self, phone: str) -> str | None: ...
    def put(self, phone: str, user_id: str) -> None: ...


def localpart(user_id: str) -> str:
    return user_id.removeprefix("@").split(":", 1)[0]


class ProvisioningService:
    def __init__(self, registrar: Registrar, directory: PhoneDirectory, config: ProvisioningConfig):
        self._registrar, self._directory, self._config = registrar, directory, config

    def lookup(self, raw_phone: str) -> str | None:
        return self._directory.get(normalize_phone(raw_phone))

    async def provision(self, raw_phone: str, raw_username: str) -> Credentials:
        phone, username = normalize_phone(raw_phone), validate_username(raw_username)
        user_id = self._directory.get(phone)
        if user_id is None:
            user_id = await self._register(phone, username)
        elif localpart(user_id) != username:
            raise ProvisionError("phone_taken", "phone already has another account", user_id)
        return Credentials(user_id, self._config.public_url, self._password(phone))

    async def _register(self, phone: str, username: str) -> str:
        if not await self._registrar.is_available(username):
            raise ProvisionError("username_taken", "username already in use")
        user_id = await self._registrar.register(username, self._password(phone))
        self._directory.put(phone, user_id)
        return user_id

    def _password(self, phone: str) -> str:
        return derive_password(self._config.secret, phone)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest bridge/tests/test_provisioning.py -c bridge/pytest.ini --rootdir=. -q && python scripts/check_layers.py`
Expected: PASS e `check_layers: 0 violação(ões)`

- [ ] **Step 5: Commit**

```bash
git add bridge/provisioning.py bridge/tests/test_provisioning.py
git commit -m "feat(bridge): ProvisioningService com lookup e provision idempotente"
```

---

### Task 3: `JsonPhoneDirectory`

**Files:**
- Create: `bridge/phone_directory.py`
- Create: `bridge/tests/test_phone_directory.py`

**Interfaces:**
- Consumes: Protocol `PhoneDirectory` da Task 2 (`get`, `put`).
- Produces: `JsonPhoneDirectory(path: Path)`.

- [ ] **Step 1: Escrever os testes que falham**

`bridge/tests/test_phone_directory.py`:

```python
import json

from bridge.phone_directory import JsonPhoneDirectory


def test_missing_file_starts_empty(tmp_path):
    assert JsonPhoneDirectory(tmp_path / "phones.json").get("+5511999990000") is None


def test_put_persists_across_instances(tmp_path):
    path = tmp_path / "state" / "phones.json"
    JsonPhoneDirectory(path).put("+5511999990000", "@marina:hq.local")
    assert JsonPhoneDirectory(path).get("+5511999990000") == "@marina:hq.local"
    assert not (path.parent / "phones.json.tmp").exists()


def test_corrupted_file_is_moved_aside(tmp_path):
    path = tmp_path / "phones.json"
    path.write_text("{not json", encoding="utf-8")
    directory = JsonPhoneDirectory(path)
    assert directory.get("+5511999990000") is None
    assert (tmp_path / "phones.json.bak").read_text(encoding="utf-8") == "{not json"
    assert not path.exists()


def test_non_object_json_is_moved_aside(tmp_path):
    path = tmp_path / "phones.json"
    path.write_text(json.dumps(["x"]), encoding="utf-8")
    JsonPhoneDirectory(path)
    assert (tmp_path / "phones.json.bak").exists()
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest bridge/tests/test_phone_directory.py -c bridge/pytest.ini --rootdir=. -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'bridge.phone_directory'`

- [ ] **Step 3: Implementar**

`bridge/phone_directory.py`:

```python
"""Phone → Matrix user id map persisted as JSON; holds no secrets."""
import json
import logging
import os
from pathlib import Path

log = logging.getLogger("bridge")


class JsonPhoneDirectory:
    def __init__(self, path: Path):
        self._path = path
        self._entries = self._load()

    def get(self, phone: str) -> str | None:
        return self._entries.get(phone)

    def put(self, phone: str, user_id: str) -> None:
        self._entries[phone] = user_id
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_name(self._path.name + ".tmp")
        tmp.write_text(json.dumps(self._entries, indent=2), encoding="utf-8")
        os.replace(tmp, self._path)

    def _load(self) -> dict[str, str]:
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return {}
        except ValueError:
            data = None
        return data if isinstance(data, dict) else self._quarantine()

    def _quarantine(self) -> dict[str, str]:
        backup = self._path.with_name(self._path.name + ".bak")
        os.replace(self._path, backup)
        log.warning("phone directory unreadable; moved to %s", backup)
        return {}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest bridge/tests/test_phone_directory.py -c bridge/pytest.ini --rootdir=. -q`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add bridge/phone_directory.py bridge/tests/test_phone_directory.py
git commit -m "feat(bridge): JsonPhoneDirectory com escrita atômica e quarentena .bak"
```

---

### Task 4: `HttpRegistrar` e `FakeRegistrar`

**Files:**
- Create: `bridge/registrar.py`
- Create: `bridge/tests/test_registrar.py`

**Interfaces:**
- Consumes: Protocol `Registrar` e `ProvisionError` (Tasks 1–2).
- Produces: `RegistrarSettings(homeserver: str, registration_token: str)`; `HttpRegistrar(session: aiohttp.ClientSession, settings: RegistrarSettings)`; `FakeRegistrar(server_name: str = "fake.local")` com atributo `accounts: dict[str, str]`. Erros: `username_taken`, `registration_rejected`, `homeserver_unavailable`.

- [ ] **Step 1: Escrever os testes que falham**

`bridge/tests/test_registrar.py`:

```python
import aiohttp
import pytest
from aiohttp import web

from bridge.provisioning import ProvisionError
from bridge.registrar import FakeRegistrar, HttpRegistrar, RegistrarSettings

REGISTER = "/_matrix/client/v3/register"
TOKEN_FLOW = "m.login.registration_token"


class Homeserver:
    def __init__(self):
        self.taken = {"bob"}
        self.limited = 0
        self.bodies = []

    def app(self):
        app = web.Application()
        app.router.add_get(f"{REGISTER}/available", self.available)
        app.router.add_post(REGISTER, self.register)
        return app

    async def available(self, request):
        if self.limited:
            self.limited -= 1
            return web.json_response({"errcode": "M_LIMIT_EXCEEDED", "retry_after_ms": 1}, status=429)
        if request.query["username"] in self.taken:
            return web.json_response({"errcode": "M_USER_IN_USE"}, status=400)
        return web.json_response({"available": True})

    async def register(self, request):
        body = await request.json()
        self.bodies.append(body)
        auth = body.get("auth")
        if auth is None:
            return web.json_response({"session": "s1", "flows": [{"stages": [TOKEN_FLOW]}]}, status=401)
        if auth != {"type": TOKEN_FLOW, "token": "tok", "session": "s1"}:
            return web.json_response({"errcode": "M_FORBIDDEN"}, status=401)
        if body["username"] in self.taken:
            return web.json_response({"errcode": "M_USER_IN_USE"}, status=400)
        return web.json_response({"user_id": f"@{body['username']}:test.local"})


@pytest.fixture
async def homeserver(aiohttp_server):
    hs = Homeserver()
    server = await aiohttp_server(hs.app())
    async with aiohttp.ClientSession() as session:
        yield hs, session, str(server.make_url(""))


def registrar(homeserver, token="tok"):
    _, session, url = homeserver
    return HttpRegistrar(session, RegistrarSettings(url, token))


async def test_available_and_in_use(homeserver):
    assert await registrar(homeserver).is_available("marina") is True
    assert await registrar(homeserver).is_available("bob") is False


async def test_register_runs_token_flow_and_inhibits_login(homeserver):
    hs = homeserver[0]
    assert await registrar(homeserver).register("marina", "pw") == "@marina:test.local"
    assert [b.get("auth", {}).get("type") for b in hs.bodies] == [None, TOKEN_FLOW]
    assert all(b["inhibit_login"] is True and b["password"] == "pw" for b in hs.bodies)


async def test_wrong_registration_token_is_rejected(homeserver):
    with pytest.raises(ProvisionError) as err:
        await registrar(homeserver, token="wrong").register("marina", "pw")
    assert err.value.code == "registration_rejected"


async def test_register_race_on_taken_username(homeserver):
    with pytest.raises(ProvisionError) as err:
        await registrar(homeserver).register("bob", "pw")
    assert err.value.code == "username_taken"


async def test_rate_limit_retries_once(homeserver):
    homeserver[0].limited = 1
    assert await registrar(homeserver).is_available("marina") is True


async def test_persistent_rate_limit_is_unavailable(homeserver):
    homeserver[0].limited = 2
    with pytest.raises(ProvisionError) as err:
        await registrar(homeserver).is_available("marina")
    assert err.value.code == "homeserver_unavailable"


async def test_unreachable_homeserver():
    async with aiohttp.ClientSession() as session:
        dead = HttpRegistrar(session, RegistrarSettings("http://127.0.0.1:1", "tok"))
        with pytest.raises(ProvisionError) as err:
            await dead.is_available("marina")
    assert err.value.code == "homeserver_unavailable"


async def test_fake_registrar_tracks_accounts():
    fake = FakeRegistrar()
    assert await fake.is_available("marina") is True
    assert await fake.register("marina", "pw") == "@marina:fake.local"
    assert await fake.is_available("marina") is False
    with pytest.raises(ProvisionError):
        await fake.register("marina", "pw")
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest bridge/tests/test_registrar.py -c bridge/pytest.ini --rootdir=. -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'bridge.registrar'`

- [ ] **Step 3: Implementar**

`bridge/registrar.py`:

```python
"""Registers Matrix accounts through the client-server API using a registration token."""
import asyncio
from dataclasses import dataclass

import aiohttp

from .provisioning import ProvisionError

REGISTER = "/_matrix/client/v3/register"
TOKEN_FLOW = "m.login.registration_token"


@dataclass(frozen=True)
class RegistrarSettings:
    homeserver: str
    registration_token: str


def register_error(status: int, reply: dict) -> ProvisionError:
    if reply.get("errcode") == "M_USER_IN_USE":
        return ProvisionError("username_taken", "username already in use")
    if status in (401, 403):
        return ProvisionError("registration_rejected", "registration token refused")
    return ProvisionError("homeserver_unavailable", f"register failed with HTTP {status}")


class HttpRegistrar:
    def __init__(self, session: aiohttp.ClientSession, settings: RegistrarSettings):
        self._session = session
        self._base = settings.homeserver.rstrip("/")
        self._token = settings.registration_token

    async def is_available(self, username: str) -> bool:
        status, reply = await self._call("GET", f"{REGISTER}/available", params={"username": username})
        if status == 200:
            return True
        if reply.get("errcode") == "M_USER_IN_USE":
            return False
        raise ProvisionError("homeserver_unavailable", f"availability check failed with HTTP {status}")

    async def register(self, username: str, password: str) -> str:
        body = {"username": username, "password": password, "inhibit_login": True}
        status, reply = await self._call("POST", REGISTER, json=body)
        if status == 401 and "session" in reply:
            body["auth"] = {"type": TOKEN_FLOW, "token": self._token, "session": reply["session"]}
            status, reply = await self._call("POST", REGISTER, json=body)
        if status == 200:
            return reply["user_id"]
        raise register_error(status, reply)

    async def _call(self, method: str, path: str, **kwargs) -> tuple[int, dict]:
        status, reply = await self._send(method, path, **kwargs)
        if reply.get("errcode") == "M_LIMIT_EXCEEDED":
            await asyncio.sleep(reply.get("retry_after_ms", 1000) / 1000)
            status, reply = await self._send(method, path, **kwargs)
        if reply.get("errcode") == "M_LIMIT_EXCEEDED":
            raise ProvisionError("homeserver_unavailable", "homeserver rate limit")
        return status, reply

    async def _send(self, method: str, path: str, **kwargs) -> tuple[int, dict]:
        try:
            async with self._session.request(method, self._base + path, **kwargs) as resp:
                return resp.status, await resp.json(content_type=None) or {}
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as exc:
            raise ProvisionError("homeserver_unavailable", "homeserver unreachable") from exc


class FakeRegistrar:
    """In-memory registrar for --fake-matrix and tests."""

    def __init__(self, server_name: str = "fake.local"):
        self.server_name = server_name
        self.accounts: dict[str, str] = {}

    async def is_available(self, username: str) -> bool:
        return username not in self.accounts

    async def register(self, username: str, password: str) -> str:
        if username in self.accounts:
            raise ProvisionError("username_taken", "username already in use")
        self.accounts[username] = password
        return f"@{username}:{self.server_name}"
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest bridge/tests/test_registrar.py -c bridge/pytest.ini --rootdir=. -q && python -m ruff check bridge`
Expected: PASS (8 testes) e ruff sem erros

- [ ] **Step 5: Commit**

```bash
git add bridge/registrar.py bridge/tests/test_registrar.py
git commit -m "feat(bridge): HttpRegistrar com registration token e FakeRegistrar"
```

---

### Task 5: API HTTP de provisionamento

**Files:**
- Create: `bridge/provision_http.py`
- Create: `bridge/tests/test_provision_http.py`

**Interfaces:**
- Consumes: `ProvisioningService`, `ProvisionError`, `Credentials` (Task 2); `FakeRegistrar` (Task 4) nos testes.
- Produces: `create_app(service: ProvisioningService, token: str) -> web.Application`; `STATUS: dict[str, int]`.

- [ ] **Step 1: Escrever os testes que falham**

`bridge/tests/test_provision_http.py`:

```python
import pytest

from bridge.provision_http import create_app
from bridge.provisioning import ProvisionError, ProvisioningConfig, ProvisioningService
from bridge.registrar import FakeRegistrar

AUTH = {"Authorization": "Bearer t0ken"}
PHONE = "+5511999990000"


class MemoryDirectory:
    def __init__(self):
        self.entries = {}

    def get(self, phone):
        return self.entries.get(phone)

    def put(self, phone, user_id):
        self.entries[phone] = user_id


class FailingRegistrar:
    def __init__(self, code):
        self.code = code

    async def is_available(self, username):
        raise ProvisionError(self.code, "boom")

    async def register(self, username, password):
        raise AssertionError("not reached")


def make_client(aiohttp_client, registrar=None):
    config = ProvisioningConfig(b"s3cret", "http://192.168.0.10:6167")
    service = ProvisioningService(registrar or FakeRegistrar("hq.local"), MemoryDirectory(), config)
    return aiohttp_client(create_app(service, "t0ken"))


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer wrong"}])
async def test_requires_token(aiohttp_client, headers):
    client = await make_client(aiohttp_client)
    resp = await client.post("/lookup", json={"phone": PHONE}, headers=headers)
    assert resp.status == 401
    assert (await resp.json())["code"] == "unauthorized"


async def test_provision_then_lookup(aiohttp_client):
    client = await make_client(aiohttp_client)
    resp = await client.post("/provision", json={"phone": PHONE, "username": "marina"}, headers=AUTH)
    body = await resp.json()
    assert resp.status == 200
    assert body["user_id"] == "@marina:hq.local"
    assert body["homeserver"] == "http://192.168.0.10:6167"
    assert len(body["password"]) == 43
    lookup = await client.post("/lookup", json={"phone": "+55 11 99999-0000"}, headers=AUTH)
    assert await lookup.json() == {"user_id": "@marina:hq.local"}


async def test_unknown_phone_lookup_is_null(aiohttp_client):
    client = await make_client(aiohttp_client)
    resp = await client.post("/lookup", json={"phone": PHONE}, headers=AUTH)
    assert await resp.json() == {"user_id": None}


@pytest.mark.parametrize("payload", ["not json", '{"phone": 1}', "[]"])
async def test_bad_body_is_400(aiohttp_client, payload):
    client = await make_client(aiohttp_client)
    resp = await client.post("/lookup", data=payload, headers=AUTH)
    assert resp.status == 400
    assert (await resp.json())["code"] == "bad_request"


async def test_validation_and_conflicts(aiohttp_client):
    client = await make_client(aiohttp_client)
    bad = await client.post("/provision", json={"phone": "123", "username": "marina"}, headers=AUTH)
    assert (bad.status, (await bad.json())["code"]) == (422, "invalid_phone")
    await client.post("/provision", json={"phone": PHONE, "username": "marina"}, headers=AUTH)
    taken = await client.post("/provision", json={"phone": PHONE, "username": "outra"}, headers=AUTH)
    assert taken.status == 409
    assert await taken.json() == {"code": "phone_taken", "message": "phone already has another account",
                                  "user_id": "@marina:hq.local"}


@pytest.mark.parametrize(("code", "status"), [("registration_rejected", 502), ("homeserver_unavailable", 503)])
async def test_homeserver_failures(aiohttp_client, code, status):
    client = await make_client(aiohttp_client, FailingRegistrar(code))
    resp = await client.post("/provision", json={"phone": PHONE, "username": "marina"}, headers=AUTH)
    assert (resp.status, (await resp.json())["code"]) == (status, code)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest bridge/tests/test_provision_http.py -c bridge/pytest.ini --rootdir=. -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'bridge.provision_http'`

- [ ] **Step 3: Implementar**

`bridge/provision_http.py`:

```python
"""HTTP endpoints the mobile app calls to provision its Matrix account."""
import hmac
import logging
from dataclasses import asdict

from aiohttp import web

from .provisioning import ProvisionError, ProvisioningService

log = logging.getLogger("bridge")
STATUS = {
    "unauthorized": 401, "bad_request": 400, "invalid_phone": 422, "invalid_username": 422,
    "username_taken": 409, "phone_taken": 409, "registration_rejected": 502, "homeserver_unavailable": 503,
}


def error_response(err: ProvisionError) -> web.Response:
    body = {"code": err.code, "message": err.message}
    if err.user_id:
        body["user_id"] = err.user_id
    return web.json_response(body, status=STATUS.get(err.code, 500))


def auth_middleware(token: str):
    expected = f"Bearer {token}".encode()

    @web.middleware
    async def check(request: web.Request, handler):
        given = request.headers.get("Authorization", "").encode()
        if not hmac.compare_digest(given, expected):
            return error_response(ProvisionError("unauthorized", "missing or wrong token"))
        return await handler(request)

    return check


@web.middleware
async def error_middleware(request: web.Request, handler):
    try:
        return await handler(request)
    except ProvisionError as err:
        if STATUS.get(err.code, 500) >= 500:
            log.warning("provisioning failed: %s (%s)", err.code, err.message)
        return error_response(err)


async def read_fields(request: web.Request, *names: str) -> list[str]:
    try:
        body = await request.json()
    except ValueError as exc:
        raise ProvisionError("bad_request", "body must be JSON") from exc
    if not isinstance(body, dict) or not all(isinstance(body.get(name), str) for name in names):
        raise ProvisionError("bad_request", f"expected string fields: {', '.join(names)}")
    return [body[name] for name in names]


class Handlers:
    def __init__(self, service: ProvisioningService):
        self._service = service

    async def lookup(self, request: web.Request) -> web.Response:
        (phone,) = await read_fields(request, "phone")
        return web.json_response({"user_id": self._service.lookup(phone)})

    async def provision(self, request: web.Request) -> web.Response:
        phone, username = await read_fields(request, "phone", "username")
        return web.json_response(asdict(await self._service.provision(phone, username)))


def create_app(service: ProvisioningService, token: str) -> web.Application:
    app = web.Application(middlewares=[auth_middleware(token), error_middleware])
    handlers = Handlers(service)
    app.router.add_post("/lookup", handlers.lookup)
    app.router.add_post("/provision", handlers.provision)
    return app
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest bridge/tests/test_provision_http.py -c bridge/pytest.ini --rootdir=. -q && python -m ruff check bridge`
Expected: PASS (10 testes) e ruff sem erros

- [ ] **Step 5: Commit**

```bash
git add bridge/provision_http.py bridge/tests/test_provision_http.py
git commit -m "feat(bridge): API HTTP /lookup e /provision com Bearer token"
```

---

### Task 6: Composição, flags e documentação

**Files:**
- Create: `bridge/provision_config.py`
- Create: `bridge/tests/test_provision_config.py`
- Modify: `bridge/__main__.py`
- Modify: `README.md` (nova seção após "Use the real mesh")
- Modify: `docs/CONVENTIONS.md` (tabela de Camadas)

**Interfaces:**
- Consumes: `create_app` (Task 5), `HttpRegistrar`/`FakeRegistrar`/`RegistrarSettings` (Task 4), `JsonPhoneDirectory` (Task 3), `ProvisioningService`/`ProvisioningConfig` (Task 2).
- Produces: `ProvisionOptions(homeserver: str | None, public_url: str | None, fake: bool, state_root: Path)`; `build_app(options, environ: Mapping[str, str], session) -> web.Application | None`; `async start_http(app, host: str, port: int) -> web.AppRunner`.

- [ ] **Step 1: Escrever os testes que falham**

`bridge/tests/test_provision_config.py`:

```python
import aiohttp
import pytest

from bridge.provision_config import ProvisionOptions, build_app, start_http

ENV = {"PROVISION_TOKEN": "t0ken", "PROVISION_SECRET": "s3cret", "MATRIX_REGISTRATION_TOKEN": "reg"}


def options(tmp_path, **overrides):
    values = {"homeserver": None, "public_url": None, "fake": False, "state_root": tmp_path}
    return ProvisionOptions(**{**values, **overrides})


def test_disabled_without_homeserver_or_fake(tmp_path):
    assert build_app(options(tmp_path), ENV, session=None) is None


@pytest.mark.parametrize("missing", ["PROVISION_TOKEN", "PROVISION_SECRET", "MATRIX_REGISTRATION_TOKEN"])
def test_missing_env_exits_with_names(tmp_path, missing):
    env = {k: v for k, v in ENV.items() if k != missing}
    with pytest.raises(SystemExit, match=missing):
        build_app(options(tmp_path, homeserver="http://hs:8008"), env, session=None)


def test_fake_does_not_need_registration_token(tmp_path):
    env = {k: v for k, v in ENV.items() if k != "MATRIX_REGISTRATION_TOKEN"}
    assert build_app(options(tmp_path, fake=True), env, session=None) is not None


async def test_started_app_serves_fake_provisioning(tmp_path):
    app = build_app(options(tmp_path, fake=True, public_url="http://10.0.0.5:6167"), ENV, session=None)
    runner = await start_http(app, "127.0.0.1", 0)
    port = runner.addresses[0][1]
    try:
        async with aiohttp.ClientSession() as session:
            resp = await session.post(f"http://127.0.0.1:{port}/provision",
                                      json={"phone": "+5511999990000", "username": "marina"},
                                      headers={"Authorization": "Bearer t0ken"})
            body = await resp.json()
    finally:
        await runner.cleanup()
    assert body["user_id"] == "@marina:fake.local"
    assert body["homeserver"] == "http://10.0.0.5:6167"
    assert (tmp_path / "phones.json").exists()


async def test_real_registrar_uses_homeserver_as_default_public_url(tmp_path):
    async with aiohttp.ClientSession() as session:
        app = build_app(options(tmp_path, homeserver="http://127.0.0.1:1"), ENV, session)
        runner = await start_http(app, "127.0.0.1", 0)
        port = runner.addresses[0][1]
        try:
            resp = await session.post(f"http://127.0.0.1:{port}/provision",
                                      json={"phone": "+5511999990000", "username": "marina"},
                                      headers={"Authorization": "Bearer t0ken"})
        finally:
            await runner.cleanup()
    assert (resp.status, (await resp.json())["code"]) == (503, "homeserver_unavailable")
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest bridge/tests/test_provision_config.py -c bridge/pytest.ini --rootdir=. -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'bridge.provision_config'`

- [ ] **Step 3: Implementar**

`bridge/provision_config.py`:

```python
"""Builds the provisioning HTTP app from CLI flags and environment secrets."""
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

import aiohttp
from aiohttp import web

from .phone_directory import JsonPhoneDirectory
from .provision_http import create_app
from .provisioning import ProvisioningConfig, ProvisioningService
from .registrar import FakeRegistrar, HttpRegistrar, RegistrarSettings

SECRETS = ("PROVISION_TOKEN", "PROVISION_SECRET")
FAKE_PUBLIC_URL = "http://fake.local"


@dataclass(frozen=True)
class ProvisionOptions:
    homeserver: str | None
    public_url: str | None
    fake: bool
    state_root: Path


def read_env(names: tuple[str, ...], environ: Mapping[str, str]) -> dict[str, str]:
    missing = [name for name in names if not environ.get(name)]
    if missing:
        raise SystemExit("provisioning needs these environment variables: " + ", ".join(missing))
    return {name: environ[name] for name in names}


def build_app(options: ProvisionOptions, environ: Mapping[str, str],
              session: aiohttp.ClientSession | None) -> web.Application | None:
    if not options.fake and options.homeserver is None:
        return None
    names = SECRETS if options.fake else (*SECRETS, "MATRIX_REGISTRATION_TOKEN")
    env = read_env(names, environ)
    if options.fake:
        registrar = FakeRegistrar()
    else:
        registrar = HttpRegistrar(session, RegistrarSettings(options.homeserver, env["MATRIX_REGISTRATION_TOKEN"]))
    public_url = options.public_url or options.homeserver or FAKE_PUBLIC_URL
    config = ProvisioningConfig(env["PROVISION_SECRET"].encode(), public_url)
    service = ProvisioningService(registrar, JsonPhoneDirectory(options.state_root / "phones.json"), config)
    return create_app(service, env["PROVISION_TOKEN"])


async def start_http(app: web.Application, host: str, port: int) -> web.AppRunner:
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, host, port).start()
    return runner
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest bridge/tests/test_provision_config.py -c bridge/pytest.ini --rootdir=. -q`
Expected: PASS (7 testes)

- [ ] **Step 5: Ligar no `__main__.py`**

Substitua `bridge/__main__.py` inteiro por:

```python
import argparse
import asyncio
import os
from pathlib import Path

import aiohttp

from .manager import FakeMesh, MeshSettings, SdkMesh
from .provision_config import ProvisionOptions, build_app, start_http
from .server import serve


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="bridge")
    p.add_argument("--fake", action="store_true", help="loopback mesh, no SDK needed")
    p.add_argument("--user-id", default="web-user", help="your peer id (SDK profile)")
    p.add_argument("--app-id", default="offline-web")
    p.add_argument("--state-root", default=".bridge-state")
    p.add_argument("--relay", metavar="WS_URL", help="Internet relay, e.g. ws://localhost:8080")
    p.add_argument("--ble", action="store_true", help="enable the BLE transport")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--matrix-homeserver", metavar="URL", help="homeserver where accounts are registered")
    p.add_argument("--matrix-public-url", metavar="URL", help="homeserver URL the phone can reach")
    p.add_argument("--fake-matrix", action="store_true", help="in-memory Matrix registrar")
    p.add_argument("--provision-host", default="127.0.0.1", help="0.0.0.0 to accept phones on the LAN")
    p.add_argument("--provision-port", type=int, default=8766)
    a = p.parse_args()
    if not a.fake and not (a.ble or a.relay):
        p.error("the SDK needs a transport: pass --ble and/or --relay ws://host:port (or use --fake)")
    return a


async def main() -> None:
    a = parse_args()
    settings = MeshSettings(a.app_id, a.user_id, Path(a.state_root), a.relay, a.ble)
    mesh = FakeMesh() if a.fake else SdkMesh(settings)
    server = await serve(mesh, port=a.port)
    print(f"bridge listening on ws://127.0.0.1:{a.port} ({'fake' if a.fake else 'sdk'})")
    options = ProvisionOptions(a.matrix_homeserver, a.matrix_public_url, a.fake_matrix, Path(a.state_root))
    async with aiohttp.ClientSession() as session:
        app = build_app(options, os.environ, session)
        if app is not None:
            await start_http(app, a.provision_host, a.provision_port)
            print(f"provisioning on http://{a.provision_host}:{a.provision_port}")
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
```

Run: `python -m bridge --help`
Expected: a ajuda lista `--matrix-homeserver`, `--matrix-public-url`, `--fake-matrix`, `--provision-host`, `--provision-port`.

- [ ] **Step 6: Documentar**

Em `README.md`, após a seção "Use the real mesh", acrescente:

````markdown
## Matrix account provisioning

The mobile onboarding asks the bridge to create a Matrix account for a phone number. The bridge registers it on your homeserver with a registration token and returns a password derived from the phone (HMAC), so it stores no passwords; `.bridge-state/phones.json` maps phone numbers to Matrix ids.

```bash
export PROVISION_TOKEN=<shared with the app>  PROVISION_SECRET=<long random>  MATRIX_REGISTRATION_TOKEN=<from the homeserver>
python -m bridge --fake --matrix-homeserver http://localhost:6167 \
  --matrix-public-url http://<your-lan-ip>:6167 --provision-host 0.0.0.0
```

Without a homeserver, `--fake-matrix` uses an in-memory registrar (only `PROVISION_TOKEN` and `PROVISION_SECRET` needed).

**Not for production:** the password travels as plain HTTP on the LAN; the app's `PROVISION_TOKEN` is embedded in its bundle; anyone with `PROVISION_SECRET` can compute every account's password; phone numbers are not verified.
````

Em `docs/CONVENTIONS.md`, na tabela de Camadas, troque as três linhas de módulos por:

```markdown
| Domínio + portas | stdlib, outros módulos de domínio | `bridge/protocol.py` (`MeshPort`, validação de frames), `bridge/provisioning.py` (`Registrar`, `PhoneDirectory`, regras de conta) |
| Adaptadores | domínio, portas, bibliotecas externas | `bridge/manager.py` (SDK), `bridge/server.py` (WebSocket), `bridge/registrar.py`, `bridge/phone_directory.py`, `bridge/provision_http.py` |
| Composição | tudo | `bridge/__main__.py`, `bridge/provision_config.py` |
```

E no parágrafo seguinte, troque `` `nio` `` por `` `nio`, `aiohttp` ``.

- [ ] **Step 7: Gate completo**

Run: `python scripts/quality_gate.py`
Expected: todas as linhas `bridge` e `repo` com `ok`; cobertura de `bridge` ≥ 80%. Se algo falhar, use a skill `fix-quality-gate` sem afrouxar regras.

- [ ] **Step 8: Commit**

```bash
git add bridge/provision_config.py bridge/tests/test_provision_config.py bridge/__main__.py README.md docs/CONVENTIONS.md
git commit -m "feat(bridge): flags e servidor HTTP de provisionamento Matrix; docs"
```

---

## Verificação manual (depois do plano mobile)

Registrada no plano mobile, que fecha o ciclo ponta a ponta com o aparelho.
