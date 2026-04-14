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


class HookError(Exception):
    """Сигнал безопасной остановки hook'а с блокировкой команды."""


def extract_command(raw_stdin: str) -> str:
    """Получить текст команды из payload hook'а Claude Code.

    Fail-secure: если JSON невалиден, бросаем исключение → hook блокирует
    команду (exit 1). Возврат пустой строки был бы fail-open: команда
    с merge-ready фразой прошла бы блокировку, потому что is_forbidden('')
    = False.
    """
    try:
        payload = json.loads(raw_stdin)
    except json.JSONDecodeError as exc:
        raise HookError(
            f"check-merge-ready: невалидный JSON на stdin ({exc}). "
            "Hook блокирует команду fail-secure."
        ) from exc
    tool_input = payload.get("tool_input") or {}
    return tool_input.get("command") or ""


# Флаги gh pr comment, передающие body через файл или stdin — hook не может
# надёжно провалидировать содержимое файла. Блокируем их полностью вне
# /finalize-pr (защита инварианта hard gate от bypass'а).
_BODY_FILE_FLAGS = re.compile(
    r"(^|\s)(--body-file|-F)(\s|=|$)",
)


def uses_body_file(command: str) -> bool:
    """True — если команда gh pr comment передаёт body через файл/stdin."""
    # Проверяем только для gh pr comment — остальные команды не по нашей теме.
    if "gh pr comment" not in command:
        return False
    return bool(_BODY_FILE_FLAGS.search(command))


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

    try:
        command = extract_command(raw)
    except HookError as exc:
        sys.stderr.write(str(exc) + "\n")
        return 1

    if not command:
        return 0

    # Блокируем --body-file / -F для gh pr comment вне /finalize-pr: body
    # передаётся файлом/stdin и hook не может надёжно проверить содержимое.
    # Это bypass hard gate (нашёл Copilot auto-reviewer). Для легитимных
    # длинных отчётов используется /finalize-pr с FINALIZE_PR_TOKEN.
    if uses_body_file(command):
        sys.stderr.write(
            "БЛОКИРОВКА: для `gh pr comment` флаги --body-file / -F "
            "запрещены без FINALIZE_PR_TOKEN, потому что hook не может "
            "провалидировать содержимое файла.\n"
            "Используй inline --body '...' ИЛИ /finalize-pr <PR_NUMBER>.\n"
        )
        return 1

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
