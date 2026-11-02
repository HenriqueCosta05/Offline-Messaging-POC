import asyncio
import sys
from pathlib import Path

import pytest

from bridge import manager
from bridge.manager import FakeMesh, MeshSettings, SdkMesh

SETTINGS = MeshSettings("app", "alice", Path("state"))


class FakeProtocolManager:
    def __init__(self):
        self.sent = []
        self.closed = False

    def send_message(self, to, content):
        self.sent.append((to, content))
        return "sdk-1"

    async def __aexit__(self, *exc):
        self.closed = True


class Recorder:
    def __init__(self):
        self.frames = []

    async def __call__(self, frame):
        self.frames.append(frame)


@pytest.fixture
def no_sleep(monkeypatch):
    async def instant(_seconds):
        return None

    monkeypatch.setattr(manager.asyncio, "sleep", instant)


async def test_fake_mesh_announces_itself_and_echoes(no_sleep):
    sink, mesh = Recorder(), FakeMesh()
    await mesh.start(sink)
    await mesh.send("m1", "echo-bot", "hi")
    await mesh.stop()
    kinds = [frame["type"] for frame in sink.frames]
    assert kinds == ["identity", "neighbor_discovered", "delivery_status", "message_received"]
    assert sink.frames[-1]["content"] == "echo: hi"


async def test_sdk_mesh_exits_with_help_when_bindings_are_missing(monkeypatch):
    monkeypatch.setitem(sys.modules, "offline_protocol_sdk", None)
    with pytest.raises(SystemExit, match="--fake"):
        await SdkMesh(SETTINGS).start(Recorder())


async def test_sdk_mesh_maps_delivery_back_to_the_browser_id():
    mesh, pm, sink = SdkMesh(SETTINGS), FakeProtocolManager(), Recorder()
    mesh._pm, mesh._sink, mesh._loop = pm, sink, asyncio.get_running_loop()
    await mesh.send("web-1", "bob", "hi")
    await asyncio.to_thread(mesh._on_sdk_event, {"type": "message_delivered", "message_id": "sdk-1"})
    await asyncio.sleep(0.05)
    assert pm.sent == [("bob", "hi")]
    assert sink.frames == [{"type": "delivery_status", "id": "web-1", "status": "delivered"}]


async def test_sdk_mesh_ignores_events_before_start_and_stops_once_started():
    mesh, pm = SdkMesh(SETTINGS), FakeProtocolManager()
    mesh._on_sdk_event({"type": "neighbor_lost", "peer_id": "bob"})
    await mesh.stop()
    mesh._pm = pm
    await mesh.stop()
    assert pm.closed
