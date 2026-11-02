from scripts.check_comments import Comment, _TsScanner, long_blocks, python_comments, python_docstrings


def full_line(*lines: int) -> list[Comment]:
    return [Comment(line, "# x", inline=False) for line in lines]


def test_two_consecutive_lines_are_allowed():
    assert long_blocks(full_line(1, 2), limit=2) == []


def test_three_consecutive_lines_are_one_violation():
    assert long_blocks(full_line(4, 5, 6), limit=2) == [(4, 3)]


def test_a_gap_splits_blocks():
    assert long_blocks(full_line(1, 2, 4, 5), limit=2) == []


def test_inline_comments_do_not_join_blocks():
    comments = [Comment(1, "x = 1  # a", inline=True), *full_line(2, 3), Comment(4, "y()  # b", inline=True)]
    assert long_blocks(comments, limit=2) == []


def test_python_comments_mark_inline_and_skip_shebang():
    source = "#!/usr/bin/env python\n# top\nx = 1  # trailing\n"
    assert python_comments(source) == [Comment(2, "# top", False), Comment(3, "# trailing", True)]


def test_python_docstrings_report_span_of_each_owner():
    source = 'def f():\n    """one"""\n\n\nclass C:\n    """a\n    b\n    c"""\n'
    assert sorted(python_docstrings(source)) == [(2, 1), (6, 3)]


def test_ts_scanner_ignores_comment_markers_inside_strings():
    source = "const url = 'http://x';\nconst t = `/* no */`;\n// real\n"
    assert _TsScanner(source).scan() == [Comment(3, "// real", False)]


def test_ts_scanner_splits_block_comment_into_lines():
    source = "f(); /* a\nb */\n"
    assert _TsScanner(source).scan() == [Comment(1, "/* a", True), Comment(2, "b */", False)]
