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
