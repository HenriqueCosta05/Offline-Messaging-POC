"""SDK adapter: the only module that imports offline_protocol_sdk."""
import asyncio
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable

EventSink = Callable[[dict], Awaitable[None]]


def translate(event: Any, client_ids: dict[str, str]) -> dict | None:
    """Maps an SDK event (`type`-tagged JSON) to a browser frame; `client_ids` maps the
    SDK message id back to the browser's id so delivery reports reach the right bubble."""
    if not isinstance(event, dict):
        return None
    kind = event.get("type")
    if kind == "message_received":
        return {
            "type": "message_received",
            "id": str(event["message_id"]),
            "from": str(event["sender"]),
            "content": str(event.get("content", "")),
            "ts": int(event.get("timestamp") or time.time() * 1000),
        }
    if kind == "neighbor_discovered":
        frame = {
            "type": "neighbor_discovered",
            "id": str(event["peer_id"]),
            "transport": str(event.get("transport", "unknown")),
        }
        if isinstance(event.get("rssi"), int):
            frame["rssi"] = event["rssi"]
        return frame
    if kind == "neighbor_lost":
        return {"type": "neighbor_lost", "id": str(event["peer_id"])}
    if kind in ("message_delivered", "message_failed", "message_undeliverable"):
        sdk_id = str(event["message_id"])
        return {
            "type": "delivery_status",
            "id": client_ids.get(sdk_id, sdk_id),
            "status": "delivered" if kind == "message_delivered" else "failed",
        }
    return None


@dataclass(frozen=True)
class MeshSettings:
    app_id: str
    profile: str
    state_root: Path
    relay_url: str | None = None
    ble: bool = False


class SdkMesh:
    """MeshPort backed by the Offline Protocol desktop Python bindings."""

    def __init__(self, settings: MeshSettings):
        self._app_id, self._profile, self._state_root = settings.app_id, settings.profile, settings.state_root
        self._relay_url, self._ble = settings.relay_url, settings.ble
        self._pm = None
        self._sink: EventSink | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._client_ids: dict[str, str] = {}

    async def start(self, on_event: EventSink) -> None:
        try:  # lazy: the bindings have no prebuilt wheel and must be built from source
            from offline_protocol_sdk import ProtocolManager  # pyright: ignore[reportMissingImports]
            from offline_protocol_sdk.offline_protocol import (  # pyright: ignore[reportMissingImports]
                OverflowPolicy,
                ProtocolConfig,
            )
        except ImportError as exc:
            raise SystemExit(
                "The Offline Protocol Python SDK is not installed.\n"
                "  - To try the app without it, run: python -m bridge --fake\n"
                "  - For the real mesh, build the bindings (see 'Use the real mesh' in README.md)."
            ) from exc

        self._sink, self._loop = on_event, asyncio.get_running_loop()
        config = ProtocolConfig(
            app_id=self._app_id,
            profile=self._profile,
            ble_enabled=self._ble,
            wifi_direct_enabled=False,
            internet_enabled=self._relay_url is not None,
            reticulum_enabled=False,
            nostr_enabled=False,
            prefer_online=self._relay_url is not None,
            initial_ttl=3,
            encryption_enabled=True,
            auto_key_exchange=True,
            store_pending=True,
            max_pending_per_peer=100,
            max_pending_global=1000,
            pending_ttl_ms=60_000,
            overflow_policy=OverflowPolicy.DROP_OLDEST,
        )
        self._state_root.mkdir(parents=True, exist_ok=True)
        self._pm = ProtocolManager(config, event_handler=self._on_sdk_event, state_root=self._state_root)
        await self._pm.__aenter__()  # starts the protocol
        if self._relay_url is not None:
            self._pm.internet.configure(server_url=self._relay_url)
            await self._pm.internet.start()
        await on_event({"type": "identity", "address": self._profile})

    def _on_sdk_event(self, event: Any) -> None:
        frame = translate(event, self._client_ids)
        if frame and self._sink and self._loop:
            asyncio.run_coroutine_threadsafe(self._sink(frame), self._loop)

    async def send(self, id: str, to: str, content: str) -> None:
        sdk_id = self._pm.send_message(to, content)  # synchronous in the SDK
        self._client_ids[sdk_id] = id

    async def stop(self) -> None:
        if self._pm:
            await self._pm.__aexit__(None, None, None)


class FakeMesh:
    """Loopback mesh for local demos: reports delivery, then echoes the message back."""

    async def start(self, on_event: EventSink) -> None:
        self._emit = on_event
        await on_event({"type": "identity", "address": "me-local"})
        await on_event({"type": "neighbor_discovered", "id": "echo-bot", "transport": "ble", "rssi": -52})

    async def send(self, id: str, to: str, content: str) -> None:
        await asyncio.sleep(0.2)
        await self._emit({"type": "delivery_status", "id": id, "status": "delivered"})
        await asyncio.sleep(0.3)
        await self._emit(
            {"type": "message_received", "id": f"echo-{id}", "from": to,
             "content": f"echo: {content}", "ts": int(time.time() * 1000)}
        )

    async def stop(self) -> None:
        pass
