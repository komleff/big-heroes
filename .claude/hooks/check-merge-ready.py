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
- Переносы строк отдельно не нормализуются: жадный `\\s*` между словами
  паттерна сам матчит пробелы, табы и переносы строк как whitespace.

Возвращает:
- exit 0  — команда разрешена (нет совпадения ИЛИ установлен FINALIZE_PR_TOKEN)
- exit 1  — блокировка (найдена запрещённая фраза)
"""
import json
import os
import re
import sys


# Паттерны маркера финального комментария readiness.
#
# GPT-5.4 external review (round 12) показал CRITICAL bypass прежнего
# H2-only варианта: `gh pr comment 1 --body 'ready to merge'` проходил.
# Теперь две стадии:
#
#   1) _MERGE_READY_CANDIDATE — ловит фразу на своей строке (с опциональным
#      ## и ✅). Разрешает префикс перед фразой на той же строке, чтобы не
#      расщеплять «The PR is ready to merge».
#   2) _NEGATION_WORDS — постфильтр: если префикс содержит отрицание / «почти»,
#      это обсуждение, не декларация готовности. Пропускаем.
#
# Терминаторы фразы строгие: конец строки / newline / закрывающая shell-кавычка.
# Продолжение предложения («готов к merge после X», «ready to merge, если Y»)
# не матчится — это именно точный маркер готовности.
_MERGE_READY_CANDIDATE = re.compile(
    r"(?im)^(?P<prefix>[^\n]*?)"
    r"(?:##\s*(?:✅\s*)?)?"
    r"(?P<phrase>"
    r"готов[оа]?\s*к\s*merge"
    r"|ready\s*(?:to|for)\s*merge"
    r"|merge\s*ready"
    r"|merge\s*is\s*ready"
    r")"
    r"\s*(?:$|\n|['\"])",
)

# Слова-отрицания перед фразой — снимают блокировку. Покрывают частые паттерны
# обсуждений: «не готов», «not ready», «почти готов», «almost ready»,
# «still not», «PR будет готов», «not yet ready».
_NEGATION_WORDS = re.compile(
    r"(?i)\b("
    r"не(?:\s+ещё|\s+еще)?"
    r"|нет"
    r"|почти"
    r"|not(?:\s+yet)?"
    r"|still\s+not"
    r"|almost"
    r"|будет"
    r"|yet\s+to"
    r")\b"
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


# Детект `gh pr comment` через regex по токенам с любыми whitespace
# между ними (пробелы, табы, переносы строк). Подстрочный поиск
# `"gh pr comment" in command` обходился через `gh\tpr\tcomment ...`,
# и hook пропускал команду без проверки --body-file / dangerous subst.
_GH_PR_COMMENT = re.compile(r"\bgh\s+pr\s+comment\b")


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


# Bypass через переменную: `--body "$BODY"` / `--body $BODY` / `--body "${BODY}"`.
# Hook видит только литерал `$BODY`, не содержимое переменной, — запрещённая
# фраза «готов к merge» в $BODY останется невидимой, и блокировка не сработает.
# Блокируем любое значение флага --body, которое СРАЗУ начинается с shell-
# переменной ($var, ${var}, ${var:-default}). Command substitution `$(...)`
# (включая heredoc `$(cat <<'EOF'...)` для legitimate длинных отчётов) НЕ
# матчится: после `$` идёт `(`, а regex ждёт `{` или букву/подчёркивание.
_OPAQUE_VAR_BODY = re.compile(
    r"""
    (?:^|\s)--body(?:=|\s+)              # флаг --body, затем `=` или пробел
    "?                                    # опциональная открывающая кавычка
    \$                                    # доллар — начало переменной
    (?:
        \{[^}]+\}                         # ${VAR} / ${VAR:-default}
        |
        [A-Za-z_]\w*                      # $VAR
    )
    """,
    re.VERBOSE,
)


# Heredoc-присваивание `VAR=$(cat <<'EOF' ... EOF)` — содержимое body инлайн
# в команде, hook видит его целиком. Если `--body "$VAR"` ссылается на
# такую переменную, opaque-blocker даёт ложное срабатывание: шаблоны
# публикации review-pass в sprint-pr-cycle/SKILL.md и external-review/SKILL.md
# используют ровно эту форму. Детектим heredoc-любой формы (quoted/unquoted,
# `<<-`), снимая opaque-блокировку — is_forbidden всё равно пройдёт по raw
# команде и поймает запрещённую фразу, если она лежит в heredoc.
_HEREDOC_PRESENT = re.compile(r"<<-?\s*[\"']?[A-Za-z_][A-Za-z0-9_]*")


def uses_body_file(command: str) -> bool:
    """True — если команда gh pr comment передаёт body через файл/stdin."""
    # Проверяем только для gh pr comment — остальные команды не по нашей теме.
    if not _GH_PR_COMMENT.search(command):
        return False
    return bool(_BODY_FILE_FLAGS.search(command))


def uses_dangerous_substitution(command: str) -> bool:
    """True — если команда gh pr comment использует file-read конструкции
    внутри command substitution, скрывающие реальное содержимое body.

    Закрывает bypass: `--body "$(cat /tmp/x)"` — hook видит только литерал
    `$(cat /tmp/x)`, не содержимое файла. Легитимный heredoc
    `$(cat <<'EOF' ... EOF)` остаётся разрешённым: содержимое инлайн в
    команде и попадает в regex `_MERGE_READY_CANDIDATE`.
    """
    if not _GH_PR_COMMENT.search(command):
        return False
    return bool(_DANGEROUS_SUBST.search(command))


def uses_opaque_variable_body(command: str) -> bool:
    """True — если `--body` получает значение из непрозрачной переменной.

    Закрывает bypass: `BODY="## ✅ Готов к merge"; gh pr comment 1 --body "$BODY"`.
    В payload tool_input.command виден только литерал `$BODY` — фраза «готов
    к merge» лежит в переменной и hook её не увидит. Чтобы hard gate
    оставался реальным, для `gh pr comment` без FINALIZE_PR_TOKEN запрещено
    подставлять body из переменной — допустимы только inline string или
    heredoc `$(cat <<'EOF' ... EOF)`, где содержимое физически в команде.

    Exception: heredoc в той же команде делает содержимое видимым hook'у
    (even через переменную — BODY=$(cat <<'EOF' ... EOF); --body "$BODY").
    Именно эту форму используют шаблоны review-pass в sprint-pr-cycle
    и external-review — без исключения hook ломает pipeline целиком.
    Фраза merge-ready в heredoc поймается is_forbidden по raw команде.
    """
    if not _GH_PR_COMMENT.search(command):
        return False
    if _HEREDOC_PRESENT.search(command):
        # Heredoc делает содержимое видимым — is_forbidden проверит его.
        return False
    return bool(_OPAQUE_VAR_BODY.search(command))


def is_forbidden(command: str) -> bool:
    """True — если команда содержит запрещённый заголовок readiness.

    Нормализуем только `_` и `-` в пробелы — это закрывает обход через
    `ready_to_merge`, `ready-to-merge`. Переносы строк НЕ нормализуем:
    паттерн использует multiline-якоря `^`/`$`, которые должны видеть
    реальные `\\n` в команде (shell-heredoc, multiline body).

    Двухстадийный matcher (см. комментарий к _MERGE_READY_CANDIDATE):
    candidate → проверка префикса на отрицание → True только если
    префикс чист.
    """
    normalized = re.sub(r"[_\-]+", " ", command)
    for match in _MERGE_READY_CANDIDATE.finditer(normalized):
        prefix = match.group("prefix") or ""
        if _NEGATION_WORDS.search(prefix):
            # «не готов к merge», «почти ready to merge», «PR будет готов…»
            # — это обсуждение, не декларация. Продолжаем искать другие
            # кандидаты в той же команде.
            continue
        return True
    return False


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
    # от hook'а: `$(cat /file)`, `$(<file)`, backticks с чтением файла.
    # Legitimate heredoc `$(cat <<'EOF' ... EOF)` остаётся разрешённым
    # (содержимое инлайн, regex его видит). Here-string `<<<` НЕ блокируется
    # отдельно: `gh pr comment` не читает stdin без `--body-file -`,
    # который уже блокируется выше.
    if uses_dangerous_substitution(command):
        sys.stderr.write(
            "БЛОКИРОВКА: для `gh pr comment` запрещены конструкции, "
            "скрывающие содержимое body от hook'а: "
            "`$(cat file)`, `$(<file)`, backticks `cat file`.\n"
            "Используй inline --body '...', heredoc `$(cat <<'EOF' ... EOF)` "
            "или /finalize-pr <PR_NUMBER>.\n"
        )
        return 1

    # Блокируем `--body "$VAR"` / `--body $VAR` / `--body "${VAR}"` —
    # body берётся из переменной, hook видит только литерал имени переменной,
    # а реальный текст ему недоступен. Это bypass: запрещённая фраза легко
    # прячется в переменную (`BODY="## ✅ Готов к merge"; gh pr comment 1 --body "$BODY"`).
    if uses_opaque_variable_body(command):
        sys.stderr.write(
            "БЛОКИРОВКА: для `gh pr comment` нельзя подставлять body из "
            "переменной (`--body \"$VAR\"`, `--body ${VAR}`): hook видит "
            "только имя переменной, не её содержимое.\n"
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
