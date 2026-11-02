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
