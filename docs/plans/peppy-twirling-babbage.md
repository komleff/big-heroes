# План: Скилл `/external-review` — автоматическое кросс-модельное ревью

## Context

**Проблема:** Фаза 3 (Sprint Final) в `sprint-pr-cycle` — ручная. PM готовит промпты, оператор вручную скармливает их GPT-5.4 и GPT-5.3-Codex, потом возвращает результаты. Это bottleneck и источник ошибок.

**Источник идеи:** [Adversarial Code Review для Claude Code (Хабр)](https://habr.com/ru/articles/1019588/) — adversarial review через Codex CLI, итеративные циклы, adversarial-промпты (attack_surface, finding_bar, scope_exclusions).

**Принципиальное решение:** Оба внешних ревьюера (GPT-5.4 и GPT-5.3-Codex) работают **параллельно по ВСЕМ 4 аспектам** (архитектура, безопасность, качество, гигиена кода). Модели имеют разные bias и ловят разные ошибки — полное дублирование аспектов максимизирует adversarial diversity.

> Формат вердикта — 4 аспекта, как и во внутреннем ревью. Тестовое покрытие проверяется в рамках аспекта «Качество» (текущий контракт из `reviewer.md` и `AGENT_ROLES.md`). Отдельного пятого аспекта «Тесты» не вводится — это предотвращает drift между внутренним и внешним форматом.

**Инструмент:** `npx @openai/codex review --base master` — встроенная diff-awareness, read-only sandbox.

---

## Шаг 0: Beads issue + проверка пререквизитов

> Процедура изменения пайплайна (PIPELINE_ADR секция 7) требует issue в Beads.

```bash
bd create --title="Скилл /external-review — автоматическое кросс-модельное ревью" \
  --description="Автоматизация Фазы 3 (Sprint Final) sprint-pr-cycle. Оба внешних ревьюера (GPT-5.4, GPT-5.3-Codex) параллельно по всем 4 аспектам через codex CLI." \
  --type=feature --priority=2
```

Проверка пререквизитов (ДО написания кода):

```bash
# 1. Codex CLI доступен
npx @openai/codex --help

# 2. OpenAI auth работает (ключ или codex login)
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  echo "OPENAI_API_KEY: set"
else
  echo "OPENAI_API_KEY: missing — проверь codex login"
fi

# 3. Проверка доступных моделей (dry-run через exec, а не review — review требует diff)
npx @openai/codex exec -m gpt-5.4 "Respond with OK" 2>&1 | head -5
npx @openai/codex exec -m gpt-5.3-codex "Respond with OK" 2>&1 | head -5

# 4. Copilot API — проверка доступности (owner/repo вычисляется автоматически)
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
gh api "repos/$REPO/pulls" --jq '.[0].number' 2>/dev/null && echo "GitHub API: OK"

# 5. Copilot — проверяем только доступность GitHub API
# Полноценная проверка re-review будет на целевом PR этой задачи (шаг 2.4)
# Если открытых PR нет — Copilot capability не validated, деградация допустима
gh api "repos/$REPO" --jq '.permissions.push' 2>/dev/null && echo "GitHub repo access: OK"
```

> **Model ID**: `gpt-5.4` и `gpt-5.3-codex` — актуальные модели. НЕ использовать `o4-mini` (устаревшая, не подходит для code review). Если dry-run не проходит — проверить model ID в документации OpenAI и обновить.

Если пререквизиты не пройдены — СТОП, эскалация оператору. Не писать скилл с неработающими командами.

---

## Шаг 1: Создать ветку

```bash
git checkout master && git pull origin master
git checkout -b feature/external-review-skill
```

---

## Шаг 2: Создать скилл `.claude/skills/external-review/SKILL.md`

### Frontmatter

```yaml
---
name: external-review
description: Кросс-модельное внешнее ревью PR через GPT-5.4 и GPT-5.3-Codex (codex CLI). Оба ревьюера параллельно по всем 4 аспектам. Используй: /external-review <PR_NUMBER>
user-invocable: true
---
```

### Логика скилла (секции)

#### 2.1 Пререквизиты

- Прочитать `.agents/AGENT_ROLES.md` секция "3. Reviewer" — формат вердикта (4 аспекта)
- Проверить PR существует: `gh pr view <N> --json number,title,baseRefName,headRefName`
- Проверить что ветка запушена и PR актуален:

```bash
# Проверить что нет незапушенных коммитов
git log @{u}..HEAD --oneline
# Проверить что рабочее дерево чистое
git diff --stat HEAD
```

Если есть незапушенные коммиты — `git push` перед продолжением.

#### 2.2 Ревьюер A: GPT-5.4 (все 4 аспекта)

```bash
npx @openai/codex review \
  --base master \
  -c model='"gpt-5.4"' \
  -c model_reasoning_effort='"high"' \
  "ADVERSARIAL_PROMPT_A"
```

Adversarial-промпт по шаблону из статьи:

- `attack_surface`: shared/ чистота, balance.json целостность, импорты между слоями, XSS, OWASP
- `finding_bar`: для каждого finding — impact, evidence, severity. Только CRITICAL и WARNING.
- `scope_exclusions`: форматирование, стиль комментариев, документация
- Формат: 4 аспекта (архитектура, безопасность, качество, гигиена кода) + итоговый вердикт
- Подпись: `— Reviewer (GPT-5.4)`

#### 2.3 Ревьюер B: GPT-5.3-Codex (все 4 аспекта)

```bash
npx @openai/codex review \
  --base master \
  -c model='"gpt-5.3-codex"' \
  "ADVERSARIAL_PROMPT_B"
```

Те же 4 аспекта, тот же формат вердикта, другая модель → другие bias.
Подпись: `— Reviewer (GPT-5.3-Codex)`

> **Model ID**: `gpt-5.4` и `gpt-5.3-codex` — проверяются в шаге 0 dry-run. В скилле обозначены как переменные `MODEL_A` / `MODEL_B` с комментарием для замены. НЕ использовать `o4-mini` (устаревшая).

#### 2.4 Copilot Re-Review

Copilot активен на репо (ревьюил PR #5, #6), но auto-trigger срабатывает только при создании PR, не после повторных коммитов. Скилл должен **явно запрашивать** Copilot re-review:

```bash
# Запросить Copilot re-review через GitHub API
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
gh api "repos/$REPO/pulls/<N>/requested_reviewers" \
  --method POST \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]' \
  2>/dev/null && echo "Copilot: re-review requested" \
  || echo "Copilot: request failed, may auto-trigger on push"
```

Этот шаг выполняется также в sprint-pr-cycle после каждого fix-цикла (шаг 2.3).

#### 2.5 Консолидация и публикация

PM читает stdout обоих codex review вызовов. Формирует единый комментарий:

```markdown
## Внешнее ревью (Sprint Final)

### Ревьюер A: GPT-5.4

#### Архитектура: [OK / ISSUE]
[обоснование]

#### Безопасность: [OK / ISSUE]
[обоснование]

#### Качество: [OK / ISSUE]
[обоснование]

#### Гигиена кода: [OK / ISSUE]
[обоснование]

**Вердикт:** [APPROVED / CHANGES_REQUESTED]
— Reviewer (GPT-5.4)

---

### Ревьюер B: GPT-5.3-Codex

#### Архитектура: [OK / ISSUE]
[обоснование]

#### Безопасность: [OK / ISSUE]
[обоснование]

#### Качество: [OK / ISSUE]
[обоснование]

#### Гигиена кода: [OK / ISSUE]
[обоснование]

**Вердикт:** [APPROVED / CHANGES_REQUESTED]
— Reviewer (GPT-5.3-Codex)

---

### Copilot
[статус: re-review requested / auto-triggered / unavailable]

### Итоговый вердикт: [APPROVED / CHANGES_REQUESTED]
[CRITICAL: N, WARNING: N]

— PM (Claude Opus 4.6), по результатам внешнего ревью
```

Публикация: `gh pr comment <N> --body "..."`

#### 2.6 Обработка ошибок

- Таймаут codex (>10 мин) → retry × 1 → частичный отчёт с пометкой
- Пустой вывод → "Review failed: empty response from [model]"
- Оба упали → эскалация оператору, публикация частичного отчёта
- Никогда не пропускать молча

#### 2.7 Pre-Chat Gate

Инвариант из sprint-pr-cycle:

1. `gh pr comment` выполнился успешно
2. Ссылка на комментарий зафиксирована
3. Только после этого сообщать оператору

---

## Шаг 3: Обновить sprint-pr-cycle

**Файл:** `.claude/skills/sprint-pr-cycle/SKILL.md`

### Фаза 3 — замена шагов 3.1 и 3.2

Было:

```
Шаг 3.1: Создай файл docs/plans/sprint-N-review-prompts.md с промптами для GPT-5.4 и GPT-5.3-Codex
Шаг 3.2: После получения вердиктов от оператора — опубликуй в PR
```

Стало:

```
Шаг 3.1: Запусти /external-review <PR_NUMBER>
Скилл автоматически запустит GPT-5.4 и GPT-5.3-Codex (оба по всем 4 аспектам),
запросит Copilot re-review и опубликует консолидированный отчёт в PR.

Шаг 3.2: Если вердикт CHANGES_REQUESTED — исправь CRITICAL,
git push, запроси Copilot re-review, повтори /external-review <PR_NUMBER>.
Если APPROVED — переходи к Фазе 4.
```

### Шаг 2.3 — добавить Copilot re-review

После fix-цикла (git push + gh pr comment) добавить запрос Copilot:

```bash
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
gh api "repos/$REPO/pulls/<N>/requested_reviewers" \
  --method POST -f 'reviewers[]=copilot-pull-request-reviewer[bot]' 2>/dev/null
```

---

## Шаг 4: Обновить PIPELINE_ADR.md

**Файл:** `.agents/PIPELINE_ADR.md`

Добавить в секцию 4 (Ключевые решения) новый пункт:

### 3.10 Автоматическое кросс-модельное ревью через Codex CLI

**Решение:** Sprint Final выполняется автоматически скиллом `/external-review`. Оба внешних ревьюера (GPT-5.4 и GPT-5.3-Codex) работают параллельно по **всем 4 аспектам** (архитектура, безопасность, качество, гигиена кода). Claude PM консолидирует результаты и публикует в PR.

**Обоснование:**

- До этого Sprint Final был ручным: PM готовил промпты в `docs/plans/sprint-N-review-prompts.md`, оператор копировал в ChatGPT/Codex, результаты возвращал PM. Bottleneck + source of errors.
- Codex CLI (`npx @openai/codex review --base master`) позволяет вызвать внешние модели из CLI с diff-awareness — модель видит полный контекст файлов.
- Оба ревьюера проверяют все 4 аспекта (а не делят между собой) — максимизирует adversarial diversity. Практика Sprint 2 и Sprint 3 показала: GPT-5.4 и GPT-5.3-Codex находят разные проблемы в одних аспектах.
- Формат вердикта един для внутреннего и внешнего ревью (4 аспекта) — предотвращает drift.
- Adversarial-промпты (attack_surface, finding_bar, scope_exclusions) из [статьи](https://habr.com/ru/articles/1019588/) снижают noise и фокусируют ревью.

**Альтернативы отвергнуты:**

| Альтернатива | Почему отвергнута |
| --- | --- |
| Разделение аспектов между моделями | Снижает adversarial diversity |
| Ручной процесс (текущий) | Медленный, error-prone, зависит от оператора |
| 5-й аспект «Тесты» для внешнего ревью | Drift с внутренним форматом (4 аспекта); тесты проверяются в «Качество» |

**Связь с инвариантами:**

- Инвариант 1 (роли разделены): сохранён — внешние модели ревьюят, Claude PM оркестрирует
- Инвариант 4 (результат в PR): сохранён — Pre-Chat Gate обязателен
- Инвариант 6 (контекст между сессиями): сохранён — Memory Bank не затрагивается, PM по-прежнему обновляет `.memory_bank/status.md` при завершении спринта (PM_ROLE.md секция 2.5 "Landing the Plane")
- Инвариант 7 (merge = решение оператора): сохранён

**Источник:** [Adversarial Code Review для Claude Code](https://habr.com/ru/articles/1019588/)

---

## Шаг 5: Синхронизация всех связанных документов

> Урок PR #3: изменение в одном файле без обновления связанных = drift за 11 раундов. Обновляем ВСЕ файлы, упоминающие Sprint Final или внешнее ревью.

### 5.1 `.agents/AGENT_ROLES.md`

Два места для обновления:

**a) Секция "3. Reviewer" → таблица Review Tiers:**

```text
Sprint Final | Конец спринта, перед merge | GPT-5.4 + GPT-5.3-Codex (автоматически через `/external-review`, оба по всем 4 аспектам)
```

**b) Текст под таблицей:**

- Было: `Sprint Final обязателен перед merge в master. PM инициирует кросс-модельное ревью, передавая PR внешним моделям.`
- Стало: `Sprint Final обязателен перед merge в master. PM запускает /external-review, который автоматически вызывает GPT-5.4 и GPT-5.3-Codex через Codex CLI.`

### 5.2 `.agents/PIPELINE.md`

Секция "3. Жизненный цикл спринта" → шаг внешнего ревью:

- Было: `APPROVED → оператор передаёт в внешнее ревью (GPT / Copilot)`
- Стало: `APPROVED → PM → /external-review → кросс-модельное ревью (GPT-5.4 + GPT-5.3-Codex + Copilot)`

Секция "2. Карта компонентов" → добавить строку:

```
| external-review | Скилл | `.claude/skills/external-review/` | Кросс-модельное ревью через Codex CLI |
```

### 5.3 `.claude/agents/reviewer.md`

Секция "Sprint Final":

- Было: `Кто: GPT-5.4 + GPT-5.3-Codex (оператор передаёт PR внешним моделям)`
- Стало: `Кто: GPT-5.4 + GPT-5.3-Codex (автоматически через скилл /external-review)`

### 5.4 `.agents/REFERENCES.md`

Добавить в секцию "Статьи и практики":

```markdown
- **Adversarial Code Review для Claude Code** — кросс-модельное ревью через Codex CLI, adversarial-промпты
  https://habr.com/ru/articles/1019588/
```

### 5.5 `.agents/HOW_TO_USE.md`

Два места для обновления:

**a) Секция "3. Как использовать /sprint-pr-cycle"** — добавить:

```text
Скилл включает автоматическое внешнее ревью (/external-review).
Copilot re-review запрашивается автоматически.
```

**b) Секция "4. Как принимать решение о merge"** — обновить критерий:

- Было: `APPROVED от Claude + APPROVED от внешней модели → можно мержить`
- Стало: `APPROVED от Claude + APPROVED от обоих внешних ревьюеров (GPT-5.4, GPT-5.3-Codex) → можно мержить`

### 5.6 `.agents/PM_ROLE.md`

Нет прямых изменений — PM_ROLE.md ссылается на sprint-pr-cycle и AGENT_ROLES.md, которые уже обновлены. Проверить отсутствие drift grep-ом.

---

## Шаг 6: Верификация целостности

```bash
# Проверить что все файлы с "Sprint Final" согласованы
grep -rn "Sprint Final\|оператор передаёт PR внешним\|review-prompts" .agents/ .claude/

# Проверить что формат вердикта везде 4 аспекта
grep -rn "Тесты: \[OK" .agents/ .claude/  # должно быть 0 результатов

# Сборка и тесты (doc-only, но проверяем)
npm run build && npm run test
```

---

## Шаг 7: Коммит и push

```bash
git add \
  .claude/skills/external-review/SKILL.md \
  .claude/skills/sprint-pr-cycle/SKILL.md \
  .agents/PIPELINE_ADR.md \
  .agents/AGENT_ROLES.md \
  .agents/PIPELINE.md \
  .agents/REFERENCES.md \
  .claude/agents/reviewer.md \
  .agents/HOW_TO_USE.md

git commit -m "feat: скилл /external-review — автоматическое кросс-модельное ревью

- Новый скилл: GPT-5.4 + GPT-5.3-Codex параллельно по всем 4 аспектам
- sprint-pr-cycle Фаза 3 → вызов /external-review
- Copilot re-review запрашивается автоматически после fix-циклов
- PIPELINE_ADR: решение 3.10 с обоснованием
- Синхронизация: AGENT_ROLES, PIPELINE, reviewer.md, HOW_TO_USE, REFERENCES"

git push -u origin feature/external-review-skill
```

---

## Полный список файлов

| Файл | Действие | Назначение |
| --- | --- | --- |
| `.claude/skills/external-review/SKILL.md` | CREATE | Новый скилл |
| `.claude/skills/sprint-pr-cycle/SKILL.md` | MODIFY | Фаза 3 → `/external-review` + Copilot |
| `.agents/PIPELINE_ADR.md` | MODIFY | Решение 3.10 + обоснование |
| `.agents/AGENT_ROLES.md` | MODIFY | Review Tiers таблица + фраза про PM/Sprint Final |
| `.agents/PIPELINE.md` | MODIFY | Жизненный цикл + карта компонентов |
| `.agents/REFERENCES.md` | MODIFY | Ссылка на статью |
| `.claude/agents/reviewer.md` | MODIFY | Sprint Final описание |
| `.agents/HOW_TO_USE.md` | MODIFY | Секция sprint-pr-cycle + критерий merge-решения |

## Верификация

1. Шаг 0: dry-run `codex exec` — CLI + model + auth доступны
2. `npm run build && npm run test` — код не сломан
3. `grep -rn "Sprint Final" .agents/ .claude/` — нет противоречий
4. `grep -rn "оператор передаёт PR внешним" .agents/ .claude/` — 0 результатов (старый текст удалён)
5. VS Code показывает `/external-review` в списке скиллов

## Открытые вопросы (все решаются в шаге 0)

1. **Model ID**: `gpt-5.4` и `gpt-5.3-codex` доступны? — dry-run через `codex exec` в шаге 0
2. **OPENAI_API_KEY**: установлен? — проверка в шаге 0
3. **Copilot API**: `gh api .../requested_reviewers` работает для bot-аккаунта `copilot-pull-request-reviewer[bot]`? — проверка в шаге 0 (GitHub API + наличие PR)
