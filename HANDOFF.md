# PM Handoff — Sprint Pipeline v3.5, Pass 7 escalation

**Создан:** 2026-04-20 (рабочий компьютер)
**Обновлён:** 2026-04-20 (домашний компьютер — checkpoint после Option B execution + API key rotation)
**Кому:** PM-агент следующей сессии после рестарта Claude Code (для pick-up API key из settings.json)
**Причина:** передача контекста без потерь при смене рабочего места + rotation auth.

---

## 🆕 Checkpoint 2026-04-20 (home PC, после Option B execution)

**Оператор выбрал Option B** (accept known limitations + defer Python rewrite в v3.6).

**Что сделано в session home-PC:**

1. **Developer commit `ebaf786`** — semantic revert Pass 6 overfits:
   - Hook `check-merge-ready.py` terminator class `(Po, Pf, Pe, Pd)` → `(Po, Pf)` (revert E-7 Pe/Pd overmatch).
   - Stripper `strip_code_spans.sh` E-2 multiline paragraph scanner → per-line (revert over-complexity, 420→358 LoC).
   - Kept legitimate: E-3 escape, E-4 blank line, E-5 Sk/Lm, E-8 semantics, E-9 structural limited.
   - Added: SKILL.md секция `## Known limitations (v3.5, deferred to v3.6)` с 8 bead-refs.

2. **8 новых `[from-v3.5-dropped]` беад созданы:**
   - `big-heroes-55m` P1 — Python rewrite, promoted v3.6 sprint-opener (≡ dolt-079).
   - `big-heroes-36d` P3 E-10 blockquote paragraph terminator.
   - `big-heroes-42a` P3 E-11 setext underline.
   - `big-heroes-zhe` P3 E-12 HTML block.
   - `big-heroes-6bp` P2 E-16 structural inline CR survives.
   - `big-heroes-ytx` P3 hook Pe/Pd broad category catch-all + E-13 edge (title expanded per Pass 8 INFO).
   - `big-heroes-16e` P3 E-14 `:` в backtick quoted.
   - `big-heroes-3ed` P3 E-15 `/` `.` Po overmatch.

3. **Internal Pass 8 delta-closure APPROVED** (Claude Opus 4.7 on `ebaf786`):
   - Semantic revert correct, Known Limitations corrent bead-refs, tests aligned (55/55 validator + 150/150 hook + 168/168 npm + regression_pr14 OK), no scope creep, build зелёный.
   - Published: https://github.com/komleff/big-heroes/pull/15#issuecomment-4282712039
   - Triage: 0 fix-now, 0 deferred, 1 reject (bd-ytx cosmetic — resolved PM через `bd update`).

4. **External review Mode A attempt failed** — `codex review --base master` на Windows dev-host (ChatGPT login) выдал `CreateProcessWithLogonW failed: 1326` (BE-11 sandbox). Fallback начат Mode C.

5. **Mode C Reviewer A (Claude Opus 4.7 standard) — APPROVED** на `ebaf786`, 0 findings в delivered scope. Output получен в PM context, НЕ опубликован (PM ждёт Reviewer B adversarial для консолидации).

6. **🆕 Оператор предоставил новый OPENAI_API_KEY** (рабочий аккаунт, валидный):
   - Placeholder добавлен в `C:\Users\komle\.claude\settings.json` блок `env`.
   - Оператор заменит заглушку на реальный ключ.
   - PM выполнил `codex logout` — сейчас `Not logged in`.
   - На рестарте Claude Code SessionStart hook `.claude/hooks/codex-login.sh` auto-логинит с API key → `Logged in using API key` → Mode A доступен.

**Current PR state:** https://github.com/komleff/big-heroes/pull/15 OPEN, MERGEABLE, CI SUCCESS, HEAD `ebaf786`.

**HANDOFF.md commit state:** этот файл ещё не committed после checkpoint — new PM может commit'ить сам или оператор обновит на месте.

---

## ⏭ Plan для нового PM (после рестарта с API key)

### Если BE-11 не затрагивает Mode A execution path (иной shell adapter при API key auth):

1. Verify `codex login status` → `API key` expected.
2. Запустить Mode A full:
   ```bash
   timeout 300 npx @openai/codex review --base master -c model='"gpt-5.4"' -c model_reasoning_effort='"high"' 2>&1 | tee /tmp/codex-review-v35-gpt54.txt
   timeout 300 npx @openai/codex review --base master -c model='"gpt-5.3-codex"' -c model_reasoning_effort='"high"' 2>&1 | tee /tmp/codex-review-v35-codex.txt
   ```
3. Консолидация по external-review skill Шаг 5, публикация в PR с Mode A label.
4. Copilot re-review request.
5. Если Mode A findings `APPROVED` → `/finalize-pr 15 --pre-landing` с меткой `⚠️ Partial fix — edge cases deferred to big-heroes-55m (v3.6)`.

### Если BE-11 снова блокирует Mode A (sandbox error независимо от auth):

1. Fallback Mode C (автономно).
2. Запустить Reviewer B (adversarial, но scope-locked на Option B verify как Reviewer A — НЕ full adversarial чтобы не попасть обратно в overfitting loop).
3. Консолидация Mode C двух проходов с меткой `⚠️ Degraded mode с имитацией adversarial diversity. Не является cross-model review`.
4. Publish в PR.
5. `/finalize-pr 15 --pre-landing` с обеими метками (⚠️ Partial fix + ⚠️ Degraded external).

### Reviewer A Mode C output (сохранён для Reviewer B консолидации если fallback)

`ebaf786`, Claude Opus 4.7 standard Mode C, APPROVED, 0 findings в delivered scope. Полный текст в PR comment истории **не опубликован** (только prompt + response ассистента); новый PM должен либо опубликовать его standalone, либо — если Mode A заработает — проигнорировать и использовать Mode A raw outputs.

### После /finalize-pr --pre-landing APPROVED

Фаза 4.5 pre-merge landing (flow v3.4):
1. Update `.memory_bank/status.md` с `Sprint v3.5 COMPLETE <finalize_date>`.
2. `git mv docs/plans/sprint-pipeline-v3-5-cleanup.md docs/archive/`.
3. `bd close big-heroes-nw5` + `bd close big-heroes-hyo big-heroes-rux big-heroes-ase big-heroes-0pk` (fix-now).
4. `bd remember "Sprint v3.5 завершён <finalize_date>: validator code-span baseline + hook terminator class Po+Pf + Known Limitations defer 8 items → Python rewrite big-heroes-55m v3.6"`.
5. `chore(landing): pre-merge artifacts — sprint-pipeline-v3-5` + push.
6. Doc-only review round (Copilot auto + Claude delta).
7. External review на landing HEAD (Mode A если работает, Mode C fallback).
8. `/finalize-pr 15` (второй, без `--pre-landing`).
9. Сообщить оператору — PR merge-ready.

---

---

## Промпт для активации нового PM

> Ты PM. Прочитай `.agents/AGENT_ROLES.md` секция "0. Project Manager" и **этот файл (`HANDOFF.md`) целиком**. Задача: продолжить Sprint Pipeline v3.5 после Pass 7 escalation. Оператор выбирает одну из 3 опций в этом handoff'е — дождись его ответа, потом исполняй выбранную опцию. **До выбора опции Developer-субагента не запускать.**

---

## TL;DR

- **Ветка:** `sprint-pipeline-v3-5-cleanup`
- **HEAD:** `705f530` (до этого handoff-коммита)
- **PR:** [#15](https://github.com/komleff/big-heroes/pull/15) OPEN, MERGEABLE, CI green
- **Blocking point:** [PM Escalation comment-4280205901](https://github.com/komleff/big-heroes/pull/15#issuecomment-4280205901) — оператор выбирает опцию A/B/C.

---

## Sprint v3.5 goal

Устранить infrastructure false positive hard gate в `/finalize-pr` Шаг 5 — validator ошибочно матчил `CHANGES_REQUESTED`/`APPROVED` в code spans (narrative-цитаты внутри review-pass body). Плюс backlog cleanup v3.4 задач. См. план: `docs/plans/sprint-pipeline-v3-5-cleanup.md`.

---

## Что сделано (6 fix-cycles, 14 commits)

| Pass | Commits | Findings source | Severity snapshot |
|------|---------|-----------------|-------------------|
| 1 (Mode B-manual через оператора) | `c63fa05`..`151e127` | GPT-5.4 + GPT-5.3-Codex | 2 CRITICAL F-1 terminator + F-2-fence + F-2-inline |
| 2 Developer fix | `2548c4d`..`51a8afa` | Pass 1 external triage | Fix 4 finds from Pass 1 |
| 2 review | — | Tester G1/G2/G3 (CRITICAL) + Reviewer Pass 2 F1 (HIGH mutation) + F4-F8 | 2 CRITICAL + 1 HIGH + 4 MEDIUM/LOW |
| 3 Developer fix | `4bca80b`, `68b7428` | Pass 2 triage — systemic Unicode category + fence lone opener fail-safe | Fix 6 finds |
| 3 review | — | Reviewer Pass 3 (D-1/D-2/D-3) + Copilot CP-1/CP-2/CP-3 | 2 HIGH + 4 MEDIUM/LOW |
| 4 Developer fix | `7ca1161`, `c94469c`, `88cfc30`, `07162c2` | Pass 3 triage | Fix 6 finds, close dolt-hta |
| 4 review | — | Reviewer Pass 4 APPROVED + external Mode A Pass 2 (E-1/E-2/E-3) + Copilot (CX-1..CX-5) | 1 CRITICAL + 4 WARNING + 3 INFO |
| 5 Developer fix | `bc6fe35`, `416b598`, `7ae4f55` | Pass 4 external+Copilot triage | Fix 8 finds |
| 5 review | — | Reviewer Pass 5 APPROVED + external Mode A Pass 3 (E-4/E-5/E-6) + Copilot (CX-6..CX-10) | 2 CRITICAL + 2 WARNING + 3 INFO |
| 6 Developer fix | `40be0b7`, `e53cb93`, `77849d6` | Pass 5 external triage | Fix 7 finds |
| 6 review | — | Reviewer Pass 6 APPROVED + external Mode A Pass 4 (E-7/E-8/E-9) + Copilot (CX-11/CX-12) | 3 CRITICAL + 2 INFO |
| 7 Developer fix | `10cdf47`, `705f530` | Pass 6 "final tactical" triage | Fix 5 finds (E-7 Pe/Pd back, E-8 escape scope, E-9 structural terminators) |
| **7 review** | **—** | **Internal (E-10 blockquote, E-11 setext, E-12 HTML block) + external Mode A Pass 5 (E-13/E-14/E-15/E-16)** | **4 P1 + 3 P2 = overfitting** |

---

## Blocking point (ЧТО ДЕЛАТЬ НОВОМУ PM)

Pass 7 подтвердил overfitting pattern: 3 round подряд каждый tactical fix открывает 2-3 новых P1. Awk-based CommonMark stripper вырос до ~230 LoC, purpose-built для чего-то, что лучше сделать в Python (см. Reviewer Pass 2 F2 prediction, `dolt-079` deferred).

**PM опубликовал escalation с 3 опциями в [comment-4280205901](https://github.com/komleff/big-heroes/pull/15#issuecomment-4280205901):**

| Опция | Scope | Рекомендация PM |
|-------|-------|-----------------|
| **A — Python rewrite stripper in-sprint** | ~1-2ч Developer, promote `dolt-079` → v3.5 | ✅ Recommended (systemic) |
| **B — Accept known limitations + merge** | ~30мин revert+docs, defer edge cases → v3.6 | Acceptable (pragmatic time-boxed) |
| **C — Full rollback stripper** | ~15мин, sprint goal abandoned | Не рекомендую |

**Ждёшь ответ оператора в чате или в PR comment.** До ответа — НЕ делегируй Developer, НЕ пиши новые fix-commits.

---

## Если оператор выбирает опцию A (Python rewrite)

**Developer task:**

1. Создать `.claude/skills/finalize-pr/validators/strip_code_spans.py` с той же stdin→stdout семантикой, что shell-вариант.
2. Python реализация:
   - Двухстадийный: Stage 1 fence strip (fenced code blocks `\`\`\``/`~~~`, с correct fence length + info-string validation), Stage 2 paragraph-aware inline span strip (paragraph terminated by: blank line `^\s*$`, ATX heading, list start, thematic break, setext underline, HTML block start, blockquote `>`).
   - CommonMark §6.1 code span: opener N backticks, closer того же N, backslash-escape работает только в обычном тексте (не inside open span).
   - Unicode-safe (NFKD для hook уже есть, stripper работает на bytes).
3. `strip_code_spans.sh` удалить, `SKILL.md` обновить вызов на `python3 "$stripper_path"`.
4. Тесты в новом `test_validate_review_pass.py` (или conserve bash test harness и переписать).
5. Repro-тесты от всех previous findings: G1/G2/G3, D-1/D-2/D-3, E-1..E-16 (55+ кейсов из `test_validate_review_pass.sh`).
6. Close `dolt-079` после merge.

**После Developer push — новый review cycle (Tester gate Critical + Reviewer Pass 8 + /external-review Mode A fresh + Copilot re-request).**

## Если оператор выбирает опцию B (accept + document)

**Developer task:**

1. Revert (не git revert, но семантически) tactical fixes которые регрессируют:
   - `10cdf47` (E-7 Pe/Pd → возможно вернуть только Po+Pf но с EOF-check из pre-E-1)
   - `bc6fe35` (E-3 escape для opener — оставить) + удалить E-2 multiline inline scanner (оставить только per-line)
   - `40be0b7` (E-4 fence blank line — оставить) + `77849d6` docs-only — оставить
2. SKILL.md — добавить секцию «Known limitations (v3.5, deferred to v3.6)»: blockquote paragraph terminator, setext headings, HTML block, structural-line inline strip, Pe/Pd terminator. Plus mention `dolt-079` для полного решения.
3. `bd create` issues с `[from-v3.5-dropped]` для каждого known limitation (E-10, E-11, E-12, E-13, E-14, E-15, E-16).
4. Upgrade `dolt-079` priority в P1 для v3.6 sprint-opener.
5. Тесты: убрать failing corners (E-10/E-11/E-12), оставить closure tests для базовых findings.

**После push — `/external-review` Mode A verify, internal Pass 8 closure, `/finalize-pr 15 --pre-landing`.**

## Если оператор выбирает опцию C (rollback)

Sprint goal abandoned. Re-plan требуется. Новый PM эскалирует к оператору за новым scope.

---

## Ключевые файлы (для orientation нового PM)

- `.claude/hooks/check-merge-ready.py` — hook Python (~600 LoC): phrase regex + `unicodedata` normalization + skip-loop + terminator class `('Po','Pf','Pe','Pd')`.
- `.claude/hooks/test_check_merge_ready.py` — 154 тестов hook.
- `.claude/skills/finalize-pr/validators/strip_code_spans.sh` — awk stripper (~230 LoC). **Кандидат на Python rewrite.**
- `.claude/skills/finalize-pr/validators/test_validate_review_pass.sh` — 55 тестов validator.
- `.claude/skills/finalize-pr/validators/regression_pr14.sh` — regression PR #14 smoke (VC-5).
- `.claude/skills/finalize-pr/SKILL.md` — skill definition, validator invocation в Шаге 5.
- `docs/plans/sprint-pipeline-v3-5-cleanup.md` — Verification Contract (VC-1..VC-6).
- `.memory_bank/status.md` — **НЕ обновлён для v3.5** (обновляется в pre-merge landing commit после `/finalize-pr --pre-landing`).

---

## Memory pointers (pers из auto-memory)

Persistent memory в `~/.claude/projects/-Users-komleff-Documents-GitHub-big-heroes/memory/`. На домашнем компьютере — **путь будет другой**, но оператор синхронизирует либо через cloud, либо новый PM пересоздаст из context. Ключевые:

- `feedback_external_review_direct_publish.md` — внешние ревьюверы при прямом запуске оператором публикуют в PR сами, PM не готовит copy-paste request'ы.
- `feedback_external_reviewer_self_signing.md` — в шаблонах review-request не хардкодить `model: GPT-5.4`, ревьювер сам подписывается.
- `reference_codex_auth_key_rotation.md` — при смене `OPENAI_API_KEY` обязателен `codex logout` + restart (иначе hook early-return на старом auth).
- `reference_copilot_re_review_api.md` — правильный login для Copilot API: `copilot-pull-request-reviewer[bot]` (с суффиксом). Без — тихий HTTP 200 без registration.
- `feedback_audit_publish.md` — `/pipeline-audit` отчёт публикуется в PR (не только в чат).
- `feedback_landing_the_plane.md` — после `/finalize-pr` обязательный порядок: update `.memory_bank/status.md`, close beads, `bd remember`.

---

## Environment-specific notes

- **Codex CLI:** `codex login status` должен возвращать `"API key"` — Mode A (GPT-5.4 + GPT-5.3-Codex полный adversarial). Если `"ChatGPT"` — Mode B (1 проход дефолтной модели). Если ошибка — Mode C/D degraded.
- **Copilot re-review:** после первого push Copilot auto-ревьюит один раз. Для повторного — `gh api POST /repos/OWNER/REPO/pulls/N/requested_reviewers -f 'reviewers[]=copilot-pull-request-reviewer[bot]'`. Ответ через 1-3 мин в `gh pr view N --json reviews`.
- **BE-11 Windows sandbox:** блокирует Codex CLI на Windows dev-host через `CreateProcessWithLogonW 1326`. На Mac работает. Если новый PM на Windows — Mode A недоступен, fallback Mode C (Claude adversarial degraded).
- **`.claude/scheduled_tasks.lock`:** untracked harness artifact, я добавил в `.git/info/exclude` чтобы не попадал в status. После pull на другой машине — возможно надо повторить (локальный exclude не синкается).

---

## Что НЕ делать

- ❌ **Не делегировать Developer до выбора опции оператором.** 7-й tactical round будет 5-й confirmation overfitting'а.
- ❌ Не публиковать в PR маркеры "готов к merge" / "ready to merge" без флага `/finalize-pr --pre-landing` — hook блокирует.
- ❌ Не пушить в master — только в ветку + PR.
- ❌ Не запускать `/finalize-pr 15 --pre-landing` до closure E-10..E-16 (иначе hard gate блокирует на findings).
- ❌ Не сокращать raw output от external review при публикации в PR — inv 6 AGENT_ROLES.md (PM не искажает findings).

---

## Стартовая последовательность для нового PM

```bash
# 1. Sync
cd big-heroes
git checkout sprint-pipeline-v3-5-cleanup
git pull --ff-only

# 2. Проверить где остановились
git log --oneline -3
# ожидание: <handoff-commit> + 705f530 + 10cdf47

# 3. Прочитать этот handoff целиком
cat HANDOFF.md

# 4. Проверить актуальный state PR
gh pr view 15 --json state,mergeable,headRefOid,statusCheckRollup
gh pr view 15 --json comments --jq '.comments | .[-5:] | .[] | {author: .author.login, firstLine: (.body | split("\n") | .[0]), createdAt}'

# 5. Проверить Codex auth (если Mac с API key)
npx @openai/codex login status

# 6. Verify local state зелёный
npm run build && npm test
python3 .claude/hooks/test_check_merge_ready.py
bash .claude/skills/finalize-pr/validators/test_validate_review_pass.sh

# 7. Ждать ответ оператора на escalation (опция A/B/C)
```

---

## После merge v3.5 (независимо от выбранной опции)

1. Pre-merge landing commit (Фаза 4.5 v3.4 flow):
   - Update `.memory_bank/status.md` с COMPLETE date.
   - Archive `docs/plans/sprint-pipeline-v3-5-cleanup.md` → `docs/archive/`.
   - `bd close` sprint tracking + fix-now tasks.
   - `bd remember "Sprint v3.5 завершён <date>: <key learnings>"`.
2. `/finalize-pr 15` (второй, на landing HEAD).
3. Сообщить оператору — ожидает merge.
4. Удалить `HANDOFF.md` после merge (этот файл — temp artifact).

— PM (Claude Opus 4.7), рабочий компьютер, 2026-04-20
