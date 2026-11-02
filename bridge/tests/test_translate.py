from bridge.manager import translate

# Event shapes mirror the SDK's `Event` enum (crates/offline-protocol/src/events.rs).


def test_message_received():
    event = {"type": "message_received", "message_id": "m1", "sender": "bob", "recipient": "me",
             "content": "hi", "hop_count": 0, "transport": "internet", "timestamp": 1700000000000}
    assert translate(event, {}) == {
        "type": "message_received", "id": "m1", "from": "bob", "content": "hi", "ts": 1700000000000}


def test_neighbor_events():
    found = {"type": "neighbor_discovered", "peer_id": "bob", "transport": "ble", "rssi": -60}
    assert translate(found, {}) == {"type": "neighbor_discovered", "id": "bob", "transport": "ble", "rssi": -60}
    no_rssi = {"type": "neighbor_discovered", "peer_id": "bob", "transport": "internet", "rssi": None}
    assert "rssi" not in translate(no_rssi, {})
    assert translate({"type": "neighbor_lost", "peer_id": "bob"}, {}) == {"type": "neighbor_lost", "id": "bob"}


def test_delivery_uses_the_browsers_message_id():
    ids = {"sdk-1": "web-1"}
    delivered = {
        "type": "message_delivered", "message_id": "sdk-1", "latency_ms": 5, "hop_count": 1, "transport": "ble",
    }
    assert translate(delivered, ids) == {"type": "delivery_status", "id": "web-1", "status": "delivered"}
    failed = {"type": "message_undeliverable", "message_id": "sdk-1", "recipient": "bob", "reason": "x"}
    assert translate(failed, ids)["status"] == "failed"


def test_ignores_unrelated_events():
    assert translate({"type": "network_metrics"}, {}) is None
    assert translate("not a dict", {}) is None
