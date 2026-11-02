from pathlib import Path

import pytest

from bridge.__main__ import parse_args, provision_options
from bridge.provision_config import ProvisionOptions


def test_provisioning_defaults():
    a = parse_args(["--fake"])
    assert (a.provision_host, a.provision_port) == ("127.0.0.1", 8766)
    assert (a.fake_matrix, a.matrix_homeserver) == (False, None)


def test_provision_flags_map_to_options():
    argv = ["--fake", "--fake-matrix", "--matrix-homeserver", "http://hs:8008",
            "--matrix-public-url", "https://pub", "--provision-host", "0.0.0.0",
            "--provision-port", "9000", "--state-root", "st"]
    a = parse_args(argv)
    assert (a.provision_host, a.provision_port) == ("0.0.0.0", 9000)
    assert provision_options(a) == ProvisionOptions("http://hs:8008", "https://pub", True, Path("st"))


def test_transport_is_still_required():
    with pytest.raises(SystemExit):
        parse_args([])


def test_existing_flags_still_parse():
    a = parse_args(["--ble", "--relay", "ws://r:8080", "--port", "9999"])
    assert (a.ble, a.relay, a.port) == (True, "ws://r:8080", 9999)
