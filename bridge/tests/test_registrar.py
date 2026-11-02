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
