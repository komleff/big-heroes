#!/usr/bin/env python3
"""
Hook: блокировка фраз merge-readiness в `gh pr comment` вне /finalize-pr.

Принимает на stdin JSON с payload tool_input от Claude Code, извлекает команду
и проверяет, содержит ли она запрещённую формулировку («готов к merge» /
«ready to merge» / «merge-ready» и вариации) при отсутствии переменной
окружения FINALIZE_PR_TOKEN.

Защита от обхода:
- Case-insensitive по кириллице и латинице (re.IGNORECASE корректно работает
  с Unicode, в отличие от grep -i в локали C).
- Нормализация `_` и `-` в пробел, чтобы ловить `ready_to_merge`,
  `ready-to-merge`, `MERGE_READY`.
- Нормализация переносов строк в пробел для multiline payload'ов.
- Жадный \\s* между словами — ловит любые количества/типы пробелов и табов.

Возвращает:
- exit 0  — команда разрешена (нет совпадения ИЛИ установлен FINALIZE_PR_TOKEN)
- exit 1  — блокировка (найдена запрещённая фраза)
"""
import json
import os
import re
import sys


# Паттерны запрещённых формулировок готовности к merge
# Части разнесены для читаемости; \s* допускает любые пробельные символы.
_MERGE_READY_PATTERN = re.compile(
    r"готов[оа]?\s*к\s*merge"          # русская форма (любой регистр)
    r"|ready\s*(?:to|for)\s*merge"     # английская "ready to/for merge"
    r"|merge\s*ready"                  # английская "merge ready"
    r"|merge\s*is\s*ready",            # английская "merge is ready"
    re.IGNORECASE,
)


def extract_command(raw_stdin: str) -> str:
    """Получить текст команды из payload hook'а Claude Code."""
    try:
        payload = json.loads(raw_stdin)
    except json.JSONDecodeError:
        return ""
    tool_input = payload.get("tool_input") or {}
    return tool_input.get("command") or ""


def is_forbidden(command: str) -> bool:
    """True — если команда содержит запрещённую формулировку."""
    # Нормализуем: подчёркивания и дефисы → пробелы, переносы строк → пробелы.
    # Это закрывает обход через `ready_to_merge`, `ready-to-merge`, multiline.
    normalized = re.sub(r"[_\-\n\r]+", " ", command)
    return bool(_MERGE_READY_PATTERN.search(normalized))


def main() -> int:
    # Легитимный вызов из /finalize-pr — пропускаем
    if os.environ.get("FINALIZE_PR_TOKEN"):
        return 0

    raw = sys.stdin.read()
    command = extract_command(raw)
    if not command:
        return 0

    if is_forbidden(command):
        sys.stderr.write(
            "БЛОКИРОВКА: фразы 'готов к merge' / 'ready to merge' / 'merge-ready' "
            "разрешены только через /finalize-pr "
            "(см. .claude/skills/finalize-pr/SKILL.md).\n"
            "Используй /finalize-pr <PR_NUMBER>.\n"
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
