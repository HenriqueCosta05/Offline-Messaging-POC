"""Loopback WebSocket server exposing a MeshPort to the browser."""
import asyncio
import json
import logging
from typing import Iterable

from websockets.asyncio.server import ServerConnection
from websockets.asyncio.server import serve as ws_serve
from websockets.datastructures import Headers
from websockets.http11 import Request, Response

from .protocol import MeshPort, ProtocolError, parse_command

log = logging.getLogger("bridge")
DEFAULT_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")


def error_frame(code: str, message: str) -> str:
    return json.dumps({"type": "error", "code": code, "message": message})


class BrowserHub:
    """Fans mesh events out to browser tabs and remembers identity and neighbors for late joiners."""

    def __init__(self, mesh: MeshPort, allowed_origins: Iterable[str]):
        self.mesh = mesh
        self.origins = set(allowed_origins)
        self.clients: set[ServerConnection] = set()
        self.identity: dict | None = None
        self.peers: dict[str, dict] = {}

    def snapshot(self) -> list[dict]:
        return ([self.identity] if self.identity else []) + list(self.peers.values())

    def remember(self, event: dict) -> None:
        kind = event.get("type")
        if kind == "identity":
            self.identity = event
        elif kind == "neighbor_discovered":
            self.peers[event["id"]] = event
        elif kind == "neighbor_lost":
            self.peers.pop(event["id"], None)

    async def broadcast(self, event: dict) -> None:
        self.remember(event)
        payload = json.dumps(event)
        await asyncio.gather(*(c.send(payload) for c in list(self.clients)), return_exceptions=True)

    def check_origin(self, connection: ServerConnection, request: Request) -> Response | None:
        if request.headers.get("Origin") in self.origins:
            return None
        return Response(403, "Forbidden", Headers([("Content-Type", "text/plain")]), b"origin not allowed\n")

    async def handler(self, ws: ServerConnection) -> None:
        self.clients.add(ws)
        try:
            await self.send_events(ws, self.snapshot())
            async for raw in ws:
                await self.on_frame(ws, raw)
        finally:
            self.clients.discard(ws)

    async def on_frame(self, ws: ServerConnection, raw: str | bytes) -> None:
        try:
            cmd = parse_command(raw)
        except ProtocolError as exc:
            await ws.send(error_frame("bad_frame", str(exc)))
            return
        if cmd["type"] == "get_peers":
            await self.send_events(ws, self.peers.values())
        else:
            await self.send_message(ws, cmd)

    async def send_message(self, ws: ServerConnection, cmd: dict) -> None:
        try:
            await self.mesh.send(cmd["id"], cmd["to"], cmd["content"])
        except Exception as exc:  # surface SDK failures to the UI
            log.exception("send failed")
            await self.broadcast({"type": "delivery_status", "id": cmd["id"], "status": "failed"})
            await ws.send(error_frame("send_failed", str(exc)))

    @staticmethod
    async def send_events(ws: ServerConnection, events: Iterable[dict]) -> None:
        for event in list(events):
            await ws.send(json.dumps(event))


async def serve(
    mesh: MeshPort,
    host: str = "127.0.0.1",
    port: int = 8765,
    allowed_origins: Iterable[str] = DEFAULT_ORIGINS,
):
    hub = BrowserHub(mesh, allowed_origins)
    await mesh.start(hub.broadcast)
    return await ws_serve(hub.handler, host, port, process_request=hub.check_origin)
