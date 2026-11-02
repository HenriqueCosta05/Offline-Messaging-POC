import asyncio
import json

import pytest
from websockets.asyncio.client import connect
from websockets.exceptions import InvalidStatus

from bridge.server import serve

ORIGIN = "http://localhost:5173"


class FakeMesh:
    def __init__(self):
        self.sent = []
        self.emit = None

    async def start(self, on_event):
        self.emit = on_event

    async def send(self, id, to, content):
        self.sent.append((id, to, content))

    async def stop(self):
        pass


@pytest.fixture
async def running():
    mesh = FakeMesh()
    server = await serve(mesh, host="127.0.0.1", port=0, allowed_origins=[ORIGIN])
    port = server.sockets[0].getsockname()[1]
    yield mesh, f"ws://127.0.0.1:{port}"
    server.close()
    await server.wait_closed()


async def test_rejects_bad_origin(running):
    _, url = running
    with pytest.raises(InvalidStatus):
        async with connect(url, origin="http://evil.example"):
            pass


async def test_malformed_json_gets_error_frame(running):
    _, url = running
    async with connect(url, origin=ORIGIN) as ws:
        await ws.send("not json")
        frame = json.loads(await ws.recv())
        assert frame["type"] == "error"
        assert frame["code"] == "bad_frame"


async def test_send_message_reaches_mesh(running):
    mesh, url = running
    async with connect(url, origin=ORIGIN) as ws:
        await ws.send(json.dumps({"type": "send_message", "id": "m1", "to": "bob", "content": "hi"}))
        await asyncio.sleep(0.05)
        assert mesh.sent == [("m1", "bob", "hi")]


async def test_failed_send_marks_message_failed_and_reports_error(running):
    mesh, url = running

    async def broken_send(id, to, content):
        raise RuntimeError("radio off")

    mesh.send = broken_send
    async with connect(url, origin=ORIGIN) as ws:
        await ws.send(json.dumps({"type": "send_message", "id": "m1", "to": "bob", "content": "hi"}))
        frames = [json.loads(await asyncio.wait_for(ws.recv(), 1)) for _ in range(2)]
        assert {"type": "delivery_status", "id": "m1", "status": "failed"} in frames
        assert {"type": "error", "code": "send_failed", "message": "radio off"} in frames


async def test_mesh_event_forwarded(running):
    mesh, url = running
    async with connect(url, origin=ORIGIN) as ws:
        await asyncio.sleep(0.05)
        await mesh.emit({"type": "message_received", "id": "x", "from": "bob", "content": "yo", "ts": 1})
        frame = json.loads(await ws.recv())
        assert frame["type"] == "message_received"
        assert frame["from"] == "bob"


async def test_late_client_gets_identity_and_known_peers(running):
    mesh, url = running
    await mesh.emit({"type": "identity", "address": "me"})
    await mesh.emit({"type": "neighbor_discovered", "id": "bob", "transport": "ble"})
    await mesh.emit({"type": "neighbor_discovered", "id": "amy", "transport": "ble"})
    await mesh.emit({"type": "neighbor_lost", "id": "amy"})
    async with connect(url, origin=ORIGIN) as ws:
        frames = [json.loads(await asyncio.wait_for(ws.recv(), 1)) for _ in range(2)]
        assert {"type": "identity", "address": "me"} in frames
        assert {"type": "neighbor_discovered", "id": "bob", "transport": "ble"} in frames
        await ws.send(json.dumps({"type": "get_peers"}))
        again = json.loads(await asyncio.wait_for(ws.recv(), 1))
        assert again["id"] == "bob"
