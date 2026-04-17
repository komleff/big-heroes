# Статус проекта Big Heroes

**Обновлён:** 2026-04-17
**Фаза:** Sprint Pipeline v3.3 — PR [#9](https://github.com/komleff/big-heroes/pull/9) в процессе ревью (ветка `claude/agent-pipeline-sprint-mxaQ1`)
**last_reviewed_commit:** 9c6ab61 (round 31 Copilot COMMENTED 2 findings: 1 CRITICAL + 1 WARNING — fix now в этом коммите)

> Семантика `last_reviewed_commit`: HEAD, на который есть опубликованный внешний review-verdict. Это НЕ `git rev-parse HEAD` ветки — текущий HEAD всегда впереди на один fix-коммит, пока round не закрыт следующим reviewer'ом. Self-reference невозможен, поэтому формат drift-free.
> Текущий HEAD ветки проверяй через `git rev-parse HEAD` или `gh pr view 9 --json headRefOid`.

---

## Текущее состояние

### Sprint Pipeline v3.3 (активный)

Реализация утверждённого плана `.agents/pipeline-improvement-plan-v3.3.md`.
Ветка: `claude/agent-pipeline-sprint-mxaQ1`.
Документы `.agents/` обновлены оператором вручную в коммите `f1f9b1c` (1573 → 1778 строк).
Скиллы и агенты — серия атомарных коммитов, по одному на каждый шаг плана.

**Сделано (шаги 1–12 плана v3.3):**
1. `/verify` как единый gate в `sprint-pr-cycle` (a846d27).
2. Reviewer возвращает findings, PM публикует — инвариант 2 (6510348).
3. External-review: режимы C (Claude adversarial degraded) и D (manual emergency через Copilot Agent), collapsible raw output (db6d4e7).
4. Новый скилл `/pipeline-audit` — антивирус против drift документов (6fd9872).
5. Новый скилл `/finalize-pr` фаза 1 — hard gate с commit binding (72693ea).
6. Hook в `settings.json` блокирует ручное «ready to merge» вне `/finalize-pr` (2f974be).
7. Verification Contract обязателен в плане Planner (738d9ed).
8. Reviewer enforcement Verification Contract в аспекте «Качество» (4ccbf3c).
9. Tier-логика и Tester gate для Critical в `sprint-pr-cycle` (74c56a1).
10. `/finalize-pr` фаза 2 — triage-проверки (Beads ID, defer-abuse warning) (231d545).
11. Reviewer возвращает META для JSON-метаданных PM (regressions, reopened) (6de6d01).

**Закрытые DOCS-issues:**
- big-heroes-z3l (P1) — Sprint Final gate в PM_ROLE.md → решено через `/finalize-pr` + явное упоминание в `PM_ROLE.md` секция 2.4 (обновлено оператором).
- big-heroes-6bs (P1) — конфликт владения review-pass → reviewer.md переведён на findings-only режим, PM единый владелец.
- big-heroes-e0n (P2) — sprint-pr-cycle Critical review level → добавлена tier-логика + tester gate.
- big-heroes-fkv (P2) — split source of truth → AGENT_ROLES.md, PM_ROLE.md, PIPELINE.md, HOW_TO_USE.md, sprint-pr-cycle и reviewer/planner согласованы.

**Текущий review-цикл (PR #9 открыт):**
- Раунды 1–14: закрыто ~40 CRITICAL/WARNING от Copilot + GPT-5.4 + Codex.
- Round 15 (2026-04-16, 89ece50): GPT-5.4 CHANGES_REQUESTED — 3 WARNING закрыты fix now (blockquote false positive в hook, Planner-drift в pipeline-audit, stale status.md).
- Round 16 (2026-04-16, 8226e5b): GPT-5.4 CHANGES_REQUESTED — 1 CRITICAL + 1 WARNING закрыты fix now (cross-platform hook wrapper `py`→`python3`→`python`, Verification Contract T1 55/55).
- Round 17 (2026-04-16, b9a7a8d): GPT-5.4 CHANGES_REQUESTED — 1 WARNING закрыто fix now (status.md reopened от round 15).
- Round 18 (2026-04-16, ef4030d): GPT-5.4 CHANGES_REQUESTED — 1 WARNING закрыто fix now (status.md:5,37 снова reopened).
- Round 19 (2026-04-16, ef4030d): GPT-5.4 CHANGES_REQUESTED — 1 WARNING корневая причина цикла: `last_checked_commit` ссылалось на HEAD ветки (self-reference). Переформулировано в `last_reviewed_commit` = последний HEAD с review-verdict. Drift-free by format.
- Round 19.5 (62d7ce1): GPT-5.4 APPROVED после format-level fix — цикл разорван. Pipeline-audit на 62d7ce1: ✅ OK (0 drift).
- Round 20 (2026-04-17, 62d7ce1): Copilot COMMENTED — 5 findings закрыты fix now в ca6bfc8: (1) CRITICAL hook bypass через literal `<<TOKEN` вне heredoc-присваивания, (2–5) 4 WARNING по pipeline-audit и sprint-pr-cycle.
- Round 21 (2026-04-17, ca6bfc8): Copilot COMMENTED — 3 findings закрыты fix now в 858b5ea: (1) CRITICAL alien-heredoc bypass (`_HEREDOC_PRESENT` снимал opaque-block при heredoc для другой переменной; заменён на `_body_var_has_heredoc` + `_BODY_DIRECT_HEREDOC_CAT`), (2) WARNING regression-тесты (+4 кейса, suite 62/62), (3) WARNING pipeline-audit step 1 не собирал hooks (добавлен `ls -1 .claude/hooks/*.py`). GPT-5.4 Standard APPROVED на ca6bfc8 (дополнительный, не заменяет Critical).
- Round 22 (2026-04-17, 858b5ea): GPT-5.4 Critical APPROVED + Copilot COMMENTED — 4 findings закрыты fix now в e4f7714: (1) CRITICAL punctuation bypass (`.!?` после фразы обходил regex-терминатор; добавлен `[.!?]`), (2) WARNING regression-тесты (+6 EN/RU, suite 68/68), (3) WARNING `$ITERATION` не задавался в sprint-pr-cycle (добавлено вычисление через `gh pr view --jq`), (4) WARNING external-review codex login status без timeout (добавлен `timeout 15`).
- Round 23 (2026-04-17, e11e44f): GPT-5.4 Critical APPROVED + Copilot COMMENTED — 2 findings закрыты fix now: (1) WARNING external-review шаблон C/D placeholder `[Degraded mode / Manual emergency mode]` не матчится `/finalize-pr` — заменён на явные строки с HTML-комментарием-инструкцией, (2) WARNING `$MODEL_NAME`, `$MODE`, `$ITERATION` не вычислялись перед подстановкой — добавлены null-guards и fallback.
- Round 24 (2026-04-17, 96b8847): Copilot COMMENTED — 4 findings: (1) WARNING `_OPAQUE_VAR_BODY` не ловил concatenation `--body "Prefix: $BODY"` — fix now: regex расширен на любую позицию $VAR + 5 regression-тестов (suite 73/73), (2) WARNING `FINALIZE_PR_TOKEN` honor-system — reject: design trade-off, (3) WARNING external-review HEAD_COMMIT без null-guard — fix now: добавлен `[[ -z || null || !regex ]]` + exit 1, (4) WARNING external-review MODE/MODEL_NAME нет auto-computation — defer: round 23 guards sufficient.
- Round 25 (2026-04-17, 2d4cfe4): Copilot COMMENTED — 1 finding: WARNING external-review mode labels активны по умолчанию — fix now: обе `⚠️` строки перенесены в HTML-комментарий, чтобы PM добавлял явно только для C/D.
- Round 26 (2026-04-17, 00ef44e): Copilot COMMENTED — 1 finding: WARNING finalize-pr grep `⚠️` матчится на неактивные метки внутри HTML-комментария — fix now: добавлен `sed '/<!--/,/-->/d'` для стрипа HTML-комментариев перед grep.
- Round 27 (2026-04-17, 5e9feaa): Copilot COMMENTED — 4 findings: (1) WARNING `_OPAQUE_COMMAND_SUBST_BODY` не ловил `$(` в неначальной позиции body — fix now: regex расширен аналогично round 24, (2) WARNING regression-тесты для cmd-subst prefix — fix now: +4 кейса (suite 77/77), (3) WARNING external-review MODE/MODEL_NAME auto-computation — defer (повтор round 24 #4), (4) WARNING status.md stale header — fix now.
- Round 28 (2026-04-17, 4c2fce9): Copilot COMMENTED — 1 finding: WARNING `is_forbidden()` не нормализовал zero-width символы и HTML entities — fix now: добавлены `html.unescape()` + strip `\u200b-\u200f`, `\u2028-\u202f`, `\ufeff`, `\u00ad`, `\u2060` + 4 regression-теста (suite 81/81).
- Round 29 (2026-04-17, 4cc8a3a): Copilot COMMENTED — 3 findings: (1) WARNING finalize-pr Tier detect в code block — defer (requires markdown parser), (2) WARNING finalize-pr triage rows без статуса — defer (structural validation), (3) WARNING reviewer.md `|` в ячейках ломает IFS-парсинг — fix now: добавлено предупреждение в docs.
- Round 30 (2026-04-17, f8c4d9f): Copilot COMMENTED — 2 findings: (1) WARNING finalize-pr iteration>=2 только для critical, не sprint-final — defer (design trade-off, operator decision), (2) WARNING finalize-pr bd show без timeout — fix now: обёрнуто в timeout 10 с fail-secure exit.
- Round 31 (2026-04-17, 9c6ab61): Copilot COMMENTED — 2 findings закрыты fix now в этом коммите: (1) **CRITICAL** editor-mode bypass (`gh pr comment <N>` без `--body`/`-b` открывает редактор, `--edit-last` тоже — содержимое скрыто от hook'а; добавлены `uses_edit_last()` и `uses_no_body()` с fail-secure блокировкой вне FINALIZE_PR_TOKEN), (2) WARNING отсутствие regression-тестов editor-mode — fix now: +6 кейсов (suite 87/87).

**Что осталось оператору:**
- Ожидать re-review от Copilot на новый HEAD (round 31 запрашивается).
- При Copilot APPROVED → повторное GPT-5.4 Critical ревью на том же HEAD для двух APPROVED → `/pipeline-audit` → `/finalize-pr 9`.

### Sprint 4 (предыдущий, MERGED)

Sprint 4 реализован, PR #8 — MERGED. 20+ коммитов, 168 тестов.
Ревью: 3 pass Claude (APPROVED), 9 pass Copilot, 5 pass GPT-5.4.
9 CRITICAL + 13 WARNING найдено и исправлено.

**Реализовано в Sprint 4:**
- EventSystem (shared): resolveEventOutcome + proc_chance — баг жертвы предмета исправлен
- RelicReplaceOverlay + addRelicWithUI — UI замены реликвий при max=3
- PveResultScene: единый экран boss extraction (1 relic + 2 items)
- PvP Arena MVP: PvpLobbyScene, 3 AI-бота, arenaRelic бонусы, Elo рейтинг
- PvpSystem (shared): generateBots + calcPvpMassLoss
- Авто-экипировка лута (autoEquipIfBetter)
- Сломанное снаряжение удаляется из слота (R9)
- UX: предупреждение о поломке, PvP defeat оверлей, параметры героя в лобби
- R9-R12 задокументированы в architecture.md

**Закрытые issues Sprint 4:**
- big-heroes-03b (P1 BUG) — событие жертвы → гарантированный сундук
- big-heroes-ne5 (P2 TECH) — proc_chance в конфиге
- big-heroes-qnb (P1 UX) — UI замены реликвий
- big-heroes-n97 (P1 UX) — единый экран boss extraction
- big-heroes-u1z (P2 UX) — boss даёт 2 items
- big-heroes-h24 (P1 FEATURE) — arenaRelic в PvP
- big-heroes-ijf (P2 BUG) — уже исправлен
- big-heroes-3nc (P1 FEATURE) — сломанное снаряжение удаляется
- big-heroes-5gd (P1 FIX) — PvP mass loss только при defeat
- big-heroes-5jk (P1 FIX) — bypass в PvE не застревает

## Дизайн-решения (НЕ откатывать)

- PvE = граф (Slay the Spire), нет линейной цепочки
- Нет промежуточного экрана "ВОЙТИ" после выбора на развилке
- ensureForkPaths смотрит на ТЕКУЩИЙ узел
- handleForkChoice записывает тип в currentIdx → enterNode напрямую
- Ремонт только в лагере, не в магазине
- Retreat: остаётся на текущем узле, ensureForkPaths перегенерирует
- **R9:** Сломанное снаряжение удаляется из слота (durability=0 → null)
- **R10:** Авто-экипировка лута (пустой слот или лучше; старый в походный рюкзак, теряется при defeat)
- **R11:** PvP Elo только victory/defeat, остальное = 0
- **R12:** Bypass PvE без лута (только продвижение)

## Открытые issues (26)

### P1 (3):
| ID | Описание |
|----|----------|
| big-heroes-tgr | PvP-арена как поход — серия боёв до лиги или поражения |
| big-heroes-tqh | generateRoute — дубли типов на развилках |
| big-heroes-bfv | походные расходники — на перекрёстке да, в бою нет |
| ~~big-heroes-z3l~~ | ~~DOCS: PM_ROLE.md — нет Sprint Final gate~~ — **CLOSED** Sprint Pipeline v3.3 |
| ~~big-heroes-6bs~~ | ~~DOCS: PM_ROLE.md — конфликт владения review-pass~~ — **CLOSED** Sprint Pipeline v3.3 |

### P2 (15):
| ID | Описание |
|----|----------|
| big-heroes-91e | UX: экран поражения Арены — показать потерю массы |
| big-heroes-bb0 | UX: очки арены (+1/+2/+3) после победы |
| big-heroes-2lw | UX: событие обмена — показать какой предмет |
| big-heroes-cwp | UX: лагерь — «нет снаряжения» вместо «всё в порядке» |
| big-heroes-o2v | UX: реликвия reveal_all — зачёркнутый ??? + название |
| big-heroes-d56 | chest рядом с ancient_chest |
| ~~big-heroes-e0n~~ | ~~DOCS: sprint-pr-cycle Critical review level~~ — **CLOSED** Sprint Pipeline v3.3 |
| ~~big-heroes-fkv~~ | ~~DOCS: HOW_TO_USE split source of truth~~ — **CLOSED** Sprint Pipeline v3.3 |
| big-heroes-24s | tierBoosted → реальный tier+1 |
| big-heroes-5yi | PvE seed — Date.now |
| big-heroes-7ix | setHp() → shared |
| big-heroes-8y2 | Block Draw (ничья 15%) |
| big-heroes-dhi | client scene-level тесты |
| big-heroes-q6m | бизнес-логика PvE → shared |
| big-heroes-4l2 | dry-run external-review |

### P3 (6):
| ID | Описание |
|----|----------|
| big-heroes-1l7 | iconColor не используется |
| big-heroes-5sg | Layout хардкод |
| big-heroes-70l | Graphics утечки |
| big-heroes-a3h | Premium pill placeholder |
| big-heroes-kuq | generateForkPaths дублирует generateRoute |
| big-heroes-y1o | applyBattleResult → RelicSystem |
