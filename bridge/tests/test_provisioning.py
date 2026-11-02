import asyncio
import json
from pathlib import Path

import pytest

from bridge.provisioning import (
    Credentials,
    ProvisionError,
    ProvisioningConfig,
    ProvisioningService,
    derive_password,
    localpart,
    normalize_phone,
    validate_username,
)

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
    def __init__(self, taken=(), passwords=None, delay=0):
        self.taken = set(taken)
        self.passwords = dict(passwords or {})
        self.registered = []
        self.delay = delay

    async def is_available(self, username):
        await asyncio.sleep(self.delay)
        return username not in self.taken

    async def login(self, username, password):
        if self.passwords.get(username) == password:
            return f"@{username}:hq.local"
        return None

    async def register(self, username, password):
        self.registered.append((username, password))
        self.taken.add(username)
        self.passwords[username] = password
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


async def test_taken_username_with_matching_password_is_adopted():
    password = derive_password(CONFIG.secret, PHONE)
    registrar = StubRegistrar(taken={"marina"}, passwords={"marina": password})
    directory = MemoryDirectory()
    creds = await service(directory, registrar).provision(PHONE, "marina")
    assert creds == Credentials("@marina:hq.local", CONFIG.public_url, password)
    assert directory.entries == {PHONE: "@marina:hq.local"}
    assert registrar.registered == []


async def test_taken_username_with_other_password_is_rejected():
    registrar = StubRegistrar(taken={"marina"}, passwords={"marina": "other"})
    directory = MemoryDirectory()
    with pytest.raises(ProvisionError) as err:
        await service(directory, registrar).provision(PHONE, "marina")
    assert err.value.code == "username_taken"
    assert directory.entries == {}


async def test_concurrent_provision_creates_one_account():
    registrar = StubRegistrar(delay=0.01)
    svc = service(registrar=registrar)
    results = await asyncio.gather(*(svc.provision(PHONE, "marina") for _ in range(3)))
    assert len(registrar.registered) == 1
    assert {c.user_id for c in results} == {"@marina:hq.local"}


async def test_slow_homeserver_times_out(monkeypatch):
    monkeypatch.setattr("bridge.provisioning.PROVISION_BUDGET_S", 0.01)
    with pytest.raises(ProvisionError) as err:
        await service(registrar=StubRegistrar(delay=1)).provision(PHONE, "marina")
    assert err.value.code == "homeserver_unavailable"
