# Статус проекта Big Heroes

**Обновлён:** 2026-04-22
**Фаза:** **Sprint Pipeline v3.6 Mode A Native — PR [#17](https://github.com/komleff/big-heroes/pull/17) ✅ COMPLETE 2026-04-22** (pre-merge finalize на commit `0a35b9a`, Правка 1 реализована: Node.js native OpenAI review tool заменил Codex CLI подпроцесс; правки 2–7 → отдельные PR). Предыдущие: Sprint Pipeline v3.5 Cleanup after v3.4 (PR [#15](https://github.com/komleff/big-heroes/pull/15)) COMPLETE 2026-04-21 ожидает merge + Sprint Pipeline v3.4 Pre-Merge Landing (PR [#14](https://github.com/komleff/big-heroes/pull/14)) MERGED 2026-04-19 + Sprint 5 Codex Auth (PR [#12](https://github.com/komleff/big-heroes/pull/12)) MERGED + PR [#13](https://github.com/komleff/big-heroes/pull/13) chore/landing-pr-12 MERGED + Sprint Pipeline v3.3 (PR [#9](https://github.com/komleff/big-heroes/pull/9)) MERGED + PR [#10](https://github.com/komleff/big-heroes/pull/10) infra fix MERGED.
**Base master HEAD:** `d3dab6b` (base для v3.6 pre-merge) · План архивирован **на HEAD ветки PR** в `docs/archive/sprint-pipeline-v3-6-mode-a-native.md` (ещё не в master до merge).

## Sprint v3.6 Mode A Native (Правка 1) итог (COMPLETE 2026-04-22, первый финализирующий /finalize-pr --pre-landing на `0a35b9a`)

- Tracking: `big-heroes-95c` (sprint), `big-heroes-59z` (Правка 1) — закроются после merge.
- Цель: заменить подпроцесс Codex CLI на native Node.js-скрипт, обращающийся к OpenAI API напрямую через SDK, и убрать зависимость от BE-11 Windows sandbox. Две полноразмерные модели разных архитектур (gpt-5.4 chat.completions reasoning:high + gpt-5.3-codex responses reasoning:high) запускаются параллельно для adversarial diversity.
- **Dogfood (второй sprint под v3.4 pre-merge landing flow + первый под Mode A native):** Mode A прогнан два раза подряд на сам PR (первый — на `4dafb08`, после cycle фиксов — на `0a35b9a`). Landing commit этим самым commit message в ветке PR.
- Артефакты:
  - `.claude/tools/openai-review.mjs` (~580 LoC) — native review-инструмент с runtime allowlist, endpoint dispatch, validateOutputFormat (Cyrillic-safe regex), exitDeferred (libuv workaround Windows Node 24), classifyApiError, buildUserPrompt с BEGIN_DIFF/END_DIFF маркерами, explicit refspec fetch.
  - `.claude/tools/package.json` + `package-lock.json` — OpenAI SDK 6.34.0 pinned, Node ≥18.17.0.
  - `.claude/tools/smoke-test.mjs` — 5 offline CLI тестов (T1–T5), cwd-independent через `git rev-parse --show-toplevel`.
  - `.claude/tools/README.md` — установка/диагностика/exit-codes/allowlist.
  - `.claude/skills/external-review/SKILL.md` — полностью переписан под Mode A как основной режим; Codex CLI остался как A-legacy fallback; Mode B (ChatGPT OAuth) удалён.
  - `.claude/skills/pipeline-audit/SKILL.md` — 3.5 Режимы (v3.6+: A / C / D + A-legacy, B deprecated), 3.6 Инварианты Правки 1.
  - `.agents/CODEX_AUTH.md` — deprecation note.
  - `.gitignore` — `.review-responses/` для артефактов.
- Review cycle (18 Copilot rounds + 21 internal passes + 6 external Mode A на двух моделях):
  - Copilot auto-review 18 rounds: все fix-now закрыты (последний round 18: 2 fix-now — docs + smoke cwd; 3-й — отложен `big-heroes-eful`).
  - Internal Claude 21 passes: 20 финализирующий на `4dafb08` APPROVED с defer; 21 adversarial second pass на `0a35b9a` APPROVED с defer (два runtime-бага закрыты: Cyrillic regex + libuv exit assert).
  - External Mode A: первые dogfood-прогоны на `4dafb08` дали CHANGES_REQUESTED (trust-boundary) + обнаружили 2 runtime-бага через parallel adversarial diversity; после фикса на `0a35b9a` — те же known-deferred + 1 новый P3 (git fetch race в параллели) → pending bd restore.
  - Triage iteration 21: 0 fix-now, 5 defer, 0 reject. Регрессий 0.
- Convention change: Mode A — прямой вызов OpenAI API через `.claude/tools/openai-review.mjs`. Codex CLI удалён из обязательного пути, оставлен в A-legacy. `--pre-landing` / landing commit / second `/finalize-pr` паттерн сохранён.
- Deferred Beads (5 items):
  - `big-heroes-iyuo` P1 — supply-chain trust boundary (tool из PR checkout с доступом к ключу). Bootstrap-ограничение первого PR с tool в master; полное разделение — следующим PR.
  - `big-heroes-xe4e` P2 — contract-тесты (endpoint dispatch / validateOutputFormat / git flow / API-errors).
  - `big-heroes-gijq` P3 — SSOT для allowlist/режимов/endpoint (дублирование README / SKILL / план).
  - `big-heroes-eful` P2 — 6 polish замечаний Copilot round 16–17.
  - Новый P3 pending bd restore — `git fetch` race при параллельном запуске двух ревьюеров в одну `refs/remotes/origin/<base>`.
- Ранее deferred (v3.6-sprint-scope, ожидают merge для закрытия):
  - `big-heroes-ig4c` P2 — HTML-escape helper для raw output.
  - `big-heroes-3t44` P3 — уточнение AC6 до <4 сек (после libuv фикса `--ping` стабильно укладывается в ~2 сек).
  - `big-heroes-0obi` P1 — контрольный внешний прогон на текущем HEAD (выполнен этим review-pass).
- ⚠️ **Beads DB warning:** локальная Dolt DB этого worktree потеряна при переключении веток (server up, database `big_heroes` not found on disk). Все беады в Dolt remote `beads-sync`; восстановление — follow-up после merge. Не блокер финализации (hard gate `/finalize-pr` опирается на PR comments).

---

## Sprint v3.5 Cleanup after v3.4 итог (COMPLETE 2026-04-21, первый финализирующий /finalize-pr на `7d1517d`)

- Tracking: `big-heroes-nw5` closed; fix-now tasks `big-heroes-hyo` / `big-heroes-rux` / `big-heroes-ase` / `big-heroes-0pk` closed.
- Цель (Option B после Pass 7 escalation): устранить v3.4 narrative-backtick false positive PR #14 на baseline CommonMark cases + backlog cleanup v3.4-triage beads. Оператор выбрал Option B — accept known limitations + defer systemic Python rewrite strip_code_spans в v3.6 (`big-heroes-55m` P1 sprint-opener).
- **Dogfood (второй sprint под v3.4 pre-merge landing flow):** landing commit в ветке PR между первым /finalize-pr --pre-landing и merge.
- Артефакты:
  - `.claude/skills/finalize-pr/SKILL.md` — Шаг 5 validator интеграция через `strip_code_spans.sh` helper + Known Limitations section (7 deferred items с bead-refs).
  - `.claude/skills/finalize-pr/validators/strip_code_spans.sh` — awk CommonMark stripper 358 LoC (Option B revert: 420→358, removed E-2 multiline scanner Pass 6 overfit).
  - `.claude/skills/finalize-pr/validators/test_validate_review_pass.sh` — 55/55 unit тестов.
  - `.claude/skills/finalize-pr/validators/regression_pr14.sh` — VC-5 regression prove (4/4 APPROVED passed, 1/1 CR blocked).
  - `.claude/hooks/check-merge-ready.py` — terminator class `(Po, Pf)` Option B revert Pe/Pd (source of E-14/E-15 overmatch). 150/150 tests.
  - `.agents/PM_ROLE.md §2.5 Шаг 4` — fenced bd remember block (markdown rendering fix, `big-heroes-hyo`).
  - `docs/archive/sprint-pipeline-v3-4-pre-merge-landing.md:320` — Test plan qualifier `--pre-landing` для первого Sprint Final finalize (`big-heroes-rux`).
- Review cycle (9 internal passes + 6 external Mode A/C + 7 Copilot rounds):
  - Tester gate GATE_PASS (после `;` `…` class coverage delta-fix).
  - Internal Claude: Pass 1 APPROVED, Pass 2 adversarial CR (2 CRITICAL + 1 WARNING CommonMark fences), Pass 3-6 APPROVED, Pass 7 CR escalation (overfitting pattern), Pass 8 delta-closure Option B APPROVED, Pass 9 delta-verify docs-only APPROVED.
  - External: 3 pass Mode A на рабочем Mac (BE-11 блокировал Windows) → Pass 7 escalation → Pass 5 Mode A cross-model на home PC (API key rotation + `sandbox_mode=danger-full-access` обход BE-11) — GPT-5.4 + GPT-5.3-Codex консенсус APPROVED на `ebaf786` → Pass 6 delta-note на `7d1517d`.
  - Triage: ~30 fix-now applied через 7 fix-rounds, 10 defer to Beads (Option B), 5 reject-with-rationale.
- Convention change: BE-11 Windows sandbox обход через `codex review -c sandbox_mode='"danger-full-access"'` — workaround для Mode A на Windows dev-host без WSL. API key rotation 2026-04-20 (старый 401, новый от рабочего аккаунта валидный).
- Deferred Beads (10 items `[from-v3.5-dropped]` → v3.6):
  - `big-heroes-55m` P1 sprint-opener — Python rewrite strip_code_spans (закрывает ≥7 из 10 systemically).
  - `big-heroes-6bp` P2 — structural inline CR survives (theoretical false APPROVED).
  - `big-heroes-36d` P3 — blockquote paragraph terminator.
  - `big-heroes-42a` P3 — setext underline.
  - `big-heroes-zhe` P3 — HTML block.
  - `big-heroes-ytx` P3 — hook Pe/Pd catch-all.
  - `big-heroes-16e` P3 — hook `:` Po overmatch в backtick quoted (Mode A Pass 5 GPT-5.4 rerepro extension).
  - `big-heroes-3ed` P3 — hook `/` `.` Po overmatch в paths/branches.
  - `big-heroes-1mm` P3 — regression_pr14.sh tautology (Pass 5 GPT-5.4).
  - `big-heroes-la3` P3 — regression_pr14.sh rc handling (Pass 6 Copilot).
- ⚠️ Partial fix метка в финальном /finalize-pr — honest disclosure per Claude tells it like it is doctrine.

---

## Sprint v3.4 Pre-Merge Landing Protocol итог (MERGED 2026-04-19, финализирующий /finalize-pr на `3519b4e`)

- Tracking: `big-heroes-sz4` closed; task `big-heroes-cfn` closed.
- Цель: перенос Landing the Plane из post-merge отдельного `chore/landing-pr-N` PR во pre-merge inline-commit в ту же ветку Sprint PR. Убран bureaucratic toil второго merge без safety value.
- **Dogfood (первый sprint под v3.4):** landing commit сделан в ветке `sprint-pipeline-v3-4-pre-merge-landing` между первым `/finalize-pr --pre-landing` и operator merge.
- Артефакты (pipeline нормативные):
  - `.agents/PM_ROLE.md §2.5` — pre-merge Landing the Plane.
  - `.agents/HOW_TO_USE.md` + `.agents/PIPELINE.md` — operator-facing sync с двухвызовным flow.
  - `.claude/skills/sprint-pr-cycle/SKILL.md` — Фаза 4.5 Pre-merge Landing (7 подшагов).
  - `.claude/skills/finalize-pr/SKILL.md` — Dual-invocation pattern + `--pre-landing` flag + LANDING_WARNING block.
  - `.claude/skills/pipeline-audit/SKILL.md` — Инвариант 8 v3.4 (расширен operator-facing coverage).
- Convention change: memory pattern `Sprint N завершён <finalize_date>` (не merge_date). Исторические sprint-1..5 оставлены.
- Review cycle:
  - Tester gate (Critical, pipeline-artifacts) GATE_PASS.
  - Internal Claude 6 passes: Pass 1 APPROVED, Pass 2 CHANGES_REQUESTED (scope creep — revert'нут), Pass 3-6 APPROVED.
  - Copilot auto-review 5 rounds: 12 findings total, все fix-now закрыты или реверт'нуты.
  - **Scope rollback 2026-04-20:** 3 revert + 2 re-apply коммиты убрали runtime LANDING_STAGE/LANDING_WARNING autodetect (план P3 требовал документацию без спец-логики). Rollback non-destructive.
  - **External GPT-5.4 Mode B-manual (Sprint Final):** 3 pass. Pass-1 CHANGES_REQUESTED (3 HIGH: operator-facing stale + R4 митигация + invariant 8 coverage). Pass-2 CHANGES_REQUESTED (1 HIGH: `--pre-landing` не в PM-facing flow). Pass-3 APPROVED на `3519b4e` (1 WARNING polish → defer `big-heroes-rux`).
  - Triage: 19 fix-now applied, 5 defer to Beads, 12 reject with rationale.
- Эскалации:
  - `big-heroes-1l6` (BE-11) upgraded to **P1 blocker** — Windows sandbox CreateProcessWithLogonW 1326 блокирует Codex CLI external review независимо от auth-метода (OAuth через ChatGPT validated, CODEX_UNSAFE_ALLOW_NO_SANDBOX=1 не помог). Mode A/B недоступны на Windows dev-host.
- Deferred Beads (созданы в v3.4): `big-heroes-35g` (error handling pre-merge landing), `big-heroes-ase` (check-merge-ready.py bypass через запятую), `big-heroes-ekb` (LANDING_STAGE dead var — resolved автоматически scope rollback), `big-heroes-8gd` (WSL path для external review, P2), `big-heroes-hrd` (mode-label enforcement в finalize-pr, P2), `big-heroes-rux` (polish pass-3 WARNING).

---

## Sprint 5 итог (MERGED 2026-04-19)

- Tracking: `big-heroes-d0w` closed.
- 5 commits в PR #12: feat(auth) hook + docs(codex-auth) + docs(sprint-5 P0) + 4 fix-итерации post-review.
- Verify ✅ build OK + tests 168/168.
- Variant A (ChatGPT OAuth Plus подписка) одобрен — hook работает с обоими auth-типами.
- Smoke-tests S1-S5: 5/5 PASS с Windows-специфичной изоляцией (USERPROFILE+HOME+APPDATA+LOCALAPPDATA).
- Review-cycle: Tester GATE_PASS → Reviewer Pass 1+2 APPROVED → Sprint Final Mode C Standard+Adversarial APPROVED → 7 раундов Copilot (4→3→3→1→1→0→0 monotonic convergence) → Final Delta Review APPROVED → /finalize-pr.
- Triage: 14 fix-now applied, 1 reject with rationale (F2 zero-touch install design), 12 defer to Beads.
- Эскалации (требуют действий вне Sprint 5):
  - `$OPENAI_API_KEY` в env невалидный (401 in-situ); ротация либо ChatGPT OAuth.
  - `big-heroes-1l6` (BE-11): Windows codex sandbox `CreateProcessWithLogonW failed: 1326` блокирует `codex review` на dev-host'е оператора.
- Deferred Beads (план следующих спринтов): `big-heroes-pgi` (BE-9 hardening backlog 12 findings), `big-heroes-la8` (BE-10 behavioral VC для плана v5), `big-heroes-90j` (BE-7 VC-1a expansion), `big-heroes-1l6` (BE-11 Windows sandbox), `big-heroes-mo9/7wh/40n/wrg` (BE-1/4/2/5).
- Remote ветка `sprint/codex-auth-integration` оставлена (оператор не делал cleanup).

---

## Текущее состояние

### Sprint Pipeline v3.3 (MERGED 2026-04-17)

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
- Round 31 (2026-04-17, 9c6ab61): Copilot COMMENTED — 2 findings закрыты fix now в `781a00f`: (1) **CRITICAL** editor-mode bypass (`gh pr comment <N>` без `--body`/`-b` открывает редактор, `--edit-last` тоже — содержимое скрыто от hook'а; добавлены `uses_edit_last()` и `uses_no_body()` с fail-secure блокировкой вне FINALIZE_PR_TOKEN), (2) WARNING отсутствие regression-тестов editor-mode — fix now: +6 кейсов (suite 87/87). Copilot re-review `781a00f`: **0 новых findings** (implicit APPROVED на текущей дельте).
- Round 31.5 (2026-04-17, ac131d0): оператор добавил `sync.remote` в `.beads/config.yaml` (не-нормативная конфигурация).
- Round 32 (2026-04-17, 781a00f): GPT-5.4 Critical CHANGES_REQUESTED — 2 findings закрыты fix now в этом коммите: (1) **CRITICAL** parser-contract bug: `reviewer.md` рекомендовал писать `\|` в ячейках findings-таблицы, но `/finalize-pr` фаза 2 парсит строки через `IFS='|'` без учёта экранирования — колонки сдвигались (status → `path:1`, payload → `defer to Beads`), hard gate обходился. Добавлена предобработка `sed "s/\\\\|/${SEP}/g"` (где `SEP=$(printf '\037')`, Unit Separator) перед IFS-split, с восстановлением `|` в каждой колонке через `tr '\037' '|'`. Формулировка в `reviewer.md:150` переписана на описание текущей семантики парсера. (2) WARNING stale Verification Contract: T1 в плане спринта упоминал `55/55`, фактический hook-suite на HEAD — `87/87`. Синхронизировано.

**Что осталось после v3.3:**

- ✅ PR #9 merged оператором 2026-04-17.
- Удалить мусорные ветки: `claude/finalize-sprint-pr9-CvRt3`, `safety/bd-init` (если ещё существуют).
- Ветка `claude/setup-codex-auth-ZTYzQ` → план Sprint 5 готов (docs/plans/sprint-5-codex-auth.md APPROVED v4).
- Ветка `feature/sprint-4-hotfix` — отложена на игровой спринт после Sprint 5.
- 32 deferred issues в Beads (техдолг для Sprint Pipeline v3.4).

### PR #10 — VS Code autoApprove fix (MERGED 2026-04-18)

Инфра-фикс пайплайна, не связан с v3.3 или игровой логикой. Ветка `fix/vscode-autoapprove`. Light/Sprint Final tier. 5 коммитов, 1 файл `.vscode/settings.json` (+13/-1).

**Проблема:** VS Code native `chat.tools.terminal.autoApprove` в `.vscode/settings.json` содержал только `{"printf": true}` — перекрывал Claude `Bash(*)` + `defaultMode: bypassPermissions` и блокировал каждую bash-команду prompt'ом → агенты не могли работать автономно.

**Решение:** regex auto-approve на safe dev-команды (git, gh, bd, jest, tsc, curl и др.) + точечные allow для `npm test|ci|--version|-v|ls|view|outdated` и `npx @org/package` (scoped); destructive операции в явный deny (regex-варианты `rm -rf /`, `rm -rf ~`, force-push в любой позиции, push в main/master, gh pr merge, gh api *merge*, gh api -X DELETE, DROP TABLE с флагом /i).

**Ревью-цикл (6 passes internal + 5 passes external + 5 Copilot rounds):**
- Internal Claude (Light tier, Architecture + Hygiene): APPROVED pass 6 + pre-finalize
- External GPT-5.4 (Mode D manual, Codex CLI usage limit до 2026-04-19): APPROVED pass 5
- Copilot pass 5: implicit APPROVED (no new comments)
- 6 fix-now закрыто через 5 fix rounds
- 2 CRITICAL rejected with rationale (autonomy > security-maximalism, operator policy)
- 1 Beads issue deferred: `big-heroes-6dw` (chained commands, P3 known risk)

**Закрытые issues:**
- big-heroes-08v (P1 infra) — `.vscode/settings.json` fix.

**Новые Beads deferred:**
- big-heroes-6dw (P3 infra) — chained commands prefix-only bypass (trade-off accepted).

**Ключевое решение оператора (закреплено в auto-memory):**
- **Автономная агентная разработка приоритетнее security-maximalism.** Reject CRITICAL допустим с rationale автономности (прерывание цикла агента = регрессия). Trust model: конфиги под git review + PR reviewer, не через VS Code blocking.

### Sprint 5 Codex Auth Integration (план утверждён, ожидает старта)

План: `docs/plans/sprint-5-codex-auth.md` (v4 APPROVED оператором).
Ветка-источник: `origin/claude/setup-codex-auth-ZTYzQ` (2 коммита, Codex CLI SessionStart hook + `.agents/CODEX_AUTH.md`).
Critical tier. Verification Contract VC-1..VC-7 с runtime checks.

### Sprint 4 (MERGED 2026-04-09)

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
