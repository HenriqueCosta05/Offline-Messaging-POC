"""Account provisioning rules: phone identity, Matrix username and derived password.
Contract: docs/superpowers/specs/2026-11-02-matrix-onboarding-design.md."""
import base64
import hashlib
import hmac
import re

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
