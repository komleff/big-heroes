# Sprint Pipeline v3.5 — Cleanup After v3.4

**Дата плана:** 2026-04-20
**PM:** Claude Opus 4.7 (1M context)
**Base:** `master @ d3dab6b` (merge PR #14 — Sprint Pipeline v3.4 Pre-Merge Landing)
**Ветка спринта:** `sprint-pipeline-v3-5-cleanup`
**Sprint tracking:** TBD (создаётся в P0 — `bd create --type=task --priority=2 --title="Sprint Pipeline v3.5 — cleanup after v3.4"`)
**Task issues:** существующие Beads задачи с префиксом `[sprint-pipeline-v3-4]` / `[from-v3.4-dropped]` (см. P-cleanup ниже) + инфраструктурная правка без предварительного issue (`bd create` внутри спринта).
**Review Tier:** **Critical + Sprint Final** (правка 1 трогает `.claude/skills/finalize-pr/SKILL.md` — нормативный артефакт пайплайна; merge в master → Sprint Final)

---

## Context

Sprint v3.4 (PR [#14](https://github.com/komleff/big-heroes/pull/14)) merged 2026-04-19. В ходе hard gate финального `/finalize-pr` вылез **infrastructure false positive**: validator в шаге 5 матчил `CHANGES_REQUESTED` внутри backtick-code-span (в narrative-блоке разбора пастовой истории review-pass). Hard gate блокировал публикацию, хотя META комментария явно содержал `Вердикт: APPROVED`. Оператор обошёл временно ручным вмешательством.

Плюс за v3.4 (6 iteration review-cycles + 11 commits после triage) в Beads накопился хвост P2/P3 задач, помеченных как deferred to v3.5 или later.

**Спринт-уборка.** Никаких новых механизмов, никакого расширения скиллов за пределами прямых bugfix'ов. Цель — закрыть хвосты и пойти в v3.6 с чистым бэклогом.

---

## Scope (brief от оператора, зафиксированный 2026-04-20)

**Правка 1 (infrastructure bugfix):** validator regex в `/finalize-pr` Шаг 5 должен игнорировать вхождения `CHANGES_REQUESTED` внутри inline code spans (парные backticks) и fenced code blocks (тройные backticks). Реальные указания статуса в plain text продолжают блокировать hard gate.

**Правка 2 (backlog cleanup):** закрыть или явно defer-with-rationale все задачи с префиксом `[sprint-pipeline-v3-4]` / `[from-v3.4-dropped]` в Beads — оценка каждой по факту, без попытки закрыть всё в рамках v3.5 (time-boxed одной сессией).

Брифинг оператора: `docs/plans/sprint-v3.5-plan.md` (до переименования) — этот файл заменяет его.

---

## Prerequisites Audit

| Item | Статус | Impact |
|------|--------|--------|
| PR #14 merged в master | ✅ MERGED 2026-04-19 (merge commit `d3dab6b`) | Можно стартовать от чистого master HEAD |
| Sprint v3.4 landing artifacts уже в master | ✅ (commit `15ee206` → merged) | `.memory_bank/status.md` актуальный, план в архиве |
| BE-11 (Windows sandbox 1326) | ❌ OPEN (P1), **не исправлен** | Mode A/B недоступны → **default Mode C (degraded)** для Sprint Final external review |
| `$OPENAI_API_KEY` | 401 in-situ per Sprint 5 audit | Mode A не работает; Mode C не требует ключа |
| Operator-approved Mode C degradation | Прецедент Sprint 5 (Mode C APPROVED, operator merged) + Sprint v3.4 (Mode B-manual via ChatGPT web, 3 pass APPROVED) | Допустимо; выбрать Mode B-manual или Mode C по обстоятельствам |

**Решение:** default — **Mode B-manual через ChatGPT web** (как в v3.4). Upgrade до Mode A пока BE-11 не закрыт не даёт выигрыша. PM публикует метку `⚠️ Degraded mode` в external review-pass.

---

## Verification Contract

| VC | Критерий | Executable check |
|----|----------|------------------|
| **VC-1** | `.claude/skills/finalize-pr/SKILL.md` Шаг 5 (helper `validate_review_pass_body` + обе grep-проверки на `CHANGES_REQUESTED` и `APPROVED`) использует предобработку тела review-pass: вхождения в inline code spans (парные \`\`) и fenced blocks (тройные \`\`\`) заменяются на плейсхолдеры перед regex-проверкой. | `grep -nE "strip[_-]code[_-]spans?\|mask_code\|code[_-]span" .claude/skills/finalize-pr/SKILL.md` ≥ 1 hit; логика документирована inline |
| **VC-2** | Три позитивных unit-теста на предобработку validator (location: см. P3): `plain text CHANGES_REQUESTED` → блокирует; `inline \`CHANGES_REQUESTED\`` → пропускает; fenced ```` ``` ... CHANGES_REQUESTED ... ``` ```` → пропускает. Также негативный sanity: реальный APPROVED без backtick-матча → пропускает. | Локальный прогон теста exit 0; файл теста коммитится вместе с правкой |
| **VC-3** | `/verify` зелёный на HEAD (build + tests) | `npm run build` exit 0, `npm test` exit 0 |
| **VC-4** | Все задачи с префиксом `[sprint-pipeline-v3-4]` / `[from-v3.4-dropped]` закрыты, явно deferred (с `bd update` + rationale), или reject-with-rationale. Ни одна не остаётся «висящей» без explicit decision. | `bd list --status=open` — 0 задач с указанными префиксами; deferred задачи имеют явную запись в notes с target sprint |
| **VC-5** | Регрессионный прогон validator на полной истории review-pass комментариев PR #14 (там есть narrative-блоки с backtick-цитатами `CHANGES_REQUESTED`) — все APPROVED-комментарии на финальных HEAD'ах PR #14 проходят новую логику как APPROVED. | Smoke-тест через `gh pr view 14 --json comments` + прогон новой функции на каждом review-pass body; все финальные APPROVED — PASS без ложного блока |
| **VC-6** | `/pipeline-audit` проходит — 8/8 invariants PASS, 0 drift (никаких новых инвариантов, но существующие не регрессировали). | `/pipeline-audit` отчёт `Инвариантов: 8/8 ✅` |

> **Вне scope VC:** мы **не** меняем формат шаблонов финального комментария `/finalize-pr`, **не** добавляем новых инвариантов в `/pipeline-audit`, **не** трогаем operator-facing документы (`HOW_TO_USE.md`, `PIPELINE.md`) если не требуется cleanup-задачей.

---

## Фазы имплементации

### P0. Prep

- [ ] `bd create --type=task --priority=2 --title="Sprint Pipeline v3.5 — cleanup after v3.4"` → sprint tracking issue (TBD id)
- [ ] `bd update <sprint-tracking> --claim`
- [ ] Ветка `sprint-pipeline-v3-5-cleanup` от `master @ d3dab6b`
- [ ] План сохранён как `docs/plans/sprint-pipeline-v3-5-cleanup.md` (этот файл)
- [ ] Удалить черновой брифинг `docs/plans/sprint-v3.5-plan.md` (его содержимое полностью перенесено в этот plan)

### P1. Правка 1 — validator code-span awareness (VC-1, VC-2, VC-5)

**Цель:** `.claude/skills/finalize-pr/SKILL.md` Шаг 5 — функция `validate_review_pass_body` не должна матчить `CHANGES_REQUESTED`/`APPROVED` внутри code spans.

**Реализация (выбор Developer'а, с ограничениями):**

Вариант A — **inline bash preprocessing** через awk/sed (без новых зависимостей):
- Step 1: strip fenced blocks (между парными ```` ``` ````).
- Step 2: strip inline code spans (между одиночными `\``), с учётом экранирования.
- Step 3: применить существующий `grep -qE` к остатку.

Вариант B — **вспомогательный Python-скрипт** `.claude/skills/finalize-pr/validators/strip_code_spans.py`, вызывается из bash через pipe.

**Предпочтение:** вариант A, если удаётся сделать в ≤ 20 строк bash без регрессий. Вариант B допустим, если awk-логика выходит за 25 строк или плохо читается. Новые bash-deps (jq уже есть, Python уже используется в hooks) — OK, не вводим новые внешние тулы.

**Обязательные тесты (VC-2):**

Создать `.claude/skills/finalize-pr/validators/test_validate_review_pass.sh` (если вариант A) или `.test.py` (если B). Три позитивных кейса + один негативный sanity-case. Запуск — standalone, без внешних зависимостей. Commit тестов вместе с правкой.

**Regression guard (VC-5):**

В smoke-тесте прогнать новый validator на полной истории review-pass комментариев PR #14 (там Pass 5/6 commentaries содержат narrative-цитаты `CHANGES_REQUESTED` в backticks). Ни один финальный APPROVED не должен ошибочно блокироваться; все исторические CHANGES_REQUESTED (реальные вердикты в plain text) должны блокироваться как раньше.

### P2. Правка 2 — Beads cleanup (VC-4)

PM последовательно проходит все open-задачи Beads с префиксом `[sprint-pipeline-v3-4]` или `[from-v3.4-dropped]`. Кандидаты на момент планирования (2026-04-20):

| ID | P | Заголовок | Expected triage |
|----|---|-----------|-----------------|
| `big-heroes-ase` | P2 | `check-merge-ready.py` bypass через запятую | **fix-now** — расширить terminator pattern в [check-merge-ready.py](.claude/hooks/check-merge-ready.py); регрессия описана с репродьюсером. Простая regex-правка. |
| `big-heroes-hrd` | P2 | `/finalize-pr` обязательный mode-label (role/model/mode/commit) | **defer v3.6+** — крупная доработка шаблонов + автодетект, scope creep для «уборки». Фиксирует инвариант через hook позже. |
| `big-heroes-8gd` | P2 | WSL/Linux canonical path для external review | **defer** — отдельный инфра-спринт, требует установку WSL, codex в Linux, обновление CODEX_AUTH.md. Не попадает в timebox v3.5. |
| `big-heroes-35g` | P3 | Error handling Фазы 4.5 pre-merge landing | **defer v3.6** — документационная доработка, не блокер v3.4 happy path. Решение: закрыть после одного-двух game sprint'ов под v3.4 flow, когда edge-cases проявятся на практике. |
| `big-heroes-rux` | P3 | Polish embedded PR-body template в archived план v3.4 | **fix-now** — 1 LoC в `docs/archive/sprint-pipeline-v3-4-pre-merge-landing.md:320`. Разрешённая cleanup-правка archived документа. |
| `big-heroes-0pk` | P3 | `status.md:5` wording «план в master» | **fix-now** — 1 LoC в [.memory_bank/status.md](.memory_bank/status.md) (но на момент v3.5 файл уже на master после merge PR #14 — пере-оценить актуальность: если misleading формулировка ушла вместе с обновлением status.md под новый спринт, задача автозакрывается. Если ещё висит — fix-now.) |
| `big-heroes-hyo` | P3 | Restore 2668ff7 — `PM_ROLE.md §2.5 Шаг 4` fenced code polish | **fix-now** — markdown косметика в [.agents/PM_ROLE.md](.agents/PM_ROLE.md); reapply diff из reflog `2668ff7`. |

**Процесс:**

1. PM запускает `bd list --status=open --limit=0 | grep -E 'sprint-pipeline-v3-4\|from-v3.4-dropped'` — получает актуальный список (может отличаться от таблицы выше, если оператор создал/закрыл задачи между planning и execution).
2. Для каждой задачи: `bd show <id>` → triage (fix-now / defer / reject).
3. **fix-now** задачи: Developer имплементирует, PM review-cycle (обычно `tier: light` если .md-only; `tier: standard` если hook/SKILL.md). Каждая правка — отдельный atomic commit с `Addresses: <beads-id>` в message.
4. **defer** задачи: `bd update <id> --notes "deferred to sprint v3.6: <rationale>"`; issue остаётся open, префикс меняется или добавляется label deferred-v3.6.
5. **reject** задачи: `bd close <id> --reason "rejected: <rationale>"`.

**Критерий приёмки (VC-4):** `bd list --status=open | grep -E 'sprint-pipeline-v3-4\|from-v3.4-dropped'` даёт 0 задач **БЕЗ** явного deferred-notes.

### P3. Verify (VC-3)

```bash
npm run build && npm test
```

### P4. Pipeline audit (VC-6)

```
/pipeline-audit
```

Ожидаем `Инвариантов: 8/8 ✅`. Если drift обнаружен — триаж как отдельное finding (обычно fix в этом же спринте).

### P5. PR creation

```bash
git push -u origin sprint-pipeline-v3-5-cleanup
gh pr create --title "fix(pipeline): Sprint v3.5 — finalize-pr validator code-span + v3.4 cleanup" \
  --body "$(cat <<'EOF'
Tier: Sprint Final

## Summary
- **Правка 1:** `/finalize-pr` Шаг 5 validator игнорирует `CHANGES_REQUESTED`/`APPROVED` внутри code spans (inline + fenced). Устраняет infrastructure false positive hard gate v3.4.
- **Правка 2:** очистка backlog — задачи с префиксом `[sprint-pipeline-v3-4]` / `[from-v3.4-dropped]` закрыты/deferred c rationale.
- Архитектурных изменений нет. Инвариантов `/pipeline-audit` — 8/8 без новых.

## Issues
- Sprint tracking: <TBD after P0>
- Fix-now: см. commits (каждый с `Addresses: <beads-id>`)

## Verification Contract
См. `docs/plans/sprint-pipeline-v3-5-cleanup.md` — VC-1..VC-6.

## Test plan
- [ ] /verify (build + tests)
- [ ] /pipeline-audit (8/8)
- [ ] Tester gate (Critical — finalize-pr SKILL.md)
- [ ] Claude Reviewer Pass 1 + Pass 2
- [ ] Regression prove на PR #14 comments history
- [ ] Sprint Final /external-review (Mode B-manual via ChatGPT web; Mode C fallback — BE-11 blocker известен)
- [ ] /finalize-pr #N --pre-landing (первый для Sprint Final)
- [ ] Pre-merge landing commit (dogfood v3.4 flow continues)
- [ ] /finalize-pr #N (второй, на landing HEAD)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

— PM (Claude Opus 4.7)
EOF
)"
```

### P6. Review cycle (Critical + Sprint Final)

1. **Tester gate** — класс `pipeline-artifacts` (Правка 1 трогает `.claude/skills/finalize-pr/SKILL.md`). Для Правки 2 — обычный tester для hook-правки (`check-merge-ready.py`), markdown-правки — без tester.
2. **Claude Reviewer Pass 1** — 4 аспекта. Фокус: корректность code-span stripping (edge cases — экранированные backticks, смешанные вложенности).
3. **PM triage** — fix / defer / reject.
4. **Claude Reviewer Pass 2** — adversarial, регрессии validator.
5. **Sprint Final `/external-review`** — Mode B-manual via ChatGPT web (как в v3.4); Mode C fallback допустим с меткой `⚠️ Degraded mode` + rationale BE-11.
6. **`/finalize-pr <PR> --pre-landing`** (первый для Sprint Final — обязательно с флагом) → APPROVED на commit X; финальный комментарий содержит `⏳ Pre-merge landing commit впереди — жди второй /finalize-pr, не мерджи сейчас.`
7. **Pre-merge landing commit** (v3.4 flow Фаза 4.5) — в этой же ветке:
   - `.memory_bank/status.md`: Sprint v3.5 `COMPLETE <finalize_date>`.
   - `git mv docs/plans/sprint-pipeline-v3-5-cleanup.md docs/archive/`.
   - `bd close <sprint-tracking>` + `bd close <task-ids>` с reason (commit hash).
   - `bd remember "Sprint v3.5 завершён <finalize_date>: validator code-span awareness + v3.4 backlog cleanup (<N> tasks closed, <M> deferred)"`.
   - `chore(landing): pre-merge artifacts — sprint-pipeline-v3-5` + push.
8. **Doc-only review round** на landing commit (Copilot auto + Claude delta self-review).
9. **Sprint Final external review на landing HEAD** — обязателен (доктрина v3.4 Фаза 4.5.6 для sprint-final); Mode B/C с меткой Degraded допустим, landing — doc-only delta.
10. **`/finalize-pr <PR>`** второй (без `--pre-landing`) → APPROVED на landing HEAD.
11. **Сообщение оператору** → оператор мержит → Sprint полностью закрыт одним merge.

---

## Риски и митигации

| # | Риск | P×I | Митигация |
|---|------|-----|-----------|
| R1 | Правка 1 затрагивает core hard gate validator → регрессия (пропуск реального CHANGES_REQUESTED в plain text или ложный блок на новых конструкциях) | High×High | Обязательные unit-тесты (VC-2, 3+1 кейсов) + regression prove на полном history PR #14 comments (VC-5) + Pass 2 adversarial reviewer инструктирован искать edge-cases (экранированные бэктики, вложенные fenced blocks, CRLF, LF-only) |
| R2 | Правка 2 раскрывает скрытые зависимости → «уборка» превращается в рефакторинг | Med×High | Жёсткое time-box: одна рабочая сессия оператора в copy-paste формате (из брифинга). Всё что не укладывается — defer в v3.6/v3.7 без попытки закрыть в v3.5. |
| R3 | BE-11 блокирует Mode A/B → Sprint Final только в Mode C | High×Low | Прецеденты Sprint 5 + v3.4 OK; default Mode B-manual через ChatGPT web, метка `⚠️ Degraded mode` + rationale |
| R4 | Правка 1 не попадает в hard gate v3.5 самого себя (dogfood) — если validator всё ещё с багом, hard gate v3.5 будет ложно блокироваться при narrative-цитате `CHANGES_REQUESTED` | Med×Med | Developer реализует правку **первой** (P1). К моменту финального `/finalize-pr` v3.5 новая логика уже активна; dogfood-проверка = успешный hard gate самого v3.5. Если что-то идёт не так — временный `--force` запрещён без operator approval (см. PM_ROLE §2.5). |
| R5 | Правка в `docs/archive/` (big-heroes-rux) ломает архивный документ как «эталонный пример» первого v3.4 dogfood | Low×Low | 1 LoC wording fix — не трогает архитектуру примера. Явное упоминание в commit message: `polish: archived plan Test plan qualifier (Addresses: big-heroes-rux)`. |

---

## Критические файлы

| Путь | Роль в спринте |
|------|----------------|
| `.claude/skills/finalize-pr/SKILL.md` | P1 — секция Шаг 5 validator (строки 226–263) (VC-1, VC-5) |
| `.claude/skills/finalize-pr/validators/test_validate_review_pass.sh` или `.test.py` | P1 — новые unit-тесты (VC-2) |
| `.claude/skills/finalize-pr/validators/strip_code_spans.{sh,py}` | P1 — helper (если Developer выбрал вариант B) или inline в SKILL.md |
| `.claude/hooks/check-merge-ready.py` | P2 fix-now — big-heroes-ase (terminator pattern) |
| `.memory_bank/status.md` | P2 fix-now — big-heroes-0pk (если ещё актуально) + landing artifact |
| `.agents/PM_ROLE.md` | P2 fix-now — big-heroes-hyo (§2.5 Шаг 4 fenced bash block) |
| `docs/archive/sprint-pipeline-v3-4-pre-merge-landing.md` | P2 fix-now — big-heroes-rux (1 LoC Test plan qualifier) |
| `docs/plans/sprint-pipeline-v3-5-cleanup.md` | этот файл (архивируется в P-landing) |
| `docs/plans/sprint-v3.5-plan.md` | P0 — удалить (черновой брифинг оператора, полностью перенесён сюда) |

---

## Developer checklist (executable)

```
[ ] P0 bd create sprint tracking + claim
[ ] P0 ветка sprint-pipeline-v3-5-cleanup от master @ d3dab6b
[ ] P0 план на месте (этот файл), черновик sprint-v3.5-plan.md удалён
[ ] P1 .claude/skills/finalize-pr/SKILL.md Шаг 5 — validator игнорирует backtick-code-spans
[ ] P1 unit-тесты — 3 позитивных + 1 негативный sanity (VC-2) в validators/
[ ] P1 regression smoke на PR #14 history — финальные APPROVED проходят (VC-5)
[ ] P2 bd list — получить актуальный список [sprint-pipeline-v3-4] / [from-v3.4-dropped]
[ ] P2 для каждой — triage fix-now / defer / reject, зафиксировать в bd
[ ] P2 fix-now big-heroes-ase — check-merge-ready.py terminator pattern + репро-тест
[ ] P2 fix-now big-heroes-rux — docs/archive/sprint-pipeline-v3-4-pre-merge-landing.md:320 wording
[ ] P2 fix-now big-heroes-0pk — .memory_bank/status.md:5 wording (если ещё актуально)
[ ] P2 fix-now big-heroes-hyo — .agents/PM_ROLE.md §2.5 Шаг 4 fenced bash reapply
[ ] P2 defer big-heroes-hrd / big-heroes-8gd / big-heroes-35g с notes "deferred to v3.6: <rationale>"
[ ] P3 /verify (npm run build && npm test) exit 0
[ ] P4 /pipeline-audit 8/8 ✅
[ ] P5 git push -u origin sprint-pipeline-v3-5-cleanup
[ ] P5 gh pr create --title ... --body с Tier: Sprint Final
[ ] P6 Tester gate pipeline-artifacts (Critical)
[ ] P6 Reviewer Pass 1 → triage → Pass 2 → APPROVED
[ ] P6 /external-review Mode B-manual (fallback Mode C) → APPROVED с меткой Degraded
[ ] P6 /finalize-pr #N --pre-landing (первый Sprint Final — обязательно с флагом) → APPROVED с ⏳ warning
[ ] P6-DOGFOOD pre-merge landing commit (status.md + archive + bd close + bd remember)
[ ] P6-DOGFOOD push → doc-only review round
[ ] P6 /external-review на landing HEAD (Sprint Final обязательно)
[ ] P6 /finalize-pr #N (второй на landing HEAD) → APPROVED
[ ] POST оператор мержит → Sprint v3.5 закрыт
```

---

## Post-merge verification

1. **Validator self-test:** на следующем Sprint PR narrative с backtick-цитатой `CHANGES_REQUESTED` не блокирует `/finalize-pr`.
2. **Beads backlog:** `bd list --status=open | grep -E 'sprint-pipeline-v3-4\|from-v3.4-dropped'` — 0 задач без deferred-notes.
3. **Pipeline-audit:** `/pipeline-audit` на post-merge HEAD → `Инвариантов: 8/8 ✅` без новых.
4. **Dogfood v3.4 continuity:** landing commit в этой же ветке, один merge commit на master, нет `chore/landing-pr-N` PR.
5. **Memory pattern:** `bd memories sprint-v3-5` показывает запись с `завершён <finalize_date>`.
