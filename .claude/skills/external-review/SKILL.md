---
name: external-review
description: Внешнее ревью PR с 4 режимами деградации. A (API key, GPT-5.4+GPT-5.3-Codex), B (ChatGPT login, 1 проход), C (Codex недоступен, Claude adversarial degraded), D (ручной через VS Code Copilot). Используй: /external-review <PR_NUMBER>
user-invocable: true
---

# External Review — кросс-модельное ревью с degradation path

Автоматизация Sprint Final (Фаза 3 sprint-pr-cycle). Два внешних ревьюера работают последовательно по **всем 4 аспектам**, максимизируя adversarial diversity. При недоступности Codex CLI предусмотрены degraded-режимы — Sprint Final не блокируется, но помечается честно.

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
BASE_BRANCH=$(gh pr view <PR_NUMBER> --json baseRefName --jq '.baseRefName')
STATE=$(gh pr view <PR_NUMBER> --json state --jq '.state')

# PR должен быть открыт
if [ "$STATE" != "OPEN" ]; then echo "СТОП: PR не открыт"; exit 1; fi

# Переключиться на head-ветку PR (гарантирует ревью именно того diff)
# gh pr checkout работает и для локальных веток, и для fork-ов
gh pr checkout <PR_NUMBER>
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
# Copilot round 22: timeout предотвращает зависание при OAuth-проблемах.
# При таймауте/ошибке — переход в режим C (degraded) или D (manual).
CODEX_STATUS=$(timeout 15 npx @openai/codex login status 2>&1) || CODEX_STATUS="timeout/error"
echo "$CODEX_STATUS"
```

## Шаг 2: Определение режима работы

Четыре режима. Выбираются автоматически по доступности инфраструктуры. Deep-check выбора режима — в таблице в конце шага.

### Режим A: API key login (полная adversarial diversity)

Если вывод содержит "API key":

- **Ревьюер A:** `-c model='"gpt-5.4"'` — сильное рассуждение
- **Ревьюер B:** `-c model='"gpt-5.3-codex"'` — фокус на коде
- Две разные модели = максимальная adversarial diversity
- В отчёте: `— Reviewer (GPT-5.4)` и `— Reviewer (GPT-5.3-Codex)`

### Режим B: ChatGPT login (fallback)

Если вывод содержит "ChatGPT":

- **Один проход:** `codex review --base "$BASE_BRANCH"` (дефолтная модель из `~/.codex/config.toml`)
- Ограничение CLI: `--base` нельзя комбинировать с промптом, поэтому два прохода с разным фокусом невозможны
- Один проход дефолтной модели — adversarial diversity снижена, но ревью выполняется
- В отчёте **честная атрибуция**: `— Reviewer (дефолтная модель)`. НЕ маркировать как GPT-5.4/GPT-5.3-Codex — это ложный audit trail. Второй ревьюер не запускается.

### Режим C: Codex CLI недоступен (degraded)

Если `npx @openai/codex login status` падает или возвращает неопределённый статус, а оператор явно не выбрал ручной fallback:

- **Два прохода Claude-субагента** против **одного и того же** PR:
  - **Проход 1 (стандартный):** Reviewer в обычном режиме, промпт как в Standard tier.
  - **Проход 2 (adversarial):** Reviewer с промптом «Ты adversarial reviewer. Твоя задача — найти то, что первый проход пропустил. Ищи baseline-слабые места: необработанные edge-cases, скрытые дубликаты, некорректные инварианты.»
- **⚠️ В отчёте обязательна метка:** «⚠️ Degraded mode с имитацией adversarial diversity. Не является cross-model review (формулировка из `.agents/pipeline-improvement-plan-v3.3.md`).»
- Атрибуция: `— Reviewer (Claude Opus 4.6, standard)` и `— Reviewer (Claude Opus 4.6, adversarial)`.
- Не маркировать как GPT.

### Режим D: Автоматические пути недоступны (manual emergency)

Если Codex CLI недоступен И оператор требует ручного fallback (например, ChatGPT-5.4 через VS Code GitHub Copilot Agent):

- Оператор вручную прогоняет PR через VS Code GitHub Copilot Agent.
- PM собирает вывод в текстовом виде и публикует с меткой:
  «⚠️ Manual emergency mode. Adversarial diversity и воспроизводимость снижены.»
- Атрибуция — по тому, кого оператор использовал (`— Reviewer (GPT-5.4 via Copilot Agent)`).

### Таблица выбора режима

| Режим | Условие запуска |
|-------|-----------------|
| A | `codex login status` = "API key" |
| B | `codex login status` = "ChatGPT" |
| C | Codex CLI недоступен; оператор не требовал ручного fallback |
| D | Оператор явно указал ручной fallback (аргумент `--manual` или чат-команда) |

> В любом режиме каждый ревьюер проверяет все 4 аспекта. Различается источник ревью и атрибуция.

## Шаг 3: Запуск ревьюеров

Ограничение CLI: `--base` нельзя комбинировать с кастомным промптом.

### 3.1 Режимы A и B — через Codex CLI

**Рекомендуемый вариант — встроенный ревью:**

```bash
# Режим A (API key) — Ревьюер A (GPT-5.4):
npx @openai/codex review --base "$BASE_BRANCH" -c model='"gpt-5.4"' -c model_reasoning_effort='"high"'

# Режим A (API key) — Ревьюер B (GPT-5.3-Codex):
npx @openai/codex review --base "$BASE_BRANCH" -c model='"gpt-5.3-codex"' -c model_reasoning_effort='"high"'

# Режим B (ChatGPT) — только один проход дефолтной модели:
npx @openai/codex review --base "$BASE_BRANCH"
```

> Встроенный ревью выдаёт свободный формат. PM при консолидации (шаг 5) **вручную маппит** вывод на 4 аспекта. Если вывод не покрывает аспект — PM помечает его как «не проверен».

В режиме B ревьюер B не запускается — ограничение CLI не позволяет различить проходы.

Сохрани raw-вывод каждого ревьюера — он пойдёт в collapsible блок отчёта (шаг 5).

### 3.2 Режим C — Claude adversarial degraded

Запусти два Claude-субагента последовательно на том же PR.

**Проход 1 (стандартный):**
```
Ты Reviewer. Прочитай .agents/AGENT_ROLES.md секция "3. Reviewer".
Режим: Standard, все 4 аспекта.
Задача: проверь PR #<PR_NUMBER>. Верни structured findings PM.
```

**Проход 2 (adversarial):**
```
Ты adversarial Reviewer. Прочитай .agents/AGENT_ROLES.md секция "3. Reviewer".
Контекст: первый проход этого PR уже прошёл. Твоя задача — найти то, что первый проход пропустил.
Фокус: baseline-слабые места, необработанные edge-cases, скрытые дубликаты, некорректные инварианты, маловероятные, но критичные ошибки.
Задача: проверь PR #<PR_NUMBER>. Верни structured findings PM.
```

Сохрани findings обоих проходов для collapsible блоков. **Обязательно** добавь в итоговый отчёт метку «⚠️ Degraded mode с имитацией adversarial diversity. Не является cross-model review».

### 3.3 Режим D — manual emergency

Оператор вручную прогоняет PR через VS Code GitHub Copilot Agent (или иной внешний инструмент) и передаёт PM текстовый вывод. PM:

1. Принимает вывод как есть.
2. Маппит на 4 аспекта.
3. Публикует с меткой «⚠️ Manual emergency mode. Adversarial diversity и воспроизводимость снижены».
4. Атрибуция — по тому, кого оператор использовал.

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

### 5.1 Имена моделей (атрибуция)

Подставь реальные имена из шага 2 — не захардкоженные:

| Режим | MODEL_A_NAME | MODEL_B_NAME | Метка |
|-------|--------------|--------------|-------|
| A | `GPT-5.4` | `GPT-5.3-Codex` | — |
| B | `дефолтная модель` | — (B не запускается) | — |
| C | `Claude Opus 4.6 (standard)` | `Claude Opus 4.6 (adversarial)` | `⚠️ Degraded mode с имитацией adversarial diversity. Не является cross-model review` |
| D | По факту (например, `GPT-5.4 via Copilot Agent`) | — | `⚠️ Manual emergency mode. Adversarial diversity и воспроизводимость снижены` |

### 5.2 Защита findings — raw output в collapsible

> **Инвариант 6 (PM не искажает findings).** PM имеет право структурировать по 4 аспектам и убирать дубликаты, но **не** перефразировать или смягчать формулировки. Чтобы оператор мог проверить, raw-вывод каждого ревьюера публикуется целиком в `<details>` блоке отдельно от консолидированного отчёта.

### 5.3 Шаблон комментария

> ⚠️ **Commit binding — без `**` и с META JSON.** `/finalize-pr` ищет маркер через regex `Commit:\s*\`?<hash>` ИЛИ JSON `"commit": "<hash>"`. Шаблон `**Commit:**` (bold markdown) **не** матчится (между `Commit:` и хэшем идёт `**`, не whitespace) — это drift, найденный GPT-5.4 external review (round 12). Используй простой `Commit: <hash>` и добавь HTML META с JSON — дублирование на случай, если кто-то изменит markdown-форматирование.

Перед публикацией зафиксируй HEAD commit:

```bash
HEAD_COMMIT=$(timeout 10 gh pr view <PR_NUMBER> --json headRefOid --jq '.headRefOid')
```

Публикация отчёта (quoted heredoc + bash parameter expansion, чтобы body-содержимое не проходило shell-расширения):

```bash
BODY=$(cat <<'EOF'
## Внешнее ревью (Sprint Final) — Режим: __MODE__

Commit: `__HEAD_COMMIT__`

<!-- {"reviewer": "__MODEL_NAME__", "commit": "__HEAD_COMMIT__", "kind": "external", "mode": "__MODE__", "iteration": __ITERATION__} -->

<!-- Для режимов A/B удали обе строки ниже. Для режима C оставь только строку `⚠️ Degraded mode`. Для режима D оставь только строку `⚠️ Manual emergency mode`. Не оставляй обе одновременно. -->
⚠️ Degraded mode — <описание из таблицы 5.1>
⚠️ Manual emergency mode — <описание из таблицы 5.1>

### Findings (обязательная таблица для /finalize-pr фазы 2 triage)

> Если вердикт APPROVED без замечаний — оставь таблицу с единственной строкой `| — | — | нет замечаний | — | — | — |`. Пустая таблица недопустима: `/finalize-pr` отличает «нет findings» от «парсинг сломался».

| # | Severity | Заголовок | Файл:строка | Статус | Beads ID / Обоснование |
|---|----------|-----------|-------------|--------|------------------------|
| 1 | CRITICAL | ... | path:N | fix now | — |
| 2 | WARNING | ... | path:N | defer to Beads | bd-xyz-123 |
| 3 | INFO | ... | path:N | reject with rationale | <обоснование> |

### Консолидация (PM)

#### Ревьюер A: MODEL_A_NAME

##### Архитектура: [OK / ISSUE]
[обоснование — дословно из findings, не перефразировать]

##### Безопасность: [OK / ISSUE]
[обоснование]

##### Качество: [OK / ISSUE]
[обоснование]

##### Гигиена кода: [OK / ISSUE]
[обоснование]

**Вердикт:** [APPROVED / CHANGES_REQUESTED]
— Reviewer (MODEL_A_NAME)

---

> Секция ревьюера B публикуется в режимах A и C. В B и D — опускается.

#### Ревьюер B: MODEL_B_NAME

##### Архитектура: [OK / ISSUE]
[обоснование]

##### Безопасность: [OK / ISSUE]
[обоснование]

##### Качество: [OK / ISSUE]
[обоснование]

##### Гигиена кода: [OK / ISSUE]
[обоснование]

**Вердикт:** [APPROVED / CHANGES_REQUESTED]
— Reviewer (MODEL_B_NAME)

---

### Raw output (для аудита оператором)

<details>
<summary>Ревьюер A: MODEL_A_NAME — raw</summary>

<pre><code>
<вставить raw-вывод ревьюера A целиком, без редактуры>
</code></pre>

</details>

<details>
<summary>Ревьюер B: MODEL_B_NAME — raw</summary>

<pre><code>
<вставить raw-вывод ревьюера B целиком, без редактуры>
</code></pre>

</details>

---

### Copilot
[re-review requested / auto-triggered / unavailable]

### Итоговый вердикт: [APPROVED / CHANGES_REQUESTED]
CRITICAL: N, WARNING: N

— PM (Claude Opus 4.6), по результатам внешнего ревью
EOF
)
# Вычисление обязательных полей публикации.
# Без них HTML META будет невалидным и /finalize-pr не распознает review-pass.
# MODE определяется из шага 2 (A/B/C/D); MODEL_NAME — из таблицы 5.1.
# ITERATION — порядковый номер прохода внешнего ревью.
if [ -z "${MODE:-}" ]; then
  echo "MODE не задан. Установи переменную MODE перед публикацией (A/B/C/D)." >&2
  exit 1
fi
if [ -z "${MODEL_NAME:-}" ]; then
  echo "MODEL_NAME не задан. Установи переменную MODEL_NAME перед публикацией." >&2
  exit 1
fi
ITERATION="${ITERATION:-1}"

# Безопасная подстановка маркеров — тело отчёта остаётся буквальным (quoted heredoc),
# bash-расширений в findings/raw-output не происходит.
BODY="${BODY//__HEAD_COMMIT__/$HEAD_COMMIT}"
BODY="${BODY//__MODEL_NAME__/$MODEL_NAME}"    # например, "gpt-5.4" или "gpt-5.3-codex"
BODY="${BODY//__MODE__/$MODE}"                # A / B / C / D
BODY="${BODY//__ITERATION__/$ITERATION}"       # номер прохода внешнего ревью
gh pr comment <PR_NUMBER> --body "$BODY"
```

> ⚠️ Raw output публикуется **без редактуры**. Если он слишком длинный — собрать как artifact и приложить ссылкой, но **не** сокращать пересказом.

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
