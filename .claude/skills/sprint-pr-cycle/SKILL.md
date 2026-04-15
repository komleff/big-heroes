---
name: sprint-pr-cycle
description: Оркестрация полного PR-цикла спринта — от создания PR до готовности к merge. Контролирует порядок шагов, запуск субагентов, публикацию отчётов. Используй когда PM завершил кодирование спринта и готов к ревью-циклу.
user-invocable: true
---

# Sprint PR Cycle

Оркестратор полного ревью-цикла спринта. Ведёт PM по обязательным шагам, не позволяя пропустить ни один.

## Контекст

Прочитай перед началом:
- `.agents/AGENT_ROLES.md` — роли и правила
- `.memory_bank/status.md` — текущее состояние

## Инвариант review-pass

Каждый review-pass считается завершённым только после публикации отчёта в PR через `gh pr comment`.

Обязательная последовательность для любого прохода:
1. Сформировать вердикт или summary текущего прохода.
2. Опубликовать его в PR через `gh pr comment`.
3. Подтвердить, что публикация успешна; зафиксировать ссылку на комментарий, если она доступна.
4. Только после этого переходить к следующему шагу цикла или писать оператору о результате.

> ⛔ Чат-резюме без PR comment не завершает review-pass.
> ⛔ Термин «финальный ответ» не используется как gate для ревью; gate = успешная публикация текущего прохода.

## Фаза 1: Подготовка PR

### Шаг 1.1: Проверка готовности

Запусти единый gate:

```
/verify
```

> `/verify` — единая точка проверки (build + test). При расширении пайплайна (linter, typecheck) добавляется туда, чтобы не было расползания проверок по скиллам.

Если `/verify` упал — **СТОП**. Исправь перед продолжением.

### Шаг 1.2: Push всех изменений

```bash
git status --porcelain
git push
```

### Шаг 1.3: Создание PR

```bash
BRANCH=$(git branch --show-current)
gh pr list --head "$BRANCH" --json number,title --jq '.[0]'
```

Если PR не найден — создай. **Обязательно укажи `Tier:` в body** — `/finalize-pr` использует его для автодетекта Sprint Final (без маркера hard gate ошибочно классифицирует PR как `standard` и не потребует external review):

| Tier в body | Когда указывать |
|-------------|-----------------|
| `Tier: Sprint Final` | PR завершает спринт и идёт к merge в master (требует `/external-review`) |
| `Tier: Critical` | shared/, config/balance.json, нормативные артефакты пайплайна |
| `Tier: Standard` | Фичи, рефакторинг, обычные PR |
| `Tier: Light` | Только документация |

```bash
TIER_LINE="Tier: Standard"  # или Sprint Final / Critical / Light — см. таблицу выше
gh pr create --title "Sprint N: [краткое описание]" --body "$(cat <<EOF
$TIER_LINE

## Summary
- [список ключевых изменений]

## Issues
- [список закрытых beads issues]

## Test plan
- [ ] /verify

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

> Sprint Final дополнительно полезно помечать GitHub-меткой `sprint-final` (если права позволяют) — `/finalize-pr` видит ОБА маркера: label ИЛИ `Tier: Sprint Final` в body. Достаточно одного, body-маркер канонический и работает без прав на labels.

## Фаза 2: Внутреннее ревью

### Шаг 2.0a: Чтение Copilot auto-review (ОБЯЗАТЕЛЬНО)

> ⚠️ **Copilot автоматически запускает review при создании PR.** Его комментарии появляются в PR в течение 1–3 минут после `gh pr create`. **PM ОБЯЗАН** прочитать их **до запуска** reviewer-субагентов — иначе findings Copilot'а не попадут в triage и могут быть пропущены (реальный случай: PR #9 пропустил 7 Copilot-замечаний в 10 раундах ревью).

Выгрузка комментариев Copilot:

```bash
# Все review-треды (комментарии, привязанные к строкам кода)
timeout 10 gh pr view <PR_NUMBER> --json reviews \
  | jq -r '.reviews[] | select(.author.login | contains("copilot-pull-request-reviewer")) | .body' \
  | head -200

# Комментарии на уровне файлов/строк — через MCP (или gh api)
timeout 10 gh api repos/OWNER/REPO/pulls/<PR_NUMBER>/comments \
  | jq -r '.[] | select(.user.login | contains("copilot")) | "\(.path):\(.line) — \(.body)"'
```

Для каждого Copilot-findings:
- Если валиден → добавь в triage как `fix now` / `defer to Beads` / `reject with rationale`.
- Помечай в консолидированном отчёте как `**[Copilot]**` (атрибуция источника).

### Шаг 2.0b: Запрос повторного Copilot re-review после фиксов (ОБЯЗАТЕЛЬНО)

> ⛔ **Инвариант auto-loop.** После КАЖДОГО push с фиксами Copilot findings PM **немедленно** запрашивает re-review — без напоминания оператора, в том же сообщении, что и сам push. Без явного запроса Copilot не реагирует на push автоматически: review-loop тихо останавливается, и оператор видит «жду ответа», когда на самом деле ничего не запрошено.
>
> Реальный случай (PR #9): за сессию дважды пришлось вручную напоминать «ты запросил re-review?» — каждый пропуск саботирует автоматизацию пайплайна. Это hard rule, не soft guideline.

Сразу после `git push` (без промежуточных шагов):

```bash
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
gh api "repos/$REPO/pulls/<PR_NUMBER>/requested_reviewers" \
  --method POST -f 'reviewers[]=copilot-pull-request-reviewer[bot]' \
  && echo "Copilot: re-review requested" \
  || echo "Copilot: request failed"
```

Через MCP (если `gh` недоступен): `mcp__github__request_copilot_review`.

> ⛔ Сообщение оператору вида «жду Copilot re-review» **запрещено**, если запрос фактически не отправлен. Если запрос не отправляется (нет прав, ошибка API) — это эскалация, а не «жду».

### Шаг 2.0: Определение review tier (ОБЯЗАТЕЛЬНО)

Tier выбирается по содержимому изменений PR:

| Tier | Когда | Ревью |
|------|-------|-------|
| **Light** | Только документация (`.md`), конфиги без логики | Один проход, аспекты «Архитектура» и «Гигиена кода» |
| **Standard** | Фичи, рефакторинг, обычные PR | Один проход, все 4 аспекта параллельно |
| **Critical** | Изменения в `shared/`, `config/balance.json`, игровая логика, формулы, **нормативные артефакты пайплайна** (`.claude/settings.json` hooks, `.claude/hooks/*`, `.claude/skills/*/SKILL.md`, `.claude/agents/*.md`) | Tester gate + два прохода, все 4 аспекта |
| **Sprint Final** | PR, завершающий спринт (готовится к merge в master) | Standard/Critical + обязательный `/external-review` |

Определение tier:
```bash
gh pr diff <PR_NUMBER> --name-only > /tmp/pr-files.txt

# Critical, если есть изменения в shared/ или config/balance.json
if grep -qE '^(shared/|config/balance\.json)' /tmp/pr-files.txt; then
  TIER="critical"
# Critical, если затронуты нормативные артефакты пайплайна — .claude/settings.json,
# hooks, skills, agents. Эта проверка идёт ДО light-ветки, потому что такие файлы
# имеют расширение .json/.md и иначе были бы ложно классифицированы как light.
elif grep -qE '^\.claude/(settings\.json|hooks/|skills/|agents/)' /tmp/pr-files.txt; then
  TIER="critical"
# Light, если только .md/.json без логики
elif ! grep -qvE '\.(md|json)$' /tmp/pr-files.txt; then
  TIER="light"
else
  TIER="standard"
fi
echo "Tier: $TIER"
```

**Правила выбора при смешанных изменениях (не понижай tier):**

- **Любое изменение в `shared/` или `config/balance.json`** → tier = `critical`, даже если 99% PR это документация. Игровая математика не может быть проревьюена поверхностно.
- **Только `.md` / `.json` без логики (`settings.json` hooks — не «без логики»!)** → tier = `light` разрешается.
- **Смешанные `client/` + `docs/`** → tier = `standard`.
- **Изменения в `.claude/settings.json` hook-логики, `.claude/hooks/*`, `.claude/skills/*/SKILL.md`, `.claude/agents/*.md`** → приравниваются к `critical` (нормативные артефакты пайплайна), даже если расширение `.json`/`.md`.
- Для PR помеченного как **Sprint Final** (завершение спринта перед merge в master) — к выбранному tier добавляется обязательный `/external-review` в Фазе 3.

> Если PR помечен как Sprint Final (метка `sprint-final` или явно в описании) — добавь обязательный `/external-review` в Фазе 3 поверх выбранного tier.

### Шаг 2.0.1: Tester gate для Critical (только Critical tier)

> Применяется **до** запуска reviewer'ов. Цель: найти непокрытые edge-cases ДО ревью кода.

Промпт Tester-субагенту:
```
Ты Tester. Прочитай .agents/AGENT_ROLES.md секция "4. Tester".
Задача: проверь PR #<PR_NUMBER>. Tier: Critical.
Контекст: PR трогает shared/ или config/balance.json — игровая математика.
Найди:
- Edge cases из Verification Contract плана (docs/plans/<sprint>.md), не покрытые тестами
- Граничные значения из config/balance.json без покрытия
- Регрессии: сценарии, ранее работавшие, которые могут сломаться
Верни findings PM (НЕ публикуй в PR).
```

Если Tester нашёл **непокрытые edge-cases** — PM делегирует Developer'у написать тесты, затем повторный `/verify`. Только после этого — переход к шагу 2.1.

### Шаг 2.1: Запуск reviewer субагентов (параллельно)

> В этом skill reviewer субагенты не публикуют комментарии в PR самостоятельно.
> Они возвращают результаты PM.
> Владельцем внутреннего review-pass является PM, и именно PM публикует единый комментарий за проход.

**Архитектура:**
```
Ты Reviewer. Прочитай .agents/AGENT_ROLES.md секция "3. Reviewer".
Задача: проверь PR #<PR_NUMBER> — аспект АРХИТЕКТУРА.
Фокус: разделение слоёв (client/shared), чистота shared-пакета, паттерны сцен.
Результат: вердикт APPROVED / CHANGES_REQUESTED с обоснованием.
```

**Безопасность:**
```
Ты Reviewer. Прочитай .agents/AGENT_ROLES.md секция "3. Reviewer".
Задача: проверь PR #<PR_NUMBER> — аспект БЕЗОПАСНОСТЬ.
Фокус: XSS, утечка данных, OWASP top-10.
Результат: вердикт APPROVED / CHANGES_REQUESTED с обоснованием.
```

**Качество:**
```
Ты Reviewer. Прочитай .agents/AGENT_ROLES.md секция "3. Reviewer".
Задача: проверь PR #<PR_NUMBER> — аспект КАЧЕСТВО.
Фокус: покрытие тестами, edge-cases, производительность < 16мс/кадр.
Результат: вердикт APPROVED / CHANGES_REQUESTED с обоснованием.
```

**Гигиена кода:**
```
Ты Reviewer. Прочитай .agents/AGENT_ROLES.md секция "3. Reviewer".
Задача: проверь PR #<PR_NUMBER> — аспект ГИГИЕНА КОДА.
Фокус: мёртвый код, дублирование типов, захардкоженные константы, закомментированный код.
Результат: вердикт APPROVED / CHANGES_REQUESTED с обоснованием.
```

### Шаг 2.2: Публикация отчёта

> **Commit binding обязателен.** `/finalize-pr` (фаза 1, шаг 3) ищет последний internal review-pass с `Commit: <hash>` ИЛИ `"commit": "<hash>"` в HTML META. Без этих маркеров скилл считает review-pass отсутствующим и блокирует финализацию. Формат идентичен external-review для единообразия.

Перед публикацией зафиксируй HEAD commit:

```bash
HEAD_COMMIT=$(timeout 10 gh pr view <PR_NUMBER> --json headRefOid --jq '.headRefOid')
```

Затем публикуй отчёт. **Используй quoted heredoc `<<'EOF'` + плейсхолдер**, чтобы bash не делал подстановок внутри тела (резюме reviewer-субагентов может содержать `$VAR`, `$(...)`, backticks — без quoted heredoc их раскроет shell и текст исказится). Подставь `$HEAD_COMMIT` после, через bash parameter expansion:

```bash
BODY=$(cat <<'EOF'
## Внутреннее ревью (Claude) — review-pass

Commit: `__HEAD_COMMIT__`

<!-- {"reviewer": "claude-opus-4-6", "commit": "__HEAD_COMMIT__", "kind": "internal"} -->

### Архитектура
**Вердикт:** [APPROVED / CHANGES_REQUESTED]
[резюме]

### Безопасность
**Вердикт:** [APPROVED / CHANGES_REQUESTED]
[резюме]

### Качество
**Вердикт:** [APPROVED / CHANGES_REQUESTED]
[резюме]

### Гигиена кода
**Вердикт:** [APPROVED / CHANGES_REQUESTED]
[резюме]

— PM (Claude Opus 4.6)
EOF
)
# Безопасная подстановка commit hash (не через eval/cat <<EOF без кавычек):
BODY="${BODY//__HEAD_COMMIT__/$HEAD_COMMIT}"
gh pr comment <PR_NUMBER> --body "$BODY"
```

### Шаг 2.2.1: Pre-Chat Gate

Перед любым сообщением оператору о результате внутреннего ревью проверь:

- PR идентифицирован корректно
- `gh pr comment` выполнился успешно
- Есть подтверждение публикации; ссылка на комментарий предпочтительна

Если хотя бы один пункт не выполнен, review-pass не завершён.

### Шаг 2.3: Исправление замечаний (если есть)

Если хотя бы один аспект `CHANGES_REQUESTED`:

1. Запусти developer субагента на исправления
2. `git push`
3. `gh pr comment` с отчётом об исправлениях
4. Запроси Copilot re-review:

```bash
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
gh api "repos/$REPO/pulls/<PR_NUMBER>/requested_reviewers" \
  --method POST -f 'reviewers[]=copilot-pull-request-reviewer[bot]' \
  && echo "Copilot: re-review requested" \
  || echo "Copilot: request failed — может потребоваться ручной запуск"
```

5. Повтори ревью

> ⛔ `git push` без `gh pr comment` = незавершённый цикл. Не останавливайся после push.
> Только `gh pr comment` — не `gh pr review` (агенты работают под аккаунтом оператора).
> ⛔ После повторного ревью снова действует тот же review-pass gate: сначала публикация, потом сообщение оператору.

### Шаг 2.4: Critical — второй проход (только Critical tier)

Для tier=Critical обязателен **второй проход** всех 4 аспектов после фиксов первого прохода. Цель — поймать то, что было пропущено или сломано в ходе исправлений.

Промпт каждому Reviewer-субагенту изменяется:
```
Ты Reviewer (второй проход). Прочитай .agents/AGENT_ROLES.md секция "3. Reviewer".
Контекст: PR #<PR_NUMBER>, Critical tier, фиксы первого прохода применены.
Фокус: то, что мог пропустить первый проход; регрессии от фиксов; сценарии,
не покрытые первым проходом.
Аспект: <АРХИТЕКТУРА | БЕЗОПАСНОСТЬ | КАЧЕСТВО | ГИГИЕНА КОДА>.
Верни findings PM (НЕ публикуй в PR).
```

PM публикует второй консолидированный отчёт (по аналогии с шагом 2.2). В JSON-метаданных `iteration: 2`.

Если второй проход дал `CHANGES_REQUESTED` — повторить шаг 2.3 → 2.4 до APPROVED.

> Если tier=Light, шаги 2.0.1, 2.4 пропускаются. Если tier=Standard — пропускается только 2.4.

## Фаза 3: Внешнее ревью (Sprint Final)

> **ОБЯЗАТЕЛЬНО перед merge в master.** PM запускает `/external-review` для кросс-модельного ревью через Codex CLI. Модели определяются автоматически по режиму авторизации (API key или ChatGPT login).

### Шаг 3.1: Запуск внешнего ревью

Вызови скилл:

```
/external-review <PR_NUMBER>
```

Скилл выполнит:

- Запуск внешних ревьюеров через Codex CLI (по всем 4 аспектам)
- Запрос Copilot re-review
- PM консолидирует вывод и публикует отчёт в PR через `gh pr comment` (ручной шаг в скилле)

> ⚠️ **Проверь режим работы.** `/external-review` автоматически выбирает режим по доступности Codex CLI. Режимы C (Codex недоступен → Claude adversarial degraded) и D (ручной emergency через Copilot Agent) **требуют явной метки в финальном отчёте** — см. таблицу в `external-review/SKILL.md` шаг 5.1. PM должен убедиться, что метка присутствует: «⚠️ Degraded mode» (C) или «⚠️ Manual emergency mode» (D). Без метки audit trail вводит в заблуждение — Sprint Final маркируется как cross-model review, хотя им не является.

### Шаг 3.2: Обработка результатов

Если вердикт `CHANGES_REQUESTED`:

1. Исправь CRITICAL и WARNING замечания через Developer-субагента
2. `git push`
3. Запроси Copilot re-review:

```bash
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
gh api "repos/$REPO/pulls/<PR_NUMBER>/requested_reviewers" \
  --method POST -f 'reviewers[]=copilot-pull-request-reviewer[bot]' \
  && echo "Copilot: re-review requested" \
  || echo "Copilot: request failed — может потребоваться ручной запуск"
```

4. Повтори `/external-review <PR_NUMBER>`

Если вердикт `APPROVED` — переходи к Фазе 3.5.

## Фаза 3.5: Triage замечаний (обязательно перед финализацией)

Все findings из внутреннего и внешнего ревью должны получить явный статус. Это инвариант 4 v3.3 и предусловие `/finalize-pr` фаза 2.

| Статус | Действие PM | Валидация |
|--------|-------------|-----------|
| **fix now** | Developer исправляет, повторный review-pass на новом commit | Повторный APPROVED для затронутого аспекта |
| **defer to Beads** | PM создаёт issue через `bd create`, фиксирует ID в PR | Обязателен Beads ID. Канонические правила валидации (приоритет `bd show <id>`, fallback regex, формат) — см. **`.claude/skills/finalize-pr/SKILL.md` фаза 2**. Не дублируй regex здесь, чтобы избежать drift |
| **reject with rationale** | PM публикует обоснование в PR | Обоснование не пустое |

Замечания без статуса = незавершённый цикл. `/finalize-pr` фаза 2 заблокирует финализацию.

Если `defer_ratio > 50%` — это сигнал defer-abuse. Скилл `/finalize-pr` выведет предупреждение оператору, но merge не блокирует (план v3.3 секция 1.4).

## Фаза 4: Финализация через `/finalize-pr`

> ⛔ **Не публикуй «готов к merge» вручную.** Hook `.claude/hooks/check-merge-ready.py` блокирует такие формулировки в `gh pr comment` вне `/finalize-pr`. Даже если все проверки зелёные — финализация идёт только через скилл.

Вызови скилл:

```
/finalize-pr <PR_NUMBER>
```

`/finalize-pr` сам проверит:
1. HEAD commit hash PR.
2. `/verify` зелёный на этом commit.
3. Internal review-pass привязан к этому commit.
4. Если tier = Sprint Final — external review есть на этом commit.
5. После CHANGES_REQUESTED был повторный review-pass на текущем commit.
6. (фаза 2) У каждого замечания есть triage-статус (fix now / defer с Beads ID / reject с обоснованием).
7. (фаза 2) Warning при `defer_ratio > 50%`.

Если все проверки пройдены — скилл опубликует финальный комментарий `## ✅ Готов к merge` через inline-токен `FINALIZE_PR_TOKEN`, который обходит hook только для этого одного вызова.

После публикации — сообщи оператору: «Опубликован финальный комментарий в PR #<N>. Решение о merge — за тобой.»

> См. `.claude/skills/finalize-pr/SKILL.md` для полной логики, шаблонов и emergency override `--force`.
