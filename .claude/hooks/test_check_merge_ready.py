#!/usr/bin/env python3
"""Unit-тесты для check-merge-ready.py.

Запуск: python3 .claude/hooks/test_check_merge_ready.py

Тестовое покрытие:
- Точный маркер `## ✅ Готов к merge` → блокируется
- Обсуждения/цитаты с «готов к merge» → пропускаются
- Обход через --body-file / -F → блокируется
- Обход через $(cat file) / $(<file) / backtick subst → блокируется
- `<<<` (here-string) НЕ блокируется: gh pr comment не читает stdin без --body-file -,
  а false-positive на текст body с `<<<` был бы критичнее
- Legitimate markdown с backticks → пропускается
- Heredoc `$(cat <<'EOF'...EOF)` — содержимое видно, блокируется/пропускается по контенту
- FINALIZE_PR_TOKEN → bypass
- Пустая команда или отсутствие `tool_input.command` → fail-secure блокировка
"""
import json
import os
import subprocess
import sys


HOOK = os.path.join(os.path.dirname(__file__), "check-merge-ready.py")


def run(cmd: str | None, with_token: bool = False) -> int:
    """Запустить hook с payload и вернуть exit code."""
    env = {k: v for k, v in os.environ.items() if k != "FINALIZE_PR_TOKEN"}
    if with_token:
        env["FINALIZE_PR_TOKEN"] = "1"
    if cmd is None:
        payload = json.dumps({"tool_input": {}})
    else:
        payload = json.dumps({"tool_input": {"command": cmd}})
    result = subprocess.run(
        ["python3", HOOK],
        input=payload,
        capture_output=True,
        text=True,
        env=env,
    )
    return result.returncode


TESTS = [
    # === Блокировка: точный маркер `## ✅ Готов к merge` ===
    ("gh pr comment 1 --body '## ✅ Готов к merge\n\nCommit: abc'", 1, "final marker RU"),
    ("gh pr comment 1 --body '## Готов к merge'", 1, "без ✅"),
    ("gh pr comment 1 --body '## Ready to merge'", 1, "EN ready to merge"),
    ("gh pr comment 1 --body '## merge-ready'", 1, "EN merge-ready"),
    ("gh pr comment 1 --body '## READY TO MERGE'", 1, "uppercase"),
    ("gh pr comment 1 --body '## ready_to_merge'", 1, "underscores"),
    # === Пропуск: обсуждения и цитаты ===
    ("gh pr comment 1 --body 'не готов к merge — тесты красные'", 0, "отрицание"),
    ("gh pr comment 1 --body 'почти готов к merge, жду review'", 0, "«почти готов»"),
    ("gh pr comment 1 --body 'готов к merge, если X'", 0, "фраза без ##"),
    ("gh pr comment 1 --body '## Готов к merge после исправлений'", 0, "## + продолжение"),
    ("gh pr comment 1 --body '## Готов к merge, если X'", 0, "## + запятая"),
    # === Fail-secure ===
    (None, 1, "нет tool_input.command"),
    # === Защита от bypass ===
    ("gh pr comment 1 --body-file x.md", 1, "--body-file"),
    ("gh pr comment 1 -F x.md", 1, "-F"),
    ("gh pr comment 1 --body \"$(cat /tmp/x)\"", 1, "$(cat /path)"),
    ("gh pr comment 1 --body \"$(<file.md)\"", 1, "$(<file)"),
    ("gh pr comment 1 --body \"`cat /tmp/x`\"", 1, "backtick cat"),
    # === Legitimate markdown ===
    ("gh pr comment 1 --body 'использует `bd show` для проверки'", 0, "inline backticks"),
    ("gh pr comment 1 --body 'regex `bd-[a-z]+` захардкожен'", 0, "markdown regex"),
    ("gh pr comment 1 --body 'пример here-string: cmd <<<\"input\" в bash'", 0, "<<< внутри body — текст"),
    # === Heredoc: содержимое видно hook'у ===
    ("gh pr comment 1 --body \"$(cat <<'EOF'\n## ✅ Готов к merge\nEOF\n)\"", 1, "heredoc final"),
    ("gh pr comment 1 --body \"$(cat <<'EOF'\nLooks good\nEOF\n)\"", 0, "heredoc clean"),
]


def main() -> int:
    failures = []
    for cmd, expected, description in TESTS:
        actual = run(cmd)
        mark = "✓" if actual == expected else "✗"
        print(f"{mark} {description}: exit={actual} expected={expected}")
        if actual != expected:
            failures.append(description)

    # FINALIZE_PR_TOKEN bypass — даже точный маркер проходит
    token_cmd = "gh pr comment 1 --body '## ✅ Готов к merge'"
    actual = run(token_cmd, with_token=True)
    mark = "✓" if actual == 0 else "✗"
    print(f"{mark} FINALIZE_PR_TOKEN bypass: exit={actual} expected=0")
    if actual != 0:
        failures.append("FINALIZE_PR_TOKEN bypass")

    total = len(TESTS) + 1
    passed = total - len(failures)
    print(f"\nИтого: {passed}/{total}")
    if failures:
        print("Провалены:")
        for f in failures:
            print(f"  - {f}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
