"""Registers Matrix accounts through the client-server API using a registration token."""
import asyncio
import contextlib
from dataclasses import dataclass

import aiohttp

from .provisioning import ProvisionError

REGISTER = "/_matrix/client/v3/register"
LOGIN = "/_matrix/client/v3/login"
LOGOUT = "/_matrix/client/v3/logout"
TOKEN_FLOW = "m.login.registration_token"
MAX_RETRY_AFTER_MS = 2000
DEFAULT_RETRY_AFTER_MS = 1000
REJECTED_USERNAME = ("M_INVALID_USERNAME", "M_EXCLUSIVE")


@dataclass(frozen=True)
class RegistrarSettings:
    homeserver: str
    registration_token: str


def retry_delay(reply: dict) -> float:
    value = reply.get("retry_after_ms")
    millis = value if isinstance(value, (int, float)) and value >= 0 else DEFAULT_RETRY_AFTER_MS
    return min(millis, MAX_RETRY_AFTER_MS) / 1000


def rejected_username() -> ProvisionError:
    return ProvisionError("invalid_username", "username not accepted by the homeserver")


def register_error(status: int, reply: dict) -> ProvisionError:
    if reply.get("errcode") == "M_USER_IN_USE":
        return ProvisionError("username_taken", "username already in use")
    if reply.get("errcode") in REJECTED_USERNAME:
        return rejected_username()
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
        if reply.get("errcode") in REJECTED_USERNAME:
            raise rejected_username()
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

    async def login(self, username: str, password: str) -> str | None:
        body = {
            "type": "m.login.password",
            "identifier": {"type": "m.id.user", "user": username},
            "password": password,
        }
        status, reply = await self._call("POST", LOGIN, json=body)
        if status == 403:
            return None
        if status != 200:
            raise ProvisionError("homeserver_unavailable", f"login failed with HTTP {status}")
        await self._logout(reply.get("access_token"))
        return reply["user_id"]

    async def _logout(self, access_token: str | None) -> None:
        headers = {"Authorization": f"Bearer {access_token}"}
        with contextlib.suppress(ProvisionError):  # best effort: a leftover device is harmless
            await self._send("POST", LOGOUT, headers=headers, json={})

    async def _call(self, method: str, path: str, **kwargs) -> tuple[int, dict]:
        status, reply = await self._send(method, path, **kwargs)
        if reply.get("errcode") == "M_LIMIT_EXCEEDED":
            await asyncio.sleep(retry_delay(reply))
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

    async def login(self, username: str, password: str) -> str | None:
        if self.accounts.get(username) != password:
            return None
        return f"@{username}:{self.server_name}"
