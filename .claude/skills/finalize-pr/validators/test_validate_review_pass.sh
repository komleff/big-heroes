#!/usr/bin/env bash
# Unit-тесты для validate_review_pass_body (Шаг 5 finalize-pr).
#
# Проверяют что predobработка code spans корректно:
#   1. блокирует plain text «Вердикт: CHANGES_REQUESTED» (истинный вердикт);
#   2. пропускает `CHANGES_REQUESTED` внутри inline code span (парные одиночные бэктики);
#   3. пропускает CHANGES_REQUESTED внутри fenced block (тройные бэктики);
#   4. sanity: plain «Вердикт: APPROVED» без backtick-матчей на CHANGES_REQUESTED — пропускает.
#
# Плюс edge cases:
#   - fenced block с language hint (```bash);
#   - CRLF line endings;
#   - вложенные inline backticks внутри fenced block не ломают strip fenced;
#   - непарный одиночный backtick не валит скрипт;
#   - множественные inline spans на одной строке.
#
# Запуск:
#   bash .claude/skills/finalize-pr/validators/test_validate_review_pass.sh
# Exit 0 = PASS, exit 1 = FAIL.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STRIPPER="$SCRIPT_DIR/strip_code_spans.sh"

if [ ! -x "$STRIPPER" ]; then
  chmod +x "$STRIPPER" 2>/dev/null || true
fi

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Обёртка-оракул: прогоняем вход через stripper, затем имитируем grep из SKILL.md.
# Возвращаем 0 если регекс НЕ матчится (validator пропускает — APPROVED путь),
# 1 если матчится (validator блокирует — CR путь).
# Это точно такой же grep, как в validate_review_pass_body для CHANGES_REQUESTED.
check_changes_requested_blocks() {
  local input="$1"
  local stripped
  stripped=$(printf '%s' "$input" | bash "$STRIPPER")
  if printf '%s\n' "$stripped" | grep -qE '(^|[^A-Z_])CHANGES_REQUESTED([^A-Z_]|$)'; then
    return 1  # блокирует (match found)
  fi
  return 0    # пропускает (no match)
}

# Аналог для APPROVED: ищет подстановку в тексте после strip.
check_approved_present() {
  local input="$1"
  local stripped
  stripped=$(printf '%s' "$input" | bash "$STRIPPER")
  if printf '%s\n' "$stripped" | grep -qE '(^|[^A-Z_])APPROVED([^A-Z_]|$)'; then
    return 0  # APPROVED найден (validator пропускает)
  fi
  return 1    # APPROVED не найден (validator бы блокировал)
}

assert_blocks() {
  local name="$1"
  local input="$2"
  TESTS_RUN=$((TESTS_RUN + 1))
  if check_changes_requested_blocks "$input"; then
    echo "FAIL: $name — ожидалось блокирование (CHANGES_REQUESTED остался после strip), но match не нашёлся"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  else
    echo "PASS: $name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  fi
}

assert_passes() {
  local name="$1"
  local input="$2"
  TESTS_RUN=$((TESTS_RUN + 1))
  if check_changes_requested_blocks "$input"; then
    echo "PASS: $name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "FAIL: $name — CHANGES_REQUESTED ложно найден после strip (должен был быть удалён вместе с code span)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

assert_approved_found() {
  local name="$1"
  local input="$2"
  TESTS_RUN=$((TESTS_RUN + 1))
  if check_approved_present "$input"; then
    echo "PASS: $name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "FAIL: $name — APPROVED не найден после strip (validator бы ложно блокировал)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

echo "=== Core VC-2 tests ==="

# 1. Positive: plain text — блокирует
assert_blocks "plain_text_changes_requested_blocks" \
"## Review-pass #3
Вердикт: CHANGES_REQUESTED
Архитектура: ISSUE"

# 2. Positive: inline backtick span — пропускает
assert_passes "inline_backtick_span_ignored" \
"## Review-pass #5
Вердикт: APPROVED

В истории был статус \`CHANGES_REQUESTED\` на предыдущем commit."

# 3. Positive: fenced block — пропускает
assert_passes "fenced_block_ignored" \
'## Review-pass #6
Вердикт: APPROVED

Пример старого отчёта:
```
Вердикт: CHANGES_REQUESTED
Архитектура: ISSUE
```
Теперь всё починено.'

# 4. Sanity negative: plain APPROVED без CR — пропускает (должен пройти as APPROVED)
assert_passes "sanity_plain_approved_no_cr" \
"## Review-pass #1
Вердикт: APPROVED
Архитектура: OK"
assert_approved_found "sanity_plain_approved_still_has_approved" \
"## Review-pass #1
Вердикт: APPROVED
Архитектура: OK"

echo "=== Edge cases ==="

# 5. Fenced с language hint
assert_passes "fenced_block_with_language_hint_ignored" \
'## Review-pass
Вердикт: APPROVED

```bash
echo "CHANGES_REQUESTED был в истории"
```'

# 6. Fenced с diff
assert_passes "fenced_block_with_diff_hint_ignored" \
'Вердикт: APPROVED

```diff
- Вердикт: CHANGES_REQUESTED
+ Вердикт: APPROVED
```'

# 7. CRLF line endings — строки с \r\n не ломают strip
CRLF_INPUT=$'## Review-pass\r\nВердикт: APPROVED\r\n\r\n```\r\nВердикт: CHANGES_REQUESTED\r\n```\r\n'
assert_passes "crlf_fenced_block_ignored" "$CRLF_INPUT"

# 8. Inline backticks внутри fenced блока — fenced strip сжирает всё целиком
assert_passes "fenced_with_inline_backticks_inside" \
'Вердикт: APPROVED

```
Заметка: `CHANGES_REQUESTED` как цитата.
```'

# 9. Непарный одиночный backtick — не должен падать, text после него проходит best-effort
# Если backtick один, awk-оракул не стрипует (нет закрытия) — CHANGES_REQUESTED в тексте должен остаться.
# Это best-effort: лучше ложно блокировать (safe default) чем ложно пропускать.
assert_blocks "unmatched_single_backtick_fallback_to_block" \
"## Review-pass
Это \`битый markdown без закрытия — Вердикт: CHANGES_REQUESTED всё равно виден как plain."

# 10. Множественные inline spans на одной строке
assert_passes "multiple_inline_spans_same_line" \
'Вердикт: APPROVED
Было \`CHANGES_REQUESTED\` потом \`APPROVED\` потом \`CHANGES_REQUESTED\` снова.'

# 11. Fenced-блок НЕ в начале строки (не должен матчиться как fenced — только для line-start ```)
# Но для robustness мы матчим ``` anywhere-on-line — принимаем что это рабочий compromise.
# Проверим, что inline `` (тройной backtick в строке) не валит — это очень редкий markdown-кейс.
# Тут ожидание: skip, as best effort.

# 12. Вложенный inline внутри inline невозможен в markdown, не проверяем.

# 13. Стоит проверить что реальный README-like diff не ломается:
assert_passes "multiple_fenced_blocks_alternating" \
'Вердикт: APPROVED

Первый:
```
Вердикт: CHANGES_REQUESTED
```

Второй:
```diff
- CHANGES_REQUESTED
+ APPROVED
```

Заключение: всё починено.'

echo "=== Pass 2 adversarial: CommonMark fence class coverage ==="

# 14. F-1: tilde fence ~~~ — CommonMark эквивалент ``` (должен стрипаться)
assert_passes "tilde_fenced_block_ignored" \
'## Review-pass
Вердикт: APPROVED

~~~
Вердикт: CHANGES_REQUESTED
~~~
Теперь всё починено.'

# 15. F-2: indented triple-backtick fence (2 leading spaces) — CommonMark допускает 0-3 indent
assert_passes "indented_backtick_fenced_block_ignored" \
'## Review-pass
Вердикт: APPROVED

  ```
  Вердикт: CHANGES_REQUESTED
  ```
Теперь всё починено.'

# 16. F-1 + F-2 combined: indented tilde fence (3 leading spaces)
assert_passes "indented_tilde_fenced_block_ignored" \
'## Review-pass
Вердикт: APPROVED

   ~~~
   Вердикт: CHANGES_REQUESTED
   ~~~
Теперь всё починено.'

# 17. Mismatched fence type: opener ``` не закрывается ~~~ — CommonMark требует симметрии.
# Всё между ``` и реальным ``` должно быть вырезано, ~~~ внутри не считается closer.
assert_passes "mismatched_fence_tilde_does_not_close_backtick" \
'## Review-pass
Вердикт: APPROVED

```
Вердикт: CHANGES_REQUESTED somewhere
~~~
не является закрытием
```
Финал.'

echo ""
echo "=== Summary ==="
echo "Run: $TESTS_RUN, Passed: $TESTS_PASSED, Failed: $TESTS_FAILED"

if [ "$TESTS_FAILED" -gt 0 ]; then
  exit 1
fi
exit 0
