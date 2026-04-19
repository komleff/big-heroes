# Sprint Pipeline v3.4 — Pre-Merge Landing Protocol

**Дата плана:** 2026-04-19
**PM:** Claude Opus 4.7 (1M context)
**Base:** `master @ c027920` (после merge PR #13 landing для Sprint 5)
**Ветка спринта:** `sprint-pipeline-v3-4-pre-merge-landing`
**Sprint tracking:** `big-heroes-sz4`
**Task issue:** `big-heroes-cfn`
**Review Tier:** **Critical + Sprint Final** (нормативные артефакты пайплайна: `.agents/PM_ROLE.md`, `.claude/skills/*/SKILL.md`)

---

## Context

Sprint 5 (PR #12, merged 2026-04-19) завершился отдельным `chore/landing-pr-12` (PR #13) — post-merge Landing the Plane per `PM_ROLE.md §2.5`. Оператор по итогу задал вопрос: можем ли делать landing **до** merge?

**Мотивация (2026-04-19 session):**

- Оператор не делает ручное ревью (Zero Trust to Human Tech Skills) — решения на основе вердиктов.
- Между `/finalize-pr` APPROVED и operator-merge код не меняется.
- Второй PR для landing artifacts (status.md, plan archive, bd close) = bureaucratic toil без safety value.
- PM согласился, оператор одобрил, запланировал infra meta-sprint v3.4.

**Новый flow v3.4 (нарратив):**

1. Review cycle полный (Tester + Reviewer Pass 1/2 + Sprint Final external + Copilot zero).
2. `/finalize-pr` APPROVED на HEAD commit.
3. PM делает landing commit **в ту же ветку**: `chore(landing): pre-merge artifacts` — обновить `.memory_bank/status.md` (с `COMPLETE <finalize_date>`), `git mv docs/plans/<sprint>.md → docs/archive/`, `bd close <sprint-tracking>` с reason, `bd remember sprint-N-<finalize_date>-<slug>`.
4. Push → один doc-only review round (Copilot обычно zero, Claude delta self-review).
5. `/finalize-pr` повторно на новом HEAD (с landing commit).
6. Оператор мержит — Sprint полностью закрыт одним merge.

**Dogfood:** этот sprint — **первый под v3.4**. После внедрения правил в артефакты мы обязаны применить их к самому себе: landing commit в эту же ветку `sprint-pipeline-v3-4-pre-merge-landing` между первым `/finalize-pr APPROVED` и merge.

**Convention change:** memory entry pattern `Sprint N завершён <merge_date>` → `Sprint N завершён <finalize_date>`. Honest — финализация = момент когда цикл закрылся. Существующие sprint-1..5 memories оставить как исторические (они использовали merge_date); новый pattern — для будущих спринтов начиная с v3.4.

---

## Prerequisites Audit

| Item | Статус | Impact |
|------|--------|--------|
| Ротация `$OPENAI_API_KEY` | Установлен (164 байта), но на Sprint 5 отмечен как 401 in-situ. **До старта Reviewer Pass 1 PM должен дёрнуть test-probe** (`codex login status` при возможности или `curl` ping) и зафиксировать результат в PR. | Mode A — только если ключ валиден |
| `big-heroes-1l6` (BE-11 Windows sandbox 1326) | **OPEN**, не исправлен | Codex CLI review через sandbox недоступен → Mode A/B недоступны → **default Mode C (degraded)** для этого sprint'а |
| Operator-approved Mode C | Прецедент Sprint 5 (Mode C Standard + Adversarial APPROVED, operator merged) | Допустимо |

**Решение:** планируем Sprint Final в **Mode C degraded**. Upgrade до Mode A/B пока BE-11 не закрыт **не даёт выигрыша**: даже с валидным `$OPENAI_API_KEY` Codex CLI падает в sandbox 1326 на Windows dev-host оператора. PM публикует метку `⚠️ Degraded mode` в external review-pass (инвариант `/finalize-pr` шаг 4). Upgrade до Mode A/B станет возможен только после fix BE-11 либо переноса external review на Linux/WSL host.

---

## Verification Contract

| VC | Критерий | Executable check |
|----|----------|------------------|
| **VC-1** | `.agents/PM_ROLE.md §2.5 "Landing the Plane"` — переписана в pre-merge формулировку, шаги 1–4 (Memory Bank, bd close, bd remember, git mv plan) идут **до** `/finalize-pr` повторного, шаг 5 = `/finalize-pr` повторно (hash на HEAD с landing commit). **Removed:** Sprint Landing не содержит **активной инструкции создавать** отдельный `chore/landing-pr-N` PR. Historical/forbidden упоминания (в блоках «История», «Запрещено в v3.4») допустимы. | `grep -n "pre-merge\|повторный /finalize-pr" .agents/PM_ROLE.md` ≥ 2 hits; `grep -nE "созда(й\|те\|ть\|вать\|йте).{0,80}chore/landing-pr\|chore/landing-pr.{0,80}созда(й\|те\|ть\|вать\|йте)" .agents/PM_ROLE.md` = 0 hits (нет императивных инструкций создавать отдельный PR). Regex намеренно не включает «создавало» (past narrative) и «отдельный PR» (описательное) — допустимы в блоках «История (v3.4)» и «Запрещено в v3.4» |
| **VC-2** | `.claude/skills/sprint-pr-cycle/SKILL.md` — между Фазой 4 (`/finalize-pr`) и merge-ожиданием добавлена **Фаза 4.5 "Pre-merge Landing"** с чеклистом (status.md, plan archive, bd close, bd remember) и инструкцией повторного `/finalize-pr` на новом HEAD. | `grep -nE "Фаза 4\.5\|Pre-merge Landing\|pre-merge landing" .claude/skills/sprint-pr-cycle/SKILL.md` ≥ 1 hit; чеклист содержит все 4 шага (status.md + archive + bd close + bd remember) |
| **VC-3** | `.claude/skills/finalize-pr/SKILL.md` — добавлен раздел про **dual-invocation pattern**: второй вызов на новом HEAD (после landing commit) — штатный режим, не ошибка. Используется уже работающий HEAD re-check механизм. | `grep -nE "dual.?invocation\|повторный вызов\|второй вызов\|landing commit" .claude/skills/finalize-pr/SKILL.md` ≥ 1 hit |
| **VC-4** | Memory pattern обновлён в `PM_ROLE.md` — формулировка `Sprint N завершён <finalize_date>` (не `<merge_date>`), с примечанием «исторические sprint-1..5 memories не перезаписываются». | `grep -n "finalize_date\|finalize.date" .agents/PM_ROLE.md` ≥ 1 hit; `grep -n "merge_date" .agents/PM_ROLE.md` — есть только в контексте «было до v3.4» или отсутствует |
| **VC-5** | `.claude/skills/pipeline-audit/SKILL.md` — добавлен **Инвариант 8 v3.4**: "Sprint не создаёт отдельный `chore/landing-pr-N` PR после merge. Landing commit коммитится в ветку Sprint PR между первым `/finalize-pr APPROVED` и merge." | `grep -nE "Инвариант 8\|invariant 8\|chore/landing-pr\|pre-merge landing" .claude/skills/pipeline-audit/SKILL.md` ≥ 1 hit; таблица инвариантов имеет 8 строк |
| **VC-6** | `/pipeline-audit` проходит — 8/8 invariants PASS, 0 drift. | Прогнать skill; отчёт `✅ OK` с `Инвариантов: 8/8` |
| **VC-7** | `/verify` зелёный (build + tests) на HEAD перед PR. | `npm run build` exit 0, `npm test` exit 0 |
| **VC-8 (Dogfood)** | После первого `/finalize-pr APPROVED` PM делает landing commit в эту же ветку (не отдельную `chore/landing-pr-*`). Второй `/finalize-pr` на новом HEAD проходит. Merge — один раз, оператором. | Git log ветки: ≥1 commit с prefix `chore(landing):` **после** последнего review/fix commit и **до** merge commit; PR #N не имеет child chore-ветки |
| **VC-9** | Operator-facing документы (`HOW_TO_USE.md`, `PIPELINE.md`) синхронизированы с двухвызовным flow v3.4: первый `## ✅ Готов к merge` — это **промежуточная** точка (PM делает landing commit), второй комментарий — после landing — единственный сигнал к merge. | `grep -n "первый\|первое\|второй\|второе\|landing\|pre-merge" .agents/HOW_TO_USE.md` ≥ 2 hits в секции «Как принимать решение о merge»; `.agents/PIPELINE.md` flow содержит landing шаг между первым и вторым `/finalize-pr` |
| **VC-10** | `/finalize-pr` принимает `--pre-landing` флаг для **первого** вызова Sprint Final PR; шаблоны фазы 1/2 печатают **explicit** строку `⏳ Pre-merge landing commit впереди — жди второй /finalize-pr, не мерджи сейчас.` когда флаг передан. Без флага — обычный merge-ready текст. Detection — explicit (PM/operator решает), без runtime autodetect (см. scope rollback 2026-04-20). | `grep -n "pre-landing\|LANDING_WARNING\|жди второй" .claude/skills/finalize-pr/SKILL.md` ≥ 3 hits; `--pre-landing` упомянут в "Аргументы" |

---

## Фазы имплементации

### P0. Prep

- [x] `bd update big-heroes-cfn --claim` (выполнено)
- [x] `bd create` sprint tracking → `big-heroes-sz4` (выполнено)
- [x] Ветка `sprint-pipeline-v3-4-pre-merge-landing` от `master @ c027920` (выполнено)
- [ ] Этот план сохранён как `docs/plans/sprint-pipeline-v3-4-pre-merge-landing.md`

### P1. Обновление `.agents/PM_ROLE.md` §2.5 (VC-1)

**Цель:** переписать Landing the Plane из post-merge в pre-merge формулировку.

Текущая секция §2.5 (строки 153–165):
```
**Шаг 1 — Обнови Memory Bank** (status.md, systemPatterns.md, productContext.md при необходимости).
**Шаг 2 — Закрой задачи в Beads** (`bd close <id>`).
**Шаг 3 — Зафикси недочёты как новые задачи** (`bd create`).
**Шаг 4 — Синхронизируй** (`git push`, `bd dolt push`).
**Шаг 5 — Финализируй PR** (`/finalize-pr <PR_NUMBER>`).
```

Новая секция §2.5:
```
### 2.5 Landing the Plane (pre-merge, ОБЯЗАТЕЛЬНО перед операторским merge)

> ⛔ Спринт НЕ merge-ready, пока все шаги ниже не выполнены В ТОЙ ЖЕ ВЕТКЕ PR.

> **История (v3.4):** до v3.4 landing выполнялся post-merge в отдельной ветке
> `chore/landing-pr-N` с отдельным PR. Это создавало второй merge без safety value
> (между первым /finalize-pr и merge код не менялся). С v3.4 landing делается
> inline-в-ветке PR между первым /finalize-pr APPROVED и operator merge.

**Контекст:** `/finalize-pr <PR_NUMBER>` опубликовал первый `## ✅ Готов к merge`.
Ветка PR на HEAD с APPROVED review-pass. Оператор ещё не мержил.

**Шаг 1 — Обнови Memory Bank** inline-в-ветке PR:
- `.memory_bank/status.md` — новый спринт помечен `COMPLETE <finalize_date>`,
  где `<finalize_date>` = дата первого APPROVED `/finalize-pr` (не дата merge).
- `systemPatterns.md`, `productContext.md` — при необходимости.

**Шаг 2 — Архивируй план:** `git mv docs/plans/<sprint>.md docs/archive/`
(если план ещё не в archive).

**Шаг 3 — Закрой задачи в Beads:** `bd close <id>` для sprint tracking + task issues
с явным reason (результат, commit hash).

**Шаг 4 — Запиши memory pattern:** `bd remember "Sprint N завершён <finalize_date>:
<key learnings>"` — формулировка `завершён <finalize_date>`, не `<merge_date>`.
Рациональ: финализация = момент закрытия цикла, не момент административного действия
оператора. Существующие sprint-1..5 memories остаются как исторические (merge_date).

**Шаг 5 — Commit и push:**
```
git add .memory_bank/ docs/archive/
git commit -m "chore(landing): pre-merge artifacts — sprint-N"
git push
```

**Шаг 6 — Doc-only review round** (штатный Copilot auto-review, Claude delta
self-review если изменения в .md — ожидаемый tier: Light).

**Шаг 7 — Финализируй PR повторно:** `/finalize-pr <PR_NUMBER>` на новом HEAD
(с landing commit). Skill re-check HEAD (Фаза 1 шаг 1 + race-protection re-check
перед публикацией) подтвердит новый SHA — это штатный dual-invocation pattern
(см. `.claude/skills/finalize-pr/SKILL.md`).

**Шаг 8 — Сообщи оператору** что PR на текущем HEAD готов к merge, landing artifacts
уже внутри.

**Запрещено в v3.4:**
- Создавать отдельную ветку `chore/landing-pr-N` и PR для landing artifacts.
- Делать landing после operator merge (status.md будет на master поздно).
- Коммитить landing artifacts в master напрямую (инвариант: merge — только оператор).
```

### P2. Обновление `.claude/skills/sprint-pr-cycle/SKILL.md` (VC-2)

**Цель:** между Фазой 4 (`/finalize-pr`) и «Сообщи оператору» добавить Фазу 4.5 Pre-merge Landing.

Текущая Фаза 4 заканчивается:
```
После публикации — сообщи оператору: «Опубликован финальный комментарий в PR #<N>. Решение о merge — за тобой.»
```

Вставить **перед** этой строкой новую Фазу 4.5:
```
## Фаза 4.5: Pre-merge Landing (ОБЯЗАТЕЛЬНО после первого /finalize-pr APPROVED)

> ⛔ Landing artifacts (status.md update, plan archive, bd close, memory entry)
> **обязаны быть в ветке PR до merge**. Отдельный `chore/landing-pr-N` PR
> запрещён с v3.4 — это убирает bureaucratic toil без safety value.

После успешной публикации `## ✅ Готов к merge` PM выполняет в **той же ветке**:

### Шаг 4.5.1: Обновление Memory Bank
- `.memory_bank/status.md` — спринт помечен `COMPLETE <finalize_date>` (дата этого `/finalize-pr`).
- При необходимости — `systemPatterns.md` / `productContext.md`.

### Шаг 4.5.2: Архивация плана
```bash
git mv docs/plans/<sprint>.md docs/archive/
```
(если план был в `docs/plans/`).

### Шаг 4.5.3: Закрытие beads
```bash
bd close <sprint-tracking-id>    # с reason: "pre-merge landing in PR #<N> via commit <SHA>"
bd close <task-issue-id>         # с reason: "pre-merge landing in PR #<N> via commit <SHA>"; task, который инициировал спринт
```

### Шаг 4.5.4: Memory pattern
```bash
bd remember "Sprint N завершён <finalize_date>: <1-line summary + key decisions>"
```
Используй именно `завершён <finalize_date>`, **не** `<merge_date>` — см.
`PM_ROLE.md §2.5` рациональ.

### Шаг 4.5.5: Commit + push
```bash
git add .memory_bank/ docs/archive/
git commit -m "chore(landing): pre-merge artifacts — sprint-N"
git push
```

### Шаг 4.5.6: Doc-only review round
Copilot автоматически стартует — прочитай его комментарии. Tier обычно Light
(только .md). Если zero findings — достаточно PM delta self-review как единого
internal review-pass с `iteration: N+1, tier: light`.

### Шаг 4.5.7: Повторный /finalize-pr

```
/finalize-pr <PR_NUMBER>
```

Skill обнаружит новый HEAD (landing commit) — это штатный **dual-invocation
pattern**. Hard gate прогонит все проверки заново на новом SHA:
- `/verify` зелёный на landing commit
- internal review-pass на landing commit (от шага 4.5.6)
- external review-pass на landing commit (для Sprint Final — если был повторный
  запуск; обычно degradation-аргумент: изменения чисто документация, operator
  может принять Mode B/C для doc-only delta)

Если второй `/finalize-pr` APPROVED → сообщи оператору что PR merge-ready,
**landing уже внутри, POST-merge шагов у PM нет**.

### Dogfood-замечание
Этот pattern впервые применён в `sprint-pipeline-v3-4-pre-merge-landing` —
см. `docs/archive/sprint-pipeline-v3-4-pre-merge-landing.md` как эталонный
пример.

## Фаза 5: Сообщение оператору
```
(и дальше текущий текст «Опубликован финальный комментарий…»)

### P3. Обновление `.claude/skills/finalize-pr/SKILL.md` (VC-3)

**Цель:** документировать, что второй вызов на новом HEAD (после landing commit) — штатный режим, не ошибка.

В конце раздела `## Re-check HEAD перед публикацией (защита от race condition)` (после текущего блока) добавить подраздел:

```
### Dual-invocation pattern (pre-merge landing, v3.4+)

> С v3.4 skill вызывается **дважды** за жизненный цикл PR Sprint Final:
>
> 1. Первый вызов — на HEAD после review cycle. Hard gate APPROVED →
>    публикация первого `## ✅ Готов к merge`.
> 2. PM в той же ветке делает `chore(landing):` commit (status.md + plan archive
>    + bd close + memory entry — см. `sprint-pr-cycle/SKILL.md` Фаза 4.5).
>    HEAD меняется.
> 3. Второй вызов — на новом HEAD (landing commit). Hard gate прогоняется
>    заново; existing HEAD re-check (шаг 1 + protection re-check перед публикацией)
>    корректно обрабатывает смену SHA.
>
> Второй вызов требует **свежего review-pass** на landing commit — это
> Фаза 4.5.6 в sprint-pr-cycle (doc-only Light tier review).

Skill поддерживает dual-invocation **без специальной логики**: каждый запуск
строит hard gate с нуля от `HEAD_COMMIT = gh pr view --json headRefOid`. Если
ветка сменила HEAD между вызовами — второй запуск видит новый commit как
«текущий», все 5 шагов (verify + internal + external + triage + re-check)
работают штатно.

**Что это НЕ означает:**
- НЕ означает, что skill должен «запомнить» первый вызов. Второй запуск
  идемпотентен в смысле гейта, не в смысле state.
- НЕ означает, что landing commit освобождает от external review для
  Sprint Final. Если tier = sprint-final, external review обязателен **и на
  landing HEAD тоже** (хотя изменения чисто документация, допустима degraded
  Mode B/C с operator-approved rationale).

См. `.claude/skills/sprint-pr-cycle/SKILL.md` Фаза 4.5 для полного flow
landing commit.
```

### P4. Memory pattern в `PM_ROLE.md` (VC-4)

**Цель:** зафиксировать новую формулировку `<finalize_date>` с исторической ссылкой.

Это уже частично сделано в P1 (Шаг 4 новой §2.5). Проверить, что формулировка явная и не содержит противоречий.

### P5. Инвариант 8 v3.4 в `/pipeline-audit` (VC-5)

**Цель:** расширить таблицу 7 → 8 инвариантов.

В `.claude/skills/pipeline-audit/SKILL.md` Шаг 2 таблица — добавить строку:

```
| 8 | Sprint не создаёт отдельный `chore/landing-pr-N` PR после merge. Landing commit коммитится в ветку Sprint PR между первым `/finalize-pr APPROVED` и merge (pre-merge landing, v3.4) | `PM_ROLE.md §2.5`, `sprint-pr-cycle/SKILL.md Фаза 4.5`, `finalize-pr/SKILL.md Dual-invocation` |
```

Также в финальном отчёте (Шаг 7) обновить:
```
Инвариантов: 7/7 ✅ → Инвариантов: 8/8 ✅
```

### P6. Verify (VC-7)

```bash
npm run build && npm test
```

### P7. PR creation

```bash
git push -u origin sprint-pipeline-v3-4-pre-merge-landing
gh pr create --title "feat(pipeline): Sprint v3.4 — pre-merge Landing the Plane protocol" \
  --body "$(cat <<'EOF'
Tier: Sprint Final

## Summary
- Перенос Landing the Plane в pre-merge фазу (inline-в-ветке PR).
- Убран отдельный `chore/landing-pr-N` — был bureaucratic toil без safety value (оператор не делает ручное ревью → второй merge избыточен).
- Новый инвариант 8 v3.4 в `/pipeline-audit`.
- Memory pattern: `Sprint N завершён <finalize_date>` (не `<merge_date>`).
- Dogfood: этот sprint — первый под v3.4 (landing commit в эту же ветку между первым и вторым /finalize-pr).

## Issues
- `big-heroes-cfn` — task issue (pre-merge landing protocol).
- `big-heroes-sz4` — sprint tracking.

## Verification Contract
См. `docs/plans/sprint-pipeline-v3-4-pre-merge-landing.md` — VC-1..VC-8.

## Test plan
- [ ] /verify (build + tests)
- [ ] /pipeline-audit (8/8)
- [ ] Tester gate (Critical class = pipeline-artifacts)
- [ ] Claude Reviewer Pass 1 + Pass 2
- [ ] Sprint Final /external-review (Mode C degraded expected due to BE-11)
- [ ] /finalize-pr (первый)
- [ ] Pre-merge landing commit (dogfood)
- [ ] /finalize-pr (второй, новый HEAD)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

— PM (Claude Opus 4.7)
EOF
)"
```

### P8. Review cycle (Critical + Sprint Final)

1. **Tester gate** — класс `pipeline-artifacts` (PM_ROLE.md + SKILL.md изменения).
2. **Claude Reviewer Pass 1** — все 4 аспекта. Фокус: архитектурная согласованность между тремя артефактами (PM_ROLE §2.5, sprint-pr-cycle Фаза 4.5, finalize-pr dual-invocation).
3. **PM triage** — fix-now / defer / reject.
4. **Claude Reviewer Pass 2** — adversarial, регрессии.
5. **Sprint Final `/external-review`** — Mode C ожидаемый (BE-11 блокирует Codex CLI Windows sandbox).
6. **`/finalize-pr` первый** — APPROVED на commit X.
7. **Pre-merge landing commit** (dogfood VC-8) — в этой же ветке:
   - status.md: Sprint v3.4 `COMPLETE <finalize_date>`
   - `git mv docs/plans/sprint-pipeline-v3-4-pre-merge-landing.md docs/archive/`
   - `bd close big-heroes-sz4`, `bd close big-heroes-cfn`
   - `bd remember "Sprint v3.4 завершён <finalize_date>: pre-merge landing protocol — убран chore/landing-pr-N, инвариант 8 в pipeline-audit, dogfood first-use"`
   - `chore(landing): pre-merge artifacts — sprint-pipeline-v3-4` + push
8. **Doc-only review round** на landing commit (Copilot + Claude delta).
9. **`/finalize-pr` второй** — на новом HEAD Y = APPROVED.
10. **Сообщение оператору** → оператор мержит → Sprint 100% закрыт одним merge.

---

## Риски и митигации

| # | Риск | P×I | Митигация |
|---|------|-----|-----------|
| R1 | BE-11 не fix'ed → Mode A/B невозможен для Sprint Final | High×Medium | Default Mode C degraded с меткой `⚠️ Degraded mode`; прецедент Sprint 5 OK |
| R2 | `$OPENAI_API_KEY` 401 in-situ | High×Low | Mode C не требует ключа; попытка in-situ probe, fallback на Mode C |
| R3 | Второй `/finalize-pr` падает из-за missing external review на landing commit | Med×High | Для Sprint Final hard gate требует external review на каждом HEAD — skip недопустим. В Фазе 4.5.6 прямая инструкция: PM обязан запустить повторный `/external-review` на landing commit. Допустима degradation (Mode B/C/D с меткой Degraded + rationale), но не skip. Для tier ≠ Sprint Final — external опционален. |
| R4 | Конфликт landing commit с in-flight operator merge | Low×High | Landing commit делается сразу после первого `/finalize-pr`, до operator-взаимодействия. Инструкция оператору: «не мерджи до второго `/finalize-pr`» в первом `## ✅ Готов к merge` |
| R5 | Drift между PM_ROLE.md, sprint-pr-cycle SKILL.md, finalize-pr SKILL.md | Med×High | `/pipeline-audit` c инвариантом 8 отлавливает; все три артефакта правятся атомарно в одном PR |
| R6 | Existing PR Sprint 5 memory pattern перезаписан | Low×Low | Инструкция явно: «sprint-1..5 memories остаются как исторические, новый pattern для v3.4+» |

---

## Критические файлы

| Путь | Роль в спринте |
|------|----------------|
| `.agents/PM_ROLE.md` | P1 — переписать §2.5 + memory pattern (VC-1, VC-4) |
| `.claude/skills/sprint-pr-cycle/SKILL.md` | P2 — добавить Фазу 4.5 (VC-2) |
| `.claude/skills/finalize-pr/SKILL.md` | P3 — добавить Dual-invocation pattern (VC-3) |
| `.claude/skills/pipeline-audit/SKILL.md` | P5 — добавить инвариант 8 (VC-5); P9 — расширить files list инварианта 8 на operator-facing (VC-9) |
| `docs/plans/sprint-pipeline-v3-4-pre-merge-landing.md` | этот файл (архивируется в P-landing) |
| `.memory_bank/status.md` | landing artifact (обновляется pre-merge) |
| `.agents/HOW_TO_USE.md` | P9 (post-GPT-5.4 external review) — синхронизировать operator-facing инструкцию с dual-invocation flow (VC-9) |
| `.agents/PIPELINE.md` | P9 — обновить flow diagram (landing шаг между двумя /finalize-pr) (VC-9) |

---

## Developer checklist (executable)

```
[ ] P0 план на месте (этот файл)
[ ] P1 .agents/PM_ROLE.md §2.5 переписан — grep "pre-merge" ≥ 2 hits; старое post-merge описание removed
[ ] P1 .agents/PM_ROLE.md memory pattern <finalize_date> с исторической сноской
[ ] P2 .claude/skills/sprint-pr-cycle/SKILL.md — Фаза 4.5 добавлена между /finalize-pr и "Сообщи оператору"
[ ] P3 .claude/skills/finalize-pr/SKILL.md — секция "Dual-invocation pattern" добавлена
[ ] P5 .claude/skills/pipeline-audit/SKILL.md — таблица инвариантов расширена до 8 строк
[ ] P5 .claude/skills/pipeline-audit/SKILL.md — финальный отчёт "Инвариантов: 8/8"
[ ] P6 /verify (npm run build + npm test) exit 0
[ ] P7-prep VC-1..VC-7 executable checks — все PASS с evidence в PR body
[ ] P7 git push -u origin sprint-pipeline-v3-4-pre-merge-landing
[ ] P7 gh pr create --title ... --body с Tier: Sprint Final
[ ] P8 PM запускает Tester (Critical/pipeline-artifacts класс)
[ ] P8 Reviewer Pass 1 → triage → Pass 2 → APPROVED
[ ] P8 /external-review → Mode C expected (BE-11) → APPROVED с меткой Degraded
[ ] P8 /finalize-pr #N (первый) → APPROVED
[ ] P8-DOGFOOD pre-merge landing commit (status.md + archive + bd close + bd remember)
[ ] P8-DOGFOOD push → doc-only review round
[ ] P8 /finalize-pr #N (второй на новом HEAD) → APPROVED
[ ] POST оператор мержит → Sprint полностью закрыт одним merge (no chore/landing-pr-N)
```

---

## Verification (после merge в master)

1. **Regression spot-check:** в `.agents/PM_ROLE.md` нет **императивной инструкции** создавать отдельную ветку/PR вида `chore/landing-pr-N`; допустимы нарративные/описательные/запретительные упоминания (в блоках «История (v3.4)» и «Запрещено в v3.4»). Проверка: `grep -nE "созда(й|те|ть|вать|йте).{0,80}chore/landing-pr|chore/landing-pr.{0,80}созда(й|те|ть|вать|йте)" .agents/PM_ROLE.md` → 0 hits. Regex намеренно не включает «создавало» (past narrative) и «отдельный PR» (описательное) — они допустимы в историческом/запретительном контексте.
2. **Следующий спринт smoke-test:** когда PM планирует следующий спринт (скорее всего game-sprint), он должен применить Фазу 4.5 и не создавать `chore/landing-pr-N`.
3. **Pipeline-audit самопроверка:** `/pipeline-audit` на post-merge HEAD → `Инвариантов: 8/8 ✅`.
4. **Memory pattern:** `bd memories sprint-v3-4` показывает новую запись с `завершён <finalize_date>`.
5. **PR structure:** merged PR содержит **один** merge commit (Sprint + landing вместе), нет child PR `chore/landing-pr-<N>`.
