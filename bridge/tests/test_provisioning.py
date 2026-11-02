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
