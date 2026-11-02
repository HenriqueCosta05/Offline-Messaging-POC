import argparse
import asyncio
from pathlib import Path

from .manager import FakeMesh, MeshSettings, SdkMesh
from .server import serve


async def main() -> None:
    p = argparse.ArgumentParser(prog="bridge")
    p.add_argument("--fake", action="store_true", help="loopback mesh, no SDK needed")
    p.add_argument("--user-id", default="web-user", help="your peer id (SDK profile)")
    p.add_argument("--app-id", default="offline-web")
    p.add_argument("--state-root", default=".bridge-state")
    p.add_argument("--relay", metavar="WS_URL", help="Internet relay, e.g. ws://localhost:8080")
    p.add_argument("--ble", action="store_true", help="enable the BLE transport")
    p.add_argument("--port", type=int, default=8765)
    a = p.parse_args()
    if not a.fake and not (a.ble or a.relay):
        p.error("the SDK needs a transport: pass --ble and/or --relay ws://host:port (or use --fake)")
    settings = MeshSettings(a.app_id, a.user_id, Path(a.state_root), a.relay, a.ble)
    mesh = FakeMesh() if a.fake else SdkMesh(settings)
    server = await serve(mesh, port=a.port)
    print(f"bridge listening on ws://127.0.0.1:{a.port} ({'fake' if a.fake else 'sdk'})")
    await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
