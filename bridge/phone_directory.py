"""Phone → Matrix user id map persisted as JSON; holds no secrets."""
import json
import logging
import os
from pathlib import Path

log = logging.getLogger("bridge")


class JsonPhoneDirectory:
    def __init__(self, path: Path):
        self._path = path
        self._entries = self._load()

    def get(self, phone: str) -> str | None:
        return self._entries.get(phone)

    def put(self, phone: str, user_id: str) -> None:
        self._entries[phone] = user_id
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_name(self._path.name + ".tmp")
        tmp.write_text(json.dumps(self._entries, indent=2), encoding="utf-8")
        os.replace(tmp, self._path)

    def _load(self) -> dict[str, str]:
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return {}
        except ValueError:
            data = None
        return data if isinstance(data, dict) else self._quarantine()

    def _quarantine(self) -> dict[str, str]:
        backup = self._path.with_name(self._path.name + ".bak")
        os.replace(self._path, backup)
        log.warning("phone directory unreadable; moved to %s", backup)
        return {}
