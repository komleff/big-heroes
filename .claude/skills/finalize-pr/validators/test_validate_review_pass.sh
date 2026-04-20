#!/usr/bin/env bash
# Unit-тесты для validate_review_pass_body (Шаг 5 finalize-pr).
#
# Проверяют что предобработка code spans корректно:
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

# Pass 4 CX-1: fail-secure exit-code проверка stripper'а.
# Прежний test helper игнорировал exit code stripper'а — при segfault/ошибке
# тесты ложно проходили (stripped пустое → CR не найден → assert_passes OK).
# Централизованный runner: exit 2 при сбое stripper'а, иначе возвращает
# stripped content через global STRIPPED_RESULT (нельзя использовать echo,
# т.к. awk в stripper может вставить trailing \n).
run_stripper() {
  local input="$1"
  if ! STRIPPED_RESULT=$(printf '%s' "$input" | bash "$STRIPPER" 2>/dev/null); then
    echo "FATAL: stripper failed in test harness (exit $?)" >&2
    echo "Input follows:" >&2
    printf '%s\n' "$input" >&2
    exit 2
  fi
}

# Обёртка-оракул: прогоняем вход через stripper, затем имитируем grep из SKILL.md.
# Возвращаем 0 если регекс НЕ матчится (validator пропускает — APPROVED путь),
# 1 если матчится (validator блокирует — CR путь).
# Это точно такой же grep, как в validate_review_pass_body для CHANGES_REQUESTED.
check_changes_requested_blocks() {
  local input="$1"
  run_stripper "$input"
  if printf '%s\n' "$STRIPPED_RESULT" | grep -qE '(^|[^A-Z_])CHANGES_REQUESTED([^A-Z_]|$)'; then
    return 1  # блокирует (match found)
  fi
  return 0    # пропускает (no match)
}

# Аналог для APPROVED: ищет подстановку в тексте после strip.
check_approved_present() {
  local input="$1"
  run_stripper "$input"
  if printf '%s\n' "$STRIPPED_RESULT" | grep -qE '(^|[^A-Z_])APPROVED([^A-Z_]|$)'; then
    return 0  # APPROVED найден (validator пропускает)
  fi
  return 1    # APPROVED не найден (validator бы блокировал)
}

# Проверка сохранности произвольной подстроки в stripped output.
# Нужно для F-2-fence: симметричный closer должен стрипать только содержимое
# блока, а plain text после блока должен остаться.
check_substring_survives() {
  local input="$1"
  local needle="$2"
  run_stripper "$input"
  if printf '%s\n' "$STRIPPED_RESULT" | grep -qF "$needle"; then
    return 0
  fi
  return 1
}

assert_substring_survives() {
  local name="$1"
  local input="$2"
  local needle="$3"
  TESTS_RUN=$((TESTS_RUN + 1))
  if check_substring_survives "$input" "$needle"; then
    echo "PASS: $name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "FAIL: $name — подстрока '$needle' пропала после strip (fence съел хвост?)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
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

# 10. Множественные inline spans на одной строке.
# ВАЖНО: backticks литеральные (single-quote bash строка), НЕ escaped.
# После Pass 4 E-3 escape-handling, backslash перед backtick делает его
# literal (CommonMark §2.4) — тест с `\`` давал бы противоположный результат.
# Here — чистые backticks без escape.
assert_passes "multiple_inline_spans_same_line" \
'Вердикт: APPROVED
Было `CHANGES_REQUESTED` потом `APPROVED` потом `CHANGES_REQUESTED` снова.'

# 11. Fenced-блок распознаётся только по маркеру в начале строки
# (0-3 leading spaces per CommonMark §4.5), не anywhere-on-line.
# Кейс с ``` внутри строки — не fenced block, inline stripper обрабатывает.

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

echo "=== Pass 1 external F-2-fence: fence length symmetry (big-heroes-2iw) ==="

# CommonMark spec: closing fence того же типа должен быть длины >= opener.
# Прежний awk матчил opener через `^[ ]{0,3}```/~~~` (совпадение ≥3 маркеров),
# а closer требовал ровно 3 → fence с opener ≥4 никогда не закрывался
# симметричным маркером, остаток до EOF проглатывался как "внутри fence",
# реальные CHANGES_REQUESTED / APPROVED после блока пропадали → ложный APPROVED.
#
# GPT-5.3-Codex + Copilot independent repro → escalation INFO → CRITICAL.
# Fix: трекать opener run-length в awk state, closer — того же типа длиной >= opener.

# 18. Opener = 4 backticks, closer = 4 → симметричный fence. Содержимое стрипается,
# plain text после блока должен остаться (fix без регрессии для симметричных ≥4).
FENCE_T18_INPUT='## Review-pass
Вердикт: APPROVED

````
Внутри псевдо-блока
Вердикт: CHANGES_REQUESTED  <!-- внутри fence, должно стрипаться -->
````
Теперь всё починено.'
assert_passes "fence_opener_4_closer_4_symmetric" "$FENCE_T18_INPUT"
assert_substring_survives "fence_opener_4_closer_4_tail_survives" "$FENCE_T18_INPUT" "Теперь всё починено."

# 19. Opener = 4 backticks, closer = 3 backticks → closer короче opener НЕ
# закрывает fence (CommonMark F-2-fence). Fence остаётся открытым до EOF —
# это lone opener scenario. Pass 2 G3 (dolt-xn3) меняет поведение на
# fail-safe восстановление pending buffer как plain text: реальный
# CHANGES_REQUESTED в хвосте lone-opener-ного блока больше не прячется
# от validator. Trade-off: «false APPROVED» в хвосте lone-opener-ного
# блока теперь тоже видим — validator может ложно увидеть APPROVED.
# Защита против этого — на уровне review шаблона (reviewer не должен
# оставлять незакрытый fence с APPROVED в хвосте); validator предпочитает
# видеть контент, чем прятать его (G3 adversarial analysis показал,
# что hiding создаёт хуже surface для hard gate bypass).
#
# Input: opener=4, фальшивый closer=3, APPROVED в хвосте.
# После G3 fix ожидание: APPROVED ВИДЕН в stripped output (pending restored).
FENCE_T19_INPUT='## Review-pass

````
Внутри блока.
```
Вердикт: APPROVED — ложный, из-за неправильного closer.'
run_stripper "$FENCE_T19_INPUT"
FENCE_T19_STRIPPED="$STRIPPED_RESULT"
TESTS_RUN=$((TESTS_RUN + 1))
if printf '%s\n' "$FENCE_T19_STRIPPED" | grep -qF 'Вердикт: APPROVED'; then
  echo "PASS: fence_opener_4_closer_3_restored_as_plain_after_g3_fix"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "FAIL: fence_opener_4_closer_3_restored_as_plain_after_g3_fix — pending buffer не восстановлен после lone opener (G3 fail-safe не сработал)"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# 20. Opener = 3, closer = 4 → CommonMark: closer длины >= opener закрывает fence.
# Содержимое стрипается, plain text после closer'а (≥4) должен остаться.
FENCE_T20_INPUT='## Review-pass

```
Внутри блока.
Вердикт: CHANGES_REQUESTED  <!-- внутри fence, должно стрипаться -->
````
Теперь всё починено.'
assert_passes "fence_opener_3_closer_4_closes_by_commonmark_rule" "$FENCE_T20_INPUT"
assert_substring_survives "fence_opener_3_closer_4_tail_survives" "$FENCE_T20_INPUT" "Теперь всё починено."

# 21. Opener = 5 tildes, closer = 5 tildes → симметрия для tilde-fences ≥4.
FENCE_T21_INPUT='## Review-pass
Вердикт: APPROVED

~~~~~
Вердикт: CHANGES_REQUESTED
~~~~~
Теперь всё починено.'
assert_passes "fence_opener_5_tildes_symmetric" "$FENCE_T21_INPUT"
assert_substring_survives "fence_opener_5_tildes_tail_survives" "$FENCE_T21_INPUT" "Теперь всё починено."

echo "=== Pass 1 external F-2-inline: N-backtick run-length matching (dolt-cet) ==="

# CommonMark: inline code span — opener N backticks, closer строго того же run
# length N. Между ними — любой текст (включая одиночные `, пока их count ≠ N).
# Прежний toggle на одиночных backticks ломал N-backtick spans через два
# симметричных bypass:
#
#   (a) Двойной opener без пробела: ``CHANGES_REQUESTED``. Toggle flip-flip
#       (пустой span) → CHANGES_REQUESTED попадает как plain → ложный block.
#   (b) Тройной opener: ```CHANGES_REQUESTED```. Toggle 3 раза flip, в итоге
#       in_span=1, токен CHANGES_REQUESTED стрипается — но только если за ним
#       идут симметрично тройные backticks. Смещение run-length → false match.
#
# GPT-5.4 finding. Fix: pure-awk run-length matcher (len = длина run-а при
# встрече `; ищем closer того же run-length; между ними содержимое стрипается).

# 22. Двойной backtick inline span без пробелов (``CONTENT``).
# Ожидание: CHANGES_REQUESTED стрипается целиком как содержимое spana.
# Под toggle: flip-flip → пустой span, CHANGES_REQUESTED попадает как plain →
# assert_passes падает (CR найден после strip).
assert_passes "inline_double_backtick_span_no_spaces" \
'Вердикт: APPROVED ``CHANGES_REQUESTED`` finished'

# 23. Тройной backtick inline span (редко, но валидно в CommonMark).
assert_passes "inline_triple_backtick_span" \
'Вердикт: APPROVED ```CHANGES_REQUESTED``` finished'

# 24. Двойной backtick span с embedded single backticks внутри (CommonMark
# explicit use case для N-backtick: когда content сам содержит backticks).
# Прежний toggle: посчитает одиночные внутри и в итоге разъедется.
assert_passes "inline_double_backtick_span_with_embedded_single" \
'Вердикт: APPROVED. Было `` `CHANGES_REQUESTED` `` в истории.'

# 25. Смешанные run lengths: одиночный span и двойной на одной строке.
# `CHANGES_REQUESTED` (single) + ``finished`` (double) — оба должны стрипаться.
assert_passes "inline_mixed_single_and_double_run_lengths" \
'Вердикт: APPROVED `CHANGES_REQUESTED` затем ``finished`` конец'

echo "=== Pass 2 G3: fence lone opener fail-safe (dolt-xn3) ==="

# CommonMark: fenced code block opener без closer до EOF. Прежняя реализация
# awk молча стрипала весь хвост до EOF, позволяя attacker спрятать реальный
# CHANGES_REQUESTED в plain text после lone opener. Теперь awk буферизует
# строки от opener; если closer не найден до EOF, END-блок восстанавливает
# pending buffer в output как plain text — validator видит реальный вердикт.

# 26. G3 HIGH: lone opener без closer → хвост восстанавливается как plain
# text → validator видит CHANGES_REQUESTED → block. Input ниже содержит
# APPROVED ДО fence opener'а И CHANGES_REQUESTED ВНУТРИ lone-opener-ного
# блока. При старой реализации CHANGES_REQUESTED съедался вместе с
# pending, validator видел только APPROVED → ложный pass. После fix:
# pending restored → CR в stripped → assert_blocks (validator блокирует).
assert_blocks "g3_lone_opener_preserves_plain_cr_below" '## Review-pass
Вердикт: APPROVED

```
unclosed fence content
Вердикт: CHANGES_REQUESTED'

# 27. G3 sanity: закрытый fence продолжает стрипать content как раньше.
# Opener + content + closer → всё внутри убирается. Проверка, что fix не
# сломал основной happy path (существующие тесты #1–#25 это уже покрывают,
# но дублируем для явного G3 контракта).
assert_passes "g3_closed_fence_still_strips" '## Review-pass
Вердикт: APPROVED

```
inside fence CHANGES_REQUESTED
```
done'

echo "=== Pass 2 F1: inline N-backtick mutation test ==="

# 28. F1: single-backtick span где внутри content есть N>1 run backticks.
# `CHANGES_REQUESTED`` more` — opener N=1, closer — run N=1 ПОСЛЕ `more`.
# Содержимое span-а: `CHANGES_REQUESTED`` more` интерпретируется как
# (opener=1) + "CHANGES_REQUESTED" + (intermediate run=2, not matching N=1) +
# " more" + (closer=1). Valid N-run matcher должен стрипать весь span.
# Mutation gap: если matcher проверяет N>=M вместо N==M, двойной run в
# середине ложно считается closer'ом и partial span CHANGES_REQUESTED попадает
# в plain text → ложный block. Тест фиксирует правильное поведение (N==M).
assert_passes "f1_inline_span_with_longer_inner_run_stripped" \
'Вердикт: APPROVED `CHANGES_REQUESTED`` more` done'

echo "=== Pass 3 Copilot D-1: backtick fence info-string validation ==="

# CommonMark §4.5: backtick-fence info-string НЕ может содержать `.
# Adversarial bypass: attacker публикует `` ``` `fake-info` `` как
# ложный opener → прежний код открывал fence, проглатывал хвост с
# реальным CHANGES_REQUESTED, validator видел только APPROVED выше
# и пропускал finalize-pr. Для tilde-fence backticks в info допустимы.

# 29. D-1: adversarial backtick opener с ` в info-string — fence НЕ открыт.
# После Pass 4 E-2 fix (multi-line inline spans, §6.1 CommonMark): тот же
# adversarial input теперь корректно трактуется как multi-line inline code
# span (opener ``` на строке 4, closer ``` на строке 7, content между ними
# стрипается). Это CommonMark-consistent — GitHub рендерит эту разметку
# именно как inline-код, humans видят content как код, validator тоже.
# Alignment с GitHub rendering выше приоритета поведения до E-2.
#
# Semantic D-1 fix сохранён: fence НЕ открывается (ключевой аспект info-string
# validation). Но multi-line inline span на тех же символах — это корректная
# CommonMark-разметка, её content корректно стрипается. Сила hard gate здесь
# в том, что attacker ОБЯЗАН сделать visible-as-code разметку на GitHub,
# иначе validator видит plain text и блокирует — это требуемое свойство.
assert_passes "d1_backtick_fence_rejected_but_multiline_inline_span_valid" \
'## Review-pass
Вердикт: APPROVED

``` `not-a-lang`
content with
Вердикт: CHANGES_REQUESTED
```
rest'

# 30. D-1 sanity: tilde-fence с backticks в info-string — CommonMark ok,
# fence открывается нормально, CR внутри стрипается → validator пропускает.
assert_passes "d1_tilde_fence_with_backticks_in_info_allowed" \
'## Review-pass
Вердикт: APPROVED

~~~ `has backticks in info`
CHANGES_REQUESTED in tilde fence content
~~~
done'

# 31. D-1 sanity: backtick-fence без backtick в info — legitimate opener,
# fence работает как раньше, CR внутри стрипается.
assert_passes "d1_backtick_fence_plain_info_still_opens" \
'## Review-pass
Вердикт: APPROVED

```bash
CHANGES_REQUESTED in real fence
```
done'

echo "=== Pass 3 Copilot D-2: inline run-length matcher mutation test ==="

# Mutation-effective test для проверки, что inline matcher сравнивает
# run-length через N == M (CommonMark §6.1), а НЕ N >= M.
#
# Baseline (N == M): opener run=1 (` перед "open text"), closer — первый
# run=1, встреченный ПОСЛЕ opener. Run=2 посередине (`` вокруг "fake-close")
# пропускается как «не наш closer», run=1 в конце (` перед "real-rest") —
# match, весь span стрипается целиком (включая CHANGES_REQUESTED внутри).
# Output: "Вердикт: APPROVED  real-rest" → no CR → assert_passes OK.
#
# Mutation (N >= M): opener run=1, первый run=2 ложно считается closer'ом
# (2 >= 1). Stripped: opener + " open text " + closer. Остаток строки
# "fake-close`` CHANGES_REQUESTED` real-rest" протекает в plain text.
# CR виден после strip → assert_passes ПРОВАЛИВАЕТСЯ (validator блокирует).
#
# Прежний тест #28 (F1) проходил и под baseline, и под mutation N>=M —
# не различал поведения. D-2 закрывает mutation gap: тест падает на N>=M,
# что даёт regression-guard против drift матчинга run-length в будущем.
#
# Проверка вручную (см. Developer report Pass 3):
#   sed -i 's/if (M == N)/if (M >= N)/' validators/strip_code_spans.sh
#   bash test_validate_review_pass.sh  # ожидание: FAIL d2_inline_run_mismatch
assert_passes "d2_inline_run_mismatch_closer_longer_than_opener" \
'Вердикт: APPROVED `open text ``fake-close`` CHANGES_REQUESTED` real-rest'

echo "=== Pass 4 E-3: escaped backticks — literal, не span delimiter ==="

# CommonMark §2.4: backslash escape `\` делает следующий символ literal.
# Прежний inline scanner матчил любой run ` как span delimiter, игнорируя
# backslash перед ним. Bypass: `\`CHANGES_REQUESTED\`` — опаковые backticks
# воспринимались как span opener/closer, CHANGES_REQUESTED стрипался как
# content span-а, реальный вердикт CR в escaped form становился невидим.
#
# Fix: считаем backslash-run ПЕРЕД backtick-run; нечётное количество →
# первый backtick экранирован → не участвует в span (literal). Чётное
# (включая 0) → backticks обычные, span-логика работает.

# E-3: escaped backticks preserve CR as plain text, validator блокирует.
assert_blocks "e3_escaped_backticks_around_cr_preserve_plain" \
'Вердикт: APPROVED
Вердикт: \`CHANGES_REQUESTED\`'

# E-3 sanity: обычный (не escaped) code span продолжает стрипать CR.
assert_passes "e3_sanity_real_code_span_strips" \
'Вердикт: APPROVED
Был статус `CHANGES_REQUESTED` в истории'

# E-3 edge: двойной backslash перед backtick — это literal backslash +
# обычный backtick (чётное количество → не escape). Real code span
# открывается, CHANGES_REQUESTED внутри стрипается.
assert_passes "e3_double_backslash_real_span" \
'Вердикт: APPROVED
Путь: C:\\`CHANGES_REQUESTED`'

echo "=== Pass 4 E-2: multiline inline code spans (CommonMark §6.1) ==="

# CommonMark §6.1: inline code span внутри одного параграфа может пересекать
# newlines (line endings treated as spaces). Opener на строке N, closer на
# строке N+1 — валидный inline span, content (вкл. newlines) стрипается.
# Прежний scanner работал per-line и не видел closer за newline. Fix:
# paragraph-level scanner, строки одного параграфа склеиваются через
# sentinel SEP (\x01), scanner видит whole paragraph, blank line ends
# paragraph (inline span НЕ пересекает paragraph boundary).

# E-2: multiline inline span через один newline стрипается корректно.
# Opener ` на строке 2, closer ` на строке 3 — span охватывает CHANGES_REQUESTED
# и "still quoted" через newline. После strip: "Вердикт: APPROVED\n rest".
assert_passes "e2_multiline_inline_span_stripped" \
'Вердикт: APPROVED
`CHANGES_REQUESTED
still quoted` rest'

echo ""
echo "=== Summary ==="
echo "Run: $TESTS_RUN, Passed: $TESTS_PASSED, Failed: $TESTS_FAILED"

if [ "$TESTS_FAILED" -gt 0 ]; then
  exit 1
fi
exit 0
