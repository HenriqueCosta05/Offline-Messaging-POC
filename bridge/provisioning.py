"""Account provisioning rules: phone identity, Matrix username and derived password.
Contract: docs/superpowers/specs/2026-11-02-matrix-onboarding-design.md."""
import base64
import hashlib
import hmac
import re
from dataclasses import dataclass
from typing import Protocol

PHONE_RE = re.compile(r"\+[1-9][0-9]{7,14}")
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
