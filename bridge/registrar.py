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
