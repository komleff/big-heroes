# Sprint: Codex Auth Integration

**Дата плана:** 2026-04-17
**PM:** Claude Opus 4.7 (1M context)
**Ветка-источник:** `origin/claude/setup-codex-auth-ZTYzQ` (HEAD `6995a5c`, 2 коммита, +355 строк по диффу коммитов)
**Base:** `master @ 924e87f` (post merge PR #9 Sprint Pipeline v3.3)
**Target ветка спринта:** `sprint/codex-auth-integration`
**Review Tier:** **Critical** (затрагивает `.claude/settings.json` hooks + добавляет `.claude/hooks/*` + правит `.claude/skills/external-review/SKILL.md`; по AGENT_ROLES.md §Review Tiers)

> **Наименование файла:** при старте Developer переименует план в `sprint-5-codex-auth.md` (формат PM_ROLE.md §Управление планами).

> **История ревью плана:**
> - **v1 (CHANGES_REQUESTED, 2026-04-17):** оператор — 4 finding'а (VC-1 не защищал hard-gate; VC-1↔P4 противоречие 4/5 файлов; Beads creation в POST; несовместимые smoke-test критерии). Fix в v2.
> - **v2 (CHANGES_REQUESTED, 2026-04-17):** оператор — 4 finding'а (S1/S3 не изолировали auth-state → ложный PASS; S5 печатал только второй exit; VC-7 узкий grep на 4 токена vs полный deny-list; R6 mitigation конфликтовал с VC-1a фиксированным diff). Fix в v3.
> - **v3 (CHANGES_REQUESTED, 2026-04-17):** оператор — 3 finding'а (S5 фиксированный `/tmp/codex-pre` мог давать ложный FAIL без pre-S4 state; VC-7 не покрывал 8 push-в-main/master deny-правил; R6 mitigation self-reference v3 vs нужно v4). Fix в v4 (текущая версия).

---

## Context

Sprint Pipeline v3.3 (PR #9) смержен в master 2026-04-17. Пайплайн production-ready, но `/external-review` зависит от аутентифицированного Codex CLI: оператор вручную выполняет `codex login` перед каждым Sprint Final gate. Это трение, источник ошибок в degraded-сценариях C/D и tacit knowledge вне документации.

Ветка `claude/setup-codex-auth-ZTYzQ` автоматизирует это: SessionStart hook на старте сессии идемпотентно логинит Codex CLI из `$OPENAI_API_KEY`, fail-secure при отсутствии ключа, передаёт ключ через stdin. Плюс `.agents/CODEX_AUTH.md` (307 строк документации).

**Зачем сейчас:** убрать ручной `codex login` в Sprint Final v3.3; предотвратить потерю контекста ревью из-за истёкшего токена; воспроизводимость пайплайна для нового оператора.

**Альтернатива (отклонена):** `origin/feature/sprint-4-hotfix` — `autoBeltIfEmpty` без интеграции/тестов, не связана с инфраструктурой. Отложена на игровой Sprint 5.

> ⚠ **Сырое состояние ветки:** `git diff --name-status master..origin/claude/setup-codex-auth-ZTYzQ` показывает 27 файлов (24+ коммитов отставания, включая массовые удаления нормативных артефактов v3.3). Это **ожидаемо для несребейзенной ветки**. После ребейза в P1 диф должен схлопнуться до 5 файлов (4 codex-auth + 1 SKILL.md sync). VC-1/VC-1b/VC-7 защищают от потери master-настроек.

---

## Verification Contract

| VC | Критерий | Executable check (точный) |
|----|----------|--------------------------|
| **VC-1a** | Diff с master = ровно 5 ожидаемых путей | `git diff --name-only master \| sort` ≡ `.agents/CODEX_AUTH.md`, `.claude/hooks/codex-login.sh`, `.claude/settings.json`, `.claude/skills/external-review/SKILL.md`, `.gitignore` |
| **VC-1b** | Нормативные артефакты v3.3 сохранены в settings.json | Все четыре `grep -F` PASS:<br>• `'Bash(gh api *merge*)'` (deny)<br>• `'Bash(gh pr merge *)'` (deny)<br>• `'check-merge-ready.py'` (PreToolUse)<br>• `'Bash(git commit*)'` (PreToolUse npm test) |
| **VC-2** | SessionStart chain не сломана | Dry-run: `bd prime; bash .claude/hooks/codex-login.sh` — оба exit 0, не конфликтуют по state |
| **VC-3** | Hook smoke-tests | По таблице P3: S1 PASS + S2 PASS + S4 PASS + S5 PASS обязательны; S3 PASS **или** documented-skip с rationale в PR; каждый сценарий имеет evidence по своему типу проверки (см. P3) |
| **VC-4** | Docs cross-ref | `grep -nE 'CODEX_AUTH\|codex-login' .claude/skills/external-review/SKILL.md` → ≥1 hit; все относительные пути в `.agents/CODEX_AUTH.md` ведут на existing файлы |
| **VC-5** | Pipeline-audit | `/pipeline-audit` → 7/7 инвариантов v3.3 PASS |
| **VC-6** | Build + Test | `npm run build` exit 0, `npm test` exit 0 |
| **VC-7** | `codex-login.sh` не содержит вызовов из полного `permissions.deny` master-настроек | См. блок «VC-7 executable check» ниже — вывод **ровно** `DONE`, ни одного `FAIL:` |

**VC-7 executable check** (вынесен из таблицы из-за `\|` в regex):

```bash
HOOK=.claude/hooks/codex-login.sh
fail=0
for tok in 'rm -rf' 'rm -r ' 'rm -fr' 'rmdir ' 'Remove-Item -Recurse' \
           'git push --force' 'git push -f ' 'gh pr merge' 'gh api ' 'gh repo delete'; do
  grep -F "$tok" "$HOOK" && { echo "FAIL: $tok"; fail=1; }
done
# Покрытие 8 deny-правил вида "git push (origin|*) (main|master|HEAD:main|HEAD:master)":
grep -E 'git[[:space:]]+push[^|;&]*(\bmain\b|\bmaster\b|HEAD:main|HEAD:master)' "$HOOK" \
  && { echo "FAIL: push to main/master"; fail=1; }
[ $fail -eq 0 ] && echo "DONE"
```

Покрытие master `permissions.deny` (всего 19 правил): rm-варианты (5) + force-push (2) + gh merge/delete (3) + `gh api ` widening для `*merge*` и `-X DELETE` (1 token = 2 правила) + regex для 8 push-в-main/master/HEAD: правил = **10 grep -F токенов + 1 regex = 19 правил**.

**Contract closure:** все 7 VC items must be `PASS` (с приложенным evidence) перед запросом первого Reviewer pass'а.

---

## Фазы имплементации

### P0. Prep & Beads creation (до кода)

**P0.1 Чтение** (обязательно):
- [.agents/AGENT_ROLES.md](.agents/AGENT_ROLES.md) — Critical tier правила
- [.agents/PIPELINE.md](.agents/PIPELINE.md) — поток спринта v3.3
- [.claude/settings.json](.claude/settings.json) — текущая структура hooks/deny в master (предмет VC-1b)
- [.claude/skills/external-review/SKILL.md](.claude/skills/external-review/SKILL.md) — место правки в P4
- [.claude/skills/finalize-pr/SKILL.md](.claude/skills/finalize-pr/SKILL.md) — правила Beads ID для defer'ов

**P0.2 Создать Beads issues** (до открытия PR — `/finalize-pr` блокирует defer-triage без Beads ID):

| ID плана | Реальный Beads ID | Title | Type | P | Status |
|----------|-------------------|-------|------|---|--------|
| BE-1 | `big-heroes-mo9` | `[codex-auth] verbose debug mode через CODEX_LOGIN_DEBUG=1` | feature | 3 | CREATED 2026-04-19 |
| BE-2 | `big-heroes-40n` | `[codex-auth] shell-test harness test_codex_login.sh для S1-S5` | tech-debt | 2 | pre-existing (Sprint Pipeline v3.3) |
| BE-3 | — | `[codex-auth] квартальный audit OpenAI permissions UI vs CODEX_AUTH.md §2.2` | docs | 3 | **SKIPPED 2026-04-19 по распоряжению оператора** — proactive audit без явного триггера. Пересоздать только при finding'е в ревью либо прямом запросе. |
| BE-4 | `big-heroes-7wh` | `[codex-auth] user-facing status indicator "Codex: ✓/✗" на старте сессии` | feature | 3 | CREATED 2026-04-19 |
| BE-5 | `big-heroes-wrg` | `[pipeline] зафиксировать в PIPELINE_ADR.md правила union/order project↔user-global SessionStart hooks` | docs | 2 | pre-existing (Sprint Pipeline v3.3) |

Sprint tracking: `big-heroes-d0w` (SPRINT 5: Codex Auth Integration).

> P7.3 defer-triage использует именно эти реальные ID (не плейсхолдеры BE-N). BE-3 не доступен — если в ревью всплывёт сценарий «квартальный audit» как defer-cause, PM согласует с оператором создание нового issue.

### P1. Ребейз

```bash
git fetch origin
git checkout -b sprint/codex-auth-integration origin/claude/setup-codex-auth-ZTYzQ
git rebase master
```

**Ожидаемое:** ветка отстаёт на 24+ коммитов; сырой diff содержит 27 файлов с массовыми удалениями (нормативные артефакты v3.3 на ветке отсутствуют, потому что коммиты ветки старше PR #9). Конфликты будут.

**Стратегия разрешения** (применяется per-file):

| Файл | Стратегия |
|------|-----------|
| `.claude/settings.json` | **Семантический merge:** базис = master-версия целиком; поверх добавить **только** блок `"SessionStart": [...]` внутрь секции `hooks`. НЕ `--theirs`, НЕ `--ours`. После merge `grep -F` каждой строки из VC-1b — все четыре hit обязательны. |
| `.agents/CODEX_AUTH.md` | `--theirs` (новый файл из ветки) |
| `.claude/hooks/codex-login.sh` | `--theirs` (новый файл из ветки) |
| `.gitignore` | `--theirs` для блока codex-auth (3 строки), но мерж с master-добавлениями если они есть |
| Любые другие файлы master, удалённые на ветке | **Восстановить из master** (`git checkout master -- <path>`) — это нормативные артефакты v3.3, ветка не должна их трогать |

**Валидация P1** (один runnable блок):
```bash
git diff --name-only master | sort > /tmp/diff_files.txt
diff <(printf '%s\n' \
  '.agents/CODEX_AUTH.md' \
  '.claude/hooks/codex-login.sh' \
  '.claude/settings.json' \
  '.claude/skills/external-review/SKILL.md' \
  '.gitignore' | sort) /tmp/diff_files.txt
# diff должен быть пустым → VC-1a PASS

for token in 'Bash(gh api *merge*)' 'Bash(gh pr merge *)' 'check-merge-ready.py' 'Bash(git commit*)'; do
  grep -F "$token" .claude/settings.json >/dev/null && echo "OK: $token" || echo "FAIL: $token"
done
# 4 OK → VC-1b PASS
```

> ⚠ Если diff отличается от ожидаемого набора — ребейз повторить, ошибки разрешения исправить. Запрет на коммит до VC-1a/1b PASS.

### P2. Audit SessionStart chain

В системе **две цепочки SessionStart**:
- User-global `C:\Users\komle\.claude\settings.json` → `bd prime` (beads context recovery)
- Project-local `d:\GitHub\big-heroes\.claude\settings.json` → **новый** `codex-login.sh` (после ребейза)

Claude Code harness объединяет обе цепочки (union); падение одного hook не прерывает остальные.

**Dry-run:**
```bash
bd prime
bash .claude/hooks/codex-login.sh; echo "exit=$?"
# оба exit 0; pereсечений по state нет (bd → .beads/, codex → ~/.codex/)
```

**Timeout бюджет:** `bd prime` 1–3 сек + `codex-login` 2–10 сек < `"timeout": 30`. OK.

**Валидация P2:** оба exit 0, evidence в PR. VC-2 PASS.

### P3. Smoke-tests (5 сценариев) — унифицированные критерии

Тесты ручные, не коммитятся в репо (BE-2 покроет автоматизацию). Evidence per-scenario строго определена.

| # | Сценарий | Команда | Тип проверки | Ожидание (evidence) |
|---|----------|---------|--------------|---------------------|
| **S1** | Нет `$OPENAI_API_KEY`, **изолированный пустой `$HOME`** (гарантирует ветку no-prior-login) | `HOME=$(mktemp -d) env -u OPENAI_API_KEY bash .claude/hooks/codex-login.sh; echo "exit=$?"` | exit + stderr | exit=0; stderr содержит `OPENAI_API_KEY не установлен` |
| **S2** | Нет `npx` в PATH | `PATH=/usr/bin:/bin bash .claude/hooks/codex-login.sh; echo "exit=$?"` | exit + silence | exit=0; stdout пусто, stderr пусто |
| **S3** | Fresh login с невалидным ключом, **изолированный пустой `$HOME`** (гарантирует ветку login-attempt, а не early-return по `Logged in`) | `HOME=$(mktemp -d) OPENAI_API_KEY=sk-proj-fake-test-key bash .claude/hooks/codex-login.sh; echo "exit=$?"` | exit + stderr | exit=0 (fail-secure); stderr содержит `Не удалось залогинить Codex CLI` либо аналогичное от npx. **Если локально нет npx/codex** — задокументировать skip с rationale в PR (см. ниже) |
| **S4** | Уже залогинен (валидный ключ в **реальном `$HOME`**) | Первый запуск с реальным ключом, затем второй | exit + silence | Второй запуск: exit=0; stdout пусто (`grep "Logged in"` matched, ранний return) |
| **S5** | Idempotency — 2 запуска подряд + проверка state. **Pre-condition:** S4 уже выполнен (есть валидный `~/.codex/auth.json`). **Изоляция snapshot'а:** одноразовый `mktemp -d` с trap-cleanup | `[ -f ~/.codex/auth.json ] \|\| { echo "SKIP S5: S4 не выполнен"; exit 0; }; SNAP=$(mktemp -d); trap "rm -rf $SNAP" EXIT; cp -a ~/.codex "$SNAP/codex"; bash .claude/hooks/codex-login.sh; e1=$?; bash .claude/hooks/codex-login.sh; e2=$?; echo "exit1=$e1 exit2=$e2"; diff -r "$SNAP/codex" ~/.codex` | exit×2 + state diff | `e1=0` И `e2=0`; `diff` пустой ИЛИ ограничен полями типа `last_refresh`/`expires_at` в `auth.json` (структурные ключи не изменены, идемпотентность подтверждена) |

**Documented-skip формат для S3** (если применимо):
```
S3: SKIPPED — npx/codex CLI недоступен локально (Windows, нет npm install -g). Hook fail-secure path для невалидного ключа покрыт ручной инспекцией кода: строки X-Y в codex-login.sh содержат `|| echo "..." >&2` без `exit 1`.
```

**Валидация P3:** S1+S2+S4+S5 = 4/4 PASS обязательно; S3 = PASS либо documented-skip с rationale. Evidence — отдельная таблица в PR body. VC-3 PASS.

### P4. Docs sync

**Drift:** `CODEX_AUTH.md` ссылается на `external-review/SKILL.md` (путь валиден после ребейза), но `SKILL.md` не содержит обратной ссылки. Подтверждено `git grep -n 'CODEX_AUTH\|codex-login' origin/claude/setup-codex-auth-ZTYzQ -- .claude/skills/external-review/SKILL.md` → 0 hits.

**Правка в [.claude/skills/external-review/SKILL.md](.claude/skills/external-review/SKILL.md)** рядом с `§1.4 Проверка Codex CLI` (строка ~74):

```markdown
> **Авто-логин:** SessionStart hook `.claude/hooks/codex-login.sh` идемпотентно логинит Codex CLI
> из `$OPENAI_API_KEY` на старте сессии. Setup ключа, permissions и compromise-response —
> см. [`.agents/CODEX_AUTH.md`](../../../.agents/CODEX_AUTH.md). Hook fail-secure: без ключа
> сессия не блокируется, `/external-review` перейдёт в режим C/D.
```

> Эта правка — **5-й файл в diff**, явно учтён в VC-1a (см. ожидаемый список путей).

**Проверка путей в `.agents/CODEX_AUTH.md`** (post-rebase): относительные ссылки на `../.claude/skills/external-review/SKILL.md`, `../.claude/hooks/codex-login.sh`, `../.gitignore`. Грепнуть `.md)` / `.sh)` в файле, проверить existence каждой целевой.

**Валидация P4:** `grep -nE 'CODEX_AUTH|codex-login' .claude/skills/external-review/SKILL.md` → ≥1 hit; все пути из CODEX_AUTH.md → existing. VC-4 PASS.

### P5. Pipeline-audit

```bash
# /pipeline-audit (skill) или ручной прогон 7 инвариантов v3.3
```

Особое внимание:
- Cross-reference артефактов (после P4 fix должен PASS).
- Settings.json hooks vs deny-rules (VC-7 уже покрывает статически; здесь — структурно).
- Если audit ругается на project-level SessionStart — fix round в этой фазе (либо правка audit skill вне scope → exception в PIPELINE_ADR.md, что уже в Critical tier scope).

**Валидация P5:** 7/7 PASS. VC-5.

### P6. PR creation

```bash
git push -u origin sprint/codex-auth-integration
gh pr create --title "feat(pipeline): авто-логин Codex CLI через SessionStart hook" --body-file pr-body.md
```

**Тело PR:**
1. Summary (что/зачем/связь с v3.3).
2. **Verification Contract** таблица VC-1a..VC-7 со столбцами `Status` (PASS/FAIL/SKIP) + `Evidence` (команда + key output line / ссылка на скрин).
3. **Smoke-test report** — таблица P3 с evidence per-scenario по типу проверки.
4. **Beads deferrals** — список BE-1..BE-5 с фактическими ID из P0.2.
5. Подпись `— PM (Claude Opus 4.7)`.

**PR gate:** PR создан **до** первого `gh pr comment` — иначе hook в settings.json блокирует комментирование.

### P7. Review cycle (Critical tier)

Согласно AGENT_ROLES.md §Review Tiers:

1. **Tester gate** — PM запускает Tester субагента. Проверка: покрытие smoke-tests, Windows bash edge-cases (`chmod 600` no-op), permission paths в `~/.codex/`, отсутствие секретов в argv/stdout. Отчёт — PR comment.
2. **Claude Reviewer Pass 1** (все 4 аспекта). Ожидаемые замечания:
   - Отсутствие `set -e` в hook → rationale: fail-secure.
   - Inconsistency `npx --no-install` (status) vs `npx` (login).
   - Silent success в S4 → defer в BE-1.
3. **PM triage:** fix-now / defer-beads (с конкретным ID из P0.2) / reject-rationale.
4. **Claude Reviewer Pass 2** — fix round + регрессии.
5. **Sprint Final `/external-review`** — режим по availability:
   - A: GPT-5.4 + GPT-5.3-Codex (dogfood test: если наш hook ломает Codex, режим A развалится — валидный регрессионный сигнал).
   - B/C/D: по fallback.
6. **`/finalize-pr`** — hard gate. Все defer'ы должны иметь Beads ID (готовы из P0.2). Merge — только оператор.

---

## Риски и митигации

| # | Риск | P×I | Митигация |
|---|------|-----|-----------|
| R1 | SessionStart chain ломает `bd prime` | Low×High | Phase 2 dry-run до PR; fallback — откат project hook, defer в BE-5 |
| R2 | Hook exposes `$OPENAI_API_KEY` в argv/logs | Low×Critical | Уже stdin-pipe + `>/dev/null 2>&1`; Reviewer pass 1 «Качество» обязан верифицировать |
| R3 | Windows bash vs Linux: `chmod`, `command -v`, `printenv` | Med×Med | Smoke-tests на Windows (целевая среда); `chmod` обёрнут в `2>/dev/null \|\| true` |
| R4 | Force-push после первого ревью-комментария ломает audit trail | Med×Med | Force-push ТОЛЬКО до первого ревью; после — только новые коммиты поверх |
| R5 | Timeout 30s мал при cold `npx` (`npm install @openai/codex`) | Med×Low | `--no-install` в status; login fail-secure exit 0; fix round → 60s если нужно |
| R6 | `/pipeline-audit` v3.3 не знает про project SessionStart → false positive | Low×Low | Если audit ругается — exception в PIPELINE_ADR.md. **Внимание:** правка PIPELINE_ADR.md = 6-й файл в diff → VC-1a в текущей формулировке fail. Mitigation требует **revision плана**: PM открывает следующую версию плана (текущая = v4 → minimum v5) с обновлённым expected-list (6 путей, добавлен фактический путь ADR — `.agents/PIPELINE_ADR.md` или `docs/architecture/pipeline-adr.md`, какой бы ни был принят), затем повторный VC-проход. Не пытаться обойти проверку — она единственное, что страхует от потери master-артефактов |
| R7 | **Случайная потеря master-hook'ов при ребейзе** (новый, по finding 1 ревью v1) | Med×Critical | VC-1b grep-проверка на 4 строки; Tester gate отдельно проверяет PreToolUse цепочку |

---

## Критические файлы

| Путь | Роль в спринте |
|------|----------------|
| [.claude/settings.json](.claude/settings.json) | Semantic merge при ребейзе (P1); добавление SessionStart; защита deny+PreToolUse (VC-1b) |
| [.claude/hooks/codex-login.sh](.claude/hooks/codex-login.sh) | Сам hook; subject smoke-тестов (P3) |
| [.claude/skills/external-review/SKILL.md](.claude/skills/external-review/SKILL.md) | Cross-ref на `.agents/CODEX_AUTH.md` (P4); 5-й файл в diff |
| [.agents/CODEX_AUTH.md](.agents/CODEX_AUTH.md) | Документация; проверка путей post-rebase (P4) |
| [.gitignore](.gitignore) | Дополнения для `.codex/` |
| [.agents/AGENT_ROLES.md](.agents/AGENT_ROLES.md) | Источник правды Critical tier (P7) |
| [.agents/PIPELINE.md](.agents/PIPELINE.md) | Поток спринта v3.3 |
| [.claude/skills/pipeline-audit/SKILL.md](.claude/skills/pipeline-audit/SKILL.md) | 7 инвариантов (P5) |
| [.claude/skills/finalize-pr/SKILL.md](.claude/skills/finalize-pr/SKILL.md) | Hard gate перед merge (P7.6); Beads ID requirement |

---

## Developer checklist (executable)

```
[ ] P0.1 Прочитать критические файлы
[ ] P0.2 bd create BE-1..BE-5; сохранить выданные ID локально
[ ] P1 git fetch; checkout -b sprint/codex-auth-integration; rebase master
[ ] P1 Семантический merge .claude/settings.json (master-base + SessionStart блок)
[ ] P1 Восстановить нормативные артефакты v3.3, если ребейз их удалил
[ ] P1 VC-1a: diff --name-only ≡ ожидаемый список из 5 путей
[ ] P1 VC-1b: 4× grep -F → 4 OK
[ ] P2 SessionStart dry-run → VC-2
[ ] P3 Smoke-tests S1+S2+S4+S5 PASS; S3 PASS или documented-skip → VC-3
[ ] P4 Cross-ref в external-review/SKILL.md → CODEX_AUTH.md → VC-4
[ ] P4 Проверить пути в CODEX_AUTH.md
[ ] P5 /pipeline-audit → 7/7 → VC-5
[ ] P6 npm run build + npm test → VC-6
[ ] P7-prep VC-7: grep на запрещённые токены в codex-login.sh → 0 hits
[ ] P7 git push -u origin sprint/codex-auth-integration
[ ] P7 gh pr create с VC-таблицей + smoke-evidence + Beads ID списком
[ ] P7 PM запускает Tester (Critical gate)
[ ] P7 Reviewer Pass 1 → PM triage (defer'ы с Beads ID из P0.2) → fix round → Reviewer Pass 2
[ ] P7 /external-review (Sprint Final)
[ ] P7 /finalize-pr → оператор merge
[ ] POST После merge: обновить .memory_bank/status.md (Sprint MERGED), архивировать план в docs/archive/
```

---

## Verification (после merge в master)

1. **Smoke-test SessionStart:** новая Claude Code сессия в проекте → нет ошибок в SessionStart output, `bd prime` отработал, при `$OPENAI_API_KEY` — `npx @openai/codex login status` = "Logged in".
2. **Dogfood `/external-review`:** запустить `/external-review <PR>` без ручного `codex login` → режим A работает.
3. **Docs navigation:** из `.claude/skills/external-review/SKILL.md` ссылка на `.agents/CODEX_AUTH.md` открывается в VS Code.
4. **Status.md:** обновлён "Sprint Codex Auth MERGED", план в `docs/archive/`.
5. **Hard-gate persistence:** `grep -F 'check-merge-ready'` в `.claude/settings.json` → hit (VC-1b post-merge регрессионный спот-чек).
