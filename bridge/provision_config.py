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
