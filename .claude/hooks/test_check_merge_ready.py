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
from typing import Optional


HOOK = os.path.join(os.path.dirname(__file__), "check-merge-ready.py")


def run(cmd: Optional[str], with_token: bool = False) -> int:
    """Запустить hook с payload и вернуть exit code."""
    env = {k: v for k, v in os.environ.items() if k != "FINALIZE_PR_TOKEN"}
    if with_token:
        env["FINALIZE_PR_TOKEN"] = "1"
    if cmd is None:
        payload = json.dumps({"tool_input": {}})
    else:
        payload = json.dumps({"tool_input": {"command": cmd}})
    # sys.executable — кросс-платформенно: Linux/macOS найдут python3, Windows
    # использует текущий интерпретатор вместо несуществующего `python3`.
    result = subprocess.run(
        [sys.executable, HOOK],
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
    # GPT-5.4 external review (round 12) — CRITICAL bypass прежнего H2-only:
    # фраза без `##` на отдельной строке должна блокироваться.
    ("gh pr comment 1 --body 'ready to merge'", 1, "bare ready to merge"),
    ("gh pr comment 1 --body 'Готов к merge'", 1, "bare готов к merge"),
    ("gh pr comment 1 --body 'merge ready'", 1, "bare merge ready"),
    ("gh pr comment 1 --body 'PR is ready to merge'", 1, "PR is ready to merge"),
    # === Пропуск: обсуждения и цитаты ===
    ("gh pr comment 1 --body 'не готов к merge — тесты красные'", 0, "отрицание"),
    ("gh pr comment 1 --body 'почти готов к merge, жду review'", 0, "«почти готов»"),
    ("gh pr comment 1 --body 'готов к merge, если X'", 0, "фраза без ##"),
    ("gh pr comment 1 --body '## Готов к merge после исправлений'", 0, "## + продолжение"),
    ("gh pr comment 1 --body '## Готов к merge, если X'", 0, "## + запятая"),
    # === Пропуск: markdown blockquote (GPT-5.4 round 15 WARNING) ===
    ("gh pr comment 1 --body '> ready to merge'", 0, "blockquote bare EN"),
    ("gh pr comment 1 --body '> готов к merge'", 0, "blockquote bare RU"),
    ("gh pr comment 1 --body '> Вердикт: ready to merge'", 0, "blockquote с префиксом"),
    ("gh pr comment 1 --body \"> Reviewer cited: ready to merge\"", 0, "blockquote double-quote"),
    ("gh pr comment 1 --body '>> nested quote ready to merge'", 0, "nested blockquote"),
    (
        "gh pr comment 1 --body 'Контекст обсуждения\n> cited ready to merge\nпродолжение'",
        0,
        "multi-line body: blockquote строка внутри",
    ),
    # === Fail-secure ===
    (None, 1, "нет tool_input.command"),
    # === Защита от bypass ===
    ("gh\tpr\tcomment 1 --body '## ✅ Готов к merge'", 1, "tab whitespace bypass"),
    ("gh \t pr  comment 1 --body-file x.md", 1, "mixed whitespace + body-file"),
    ("gh pr comment 1 --body-file x.md", 1, "--body-file"),
    ("gh pr comment 1 -F x.md", 1, "-F"),
    ("gh pr comment 1 --body \"$(cat /tmp/x)\"", 1, "$(cat /path)"),
    ("gh pr comment 1 --body \"$(<file.md)\"", 1, "$(<file)"),
    ("gh pr comment 1 --body \"`cat /tmp/x`\"", 1, "backtick cat"),
    # Bypass через непрозрачную переменную — запрещённая фраза в $BODY,
    # hook видит только имя переменной. Основной случай Copilot round 12.
    ("gh pr comment 1 --body \"$BODY\"", 1, "--body \"$BODY\" (opaque var)"),
    ("gh pr comment 1 --body $BODY", 1, "--body $BODY без кавычек"),
    ("gh pr comment 1 --body \"${BODY}\"", 1, "--body \"${BODY}\""),
    ("gh pr comment 1 --body \"${BODY:-default}\"", 1, "--body default-expansion"),
    ("gh pr comment 1 --body=$BODY", 1, "--body=$BODY (=syntax)"),
    # === Legitimate markdown ===
    ("gh pr comment 1 --body 'использует `bd show` для проверки'", 0, "inline backticks"),
    ("gh pr comment 1 --body 'regex `bd-[a-z]+` захардкожен'", 0, "markdown regex"),
    ("gh pr comment 1 --body 'пример here-string: cmd <<<\"input\" в bash'", 0, "<<< внутри body — текст"),
    # === Heredoc: содержимое видно hook'у ===
    ("gh pr comment 1 --body \"$(cat <<'EOF'\n## ✅ Готов к merge\nEOF\n)\"", 1, "heredoc final"),
    ("gh pr comment 1 --body \"$(cat <<'EOF'\nLooks good\nEOF\n)\"", 0, "heredoc clean"),
    # === Heredoc-awareness: review-pass публикация через $BODY=heredoc ===
    # Codex GPT-5.4 P1 (round 13): _OPAQUE_VAR_BODY блокировал шаблон PM-публикации
    # review-pass в sprint-pr-cycle:325 и external-review:319, делая pipeline
    # нефункциональным. Heredoc-присваивание делает содержимое видимым hook'у —
    # is_forbidden проверит фразу по raw команде.
    (
        "BODY=$(cat <<'EOF'\n## Внутреннее ревью (Claude) — review-pass\nCommit: abc123\nОтчёт по 4 аспектам.\nEOF\n)\n"
        "gh pr comment 1 --body \"$BODY\"",
        0,
        "review-pass publish (heredoc + $BODY)",
    ),
    (
        "BODY=$(cat <<'EOF'\n## Внешнее ревью (Sprint Final) — Режим: B\nCommit: abc123\nEOF\n)\n"
        "gh pr comment 1 --body \"$BODY\"",
        0,
        "external review publish (heredoc + $BODY)",
    ),
    # Даже с heredoc и $BODY — merge-ready фраза в heredoc ловится is_forbidden.
    (
        "BODY=$(cat <<'EOF'\n## ✅ Готов к merge\nEOF\n)\n"
        "gh pr comment 1 --body \"$BODY\"",
        1,
        "heredoc+$BODY с merge-ready — блокируется",
    ),
    # === Command substitution в --body без heredoc — block ===
    # Codex round 14 CRITICAL + D-02: bypass через $(echo $VAR), $(head/tail/sed/awk/xxd),
    # $(printf %s $VAR), $(perl/python/node -e ...) — любой инструмент кроме heredoc-cat.
    ("gh pr comment 1 --body \"$(echo $BODY)\"", 1, "$(echo $VAR) bypass"),
    ("gh pr comment 1 --body \"$(printf %s $BODY)\"", 1, "$(printf %s $VAR) bypass"),
    ("gh pr comment 1 --body \"$(head /tmp/x)\"", 1, "$(head file) bypass"),
    ("gh pr comment 1 --body \"$(tail -1 /tmp/x)\"", 1, "$(tail file) bypass"),
    ("gh pr comment 1 --body \"$(sed -n 1p /tmp/x)\"", 1, "$(sed file) bypass"),
    ("gh pr comment 1 --body \"$(awk 1 /tmp/x)\"", 1, "$(awk file) bypass"),
    ("gh pr comment 1 --body \"$(xxd /tmp/x)\"", 1, "$(xxd file) bypass"),
    ("gh pr comment 1 --body \"$(perl -e 'print qq/ready to merge/')\"", 1, "$(perl) bypass"),
    ("gh pr comment 1 --body \"$(python3 -c 'print(\"x\")')\"", 1, "$(python) bypass"),
    ("gh pr comment 1 --body=$(echo $BODY)", 1, "--body=$(echo) without quotes"),
    # Heredoc в той же команде — снимает command-subst блокировку (содержимое heredoc
    # видно hook'у через raw команду; is_forbidden проверит фразу в heredoc).
    (
        "BODY=$(cat <<'EOF'\n## Clean review\nEOF\n)\n"
        "gh pr comment 1 --body \"$(echo $BODY)\"",
        0,
        "heredoc + $(echo $BODY) без merge-ready — pass (raw heredoc виден)",
    ),
    (
        "BODY=$(cat <<'EOF'\n## ✅ Готов к merge\nEOF\n)\n"
        "gh pr comment 1 --body \"$(echo $BODY)\"",
        1,
        "heredoc + $(echo $BODY) с merge-ready — block (is_forbidden ловит raw)",
    ),
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
