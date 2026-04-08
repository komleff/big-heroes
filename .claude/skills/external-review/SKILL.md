---
name: external-review
description: Кросс-модельное внешнее ревью PR через GPT-5.4 и GPT-5.3-Codex (Codex CLI). Оба ревьюера параллельно по всем 4 аспектам. Используй: /external-review <PR_NUMBER>
user-invocable: true
---

# External Review — кросс-модельное ревью через Codex CLI

Автоматизация Sprint Final (Фаза 3 sprint-pr-cycle). Два внешних ревьюера (GPT-5.4 и GPT-5.3-Codex) работают параллельно по **всем 4 аспектам**, максимизируя adversarial diversity.

> Источник: [Adversarial Code Review для Claude Code](https://habr.com/ru/articles/1019588/)

## Контекст

Прочитай перед началом:

- `.agents/AGENT_ROLES.md` секция "3. Reviewer" — формат вердикта (4 аспекта)
- `.memory_bank/status.md` — текущее состояние проекта

## Аргументы

- `PR_NUMBER` — номер PR для ревью (обязательный)

## Шаг 1: Пререквизиты

### 1.1 Проверка PR

```bash
gh pr view <PR_NUMBER> --json number,title,baseRefName,headRefName,state
```

Если PR не найден или закрыт — **СТОП**.

### 1.2 Проверка что ветка запушена

```bash
# Незапушенные коммиты
git log @{u}..HEAD --oneline
# Чистота рабочего дерева
git diff --stat HEAD
```

Если есть незапушенные коммиты — выполни `git push` перед продолжением.

### 1.3 Проверка Codex CLI

```bash
npx @openai/codex login status
```

## Шаг 2: Определение режима работы

Codex CLI поддерживает два режима авторизации с разными возможностями:

### Режим A: API key login (полная adversarial diversity)

Если `npx @openai/codex login status` показывает "API key":

- **Ревьюер A:** `-m gpt-5.4` — сильное рассуждение
- **Ревьюер B:** `-m gpt-5.3-codex` — фокус на коде
- Две разные модели = максимальная adversarial diversity

### Режим B: ChatGPT login (fallback)

Если `npx @openai/codex login status` показывает "ChatGPT":

- **Ревьюер A:** дефолтная модель, промпт с фокусом на архитектуру + качество
- **Ревьюер B:** дефолтная модель, промпт с фокусом на безопасность + гигиену
- Одна модель, но два прохода с разным adversarial-фокусом

> В обоих режимах каждый ревьюер проверяет все 4 аспекта. Различается только акцент промпта.

## Шаг 3: Запуск ревьюеров

### 3.1 Ревьюер A

Выполни `codex review` с промптом ниже. Подставь модель по режиму (шаг 2).

```bash
npx @openai/codex review \
  --base master \
  -c model='"MODEL_A"' \
  -c model_reasoning_effort='"high"' \
  "$(cat <<'PROMPT'
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

Аналогичная команда, но с `MODEL_B` и другим акцентом в adversarial directives:

```bash
npx @openai/codex review \
  --base master \
  -c model='"MODEL_B"' \
  -c model_reasoning_effort='"high"' \
  "$(cat <<'PROMPT'
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
  2>/dev/null && echo "Copilot: re-review requested" \
  || echo "Copilot: request failed, may auto-trigger on push"
```

## Шаг 5: Консолидация и публикация

Собери результаты обоих ревьюеров в единый комментарий. Формат:

```bash
gh pr comment <PR_NUMBER> --body "$(cat <<'EOF'
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
