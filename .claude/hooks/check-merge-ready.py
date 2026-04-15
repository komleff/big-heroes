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


# Паттерн точного маркера финального комментария readiness.
# Почему так строго: поиск по подстроке даёт ложные блокировки на обсуждения
# и отрицания вроде «не готов к merge», «почти готов к merge», «готов к merge,
# если X». `/finalize-pr` публикует ровно заголовок `## ✅ Готов к merge`
# (см. шаблон в finalize-pr/SKILL.md), поэтому требуем `##` + фразу + конец
# строки/текста. Якорь `^` не подходит: внутри `gh pr comment ... --body "## ..."`
# заголовок начинается в той же shell-строке после `--body "`, а не после `\n`.
_MERGE_READY_PATTERN = re.compile(
    r"##\s*(?:✅\s*)?"
    r"(?:готов[оа]?\s*к\s*merge"
    r"|ready\s*(?:to|for)\s*merge"
    r"|merge\s*ready"
    r"|merge\s*is\s*ready)"
    # Терминаторы фразы: конец строки body / newline / закрывающая shell-кавычка
    # (`'` или `"`). Обычный пробел + текст («## Готов к merge после X») НЕ
    # матчит — это не точный маркер, а продолжение предложения.
    r"\s*(?:$|\n|['\"])",
    re.IGNORECASE | re.MULTILINE,
)


class HookError(Exception):
    """Сигнал безопасной остановки hook'а с блокировкой команды."""


def extract_command(raw_stdin: str) -> str:
    """Получить текст команды из payload hook'а Claude Code.

    Fail-secure: если JSON невалиден, бросаем исключение → hook блокирует
    команду (exit 1). Отсутствие `tool_input.command` — тоже HookError:
    hook привязан matcher'ом `Bash(gh pr comment*)`, поэтому `command`
    обязан присутствовать. Пустая строка была бы fail-open при изменении
    формата payload.
    """
    try:
        payload = json.loads(raw_stdin)
    except json.JSONDecodeError as exc:
        raise HookError(
            f"check-merge-ready: невалидный JSON на stdin ({exc}). "
            "Hook блокирует команду fail-secure."
        ) from exc
    tool_input = payload.get("tool_input") or {}
    command = tool_input.get("command")
    if not command:
        raise HookError(
            "check-merge-ready: в payload отсутствует tool_input.command. "
            "Hook блокирует команду fail-secure."
        )
    return command


# Флаги gh pr comment, передающие body через файл или stdin — hook не может
# надёжно провалидировать содержимое файла. Блокируем их полностью вне
# /finalize-pr (защита инварианта hard gate от bypass'а).
_BODY_FILE_FLAGS = re.compile(
    r"(^|\s)(--body-file|-F)(\s|=|$)",
)


# Паттерны bash-subst, скрывающие реальное содержимое --body от hook'а.
# Legitimate heredoc `$(cat <<'EOF' ... EOF)` НЕ блокируется: содержимое
# инлайн в команде, hook его видит. А `$(cat /tmp/x)` и ``cat /tmp/x`` —
# block, потому что читают внешний файл, который hook не видит.
# Обычные markdown-backticks не блокируем: они легитимны в отчётах
# (inline-код в PR-комментариях встречается повсеместно).
#
# Why не блокируем `<<<` (here-string): `gh pr comment` не читает stdin без
# `--body-file -` (который уже блокируется выше _BODY_FILE_FLAGS). Значит
# `<<<` не создаёт реального bypass, а любая подстрока `<<<` в самом body
# (например, в обсуждении bash-синтаксиса) давала бы ложные блокировки.
_DANGEROUS_SUBST = re.compile(
    r"""(
        \$\(\s*cat\s+[^<\s]                      # $(cat /path/…) или $(cat  file)
        |
        \$\(\s*<                                 # $(<file) — file redirection
        |
        (?<!\\)`\s*cat\s+[^<\s`][^`]*(?<!\\)`    # `cat /path` — backtick subst с чтением файла
        |
        (?<!\\)`\s*<\s*[^`\s][^`]*(?<!\\)`       # `<file` — backtick subst с редиректом
    )""",
    re.VERBOSE,
)


def uses_body_file(command: str) -> bool:
    """True — если команда gh pr comment передаёт body через файл/stdin."""
    # Проверяем только для gh pr comment — остальные команды не по нашей теме.
    if "gh pr comment" not in command:
        return False
    return bool(_BODY_FILE_FLAGS.search(command))


def uses_dangerous_substitution(command: str) -> bool:
    """True — если команда gh pr comment использует file-read конструкции
    внутри command substitution, скрывающие реальное содержимое body.

    Закрывает bypass: `--body "$(cat /tmp/x)"` — hook видит только литерал
    `$(cat /tmp/x)`, не содержимое файла. Легитимный heredoc
    `$(cat <<'EOF' ... EOF)` остаётся разрешённым: содержимое инлайн в
    команде и попадает в regex `_MERGE_READY_PATTERN`.
    """
    if "gh pr comment" not in command:
        return False
    return bool(_DANGEROUS_SUBST.search(command))


def is_forbidden(command: str) -> bool:
    """True — если команда содержит запрещённый заголовок readiness.

    Нормализуем только `_` и `-` в пробелы — это закрывает обход через
    `ready_to_merge`, `ready-to-merge`. Переносы строк НЕ нормализуем:
    `_MERGE_READY_PATTERN` использует multiline-якоря `^`/`$`, которые
    должны видеть реальные `\\n` в команде (shell-heredoc, multiline body).
    """
    normalized = re.sub(r"[_\-]+", " ", command)
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

    # Блокируем command substitution, скрывающие реальное содержимое body
    # от hook'а: `$(cat /file)`, `$(<file)`, backticks, here-strings.
    # Legitimate heredoc `$(cat <<'EOF' ... EOF)` остаётся разрешённым
    # (содержимое инлайн, regex его видит).
    if uses_dangerous_substitution(command):
        sys.stderr.write(
            "БЛОКИРОВКА: для `gh pr comment` запрещены конструкции, "
            "скрывающие содержимое body от hook'а: "
            "`$(cat file)`, `$(<file)`, backticks `cmd`, here-string `<<<`.\n"
            "Используй inline --body '...', heredoc `$(cat <<'EOF' ... EOF)` "
            "или /finalize-pr <PR_NUMBER>.\n"
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
