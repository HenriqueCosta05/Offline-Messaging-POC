import json

from bridge.phone_directory import JsonPhoneDirectory


def test_missing_file_starts_empty(tmp_path):
    assert JsonPhoneDirectory(tmp_path / "phones.json").get("+5511999990000") is None


def test_put_persists_across_instances(tmp_path):
    path = tmp_path / "state" / "phones.json"
    JsonPhoneDirectory(path).put("+5511999990000", "@marina:hq.local")
    assert JsonPhoneDirectory(path).get("+5511999990000") == "@marina:hq.local"
    assert not (path.parent / "phones.json.tmp").exists()


def test_corrupted_file_is_moved_aside(tmp_path):
    path = tmp_path / "phones.json"
    path.write_text("{not json", encoding="utf-8")
    directory = JsonPhoneDirectory(path)
    assert directory.get("+5511999990000") is None
    assert (tmp_path / "phones.json.bak").read_text(encoding="utf-8") == "{not json"
    assert not path.exists()


def test_non_object_json_is_moved_aside(tmp_path):
    path = tmp_path / "phones.json"
    path.write_text(json.dumps(["x"]), encoding="utf-8")
    JsonPhoneDirectory(path)
    assert (tmp_path / "phones.json.bak").exists()
