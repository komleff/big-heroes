---
name: external-review
description: Кросс-модельное внешнее ревью PR через GPT-5.4 и GPT-5.3-Codex (Codex CLI). Оба ревьюера последовательно по всем 4 аспектам. Используй: /external-review <PR_NUMBER>
user-invocable: true
---

# External Review — кросс-модельное ревью через Codex CLI

Автоматизация Sprint Final (Фаза 3 sprint-pr-cycle). Два внешних ревьюера (GPT-5.4 и GPT-5.3-Codex) работают последовательно по **всем 4 аспектам**, максимизируя adversarial diversity.

> Источник: [Adversarial Code Review для Claude Code](https://habr.com/ru/articles/1019588/)

## Контекст

Прочитай перед началом:

- `.agents/AGENT_ROLES.md` секция "3. Reviewer" — формат вердикта (4 аспекта)
- `.memory_bank/status.md` — текущее состояние проекта

## Аргументы

- `PR_NUMBER` — номер PR для ревью (обязательный)

## Шаг 1: Пререквизиты

### 1.1 Проверка чистоты рабочего дерева

> Проверяется ДО checkout, чтобы не потерять локальные изменения.

```bash
# Проверить чистоту рабочего дерева (включая untracked)
if [ -n "$(git status --porcelain)" ]; then
  echo "СТОП: рабочее дерево не чистое. Закоммить или stash изменения."
  exit 1
fi
```

### 1.2 Проверка PR и переключение на head-ветку

```bash
# Получить метаданные PR (без внешнего jq — используем встроенный --jq)
HEAD_BRANCH=$(gh pr view <PR_NUMBER> --json headRefName --jq '.headRefName')
BASE_BRANCH=$(gh pr view <PR_NUMBER> --json baseRefName --jq '.baseRefName')
STATE=$(gh pr view <PR_NUMBER> --json state --jq '.state')

# PR должен быть открыт
if [ "$STATE" != "OPEN" ]; then echo "СТОП: PR не открыт"; exit 1; fi

# Валидация имени ветки (защита от option injection)
if ! git check-ref-format --allow-onelevel "refs/heads/$HEAD_BRANCH" >/dev/null 2>&1; then
  echo "СТОП: невалидное имя ветки: $HEAD_BRANCH"
  exit 1
fi

# Переключиться на head-ветку PR (гарантирует ревью именно того diff)
git fetch origin "$HEAD_BRANCH"
git switch "$HEAD_BRANCH"
git pull origin "$HEAD_BRANCH"
```

> `BASE_BRANCH` используется далее в `codex review --base "$BASE_BRANCH"` вместо захардкоженного `master`.

Если PR не найден или закрыт — **СТОП**.

### 1.3 Проверка что ветка запушена

```bash
# Проверить наличие upstream
if ! git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  echo "СТОП: upstream не настроен. Выполни: git push -u origin $(git branch --show-current)"
  exit 1
fi

# Проверить незапушенные коммиты
UNPUSHED=$(git log @{u}..HEAD --oneline)
if [ -n "$UNPUSHED" ]; then
  echo "СТОП: есть незапушенные коммиты. Выполни git push."
  exit 1
fi
```

### 1.4 Проверка Codex CLI

```bash
npx @openai/codex login status
```

## Шаг 2: Определение режима работы

Codex CLI поддерживает два режима авторизации с разными возможностями:

### Режим A: API key login (полная adversarial diversity)

Если `npx @openai/codex login status` показывает "API key":

- **Ревьюер A:** `-c model='"gpt-5.4"'` — сильное рассуждение
- **Ревьюер B:** `-c model='"gpt-5.3-codex"'` — фокус на коде
- Две разные модели = максимальная adversarial diversity
- В отчёте: `— Reviewer (GPT-5.4)` и `— Reviewer (GPT-5.3-Codex)`

### Режим B: ChatGPT login (fallback)

Если `npx @openai/codex login status` показывает "ChatGPT":

- **Ревьюер A:** без `-c model=...` (дефолтная модель из `~/.codex/config.toml`), промпт с фокусом на архитектуру + качество
- **Ревьюер B:** без `-c model=...` (та же дефолтная модель), промпт с фокусом на безопасность + гигиену
- Одна модель, но два прохода с разным adversarial-фокусом
- В отчёте **честная атрибуция**: `— Reviewer A (дефолтная модель, проход 1)` и `— Reviewer B (дефолтная модель, проход 2)`. НЕ маркировать как GPT-5.4/GPT-5.3-Codex — это ложный audit trail.

> В обоих режимах каждый ревьюер проверяет все 4 аспекта. Различается акцент промпта и атрибуция.

## Шаг 3: Запуск ревьюеров

### 3.1 Ревьюер A

Ограничение CLI: `--base` нельзя комбинировать с кастомным промптом.

**Рекомендуемый вариант — встроенный ревью:**

```bash
# Режим A (API key) — GPT-5.4:
npx @openai/codex review --base "$BASE_BRANCH" -c model='"gpt-5.4"' -c model_reasoning_effort='"high"'

# Режим B (ChatGPT) — дефолтная модель:
npx @openai/codex review --base "$BASE_BRANCH"
```

> Встроенный ревью выдаёт свободный формат. PM при консолидации (шаг 5) **вручную маппит** вывод на 4 аспекта. Если вывод не покрывает аспект — PM помечает его как "не проверен".

**Альтернатива — кастомный adversarial-промпт** (без `--base`, ревьюит uncommitted):

```bash
npx @openai/codex review "$(cat <<'PROMPT'
Ты — Reviewer в проекте Big Heroes (PixiJS v8 + TypeScript).
Задача: проверь изменения в PR по 4 аспектам. Дай вердикт по каждому.

## Проект

- client/ — PixiJS UI (сцены, HUD)
- shared/ — чистые функции, игровая математика (без side-effects)
- config/balance.json — числовые параметры баланса

## 4 аспекта проверки

### 1. Архитектура
- Разделение client/ и shared/ — бизнес-логика только в shared/
- Нет импортов из client/ в shared/
- Сцены наследуют Container, переходы через SceneManager
- Формулы и расчёты — только из shared/

### 2. Безопасность
- XSS, prototype pollution, command injection
- OWASP Top 10
- Утечка чувствительных данных

### 3. Качество
- Тесты покрывают новый код в shared/
- Edge-cases: нулевые значения, пустые массивы, граничные условия
- Производительность: рендер < 16мс/кадр (60fps)
- Нет дублирования кода

### 4. Гигиена кода
- Нет мёртвого кода (неиспользуемые функции, переменные, импорты)
- Нет дублирования типов между shared/ и client/
- Числовые константы в config/balance.json, не захардкожены
- Нет закомментированного кода без пояснения

## Adversarial Directives

<attack_surface>
- shared/ пакет: чистота функций, отсутствие side-effects
- config/balance.json: целостность, все константы через него
- Импорты между слоями: client не должен содержать бизнес-логику
- XSS через текстовые поля PixiJS
</attack_surface>

<finding_bar>
Для каждого finding ответь:
1. Impact — что сломается?
2. Evidence — конкретный файл и строка
3. Severity — CRITICAL / WARNING / INFO
Только CRITICAL и WARNING. INFO — только для архитектурных решений.
</finding_bar>

<scope_exclusions>
- Форматирование и стиль кода
- Стиль комментариев
- Документация (.md файлы)
- Порядок импортов
</scope_exclusions>

## Формат ответа

```markdown
### Архитектура: [OK / ISSUE]
[обоснование с файлами и строками]

### Безопасность: [OK / ISSUE]
[обоснование]

### Качество: [OK / ISSUE]
[обоснование]

### Гигиена кода: [OK / ISSUE]
[обоснование]

### Итого
CRITICAL: N, WARNING: N
**Вердикт:** [APPROVED / CHANGES_REQUESTED]

— Reviewer (MODEL_NAME)
```
PROMPT
)"
```

Сохрани вывод ревьюера A.

### 3.2 Ревьюер B

Аналогичная команда, но с другой моделью и акцентом в adversarial directives.

**Рекомендуемый вариант — встроенный ревью:**

```bash
# Режим A (API key) — GPT-5.3-Codex:
npx @openai/codex review --base "$BASE_BRANCH" -c model='"gpt-5.3-codex"' -c model_reasoning_effort='"high"'

# Режим B (ChatGPT) — дефолтная модель, второй проход:
npx @openai/codex review --base "$BASE_BRANCH"
```

> Встроенный ревью выдаёт свободный формат. PM при консолидации (шаг 5) **вручную маппит** вывод на 4 аспекта. Если вывод не покрывает аспект — PM помечает его как "не проверен".

**Альтернатива — кастомный adversarial-промпт** (без `--base`):

```bash
npx @openai/codex review "$(cat <<'PROMPT'
Ты — Reviewer в проекте Big Heroes (PixiJS v8 + TypeScript).
Задача: проверь изменения в PR по 4 аспектам. Дай вердикт по каждому.
Ты — второй независимый ревьюер. Не полагайся на то, что первый ревьюер что-то поймал.

## Проект

- client/ — PixiJS UI (сцены, HUD)
- shared/ — чистые функции, игровая математика (без side-effects)
- config/balance.json — числовые параметры баланса

## 4 аспекта проверки

### 1. Архитектура
- Разделение client/ и shared/ — бизнес-логика только в shared/
- Нет импортов из client/ в shared/
- Сцены наследуют Container, переходы через SceneManager
- Формулы и расчёты — только из shared/

### 2. Безопасность
- XSS, prototype pollution, command injection
- OWASP Top 10
- Утечка чувствительных данных

### 3. Качество
- Тесты покрывают новый код в shared/
- Edge-cases: нулевые значения, пустые массивы, граничные условия
- Производительность: рендер < 16мс/кадр (60fps)
- Нет дублирования кода

### 4. Гигиена кода
- Нет мёртвого кода (неиспользуемые функции, переменные, импорты)
- Нет дублирования типов между shared/ и client/
- Числовые константы в config/balance.json, не захардкожены
- Нет закомментированного кода без пояснения

## Adversarial Directives

<attack_surface>
- Безопасность: все внешние входы, текстовые поля, localStorage
- Тесты: покрытие shared/ модулей, детерминизм, mock-изоляция
- Гигиена: мёртвый код после рефакторинга, забытые TODO
- Runtime: утечки памяти в PixiJS (destroy, removeChild)
</attack_surface>

<finding_bar>
Для каждого finding ответь:
1. Impact — что сломается?
2. Evidence — конкретный файл и строка
3. Severity — CRITICAL / WARNING / INFO
Только CRITICAL и WARNING. INFO — только для архитектурных решений.
</finding_bar>

<scope_exclusions>
- Форматирование и стиль кода
- Стиль комментариев
- Документация (.md файлы)
- Порядок импортов
</scope_exclusions>

## Формат ответа

```markdown
### Архитектура: [OK / ISSUE]
[обоснование с файлами и строками]

### Безопасность: [OK / ISSUE]
[обоснование]

### Качество: [OK / ISSUE]
[обоснование]

### Гигиена кода: [OK / ISSUE]
[обоснование]

### Итого
CRITICAL: N, WARNING: N
**Вердикт:** [APPROVED / CHANGES_REQUESTED]

— Reviewer (MODEL_NAME)
```
PROMPT
)"
```

Сохрани вывод ревьюера B.

## Шаг 4: Copilot Re-Review

Запроси re-review от GitHub Copilot (auto-reviewer):

```bash
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
gh api "repos/$REPO/pulls/<PR_NUMBER>/requested_reviewers" \
  --method POST \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]' \
  && echo "Copilot: re-review requested" \
  || echo "Copilot: request failed — может потребоваться ручной запуск"
```

## Шаг 5: Консолидация и публикация

Собери результаты обоих ревьюеров в единый комментарий. Подставь реальные имена моделей из шага 2 (не захардкоженные):

- **Режим A:** `MODEL_A_NAME = "GPT-5.4"`, `MODEL_B_NAME = "GPT-5.3-Codex"`
- **Режим B:** `MODEL_A_NAME = "дефолтная модель, проход 1"`, `MODEL_B_NAME = "дефолтная модель, проход 2"`

```bash
gh pr comment <PR_NUMBER> --body "$(cat <<'EOF'
## Внешнее ревью (Sprint Final)

### Ревьюер A: MODEL_A_NAME

#### Архитектура: [OK / ISSUE]
[обоснование]

#### Безопасность: [OK / ISSUE]
[обоснование]

#### Качество: [OK / ISSUE]
[обоснование]

#### Гигиена кода: [OK / ISSUE]
[обоснование]

**Вердикт:** [APPROVED / CHANGES_REQUESTED]
— Reviewer (MODEL_A_NAME)

---

### Ревьюер B: MODEL_B_NAME

#### Архитектура: [OK / ISSUE]
[обоснование]

#### Безопасность: [OK / ISSUE]
[обоснование]

#### Качество: [OK / ISSUE]
[обоснование]

#### Гигиена кода: [OK / ISSUE]
[обоснование]

**Вердикт:** [APPROVED / CHANGES_REQUESTED]
— Reviewer (MODEL_B_NAME)

---

### Copilot
[re-review requested / auto-triggered / unavailable]

### Итоговый вердикт: [APPROVED / CHANGES_REQUESTED]
CRITICAL: N, WARNING: N

— PM (Claude Opus 4.6), по результатам внешнего ревью
EOF
)"
```

## Шаг 6: Pre-Chat Gate

> Инвариант: review-pass НЕ завершён, пока отчёт не опубликован в PR.

Перед сообщением оператору проверь:

1. `gh pr comment` выполнился успешно
2. Ссылка на комментарий зафиксирована (если доступна)
3. Только после этого сообщай оператору результат

> ⛔ Чат-резюме без PR comment не завершает review-pass.

## Шаг 7: Обработка ошибок

| Ситуация | Действие |
| --- | --- |
| Codex таймаут (>10 мин) | Retry × 1, затем частичный отчёт |
| Пустой вывод от модели | "Review failed: empty response from [model]" |
| Оба ревьюера упали | Эскалация оператору, публикация частичного отчёта |
| Один ревьюер упал | Публикация отчёта с пометкой об упавшем ревьюере |
| Rate limit | Пометить модель как unavailable, продолжить с доступной |

> Никогда не пропускать ошибку молча. Частичный отчёт лучше, чем отсутствие отчёта.

## Шаг 8: Итеративные исправления

Если итоговый вердикт `CHANGES_REQUESTED`:

1. PM передаёт CRITICAL и WARNING findings Developer-субагенту
2. Developer исправляет → `git push`
3. PM запрашивает Copilot re-review (шаг 4)
4. PM повторно запускает `/external-review <PR_NUMBER>`
5. Каждый повторный запуск создаёт **новый** комментарий (не редактирует старый) — для audit trail
