import ast

from scripts.check_layers import imported_modules, is_forbidden


def test_imported_modules_resolves_relative_imports_inside_bridge():
    tree = ast.parse("import json\nfrom .manager import SdkMesh\nfrom websockets.asyncio import x\n")
    assert imported_modules(tree) == [(1, "json"), (2, "bridge.manager"), (3, "websockets.asyncio")]


def test_forbidden_matches_package_and_submodules_only():
    assert is_forbidden("websockets.asyncio.server")
    assert is_forbidden("nio")
    assert not is_forbidden("nioxide")
    assert not is_forbidden("json")
