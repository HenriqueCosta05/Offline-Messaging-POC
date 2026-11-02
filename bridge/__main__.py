import argparse
import asyncio
import os
from pathlib import Path

import aiohttp

from .manager import FakeMesh, MeshSettings, SdkMesh
from .provision_config import ProvisionOptions, build_app, start_http
from .server import serve


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="bridge")
    p.add_argument("--fake", action="store_true", help="loopback mesh, no SDK needed")
    p.add_argument("--user-id", default="web-user", help="your peer id (SDK profile)")
    p.add_argument("--app-id", default="offline-web")
    p.add_argument("--state-root", default=".bridge-state")
    p.add_argument("--relay", metavar="WS_URL", help="Internet relay, e.g. ws://localhost:8080")
    p.add_argument("--ble", action="store_true", help="enable the BLE transport")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--matrix-homeserver", metavar="URL", help="homeserver where accounts are registered")
    p.add_argument("--matrix-public-url", metavar="URL", help="homeserver URL the phone can reach")
    p.add_argument("--fake-matrix", action="store_true", help="in-memory Matrix registrar")
    p.add_argument("--provision-host", default="127.0.0.1", help="0.0.0.0 to accept phones on the LAN")
    p.add_argument("--provision-port", type=int, default=8766)
    a = p.parse_args(argv)
    if not a.fake and not (a.ble or a.relay):
        p.error("the SDK needs a transport: pass --ble and/or --relay ws://host:port (or use --fake)")
    return a


def provision_options(a: argparse.Namespace) -> ProvisionOptions:
    return ProvisionOptions(a.matrix_homeserver, a.matrix_public_url, a.fake_matrix, Path(a.state_root))


async def main() -> None:
    a = parse_args()
    settings = MeshSettings(a.app_id, a.user_id, Path(a.state_root), a.relay, a.ble)
    mesh = FakeMesh() if a.fake else SdkMesh(settings)
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
        app = build_app(provision_options(a), os.environ, session)
        server = await serve(mesh, port=a.port)
        print(f"bridge listening on ws://127.0.0.1:{a.port} ({'fake' if a.fake else 'sdk'})")
        if app is not None:
            await start_http(app, a.provision_host, a.provision_port)
            print(f"provisioning on http://{a.provision_host}:{a.provision_port}")
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
