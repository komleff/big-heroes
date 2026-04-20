# External Review Request — Sprint Pipeline v3.5 (PR #15) — Pass 1

**Mode B-manual workflow:** оператор копирует весь файл в ChatGPT (web, GPT-5.4 через OAuth-логин), копирует ответ **прямо в PR #15 comment** (GitHub UI), даёт PM команду «pass-1 готов».

**Target model:** GPT-5.4 (тот же канал что v3.4 external review).

**Mode degradation:** B-manual (semi-manual через ChatGPT web). Причина: `big-heroes-1l6` (BE-11 Windows sandbox 1326) блокирует Codex CLI на dev-host оператора → Mode A/B недоступны. Прецеденты v3.4 (3 pass Mode B-manual APPROVED).

---

## Commit binding (обязательно зафиксировать в ответе)

- **PR:** https://github.com/komleff/big-heroes/pull/15
- **HEAD commit:** `cac2c7c` (full SHA в diff header)
- **Base branch:** `master` @ `d3dab6b` (после merge PR #14 — Sprint Pipeline v3.4 Pre-Merge Landing)
- **Title:** `fix(pipeline): Sprint v3.5 — finalize-pr validator code-span + v3.4 cleanup`
- **Tier:** Critical + Sprint Final

**Внутренние review-pass уже пройдены (Claude Opus 4.7):**
- Tester gate → GATE_BLOCK (gap `;` `…`) → GATE_PASS после delta-fix.
- Reviewer Pass 1 → APPROVED.
- Reviewer Pass 2 adversarial → CHANGES_REQUESTED (2 CRITICAL + 1 WARNING) — CommonMark fence alternatives.
- Reviewer Pass 3 delta-verify → APPROVED на `cac2c7c` (+1 INFO deferred: 4+ fence markers closer >= opener).

**Файлы в diff (9, 8 коммитов от master):**

1. `docs/plans/sprint-pipeline-v3-5-cleanup.md` (new, 259 lines — план спринта с VC-1..VC-6)
2. `.claude/skills/finalize-pr/SKILL.md` (+21/-2 — Шаг 5 validator использует strip_code_spans helper)
3. `.claude/skills/finalize-pr/validators/strip_code_spans.sh` (new, 115 lines — awk state machine для fenced/inline strip с typed fence tracking + 0-3 indent tolerance)
4. `.claude/skills/finalize-pr/validators/test_validate_review_pass.sh` (new, 255 lines — 16 unit-тестов)
5. `.claude/skills/finalize-pr/validators/regression_pr14.sh` (new, 124 lines — VC-5 regression prove helper)
6. `.claude/hooks/check-merge-ready.py` (+16/-0 — terminator class расширен с `,` + `;` + `…` U+2026)
7. `.claude/hooks/test_check_merge_ready.py` (+37/-0 — 5 новых regression тестов + semantic symmetry тесты)
8. `.agents/PM_ROLE.md` (+13/-? — §2.5 Шаг 4 fenced bash block вместо inline backticks с newline)
9. `docs/archive/sprint-pipeline-v3-4-pre-merge-landing.md` (+2/-1 — 1 LoC Test plan qualifier для первого /finalize-pr)

---

## Роль и задача

Ты — внешний Reviewer (GPT-5.4), pass-1 для Sprint Pipeline v3.5. Главная задача: **independent cross-model review** спринт-уборки v3.4. Ищешь CRITICAL/HIGH findings, которые внутренняя Claude-цепочка (Pass 1-2-3 одной модели = Opus 4.7) могла пропустить. Semi-adversarial по отношению к **внутренним** Claude review-pass'ам.

**Вторичная:** verify что Pass 2 CRITICAL findings закрыты в `cac2c7c` корректно — tilde `~~~` fences + indented (0-3 spaces) + mismatched fence types.

---

## Scope Sprint v3.5 (брифинг оператора, зафиксированный 2026-04-20)

**Спринт-уборка после v3.4.** Никаких новых механизмов. Две правки:

**Правка 1 (infrastructure bugfix):** validator regex в `/finalize-pr` Шаг 5 — игнорировать вхождения `CHANGES_REQUESTED`/`APPROVED` внутри code spans (inline `backticks` + fenced ```markers```). Устраняет infrastructure false positive hard gate, обнаруженный в PR #14 (narrative-цитата блокировала transition несмотря на явный `Вердикт: APPROVED` в META).

**Правка 2 (backlog cleanup):** закрыть или defer-with-rationale задачи с префиксом `[sprint-pipeline-v3-4]` / `[from-v3.4-dropped]`. Result: 3 fix-now (hyo fenced block, rux 1 LoC qualifier, ase hook terminator) + 1 resolved (ekb — scope rollback v3.4) + 3 deferred v3.6 (35g error handling, hrd mode-label, 8gd WSL path).

---

## Pass 2 findings — closure verification (Pass 3 already APPROVED, but independent verify)

| pass-2 # | Finding | Fix commit | Approach |
|---|---|---|---|
| F-1 (CRITICAL) | Stripper не покрывает tilde fences `~~~` (CommonMark spec эквивалент с ```) | `cac2c7c` | Awk state machine с типом `in_fence ∈ {"","BACKTICK","TILDE"}`. TILDE-opener `^[ ]{0,3}~~~` закрывается только TILDE-closer `^[ ]{0,3}~~~[ \t]*$`. |
| F-2 (CRITICAL) | Stripper не покрывает indented fences (1-3 leading spaces, CommonMark) | `cac2c7c` | Regex `^[ ]{0,3}` в opener и closer. 4+ spaces → indented code block (другой formalism, не fence) — правомерно отвергаются. |
| F-3 (WARNING) | Stripper не покрывает blockquote-prefixed fences (`> ``` `) | deferred | `big-heroes-wz6` (P3, target v3.6). Asymmetric с hook `_BLOCKQUOTE_MARKER`, но реже встречается. |

Pass 3 (delta-verify) подтвердил closure F-1 + F-2 + mismatched fence handling + 16/16 tests PASS. Deferred F-3 + INFO 4+ markers (`big-heroes-2iw`).

---

## Чек-лист pass-1 (по 4 аспектам)

### Архитектура

- **validators/ subdirectory** — первый прецедент subdirectory внутри `/finalize-pr` skill. Обоснован ли vs inline awk в SKILL.md? Устанавливает pattern для будущих complex skills — нет ли архитектурной деградации (too deep nesting, unclear ownership)?
- **State machine в awk** (85 строк) — план плана разрешал Python fallback при awk >25 LoC. Почему именно bash/awk, не Python? Consistency argument принят Pass 1-2-3, но оператор может предпочесть Python для тестируемости/portability.
- **Hook regex class** `[.!?,;…]` — симметричное class-расширение. Нет ли лучшей архитектуры (например, lookahead на readiness-keyword после terminator) — или это over-engineering для INFO-level risk?
- **Stripper vs SKILL.md decoupling** — SKILL.md:257 вызывает `bash .claude/skills/finalize-pr/validators/strip_code_spans.sh` через relative path. Coupled с cwd=repo root. Acceptable convention (как остальные bash в SKILL.md) или fragile?

### Безопасность

- **Hook bypass completeness:** после `,;…` — остались ли terminator'ы того же class'а, которые обходят блокировку? Конкретно проверь:
  - `:` (colon) — `готов к merge: landing` — блокируется или нет?
  - CJK punctuation: `。` (U+3002), `！` (U+FF01), `？` (U+FF1F) — acceptable deferred или реальный bypass?
  - Zero-width joiner после merge (`готов к merge\u200d, ...`) — скрывает ли terminator?
  - Mixed scripts: `готов к merge，` (full-width comma U+FF0C) — обходит?
- **Validator ReDoS:** awk state machine на pathological input (10k unclosed fences, alternating ``` и ~~~ без CRLF) — время обработки остаётся O(n)?
- **strip_code_spans.sh shell-injection surface:** input через stdin (не argv), awk на тексте, нет eval/source/exec. Verify — или есть subshell с unquoted variable?
- **regression_pr14.sh**: если оператор случайно commit'нет `/tmp/pr14_comments/` содержимое — утечка review-pass данных в репо? (Внутренний Claude Pass 2 сказал "нет утечки" — verify).

### Качество

- **Verification Contract:** все 6 VC в плане, каждый выполнен на HEAD? VC-4 (Beads cleanup) заявлен partial — `bd close` fix-now задач отложен на landing commit. Это acceptable design или анти-pattern?
- **Test coverage validator** (16 unit + regression_pr14): покрыто ли реальное pathological input'а вместо synthetic cases? Например — copy комментарий из PR #14 с narrative-цитатой внутри, проверка что новый validator not-block'ает.
- **Hook test coverage** (102): symmetry-тесты `когда X` / `как только X` — достаточно ли для bd-ase semantic regression? Или нужно покрытие на «после X» / «при условии Y»?
- **Mutation testing от Pass 2** показал meaningful coverage (4-5 failures at typical mutations). Есть ли кейсы, на которых mutations проходят?
- **Performance:** validator < 100ms на 10KB body — measured или estimated? На Windows git-bash awk — какая версия (GNU vs POSIX)? Portability risk?

### Гигиена кода

- **Комментарии** на русском в `strip_code_spans.sh` и `test_validate_review_pass.sh` — объясняют rationale edge-cases, trade-offs. Есть ли лишние (объясняют «что» а не «почему»)? Opposite — недокументированные edge case decisions?
- **Hook inline comment** на строке расширения regex — содержит `big-heroes-ase` как ticket reference. Actual rationale или just "addresses: bd-ase"?
- **Dead code:** ничего от итераций Pass 2 delta-fix не осталось как мёртвый? (Например, старая toggle-логика перед state machine.)
- **Markdown правки** (hyo fenced block, rux 1 LoC qualifier): проверены Pass 1 — без опечаток. Независимо verify?
- **План v3.5 документ:** 259 lines. Уместно для cleanup sprint или over-engineered? Раздел Prerequisites Audit / Verification Contract / Фазы имплементации / Риски — все нужны?

### Independent adversarial (свой собственный)

Что Claude Opus 4.7 (Pass 1-2-3 = одна модель) мог **системно** пропустить, что заметит GPT-5.4:

- Pattern не из CommonMark, а из **GitHub Flavored Markdown**: admonitions (`> [!NOTE]`), task lists, autolinks?
- Character classes не из ASCII/Latin-1: hebrew bidi mark после `merge`, arabic punctuation?
- Race condition в `validate_review_pass_body` с bash IFS или glob expansion при вызове из cyrillic filesystem path?
- Scenario adversarial: reviewer создаёт review-pass с cryptic encoding (base64 чтобы обойти CR-grep), но дипломатично замаскированный как narrative.
- Supply chain: `validators/strip_code_spans.sh` добавлен в `/finalize-pr` — но hook `.claude/hooks/check-merge-ready.py` не покрывает path tampering на subdirectory. Может ли злонамеренный actor подменить strip_code_spans.sh для обхода hard gate?

---

## Expected output format

```
META:
  model: GPT-5.4
  commit: cac2c7c (full SHA в JSON META для /finalize-pr hard gate)
  mode: B-manual (semi-manual через ChatGPT web due to BE-11)
  delivery: оператор publishes directly в PR comment
  date: 2026-04-20
  pass: 1 (external independent review)
```

**Triage severity mapping:**
- CRITICAL / HIGH → fix в текущем Sprint v3.5 (блокирует merge).
- WARNING / INFO → defer to Beads (P2/P3) или reject with rationale.

Финальный вердикт:
- **APPROVED** — нет CRITICAL/HIGH, Sprint Final external review пройден, PM может финализировать `/finalize-pr --pre-landing`.
- **CHANGES_REQUESTED** — CRITICAL/HIGH finding, требует fix + new review pass.

**Обязательный формат (табличный для `/finalize-pr` triage-парсера):**

```markdown
| # | Severity | Заголовок | Файл:строка | Статус | Beads ID / Обоснование |
|---|----------|-----------|-------------|--------|------------------------|
| 1 | CRITICAL | ... | path:N | fix now | — |
| 2 | WARNING | ... | path:N | defer to Beads | bd-pipeline-xyz |
| 3 | INFO | ... | path:N | reject with rationale | <текст> |
```

Pipe `|` внутри ячеек экранируй как `\|`.

Если отсутствуют CRITICAL/HIGH и остальные — WARNING/INFO с defer — вердикт **APPROVED**.

---

## Workflow для оператора

1. Открой ChatGPT web (OAuth, не API).
2. Скопируй контент этого файла (включая diff ниже) в сообщение.
3. **Опубликуй ответ прямо в PR #15** через GitHub UI — не в файл.
4. Скажи PM «pass-1 готов» — PM продолжит с `/finalize-pr #15 --pre-landing`.

---

## Full diff (master..HEAD, HEAD=cac2c7c)

```diff
diff --git a/.agents/PM_ROLE.md b/.agents/PM_ROLE.md
index 16011f0..3923dd9 100644
--- a/.agents/PM_ROLE.md
+++ b/.agents/PM_ROLE.md
@@ -173,10 +173,15 @@ bd show <id>               # детали конкретной задачи
 **Шаг 3 — Закрой задачи в Beads:** `bd close <id>` для sprint tracking + task issues
 с явным reason (результат, commit hash).
 
-**Шаг 4 — Запиши memory pattern:** `bd remember "Sprint N завершён <finalize_date>:
-<key learnings>"` — формулировка `завершён <finalize_date>`, не `<merge_date>`.
-Рациональ: финализация = момент закрытия цикла, не момент административного действия
-оператора. Существующие sprint-1..5 memories остаются как исторические (merge_date).
+**Шаг 4 — Запиши memory pattern:**
+
+```bash
+bd remember "Sprint N завершён <finalize_date>: <key learnings>"
+```
+
+Формулировка `завершён <finalize_date>`, не `<merge_date>`. Рациональ: финализация =
+момент закрытия цикла, не момент административного действия оператора. Существующие
+sprint-1..5 memories остаются как исторические (merge_date).
 
 **Шаг 5 — Commit и push:**
 
diff --git a/.claude/hooks/check-merge-ready.py b/.claude/hooks/check-merge-ready.py
index 1600c4b..9a6b5fc 100755
--- a/.claude/hooks/check-merge-ready.py
+++ b/.claude/hooks/check-merge-ready.py
@@ -39,9 +39,19 @@ import sys
 #      это обсуждение, не декларация готовности. Пропускаем.
 #
 # Терминаторы фразы строгие: конец строки / newline / закрывающая shell-кавычка /
-# пунктуация `.!?`. Продолжение предложения («готов к merge после X»,
-# «ready to merge, если Y») не матчится — это именно точный маркер готовности.
+# пунктуация `.!?,`. Продолжение предложения без знака препинания («готов к
+# merge после X», «ready to merge in the future») не матчится — это обсуждение.
 # Copilot round 22 CRITICAL: пунктуация `.!?` обходила прежний терминатор.
+# big-heroes-ase (v3.5): добавлена запятая — pre-existing bypass. Фраза
+# «готов к merge, landing artifacts уже внутри» из PM_ROLE §2.5 Шаг 8 могла
+# быть скопирована дословно и обходила hook как «обсуждение с продолжением».
+# Теперь запятая трактуется как terminator декларации readiness (как `.`/`!`/`?`
+# сами по себе — без требования line-end после). Negation-префиксы (`не`,
+# «почти», «будет») по-прежнему снимают блок через _NEGATION_WORDS.
+# big-heroes-nw5 (v3.5): расширен class-coverage до `;` и `…` (U+2026 ellipsis).
+# Tester gate PR #15: `;` и `…` — symmetric punctuation-terminators, дают
+# тот же bypass, что и запятая до ase. Итого terminator class: `.!?,;…`.
+# ASCII-троеточие `...` уже покрыто литеральным `.` в классе.
 _MERGE_READY_CANDIDATE = re.compile(
     r"(?im)^(?P<prefix>[^\n]*?)"
     r"(?:##\s*(?:✅\s*)?)?"
@@ -51,7 +61,7 @@ _MERGE_READY_CANDIDATE = re.compile(
     r"|merge\s*ready"
     r"|merge\s*is\s*ready"
     r")"
-    r"\s*(?:[.!?]\s*)?(?:$|\n|['\"])",
+    r"\s*(?:[.!?,;\u2026]|(?:$|\n|['\"]))",
 )
 
 # Слова-отрицания перед фразой — снимают блокировку. Покрывают частые паттерны
diff --git a/.claude/hooks/test_check_merge_ready.py b/.claude/hooks/test_check_merge_ready.py
index da4da2b..d12284c 100755
--- a/.claude/hooks/test_check_merge_ready.py
+++ b/.claude/hooks/test_check_merge_ready.py
@@ -73,6 +73,27 @@ TESTS = [
     ("gh pr comment 1 --body '## ✅ Готов к merge.'", 1, "final marker RU + dot"),
     ("gh pr comment 1 --body '## ✅ Готов к merge!'", 1, "final marker RU + bang"),
     ("gh pr comment 1 --body '## ✅ Готов к merge?'", 1, "final marker RU + question"),
+    # === big-heroes-ase: запятая как terminator (regression v3.5) ===
+    # Pre-existing bypass: фраза «готов к merge, <продолжение>» обходила hook
+    # с запятой-разделителем. Репродьюсер: PM_ROLE §2.5 Шаг 8 и
+    # sprint-pr-cycle Фаза 4.5.7 содержат «готов к merge, landing artifacts
+    # уже внутри» — если PM копирует дословно в gh pr comment, hook должен
+    # блокировать, а не пропускать как «обсуждение».
+    ("gh pr comment 14 --body 'PR готов к merge, landing inside'", 1, "ase: comma terminator RU"),
+    ("gh pr comment 1 --body 'ready to merge, landing inside'", 1, "ase: comma terminator EN"),
+    ("gh pr comment 1 --body '## ✅ Готов к merge, landing artifacts уже внутри'", 1, "ase: RU marker + запятая + продолжение"),
+    # === big-heroes-nw5: semicolon и ellipsis как terminator (Tester gate v3.5) ===
+    # После закрытия bd-ase запятой Tester обнаружил class-coverage gap:
+    # `;` и `…` (U+2026) — symmetric punctuation-terminators, обходят hook
+    # тем же способом. Расширяем класс: [.!?,] → [.!?,;…].
+    ("gh pr comment 15 --body '## ✅ Готов к merge; landing commit следом'", 1, "nw5: semicolon terminator RU"),
+    ("gh pr comment 15 --body 'ready to merge; see CI'", 1, "nw5: semicolon terminator EN"),
+    ("gh pr comment 15 --body 'готов к merge… если X'", 1, "nw5: ellipsis U+2026 terminator RU"),
+    # Symmetry semantic для discussion-continuations: `когда X` и `как только X`
+    # ведут себя как `если X` — запятая делает их terminator, декларация readiness
+    # с продолжением. Явно фиксируем через coverage.
+    ("gh pr comment 1 --body 'готов к merge, когда X'", 1, "nw5: symmetry — запятая + когда"),
+    ("gh pr comment 1 --body 'готов к merge, как только X'", 1, "nw5: symmetry — запятая + как только"),
     # === Copilot round 28: zero-width char / HTML entity bypass ===
     ("gh pr comment 1 --body 'ready\u200bto merge'", 1, "zero-width space bypass"),
     ("gh pr comment 1 --body '## ✅ Готов\u200b к merge'", 1, "ZWSP in RU marker"),
@@ -80,10 +101,18 @@ TESTS = [
     ("gh pr comment 1 --body 'ready\ufeffto merge'", 1, "BOM char bypass"),
     # === Пропуск: обсуждения и цитаты ===
     ("gh pr comment 1 --body 'не готов к merge — тесты красные'", 0, "отрицание"),
-    ("gh pr comment 1 --body 'почти готов к merge, жду review'", 0, "«почти готов»"),
-    ("gh pr comment 1 --body 'готов к merge, если X'", 0, "фраза без ##"),
-    ("gh pr comment 1 --body '## Готов к merge после исправлений'", 0, "## + продолжение"),
-    ("gh pr comment 1 --body '## Готов к merge, если X'", 0, "## + запятая"),
+    ("gh pr comment 1 --body 'почти готов к merge, жду review'", 0, "«почти готов» — negation wins"),
+    ("gh pr comment 1 --body '## Готов к merge после исправлений'", 0, "## + продолжение без terminator"),
+    # big-heroes-ase (v3.5): запятая теперь terminator. Прежние кейсы с
+    # «готов к merge, если X» (ранее expected 0 как «обсуждение») переведены
+    # в block: фраза с запятой неотличима от декларации с продолжением.
+    # Narrative-фразы без terminator (например «готов к merge in the future»)
+    # продолжают проходить — см. тесты ниже.
+    ("gh pr comment 1 --body 'готов к merge, если X'", 1, "ase: запятая terminator (было 0)"),
+    ("gh pr comment 1 --body '## Готов к merge, если X'", 1, "ase: ## + запятая terminator (было 0)"),
+    # Narrative без terminator — не блокируется (позитивный sanity для task 3).
+    ("gh pr comment 1 --body 'готов к merge in the future'", 0, "narrative без terminator"),
+    ("gh pr comment 1 --body 'PR будет готов к merge после CI'", 0, "narrative с negation «будет»"),
     # === Пропуск: markdown blockquote (GPT-5.4 round 15 WARNING) ===
     ("gh pr comment 1 --body '> ready to merge'", 0, "blockquote bare EN"),
     ("gh pr comment 1 --body '> готов к merge'", 0, "blockquote bare RU"),
diff --git a/.claude/skills/finalize-pr/SKILL.md b/.claude/skills/finalize-pr/SKILL.md
index 157987b..fdfcd68 100644
--- a/.claude/skills/finalize-pr/SKILL.md
+++ b/.claude/skills/finalize-pr/SKILL.md
@@ -229,6 +229,19 @@ fi
 #   1) в теле НЕТ ни одного CHANGES_REQUESTED (иначе один из аспектов
 #      или ревьюеров сигналит CHANGES_REQUESTED, скрытый поздним APPROVED);
 #   2) в теле есть хотя бы один APPROVED.
+#
+# Предобработка strip_code_spans.sh (Sprint v3.5, big-heroes-nw5):
+# вхождения CHANGES_REQUESTED и APPROVED внутри inline code spans
+# (парные одиночные бэктики) и fenced code blocks (тройные бэктики)
+# — это historical/narrative цитаты в review-pass комментариях,
+# они НЕ должны матчиться regex'ом. Раньше бэктики попадали в
+# non-[A-Z_] boundary и давали infrastructure false positive
+# (v3.4 PR #14: narrative «оснований для `CHANGES_REQUESTED` не
+# вижу» блокировал hard gate при реальном Вердикт: APPROVED).
+# Stripper читает тело из stdin и возвращает текст с вырезанными
+# code spans, затем grep работает на plain text. Реальные вердикты
+# в plain text продолжают блокировать/пропускать как раньше.
+# Unit-тесты: .claude/skills/finalize-pr/validators/test_validate_review_pass.sh.
 validate_review_pass_body() {
   local review_kind="$1"   # "internal" | "external"
   local review_body="$2"
@@ -239,13 +252,17 @@ validate_review_pass_body() {
     exit 1
   fi
 
-  if printf '%s\n' "$review_body" | grep -qE '(^|[^A-Z_])CHANGES_REQUESTED([^A-Z_]|$)'; then
+  # Mask code spans перед regex-проверкой (strip_code_spans.sh — stdin→stdout).
+  local stripped_body
+  stripped_body=$(printf '%s' "$review_body" | bash .claude/skills/finalize-pr/validators/strip_code_spans.sh)
+
+  if printf '%s\n' "$stripped_body" | grep -qE '(^|[^A-Z_])CHANGES_REQUESTED([^A-Z_]|$)'; then
     echo "СТОП: в последнем ${review_kind} review-pass на $HEAD_COMMIT есть CHANGES_REQUESTED по одному из аспектов/ревьюеров."
     echo "После CHANGES_REQUESTED обязателен повторный ${review_kind} review-pass с APPROVED по всем аспектам на текущем commit."
     exit 1
   fi
 
-  if ! printf '%s\n' "$review_body" | grep -qE '(^|[^A-Z_])APPROVED([^A-Z_]|$)'; then
+  if ! printf '%s\n' "$stripped_body" | grep -qE '(^|[^A-Z_])APPROVED([^A-Z_]|$)'; then
     echo "СТОП: в последнем ${review_kind} review-pass не найден APPROVED."
     echo "Проверь, что отчёт публикуется по шаблону sprint-pr-cycle и содержит явный 'Вердикт: APPROVED'."
     exit 1
diff --git a/.claude/skills/finalize-pr/validators/regression_pr14.sh b/.claude/skills/finalize-pr/validators/regression_pr14.sh
new file mode 100644
index 0000000..01d6226
--- /dev/null
+++ b/.claude/skills/finalize-pr/validators/regression_pr14.sh
@@ -0,0 +1,124 @@
+#!/usr/bin/env bash
+# Regression prove для VC-5: проверяет, что новый stripper + grep
+# не даёт ложных результатов на реальной истории comments PR #14.
+#
+# Ожидание:
+#   - все финальные APPROVED review-pass (internal + external) проходят
+#     (grep на CHANGES_REQUESTED после strip НЕ матчится, grep на APPROVED матчится);
+#   - исторические CHANGES_REQUESTED review-pass (в plain text вердикт CR)
+#     блокируются (grep на CHANGES_REQUESTED после strip ДОЛЖЕН матчиться).
+#
+# Запуск:
+#   # предполагается что /tmp/pr14_comments/c*.txt уже извлечены:
+#   # for i in $(seq 0 24); do gh pr view 14 --json comments -q ".comments[$i].body" > /tmp/pr14_comments/c$i.txt; done
+#   bash .claude/skills/finalize-pr/validators/regression_pr14.sh
+
+set -u
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+STRIPPER="$SCRIPT_DIR/strip_code_spans.sh"
+
+COMMENTS_DIR="${COMMENTS_DIR:-/tmp/pr14_comments}"
+
+if [ ! -d "$COMMENTS_DIR" ]; then
+  echo "Нет каталога $COMMENTS_DIR — сначала извлеки comments PR #14:" >&2
+  echo "  mkdir -p $COMMENTS_DIR && for i in \$(seq 0 24); do gh pr view 14 --json comments -q \".comments[\$i].body\" > $COMMENTS_DIR/c\$i.txt; done" >&2
+  exit 2
+fi
+
+APPROVED_PASS=0
+APPROVED_FAIL=0
+CR_PASS=0
+CR_FAIL=0
+
+echo "=== Regression PR #14 (VC-5) ==="
+
+for f in "$COMMENTS_DIR"/c*.txt; do
+  # Отбираем только review-pass (internal или external), исключаем triage/scope rollback/landing.
+  if ! grep -qiE "Внутреннее ревью|Внешнее ревью|review-pass" "$f"; then
+    continue
+  fi
+
+  idx=$(basename "$f" .txt)
+  body=$(cat "$f")
+
+  # Находим заявленный вердикт в plain text (ищем строку с «**Вердикт:**» или «Вердикт:»
+  # которая НЕ в code span — для этого используем stripped body).
+  stripped=$(printf '%s' "$body" | bash "$STRIPPER")
+
+  # Определяем «ожидание»: какой вердикт заявлен в plain text.
+  # Ищем первое явное вхождение CHANGES_REQUESTED или APPROVED в stripped body
+  # (т.е. в plain text вне code spans). Приоритет CHANGES_REQUESTED, так как реальные вердикты CR
+  # обычно содержат и APPROVED (например, "APPROVED ранее — но теперь CHANGES_REQUESTED").
+  has_cr_plain=false
+  has_approved_plain=false
+  if printf '%s\n' "$stripped" | grep -qE '(^|[^A-Z_])CHANGES_REQUESTED([^A-Z_]|$)'; then
+    has_cr_plain=true
+  fi
+  if printf '%s\n' "$stripped" | grep -qE '(^|[^A-Z_])APPROVED([^A-Z_]|$)'; then
+    has_approved_plain=true
+  fi
+
+  # Классификация по первой строке «Вердикт:» в stripped body.
+  first_verdict_line=$(printf '%s\n' "$stripped" | grep -iE '^\*{0,2}#{0,3} *Вердикт[:*]' | head -1)
+  if [ -z "$first_verdict_line" ]; then
+    # fallback — любая строка с «Вердикт:»
+    first_verdict_line=$(printf '%s\n' "$stripped" | grep -iE 'Вердикт[:*]' | head -1)
+  fi
+
+  declared="UNKNOWN"
+  if printf '%s' "$first_verdict_line" | grep -qE 'CHANGES_REQUESTED'; then
+    declared="CHANGES_REQUESTED"
+  elif printf '%s' "$first_verdict_line" | grep -qE 'APPROVED'; then
+    declared="APPROVED"
+  fi
+
+  # validator принимает review-pass как APPROVED если:
+  #   - CHANGES_REQUESTED НЕ найден после strip, И
+  #   - APPROVED найден после strip.
+  validator_verdict="BLOCK"
+  if ! $has_cr_plain && $has_approved_plain; then
+    validator_verdict="APPROVED"
+  elif $has_cr_plain; then
+    validator_verdict="BLOCK"
+  else
+    validator_verdict="NO_APPROVED"
+  fi
+
+  # Сверяем
+  case "$declared" in
+    APPROVED)
+      if [ "$validator_verdict" = "APPROVED" ]; then
+        echo "PASS  [$idx] declared=APPROVED → validator=APPROVED"
+        APPROVED_PASS=$((APPROVED_PASS + 1))
+      else
+        echo "FAIL  [$idx] declared=APPROVED → validator=$validator_verdict (ложная блокировка!)"
+        APPROVED_FAIL=$((APPROVED_FAIL + 1))
+      fi
+      ;;
+    CHANGES_REQUESTED)
+      if [ "$validator_verdict" = "BLOCK" ]; then
+        echo "PASS  [$idx] declared=CHANGES_REQUESTED → validator=BLOCK (корректно блокирует)"
+        CR_PASS=$((CR_PASS + 1))
+      else
+        echo "FAIL  [$idx] declared=CHANGES_REQUESTED → validator=$validator_verdict (CR должен был блокироваться!)"
+        CR_FAIL=$((CR_FAIL + 1))
+      fi
+      ;;
+    *)
+      echo "SKIP  [$idx] не удалось определить declared verdict"
+      ;;
+  esac
+done
+
+echo ""
+echo "=== Summary ==="
+echo "APPROVED review-pass: $APPROVED_PASS passed / $((APPROVED_PASS + APPROVED_FAIL)) total"
+echo "CR review-pass:       $CR_PASS correctly blocked / $((CR_PASS + CR_FAIL)) total"
+
+if [ "$APPROVED_FAIL" -gt 0 ] || [ "$CR_FAIL" -gt 0 ]; then
+  echo "REGRESSION FAILED"
+  exit 1
+fi
+echo "REGRESSION OK"
+exit 0
diff --git a/.claude/skills/finalize-pr/validators/strip_code_spans.sh b/.claude/skills/finalize-pr/validators/strip_code_spans.sh
new file mode 100644
index 0000000..aaf40b9
--- /dev/null
+++ b/.claude/skills/finalize-pr/validators/strip_code_spans.sh
@@ -0,0 +1,115 @@
+#!/usr/bin/env bash
+# strip_code_spans.sh — предобработка тела review-pass для validate_review_pass_body.
+#
+# Зачем: validator Шаг 5 в SKILL.md использует `grep -qE` по `CHANGES_REQUESTED`
+# и `APPROVED` с word-boundary regex. Бэктики попадают в non-[A-Z_] boundary,
+# и narrative-текст с цитатой `CHANGES_REQUESTED` внутри code span ложно
+# блокирует hard gate (infrastructure false positive v3.4 #14).
+#
+# Что делаем: заменяем содержимое code spans (inline `...` и fenced блоки)
+# на пустоту ДО того, как validator grep'ает слова. Реальные вердикты в
+# plain text остаются, narrative-цитаты из code spans — нет.
+#
+# CommonMark coverage (Pass 2 class-coverage fix, big-heroes-nw5):
+#   - fenced blocks: opener/closer — тройной бэктик ``` ИЛИ тильда ~~~;
+#   - indent tolerance: 0-3 leading spaces перед маркером (CommonMark spec);
+#   - fence type matching: ``` закрывается только ```, ~~~ только ~~~;
+#   - mismatched marker (``` внутри ~~~ fence или наоборот) — игнорируется,
+#     fence остаётся открытым до реального closer того же типа.
+#
+# НЕ покрыто (deferred):
+#   - blockquote-prefixed fences (`> ```) — big-heroes-wz6;
+#   - indented code blocks (4+ spaces без маркера) — редкий случай в
+#     review-pass, safe default: остаётся plain text, validator блокирует.
+#
+# Поток: читаем stdin, пишем stdout.
+# Зависимости: bash, awk (POSIX). Без внешних тулов.
+#
+# Edge cases (покрыты тестами в test_validate_review_pass.sh):
+#   - fenced с language hint (```bash, ```diff, ```ts и т.п.);
+#   - CRLF — нормализуем через tr перед awk;
+#   - inline backticks внутри fenced блока — fenced strip работает первым
+#     и удаляет весь блок целиком, внутренние ` не ломают логику;
+#   - непарный одиночный ` — best-effort, text после него проходит как есть
+#     (лучше ложное блокирование чем ложный пропуск);
+#   - множественные inline spans на одной строке — toggle на bench.
+
+set -u
+
+# 1) Нормализуем CRLF → LF. Оператор на Windows может прислать \r\n.
+# 2) Strip fenced blocks: awk state-machine с типизированным fence tracking.
+#    in_fence ∈ {"", "BACKTICK", "TILDE"}. Opener — строка с 0-3 leading spaces
+#    и маркером ``` или ~~~. Closer — того же типа, с 0-3 indent и без другого
+#    контента (только optional trailing whitespace).
+# 3) Strip inline code spans: в каждой строке, которая НЕ внутри fenced
+#    блока (после шага 2 таких не осталось), проходим посимвольно и
+#    удаляем содержимое между парными одиночными бэктиками.
+#    Непарный backtick оставляет хвост строки как есть (best-effort).
+tr -d '\r' | awk '
+  BEGIN { in_fence = "" }
+  {
+    line = $0
+
+    if (in_fence == "") {
+      # Не внутри fence — проверить, это ли opener.
+      # CommonMark: 0-3 leading spaces, затем ``` или ~~~.
+      # Opener может иметь language hint (```bash) — часть после marker
+      # игнорируется при strip, печатать эту строку не нужно.
+      if (match(line, /^[ ]{0,3}```/)) {
+        in_fence = "BACKTICK"
+        next
+      }
+      if (match(line, /^[ ]{0,3}~~~/)) {
+        in_fence = "TILDE"
+        next
+      }
+      # Strip inline code spans на текущей строке.
+      # Проход посимвольно: toggle at `, не-code символы копируем.
+      out = ""
+      in_span = 0
+      n = length(line)
+      for (i = 1; i <= n; i++) {
+        c = substr(line, i, 1)
+        if (c == "`") {
+          in_span = !in_span
+          # сам бэктик не сохраняем (и open, и close)
+          continue
+        }
+        if (!in_span) {
+          out = out c
+        }
+        # если in_span — пропускаем символ
+      }
+      # Если строка закончилась с in_span=1 (непарный `), оставшийся хвост
+      # УЖЕ не попал в out — это удалило бы text и могло спрятать реальный
+      # CHANGES_REQUESTED. Восстанавливаем: если закрытия не было, вернём
+      # хвост от последнего ` как plain text (best-effort safe default).
+      if (in_span) {
+        # Найдём последний бэктик и возьмём всё ПОСЛЕ него как plain text.
+        last_tick = 0
+        for (j = n; j >= 1; j--) {
+          if (substr(line, j, 1) == "`") { last_tick = j; break }
+        }
+        if (last_tick > 0 && last_tick < n) {
+          tail = substr(line, last_tick + 1)
+          out = out tail
+        }
+      }
+      print out
+    } else {
+      # Внутри fence — ищем close ТОГО ЖЕ типа.
+      # Closer: 0-3 leading spaces + marker + optional trailing whitespace.
+      # Mismatched marker (~~~ внутри BACKTICK или vice versa) игнорируется.
+      if (in_fence == "BACKTICK" && match(line, /^[ ]{0,3}```[ \t]*$/)) {
+        in_fence = ""
+        next
+      }
+      if (in_fence == "TILDE" && match(line, /^[ ]{0,3}~~~[ \t]*$/)) {
+        in_fence = ""
+        next
+      }
+      # Внутри fence — содержимое стрипуется (линия не выводится).
+      next
+    }
+  }
+'
diff --git a/.claude/skills/finalize-pr/validators/test_validate_review_pass.sh b/.claude/skills/finalize-pr/validators/test_validate_review_pass.sh
new file mode 100644
index 0000000..9b23fcd
--- /dev/null
+++ b/.claude/skills/finalize-pr/validators/test_validate_review_pass.sh
@@ -0,0 +1,255 @@
+#!/usr/bin/env bash
+# Unit-тесты для validate_review_pass_body (Шаг 5 finalize-pr).
+#
+# Проверяют что predobработка code spans корректно:
+#   1. блокирует plain text «Вердикт: CHANGES_REQUESTED» (истинный вердикт);
+#   2. пропускает `CHANGES_REQUESTED` внутри inline code span (парные одиночные бэктики);
+#   3. пропускает CHANGES_REQUESTED внутри fenced block (тройные бэктики);
+#   4. sanity: plain «Вердикт: APPROVED» без backtick-матчей на CHANGES_REQUESTED — пропускает.
+#
+# Плюс edge cases:
+#   - fenced block с language hint (```bash);
+#   - CRLF line endings;
+#   - вложенные inline backticks внутри fenced block не ломают strip fenced;
+#   - непарный одиночный backtick не валит скрипт;
+#   - множественные inline spans на одной строке.
+#
+# Запуск:
+#   bash .claude/skills/finalize-pr/validators/test_validate_review_pass.sh
+# Exit 0 = PASS, exit 1 = FAIL.
+
+set -u
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+STRIPPER="$SCRIPT_DIR/strip_code_spans.sh"
+
+if [ ! -x "$STRIPPER" ]; then
+  chmod +x "$STRIPPER" 2>/dev/null || true
+fi
+
+TESTS_RUN=0
+TESTS_PASSED=0
+TESTS_FAILED=0
+
+# Обёртка-оракул: прогоняем вход через stripper, затем имитируем grep из SKILL.md.
+# Возвращаем 0 если регекс НЕ матчится (validator пропускает — APPROVED путь),
+# 1 если матчится (validator блокирует — CR путь).
+# Это точно такой же grep, как в validate_review_pass_body для CHANGES_REQUESTED.
+check_changes_requested_blocks() {
+  local input="$1"
+  local stripped
+  stripped=$(printf '%s' "$input" | bash "$STRIPPER")
+  if printf '%s\n' "$stripped" | grep -qE '(^|[^A-Z_])CHANGES_REQUESTED([^A-Z_]|$)'; then
+    return 1  # блокирует (match found)
+  fi
+  return 0    # пропускает (no match)
+}
+
+# Аналог для APPROVED: ищет подстановку в тексте после strip.
+check_approved_present() {
+  local input="$1"
+  local stripped
+  stripped=$(printf '%s' "$input" | bash "$STRIPPER")
+  if printf '%s\n' "$stripped" | grep -qE '(^|[^A-Z_])APPROVED([^A-Z_]|$)'; then
+    return 0  # APPROVED найден (validator пропускает)
+  fi
+  return 1    # APPROVED не найден (validator бы блокировал)
+}
+
+assert_blocks() {
+  local name="$1"
+  local input="$2"
+  TESTS_RUN=$((TESTS_RUN + 1))
+  if check_changes_requested_blocks "$input"; then
+    echo "FAIL: $name — ожидалось блокирование (CHANGES_REQUESTED остался после strip), но match не нашёлся"
+    TESTS_FAILED=$((TESTS_FAILED + 1))
+  else
+    echo "PASS: $name"
+    TESTS_PASSED=$((TESTS_PASSED + 1))
+  fi
+}
+
+assert_passes() {
+  local name="$1"
+  local input="$2"
+  TESTS_RUN=$((TESTS_RUN + 1))
+  if check_changes_requested_blocks "$input"; then
+    echo "PASS: $name"
+    TESTS_PASSED=$((TESTS_PASSED + 1))
+  else
+    echo "FAIL: $name — CHANGES_REQUESTED ложно найден после strip (должен был быть удалён вместе с code span)"
+    TESTS_FAILED=$((TESTS_FAILED + 1))
+  fi
+}
+
+assert_approved_found() {
+  local name="$1"
+  local input="$2"
+  TESTS_RUN=$((TESTS_RUN + 1))
+  if check_approved_present "$input"; then
+    echo "PASS: $name"
+    TESTS_PASSED=$((TESTS_PASSED + 1))
+  else
+    echo "FAIL: $name — APPROVED не найден после strip (validator бы ложно блокировал)"
+    TESTS_FAILED=$((TESTS_FAILED + 1))
+  fi
+}
+
+echo "=== Core VC-2 tests ==="
+
+# 1. Positive: plain text — блокирует
+assert_blocks "plain_text_changes_requested_blocks" \
+"## Review-pass #3
+Вердикт: CHANGES_REQUESTED
+Архитектура: ISSUE"
+
+# 2. Positive: inline backtick span — пропускает
+assert_passes "inline_backtick_span_ignored" \
+"## Review-pass #5
+Вердикт: APPROVED
+
+В истории был статус \`CHANGES_REQUESTED\` на предыдущем commit."
+
+# 3. Positive: fenced block — пропускает
+assert_passes "fenced_block_ignored" \
+'## Review-pass #6
+Вердикт: APPROVED
+
+Пример старого отчёта:
+```
+Вердикт: CHANGES_REQUESTED
+Архитектура: ISSUE
+```
+Теперь всё починено.'
+
+# 4. Sanity negative: plain APPROVED без CR — пропускает (должен пройти as APPROVED)
+assert_passes "sanity_plain_approved_no_cr" \
+"## Review-pass #1
+Вердикт: APPROVED
+Архитектура: OK"
+assert_approved_found "sanity_plain_approved_still_has_approved" \
+"## Review-pass #1
+Вердикт: APPROVED
+Архитектура: OK"
+
+echo "=== Edge cases ==="
+
+# 5. Fenced с language hint
+assert_passes "fenced_block_with_language_hint_ignored" \
+'## Review-pass
+Вердикт: APPROVED
+
+```bash
+echo "CHANGES_REQUESTED был в истории"
+```'
+
+# 6. Fenced с diff
+assert_passes "fenced_block_with_diff_hint_ignored" \
+'Вердикт: APPROVED
+
+```diff
+- Вердикт: CHANGES_REQUESTED
++ Вердикт: APPROVED
+```'
+
+# 7. CRLF line endings — строки с \r\n не ломают strip
+CRLF_INPUT=$'## Review-pass\r\nВердикт: APPROVED\r\n\r\n```\r\nВердикт: CHANGES_REQUESTED\r\n```\r\n'
+assert_passes "crlf_fenced_block_ignored" "$CRLF_INPUT"
+
+# 8. Inline backticks внутри fenced блока — fenced strip сжирает всё целиком
+assert_passes "fenced_with_inline_backticks_inside" \
+'Вердикт: APPROVED
+
+```
+Заметка: `CHANGES_REQUESTED` как цитата.
+```'
+
+# 9. Непарный одиночный backtick — не должен падать, text после него проходит best-effort
+# Если backtick один, awk-оракул не стрипует (нет закрытия) — CHANGES_REQUESTED в тексте должен остаться.
+# Это best-effort: лучше ложно блокировать (safe default) чем ложно пропускать.
+assert_blocks "unmatched_single_backtick_fallback_to_block" \
+"## Review-pass
+Это \`битый markdown без закрытия — Вердикт: CHANGES_REQUESTED всё равно виден как plain."
+
+# 10. Множественные inline spans на одной строке
+assert_passes "multiple_inline_spans_same_line" \
+'Вердикт: APPROVED
+Было \`CHANGES_REQUESTED\` потом \`APPROVED\` потом \`CHANGES_REQUESTED\` снова.'
+
+# 11. Fenced-блок НЕ в начале строки (не должен матчиться как fenced — только для line-start ```)
+# Но для robustness мы матчим ``` anywhere-on-line — принимаем что это рабочий compromise.
+# Проверим, что inline `` (тройной backtick в строке) не валит — это очень редкий markdown-кейс.
+# Тут ожидание: skip, as best effort.
+
+# 12. Вложенный inline внутри inline невозможен в markdown, не проверяем.
+
+# 13. Стоит проверить что реальный README-like diff не ломается:
+assert_passes "multiple_fenced_blocks_alternating" \
+'Вердикт: APPROVED
+
+Первый:
+```
+Вердикт: CHANGES_REQUESTED
+```
+
+Второй:
+```diff
+- CHANGES_REQUESTED
++ APPROVED
+```
+
+Заключение: всё починено.'
+
+echo "=== Pass 2 adversarial: CommonMark fence class coverage ==="
+
+# 14. F-1: tilde fence ~~~ — CommonMark эквивалент ``` (должен стрипаться)
+assert_passes "tilde_fenced_block_ignored" \
+'## Review-pass
+Вердикт: APPROVED
+
+~~~
+Вердикт: CHANGES_REQUESTED
+~~~
+Теперь всё починено.'
+
+# 15. F-2: indented triple-backtick fence (2 leading spaces) — CommonMark допускает 0-3 indent
+assert_passes "indented_backtick_fenced_block_ignored" \
+'## Review-pass
+Вердикт: APPROVED
+
+  ```
+  Вердикт: CHANGES_REQUESTED
+  ```
+Теперь всё починено.'
+
+# 16. F-1 + F-2 combined: indented tilde fence (3 leading spaces)
+assert_passes "indented_tilde_fenced_block_ignored" \
+'## Review-pass
+Вердикт: APPROVED
+
+   ~~~
+   Вердикт: CHANGES_REQUESTED
+   ~~~
+Теперь всё починено.'
+
+# 17. Mismatched fence type: opener ``` не закрывается ~~~ — CommonMark требует симметрии.
+# Всё между ``` и реальным ``` должно быть вырезано, ~~~ внутри не считается closer.
+assert_passes "mismatched_fence_tilde_does_not_close_backtick" \
+'## Review-pass
+Вердикт: APPROVED
+
+```
+Вердикт: CHANGES_REQUESTED somewhere
+~~~
+не является закрытием
+```
+Финал.'
+
+echo ""
+echo "=== Summary ==="
+echo "Run: $TESTS_RUN, Passed: $TESTS_PASSED, Failed: $TESTS_FAILED"
+
+if [ "$TESTS_FAILED" -gt 0 ]; then
+  exit 1
+fi
+exit 0
diff --git a/docs/archive/sprint-pipeline-v3-4-pre-merge-landing.md b/docs/archive/sprint-pipeline-v3-4-pre-merge-landing.md
index d4f0d2b..be291a7 100644
--- a/docs/archive/sprint-pipeline-v3-4-pre-merge-landing.md
+++ b/docs/archive/sprint-pipeline-v3-4-pre-merge-landing.md
@@ -317,7 +317,7 @@ Tier: Sprint Final
 - [ ] Tester gate (Critical class = pipeline-artifacts)
 - [ ] Claude Reviewer Pass 1 + Pass 2
 - [ ] Sprint Final /external-review (Mode C degraded expected due to BE-11)
-- [ ] /finalize-pr (первый)
+- [ ] /finalize-pr (первый, для Sprint Final: --pre-landing)
 - [ ] Pre-merge landing commit (dogfood)
 - [ ] /finalize-pr (второй, новый HEAD)
 
diff --git a/docs/plans/sprint-pipeline-v3-5-cleanup.md b/docs/plans/sprint-pipeline-v3-5-cleanup.md
new file mode 100644
index 0000000..0fb9463
--- /dev/null
+++ b/docs/plans/sprint-pipeline-v3-5-cleanup.md
@@ -0,0 +1,259 @@
+# Sprint Pipeline v3.5 — Cleanup After v3.4
+
+**Дата плана:** 2026-04-20
+**PM:** Claude Opus 4.7 (1M context)
+**Base:** `master @ d3dab6b` (merge PR #14 — Sprint Pipeline v3.4 Pre-Merge Landing)
+**Ветка спринта:** `sprint-pipeline-v3-5-cleanup`
+**Sprint tracking:** TBD (создаётся в P0 — `bd create --type=task --priority=2 --title="Sprint Pipeline v3.5 — cleanup after v3.4"`)
+**Task issues:** существующие Beads задачи с префиксом `[sprint-pipeline-v3-4]` / `[from-v3.4-dropped]` (см. P-cleanup ниже) + инфраструктурная правка без предварительного issue (`bd create` внутри спринта).
+**Review Tier:** **Critical + Sprint Final** (правка 1 трогает `.claude/skills/finalize-pr/SKILL.md` — нормативный артефакт пайплайна; merge в master → Sprint Final)
+
+---
+
+## Context
+
+Sprint v3.4 (PR [#14](https://github.com/komleff/big-heroes/pull/14)) merged 2026-04-19. В ходе hard gate финального `/finalize-pr` вылез **infrastructure false positive**: validator в шаге 5 матчил `CHANGES_REQUESTED` внутри backtick-code-span (в narrative-блоке разбора пастовой истории review-pass). Hard gate блокировал публикацию, хотя META комментария явно содержал `Вердикт: APPROVED`. Оператор обошёл временно ручным вмешательством.
+
+Плюс за v3.4 (6 iteration review-cycles + 11 commits после triage) в Beads накопился хвост P2/P3 задач, помеченных как deferred to v3.5 или later.
+
+**Спринт-уборка.** Никаких новых механизмов, никакого расширения скиллов за пределами прямых bugfix'ов. Цель — закрыть хвосты и пойти в v3.6 с чистым бэклогом.
+
+---
+
+## Scope (brief от оператора, зафиксированный 2026-04-20)
+
+**Правка 1 (infrastructure bugfix):** validator regex в `/finalize-pr` Шаг 5 должен игнорировать вхождения `CHANGES_REQUESTED` внутри inline code spans (парные backticks) и fenced code blocks (тройные backticks). Реальные указания статуса в plain text продолжают блокировать hard gate.
+
+**Правка 2 (backlog cleanup):** закрыть или явно defer-with-rationale все задачи с префиксом `[sprint-pipeline-v3-4]` / `[from-v3.4-dropped]` в Beads — оценка каждой по факту, без попытки закрыть всё в рамках v3.5 (time-boxed одной сессией).
+
+Брифинг оператора: `docs/plans/sprint-v3.5-plan.md` (до переименования) — этот файл заменяет его.
+
+---
+
+## Prerequisites Audit
+
+| Item | Статус | Impact |
+|------|--------|--------|
+| PR #14 merged в master | ✅ MERGED 2026-04-19 (merge commit `d3dab6b`) | Можно стартовать от чистого master HEAD |
+| Sprint v3.4 landing artifacts уже в master | ✅ (commit `15ee206` → merged) | `.memory_bank/status.md` актуальный, план в архиве |
+| BE-11 (Windows sandbox 1326) | ❌ OPEN (P1), **не исправлен** | Mode A/B недоступны → **default Mode C (degraded)** для Sprint Final external review |
+| `$OPENAI_API_KEY` | 401 in-situ per Sprint 5 audit | Mode A не работает; Mode C не требует ключа |
+| Operator-approved Mode C degradation | Прецедент Sprint 5 (Mode C APPROVED, operator merged) + Sprint v3.4 (Mode B-manual via ChatGPT web, 3 pass APPROVED) | Допустимо; выбрать Mode B-manual или Mode C по обстоятельствам |
+
+**Решение:** default — **Mode B-manual через ChatGPT web** (как в v3.4). Upgrade до Mode A пока BE-11 не закрыт не даёт выигрыша. PM публикует метку `⚠️ Degraded mode` в external review-pass.
+
+---
+
+## Verification Contract
+
+| VC | Критерий | Executable check |
+|----|----------|------------------|
+| **VC-1** | `.claude/skills/finalize-pr/SKILL.md` Шаг 5 (helper `validate_review_pass_body` + обе grep-проверки на `CHANGES_REQUESTED` и `APPROVED`) использует предобработку тела review-pass: вхождения в inline code spans (парные \`\`) и fenced blocks (тройные \`\`\`) заменяются на плейсхолдеры перед regex-проверкой. | `grep -nE "strip[_-]code[_-]spans?\|mask_code\|code[_-]span" .claude/skills/finalize-pr/SKILL.md` ≥ 1 hit; логика документирована inline |
+| **VC-2** | Три позитивных unit-теста на предобработку validator (location: см. P3): `plain text CHANGES_REQUESTED` → блокирует; `inline \`CHANGES_REQUESTED\`` → пропускает; fenced ```` ``` ... CHANGES_REQUESTED ... ``` ```` → пропускает. Также негативный sanity: реальный APPROVED без backtick-матча → пропускает. | Локальный прогон теста exit 0; файл теста коммитится вместе с правкой |
+| **VC-3** | `/verify` зелёный на HEAD (build + tests) | `npm run build` exit 0, `npm test` exit 0 |
+| **VC-4** | Все задачи с префиксом `[sprint-pipeline-v3-4]` / `[from-v3.4-dropped]` закрыты, явно deferred (с `bd update` + rationale), или reject-with-rationale. Ни одна не остаётся «висящей» без explicit decision. | `bd list --status=open` — 0 задач с указанными префиксами; deferred задачи имеют явную запись в notes с target sprint |
+| **VC-5** | Регрессионный прогон validator на полной истории review-pass комментариев PR #14 (там есть narrative-блоки с backtick-цитатами `CHANGES_REQUESTED`) — все APPROVED-комментарии на финальных HEAD'ах PR #14 проходят новую логику как APPROVED. | Smoke-тест через `gh pr view 14 --json comments` + прогон новой функции на каждом review-pass body; все финальные APPROVED — PASS без ложного блока |
+| **VC-6** | `/pipeline-audit` проходит — 8/8 invariants PASS, 0 drift (никаких новых инвариантов, но существующие не регрессировали). | `/pipeline-audit` отчёт `Инвариантов: 8/8 ✅` |
+
+> **Вне scope VC:** мы **не** меняем формат шаблонов финального комментария `/finalize-pr`, **не** добавляем новых инвариантов в `/pipeline-audit`, **не** трогаем operator-facing документы (`HOW_TO_USE.md`, `PIPELINE.md`) если не требуется cleanup-задачей.
+
+---
+
+## Фазы имплементации
+
+### P0. Prep
+
+- [ ] `bd create --type=task --priority=2 --title="Sprint Pipeline v3.5 — cleanup after v3.4"` → sprint tracking issue (TBD id)
+- [ ] `bd update <sprint-tracking> --claim`
+- [ ] Ветка `sprint-pipeline-v3-5-cleanup` от `master @ d3dab6b`
+- [ ] План сохранён как `docs/plans/sprint-pipeline-v3-5-cleanup.md` (этот файл)
+- [ ] Удалить черновой брифинг `docs/plans/sprint-v3.5-plan.md` (его содержимое полностью перенесено в этот plan)
+
+### P1. Правка 1 — validator code-span awareness (VC-1, VC-2, VC-5)
+
+**Цель:** `.claude/skills/finalize-pr/SKILL.md` Шаг 5 — функция `validate_review_pass_body` не должна матчить `CHANGES_REQUESTED`/`APPROVED` внутри code spans.
+
+**Реализация (выбор Developer'а, с ограничениями):**
+
+Вариант A — **inline bash preprocessing** через awk/sed (без новых зависимостей):
+- Step 1: strip fenced blocks (между парными ```` ``` ````).
+- Step 2: strip inline code spans (между одиночными `\``), с учётом экранирования.
+- Step 3: применить существующий `grep -qE` к остатку.
+
+Вариант B — **вспомогательный Python-скрипт** `.claude/skills/finalize-pr/validators/strip_code_spans.py`, вызывается из bash через pipe.
+
+**Предпочтение:** вариант A, если удаётся сделать в ≤ 20 строк bash без регрессий. Вариант B допустим, если awk-логика выходит за 25 строк или плохо читается. Новые bash-deps (jq уже есть, Python уже используется в hooks) — OK, не вводим новые внешние тулы.
+
+**Обязательные тесты (VC-2):**
+
+Создать `.claude/skills/finalize-pr/validators/test_validate_review_pass.sh` (если вариант A) или `.test.py` (если B). Три позитивных кейса + один негативный sanity-case. Запуск — standalone, без внешних зависимостей. Commit тестов вместе с правкой.
+
+**Regression guard (VC-5):**
+
+В smoke-тесте прогнать новый validator на полной истории review-pass комментариев PR #14 (там Pass 5/6 commentaries содержат narrative-цитаты `CHANGES_REQUESTED` в backticks). Ни один финальный APPROVED не должен ошибочно блокироваться; все исторические CHANGES_REQUESTED (реальные вердикты в plain text) должны блокироваться как раньше.
+
+### P2. Правка 2 — Beads cleanup (VC-4)
+
+PM последовательно проходит все open-задачи Beads с префиксом `[sprint-pipeline-v3-4]` или `[from-v3.4-dropped]`. Кандидаты на момент планирования (2026-04-20):
+
+| ID | P | Заголовок | Expected triage |
+|----|---|-----------|-----------------|
+| `big-heroes-ase` | P2 | `check-merge-ready.py` bypass через запятую | **fix-now** — расширить terminator pattern в [check-merge-ready.py](.claude/hooks/check-merge-ready.py); регрессия описана с репродьюсером. Простая regex-правка. |
+| `big-heroes-hrd` | P2 | `/finalize-pr` обязательный mode-label (role/model/mode/commit) | **defer v3.6+** — крупная доработка шаблонов + автодетект, scope creep для «уборки». Фиксирует инвариант через hook позже. |
+| `big-heroes-8gd` | P2 | WSL/Linux canonical path для external review | **defer** — отдельный инфра-спринт, требует установку WSL, codex в Linux, обновление CODEX_AUTH.md. Не попадает в timebox v3.5. |
+| `big-heroes-35g` | P3 | Error handling Фазы 4.5 pre-merge landing | **defer v3.6** — документационная доработка, не блокер v3.4 happy path. Решение: закрыть после одного-двух game sprint'ов под v3.4 flow, когда edge-cases проявятся на практике. |
+| `big-heroes-rux` | P3 | Polish embedded PR-body template в archived план v3.4 | **fix-now** — 1 LoC в `docs/archive/sprint-pipeline-v3-4-pre-merge-landing.md:320`. Разрешённая cleanup-правка archived документа. |
+| `big-heroes-0pk` | P3 | `status.md:5` wording «план в master» | **fix-now** — 1 LoC в [.memory_bank/status.md](.memory_bank/status.md) (но на момент v3.5 файл уже на master после merge PR #14 — пере-оценить актуальность: если misleading формулировка ушла вместе с обновлением status.md под новый спринт, задача автозакрывается. Если ещё висит — fix-now.) |
+| `big-heroes-hyo` | P3 | Restore 2668ff7 — `PM_ROLE.md §2.5 Шаг 4` fenced code polish | **fix-now** — markdown косметика в [.agents/PM_ROLE.md](.agents/PM_ROLE.md); reapply diff из reflog `2668ff7`. |
+
+**Процесс:**
+
+1. PM запускает `bd list --status=open --limit=0 | grep -E 'sprint-pipeline-v3-4\|from-v3.4-dropped'` — получает актуальный список (может отличаться от таблицы выше, если оператор создал/закрыл задачи между planning и execution).
+2. Для каждой задачи: `bd show <id>` → triage (fix-now / defer / reject).
+3. **fix-now** задачи: Developer имплементирует, PM review-cycle (обычно `tier: light` если .md-only; `tier: standard` если hook/SKILL.md). Каждая правка — отдельный atomic commit с `Addresses: <beads-id>` в message.
+4. **defer** задачи: `bd update <id> --notes "deferred to sprint v3.6: <rationale>"`; issue остаётся open, префикс меняется или добавляется label deferred-v3.6.
+5. **reject** задачи: `bd close <id> --reason "rejected: <rationale>"`.
+
+**Критерий приёмки (VC-4):** `bd list --status=open | grep -E 'sprint-pipeline-v3-4\|from-v3.4-dropped'` даёт 0 задач **БЕЗ** явного deferred-notes.
+
+### P3. Verify (VC-3)
+
+```bash
+npm run build && npm test
+```
+
+### P4. Pipeline audit (VC-6)
+
+```
+/pipeline-audit
+```
+
+Ожидаем `Инвариантов: 8/8 ✅`. Если drift обнаружен — триаж как отдельное finding (обычно fix в этом же спринте).
+
+### P5. PR creation
+
+```bash
+git push -u origin sprint-pipeline-v3-5-cleanup
+gh pr create --title "fix(pipeline): Sprint v3.5 — finalize-pr validator code-span + v3.4 cleanup" \
+  --body "$(cat <<'EOF'
+Tier: Sprint Final
+
+## Summary
+- **Правка 1:** `/finalize-pr` Шаг 5 validator игнорирует `CHANGES_REQUESTED`/`APPROVED` внутри code spans (inline + fenced). Устраняет infrastructure false positive hard gate v3.4.
+- **Правка 2:** очистка backlog — задачи с префиксом `[sprint-pipeline-v3-4]` / `[from-v3.4-dropped]` закрыты/deferred c rationale.
+- Архитектурных изменений нет. Инвариантов `/pipeline-audit` — 8/8 без новых.
+
+## Issues
+- Sprint tracking: <TBD after P0>
+- Fix-now: см. commits (каждый с `Addresses: <beads-id>`)
+
+## Verification Contract
+См. `docs/plans/sprint-pipeline-v3-5-cleanup.md` — VC-1..VC-6.
+
+## Test plan
+- [ ] /verify (build + tests)
+- [ ] /pipeline-audit (8/8)
+- [ ] Tester gate (Critical — finalize-pr SKILL.md)
+- [ ] Claude Reviewer Pass 1 + Pass 2
+- [ ] Regression prove на PR #14 comments history
+- [ ] Sprint Final /external-review (Mode B-manual via ChatGPT web; Mode C fallback — BE-11 blocker известен)
+- [ ] /finalize-pr #N --pre-landing (первый для Sprint Final)
+- [ ] Pre-merge landing commit (dogfood v3.4 flow continues)
+- [ ] /finalize-pr #N (второй, на landing HEAD)
+
+🤖 Generated with [Claude Code](https://claude.com/claude-code)
+
+— PM (Claude Opus 4.7)
+EOF
+)"
+```
+
+### P6. Review cycle (Critical + Sprint Final)
+
+1. **Tester gate** — класс `pipeline-artifacts` (Правка 1 трогает `.claude/skills/finalize-pr/SKILL.md`). Для Правки 2 — обычный tester для hook-правки (`check-merge-ready.py`), markdown-правки — без tester.
+2. **Claude Reviewer Pass 1** — 4 аспекта. Фокус: корректность code-span stripping (edge cases — экранированные backticks, смешанные вложенности).
+3. **PM triage** — fix / defer / reject.
+4. **Claude Reviewer Pass 2** — adversarial, регрессии validator.
+5. **Sprint Final `/external-review`** — Mode B-manual via ChatGPT web (как в v3.4); Mode C fallback допустим с меткой `⚠️ Degraded mode` + rationale BE-11.
+6. **`/finalize-pr <PR> --pre-landing`** (первый для Sprint Final — обязательно с флагом) → APPROVED на commit X; финальный комментарий содержит `⏳ Pre-merge landing commit впереди — жди второй /finalize-pr, не мерджи сейчас.`
+7. **Pre-merge landing commit** (v3.4 flow Фаза 4.5) — в этой же ветке:
+   - `.memory_bank/status.md`: Sprint v3.5 `COMPLETE <finalize_date>`.
+   - `git mv docs/plans/sprint-pipeline-v3-5-cleanup.md docs/archive/`.
+   - `bd close <sprint-tracking>` + `bd close <task-ids>` с reason (commit hash).
+   - `bd remember "Sprint v3.5 завершён <finalize_date>: validator code-span awareness + v3.4 backlog cleanup (<N> tasks closed, <M> deferred)"`.
+   - `chore(landing): pre-merge artifacts — sprint-pipeline-v3-5` + push.
+8. **Doc-only review round** на landing commit (Copilot auto + Claude delta self-review).
+9. **Sprint Final external review на landing HEAD** — обязателен (доктрина v3.4 Фаза 4.5.6 для sprint-final); Mode B/C с меткой Degraded допустим, landing — doc-only delta.
+10. **`/finalize-pr <PR>`** второй (без `--pre-landing`) → APPROVED на landing HEAD.
+11. **Сообщение оператору** → оператор мержит → Sprint полностью закрыт одним merge.
+
+---
+
+## Риски и митигации
+
+| # | Риск | P×I | Митигация |
+|---|------|-----|-----------|
+| R1 | Правка 1 затрагивает core hard gate validator → регрессия (пропуск реального CHANGES_REQUESTED в plain text или ложный блок на новых конструкциях) | High×High | Обязательные unit-тесты (VC-2, 3+1 кейсов) + regression prove на полном history PR #14 comments (VC-5) + Pass 2 adversarial reviewer инструктирован искать edge-cases (экранированные бэктики, вложенные fenced blocks, CRLF, LF-only) |
+| R2 | Правка 2 раскрывает скрытые зависимости → «уборка» превращается в рефакторинг | Med×High | Жёсткое time-box: одна рабочая сессия оператора в copy-paste формате (из брифинга). Всё что не укладывается — defer в v3.6/v3.7 без попытки закрыть в v3.5. |
+| R3 | BE-11 блокирует Mode A/B → Sprint Final только в Mode C | High×Low | Прецеденты Sprint 5 + v3.4 OK; default Mode B-manual через ChatGPT web, метка `⚠️ Degraded mode` + rationale |
+| R4 | Правка 1 не попадает в hard gate v3.5 самого себя (dogfood) — если validator всё ещё с багом, hard gate v3.5 будет ложно блокироваться при narrative-цитате `CHANGES_REQUESTED` | Med×Med | Developer реализует правку **первой** (P1). К моменту финального `/finalize-pr` v3.5 новая логика уже активна; dogfood-проверка = успешный hard gate самого v3.5. Если что-то идёт не так — временный `--force` запрещён без operator approval (см. PM_ROLE §2.5). |
+| R5 | Правка в `docs/archive/` (big-heroes-rux) ломает архивный документ как «эталонный пример» первого v3.4 dogfood | Low×Low | 1 LoC wording fix — не трогает архитектуру примера. Явное упоминание в commit message: `polish: archived plan Test plan qualifier (Addresses: big-heroes-rux)`. |
+
+---
+
+## Критические файлы
+
+| Путь | Роль в спринте |
+|------|----------------|
+| `.claude/skills/finalize-pr/SKILL.md` | P1 — секция Шаг 5 validator (строки 226–263) (VC-1, VC-5) |
+| `.claude/skills/finalize-pr/validators/test_validate_review_pass.sh` или `.test.py` | P1 — новые unit-тесты (VC-2) |
+| `.claude/skills/finalize-pr/validators/strip_code_spans.{sh,py}` | P1 — helper (если Developer выбрал вариант B) или inline в SKILL.md |
+| `.claude/hooks/check-merge-ready.py` | P2 fix-now — big-heroes-ase (terminator pattern) |
+| `.memory_bank/status.md` | P2 fix-now — big-heroes-0pk (если ещё актуально) + landing artifact |
+| `.agents/PM_ROLE.md` | P2 fix-now — big-heroes-hyo (§2.5 Шаг 4 fenced bash block) |
+| `docs/archive/sprint-pipeline-v3-4-pre-merge-landing.md` | P2 fix-now — big-heroes-rux (1 LoC Test plan qualifier) |
+| `docs/plans/sprint-pipeline-v3-5-cleanup.md` | этот файл (архивируется в P-landing) |
+| `docs/plans/sprint-v3.5-plan.md` | P0 — удалить (черновой брифинг оператора, полностью перенесён сюда) |
+
+---
+
+## Developer checklist (executable)
+
+```
+[ ] P0 bd create sprint tracking + claim
+[ ] P0 ветка sprint-pipeline-v3-5-cleanup от master @ d3dab6b
+[ ] P0 план на месте (этот файл), черновик sprint-v3.5-plan.md удалён
+[ ] P1 .claude/skills/finalize-pr/SKILL.md Шаг 5 — validator игнорирует backtick-code-spans
+[ ] P1 unit-тесты — 3 позитивных + 1 негативный sanity (VC-2) в validators/
+[ ] P1 regression smoke на PR #14 history — финальные APPROVED проходят (VC-5)
+[ ] P2 bd list — получить актуальный список [sprint-pipeline-v3-4] / [from-v3.4-dropped]
+[ ] P2 для каждой — triage fix-now / defer / reject, зафиксировать в bd
+[ ] P2 fix-now big-heroes-ase — check-merge-ready.py terminator pattern + репро-тест
+[ ] P2 fix-now big-heroes-rux — docs/archive/sprint-pipeline-v3-4-pre-merge-landing.md:320 wording
+[ ] P2 fix-now big-heroes-0pk — .memory_bank/status.md:5 wording (если ещё актуально)
+[ ] P2 fix-now big-heroes-hyo — .agents/PM_ROLE.md §2.5 Шаг 4 fenced bash reapply
+[ ] P2 defer big-heroes-hrd / big-heroes-8gd / big-heroes-35g с notes "deferred to v3.6: <rationale>"
+[ ] P3 /verify (npm run build && npm test) exit 0
+[ ] P4 /pipeline-audit 8/8 ✅
+[ ] P5 git push -u origin sprint-pipeline-v3-5-cleanup
+[ ] P5 gh pr create --title ... --body с Tier: Sprint Final
+[ ] P6 Tester gate pipeline-artifacts (Critical)
+[ ] P6 Reviewer Pass 1 → triage → Pass 2 → APPROVED
+[ ] P6 /external-review Mode B-manual (fallback Mode C) → APPROVED с меткой Degraded
+[ ] P6 /finalize-pr #N --pre-landing (первый Sprint Final — обязательно с флагом) → APPROVED с ⏳ warning
+[ ] P6-DOGFOOD pre-merge landing commit (status.md + archive + bd close + bd remember)
+[ ] P6-DOGFOOD push → doc-only review round
+[ ] P6 /external-review на landing HEAD (Sprint Final обязательно)
+[ ] P6 /finalize-pr #N (второй на landing HEAD) → APPROVED
+[ ] POST оператор мержит → Sprint v3.5 закрыт
+```
+
+---
+
+## Post-merge verification
+
+1. **Validator self-test:** на следующем Sprint PR narrative с backtick-цитатой `CHANGES_REQUESTED` не блокирует `/finalize-pr`.
+2. **Beads backlog:** `bd list --status=open | grep -E 'sprint-pipeline-v3-4\|from-v3.4-dropped'` — 0 задач без deferred-notes.
+3. **Pipeline-audit:** `/pipeline-audit` на post-merge HEAD → `Инвариантов: 8/8 ✅` без новых.
+4. **Dogfood v3.4 continuity:** landing commit в этой же ветке, один merge commit на master, нет `chore/landing-pr-N` PR.
+5. **Memory pattern:** `bd memories sprint-v3-5` показывает запись с `завершён <finalize_date>`.

```
