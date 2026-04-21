---
name: external-review
description: Внешнее ревью PR через Node.js native скрипт (Sprint Pipeline v3.6, Mode A). Две полноразмерные модели параллельно — gpt-5.4 (reasoning) + gpt-5.3-codex (code). Fallback режимы — C (Claude adversarial degraded) и D (manual emergency). Используй `/external-review <PR_NUMBER>`.
user-invocable: true
---

# External Review — кросс-модельное ревью через Node.js native OpenAI SDK

Автоматизация Sprint Final (Фаза 3 `sprint-pr-cycle`). Две полноразмерные модели разных архитектур проверяют PR по **всем 4 аспектам**, максимизируя adversarial diversity. Основной путь — Node.js native скрипт `.claude/tools/openai-review.mjs` (Правка 1 плана v3.6); при его недоступности предусмотрены degraded-режимы — Sprint Final не блокируется, но помечается честно.

> Источник подхода: [Adversarial Code Review для Claude Code](https://habr.com/ru/articles/1019588/)

## Контекст

Прочитай перед началом:

- `.agents/AGENT_ROLES.md` секция «3. Reviewer» — формат вердикта (4 аспекта).
- `.memory_bank/status.md` — текущее состояние проекта.
- `docs/plans/sprint-pipeline-v3-6-mode-a-native.md` секция «Правка 1» и `Err5` — runtime allowlist и endpoint dispatch.

## Аргументы

- `PR_NUMBER` — номер PR для ревью (обязательный).

## Шаг 1: Пререквизиты

### 1.1 Проверка чистоты рабочего дерева

> Проверяется ДО checkout, чтобы не потерять локальные изменения.

```bash
if [ -n "$(git status --porcelain)" ]; then
  echo "СТОП: рабочее дерево не чистое. Закоммить или stash изменения."
  exit 1
fi
```

### 1.2 Проверка PR и переключение на head-ветку

```bash
BASE_BRANCH=$(gh pr view <PR_NUMBER> --json baseRefName --jq '.baseRefName')
STATE=$(gh pr view <PR_NUMBER> --json state --jq '.state')

if [ "$STATE" != "OPEN" ]; then echo "СТОП: PR не открыт"; exit 1; fi

# Переключиться на head-ветку PR (гарантирует ревью именно того diff)
gh pr checkout <PR_NUMBER>
```

`BASE_BRANCH` используется далее в `openai-review.mjs --base "$BASE_BRANCH"` — base-ветка берётся из PR-метаданных, не захардкодена.

### 1.3 Проверка что ветка запушена

```bash
if ! git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  echo "СТОП: upstream не настроен. Выполни: git push -u origin $(git branch --show-current)"
  exit 1
fi

UNPUSHED=$(git log @{u}..HEAD --oneline)
if [ -n "$UNPUSHED" ]; then
  echo "СТОП: есть незапушенные коммиты. Выполни git push."
  exit 1
fi
```

### 1.4 Pre-flight: установка зависимостей, валидация ключа, фиксация HEAD_COMMIT

> **Первый вход на чистой машине** — выполни `npm install` в `.claude/tools/` (одноразово). Повторяемая переустановка — `npm ci`.

```bash
# Фиксация HEAD_COMMIT сразу — используется далее в именах артефактов (Шаг 3.1)
# и в commit binding публикации (Шаг 5.3). Единое значение для всего прохода ревью.
HEAD_COMMIT=$(timeout 10 gh pr view <PR_NUMBER> --json headRefOid --jq '.headRefOid')
if [[ -z "$HEAD_COMMIT" || "$HEAD_COMMIT" == "null" || ! "$HEAD_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "СТОП: не удалось получить валидный HEAD commit для PR <PR_NUMBER>" >&2
  exit 1
fi

MODE_A_AVAILABLE=1

# Установка openai SDK (если ещё нет node_modules). Падение npm install — это degraded, а не СТОП:
# при проблемах сети/прокси логичнее перейти в Mode C/D, а не блокировать весь /external-review.
if [ ! -d .claude/tools/node_modules ]; then
  if ! (cd .claude/tools && npm install); then
    echo "ВНИМАНИЕ: npm install упал в .claude/tools/ — Mode A недоступен, переход в degraded-режим C/D."
    MODE_A_AVAILABLE=0
  fi
fi

# Ранняя проверка валидности $OPENAI_API_KEY (<2 сек, AC6 плана) — только если SDK установлен.
if [ "$MODE_A_AVAILABLE" = "1" ]; then
  if ! node .claude/tools/openai-review.mjs --ping; then
    echo "ВНИМАНИЕ: Mode A недоступен (невалидный ключ / rate limit / network)."
    echo "Скрипт перейдёт в degraded-режим C. Детали ошибки — на stderr выше."
    MODE_A_AVAILABLE=0
  fi
fi
```

Если `--ping` упал, скрипт возвращает exit 1 с классифицированным сообщением на stderr. См. раздел «Ошибки с exit 1» в `.claude/tools/README.md`.

## Шаг 2: Определение режима работы

Три активных режима. Выбираются автоматически по доступности Mode A. Mode B (Codex CLI с ChatGPT OAuth) **deprecated в v3.6** — Codex CLI остаётся только как legacy fallback для Mode A на несовместимых средах.

### Режим A: Node.js native через OpenAI SDK (основной путь)

Если `MODE_A_AVAILABLE=1` из Шага 1.4:

- **Reviewer A:** `node .claude/tools/openai-review.mjs --model gpt-5.4 --base "$BASE_BRANCH"` — reasoning-специализация (`/v1/chat/completions` с `reasoning_effort: "high"`).
- **Reviewer B:** `node .claude/tools/openai-review.mjs --model gpt-5.3-codex --base "$BASE_BRANCH"` — code-специализация (`/v1/responses` с `reasoning.effort: "high"`).
- Две полноразмерные модели разных архитектур = максимальная adversarial diversity.
- В отчёте: `— Reviewer (GPT-5.4)` и `— Reviewer (GPT-5.3-Codex)`.

Скрипт возвращает raw markdown на stdout (4 аспекта + вердикт `APPROVED | CHANGES_REQUESTED | ESCALATION`). Exit codes: 0 OK, 1 runtime/API, 2 валидация, 3 nothing to review — см. `.claude/tools/README.md` таблицу.

### Режим C: Mode A недоступен (degraded, Claude adversarial)

Если `MODE_A_AVAILABLE=0` (ключ невалиден / rate limit / network timeout), а оператор явно не выбрал ручной fallback:

- **Два прохода Claude-субагента** против одного и того же PR:
  - **Проход 1 (стандартный):** Reviewer в обычном режиме, промпт как в Standard tier.
  - **Проход 2 (adversarial):** Reviewer с промптом «Ты adversarial reviewer. Твоя задача — найти то, что первый проход пропустил. Ищи baseline-слабые места: необработанные edge-cases, скрытые дубликаты, некорректные инварианты».
- **⚠️ В отчёте обязательна метка:** «⚠️ Degraded mode с имитацией adversarial diversity. Не является cross-model review».
- Атрибуция: `— Reviewer (Claude Opus 4.7, standard)` и `— Reviewer (Claude Opus 4.7, adversarial)`.

### Режим D: Автоматические пути недоступны (manual emergency)

Если Mode A недоступен И оператор требует ручного fallback (например, gpt-5.4 через VS Code GitHub Copilot Agent):

- Оператор вручную прогоняет PR через внешний инструмент.
- PM собирает вывод в текстовом виде и публикует с меткой: «⚠️ Manual emergency mode. Adversarial diversity и воспроизводимость снижены».
- Атрибуция — по фактическому источнику (`— Reviewer (GPT-5.4 via Copilot Agent)`).

### Legacy fallback режима A (Codex CLI)

> **Не используется по умолчанию.** Включается только если Node.js native не запускается (нестандартный Node ≤ 18.17, сломана установка `openai` SDK). На Windows dev-host BE-11 `CreateProcessWithLogonW` блокирует Codex CLI — это одна из причин отказа от него в v3.6.
>
> Если оператор явно выбрал этот путь (через аргумент или чат-команду) и Codex CLI залогинен (`codex login status` = "API key"):
>
> ```bash
> npx @openai/codex review --base "$BASE_BRANCH" -c model='"gpt-5.4"' -c model_reasoning_effort='"high"'
> npx @openai/codex review --base "$BASE_BRANCH" -c model='"gpt-5.3-codex"' -c model_reasoning_effort='"high"'
> ```
>
> В отчёте пометить: «⚠️ Legacy Codex CLI fallback — Mode A через subprocess. Основной путь v3.6 — `.claude/tools/openai-review.mjs`».

### Таблица выбора режима

| Режим | Условие запуска |
|-------|-----------------|
| A | `openai-review.mjs --ping` → exit 0 |
| C | `--ping` упал и оператор не требовал ручного fallback |
| D | Оператор явно указал ручной fallback (аргумент `--manual` или чат-команда) |
| A-legacy | Оператор явно указал `--codex-fallback` и Node.js native недоступен |

> В любом режиме каждый проверяющий проходит все 4 аспекта. Различается источник ревью и атрибуция.

## Шаг 3: Запуск проверяющих

### 3.1 Режим A — через Node.js native script (основной путь)

Вызывай скрипт последовательно двумя моделями. Сохраняй raw-вывод в файлы для collapsible блоков отчёта (шаг 5).

```bash
# Создать каталог для артефактов (если ещё нет):
mkdir -p .review-responses

# Reviewer A: gpt-5.4 через /v1/chat/completions
node .claude/tools/openai-review.mjs --model gpt-5.4 --base "$BASE_BRANCH" \
  > .review-responses/mode-a-reviewer-a-"$HEAD_COMMIT".md \
  2> .review-responses/mode-a-reviewer-a-"$HEAD_COMMIT".err

# Reviewer B: gpt-5.3-codex через /v1/responses
node .claude/tools/openai-review.mjs --model gpt-5.3-codex --base "$BASE_BRANCH" \
  > .review-responses/mode-a-reviewer-b-"$HEAD_COMMIT".md \
  2> .review-responses/mode-a-reviewer-b-"$HEAD_COMMIT".err
```

**Параллельный запуск** — оба скрипта можно вызвать одновременно; stdout и stderr разведены по файлам, чтобы не смешивать отчёт с диагностикой; падение одного проверяющего детектируется через exit-коды (не пропускаем ошибку молча):

```bash
node .claude/tools/openai-review.mjs --model gpt-5.4 --base "$BASE_BRANCH" \
  > .review-responses/mode-a-reviewer-a-"$HEAD_COMMIT".md \
  2> .review-responses/mode-a-reviewer-a-"$HEAD_COMMIT".err &
PID_A=$!
node .claude/tools/openai-review.mjs --model gpt-5.3-codex --base "$BASE_BRANCH" \
  > .review-responses/mode-a-reviewer-b-"$HEAD_COMMIT".md \
  2> .review-responses/mode-a-reviewer-b-"$HEAD_COMMIT".err &
PID_B=$!

wait "$PID_A"; EXIT_A=$?
wait "$PID_B"; EXIT_B=$?

if [ "$EXIT_A" -ne 0 ] && [ "$EXIT_A" -ne 3 ]; then
  echo "ВНИМАНИЕ: Reviewer A (gpt-5.4) упал с exit $EXIT_A. stderr: .review-responses/mode-a-reviewer-a-$HEAD_COMMIT.err"
fi
if [ "$EXIT_B" -ne 0 ] && [ "$EXIT_B" -ne 3 ]; then
  echo "ВНИМАНИЕ: Reviewer B (gpt-5.3-codex) упал с exit $EXIT_B. stderr: .review-responses/mode-a-reviewer-b-$HEAD_COMMIT.err"
fi
```

Exit 3 (`nothing to review`) — не ошибка, штатный сигнал пустого diff'а.

Скрипт сам обеспечивает:
- Явный `git fetch origin +refs/heads/<base>:refs/remotes/origin/<base>` (устойчиво к пользовательским `remote.origin.fetch`).
- `git diff --no-color --no-ext-diff` (детерминированный diff независимо от git config пользователя).
- Runtime allowlist (ровно две полноразмерные модели, отказ при любой другой).
- Диспатч endpoint по модели (chat.completions vs responses).
- Классификацию ошибок API (401/403 ключ, 429 rate limit, 400 oversized, 5xx сервер, network).
- Таймауты: 180 сек для review (reasoning high может отрабатывать долго); 2 сек для `--ping` с одним retry (AC6 плана) — короткий бюджет для fail-fast на проблемах сети/ключа.

**Формат вывода скрипта — готовый markdown**, не требует ручного маппинга на 4 аспекта — system prompt задаёт жёсткий формат `## Вердикт: ...` + `### Архитектура: ...` + 3 других аспекта.

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

Оператор вручную прогоняет PR через внешний инструмент (VS Code GitHub Copilot Agent или аналог) и передаёт PM текстовый вывод. PM:

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
| C | `Claude Opus 4.7 (standard)` | `Claude Opus 4.7 (adversarial)` | `⚠️ Degraded mode с имитацией adversarial diversity. Не является cross-model review` |
| D | По факту (например, `GPT-5.4 via Copilot Agent`) | — | `⚠️ Manual emergency mode. Adversarial diversity и воспроизводимость снижены` |
| A-legacy | `GPT-5.4 (Codex CLI)` | `GPT-5.3-Codex (Codex CLI)` | `⚠️ Legacy Codex CLI fallback — основной путь v3.6 — openai-review.mjs` |

### 5.2 Защита findings — raw output в collapsible

> **Инвариант 6 (PM не искажает findings).** PM имеет право структурировать по 4 аспектам и убирать дубликаты, но **не** перефразировать или смягчать формулировки. Чтобы оператор мог проверить, raw-вывод каждого проверяющего публикуется целиком в `<details>` блоке отдельно от консолидированного отчёта.

### 5.3 Шаблон комментария

> ⚠️ **Commit binding — без `**` и с META JSON.** `/finalize-pr` ищет маркер через regex `Commit:\s*\`?<hash>` ИЛИ JSON `"commit": "<hash>"`. Шаблон `**Commit:**` (bold markdown) **не** матчится (между `Commit:` и хэшем идёт `**`, не whitespace) — это drift, найденный внешним ревью (round 12). Используй простой `Commit: <hash>` и добавь HTML META с JSON — дублирование на случай, если кто-то изменит markdown-форматирование.

`HEAD_COMMIT` уже зафиксирован в шаге 1.4 — повторно не вычисляем.

Публикация отчёта (quoted heredoc + bash parameter expansion, чтобы body-содержимое не проходило shell-расширения):

```bash
BODY=$(cat <<'EOF'
## Внешнее ревью (Sprint Final) — Режим: __MODE__

Commit: `__HEAD_COMMIT__`

<!-- {"reviewer_a": "__MODEL_A_NAME__", "reviewer_b": "__MODEL_B_NAME__", "commit": "__HEAD_COMMIT__", "kind": "external", "mode": "__MODE__", "iteration": __ITERATION__} -->

<!--
Для режима A не добавляй warning-метки — оставь этот блок как есть (в комментарии).
Для режима C: вынеси из комментария только строку `⚠️ Degraded mode ...`.
Для режима D: вынеси из комментария только строку `⚠️ Manual emergency mode ...`.
Для режима A-legacy: вынеси только `⚠️ Legacy Codex CLI fallback ...`.
Не добавляй несколько строк одновременно. Дефолт — безопасный (нет меток).
⚠️ Degraded mode — <описание из таблицы 5.1>
⚠️ Manual emergency mode — <описание из таблицы 5.1>
⚠️ Legacy Codex CLI fallback — <описание из таблицы 5.1>
-->

### Findings (обязательная таблица для /finalize-pr фазы 2 triage)

> Если вердикт APPROVED без замечаний — оставь таблицу с единственной строкой `| — | — | нет замечаний | — | — | — |`. Пустая таблица недопустима: `/finalize-pr` отличает «нет findings» от «парсинг сломался».

| # | Severity | Заголовок | Файл:строка | Статус | Beads ID / Обоснование |
|---|----------|-----------|-------------|--------|------------------------|
| 1 | CRITICAL | ... | path:N | fix now | — |
| 2 | WARNING | ... | path:N | defer to Beads | bd-xyz-123 |
| 3 | INFO | ... | path:N | reject with rationale | <обоснование> |

### Консолидация (PM)

#### Reviewer A: __MODEL_A_NAME__

##### Архитектура: [OK / ISSUE]
[обоснование — дословно из findings, не перефразировать]

##### Безопасность: [OK / ISSUE]
[обоснование]

##### Качество: [OK / ISSUE]
[обоснование]

##### Гигиена кода: [OK / ISSUE]
[обоснование]

**Вердикт:** [APPROVED / CHANGES_REQUESTED / ESCALATION]
— Reviewer (__MODEL_A_NAME__)

---

> Секция Reviewer B публикуется в режимах A, A-legacy, C. В D — опускается.

#### Reviewer B: __MODEL_B_NAME__

##### Архитектура: [OK / ISSUE]
[обоснование]

##### Безопасность: [OK / ISSUE]
[обоснование]

##### Качество: [OK / ISSUE]
[обоснование]

##### Гигиена кода: [OK / ISSUE]
[обоснование]

**Вердикт:** [APPROVED / CHANGES_REQUESTED / ESCALATION]
— Reviewer (__MODEL_B_NAME__)

---

### Raw output (для аудита оператором)

<details>
<summary>Reviewer A: __MODEL_A_NAME__ — raw</summary>

<pre><code>
<вставить raw-вывод Reviewer A целиком, без редактуры>
</code></pre>

</details>

<details>
<summary>Reviewer B: __MODEL_B_NAME__ — raw</summary>

<pre><code>
<вставить raw-вывод Reviewer B целиком, без редактуры>
</code></pre>

</details>

---

### Copilot
[re-review requested / auto-triggered / unavailable]

### Итоговый вердикт: [APPROVED / CHANGES_REQUESTED / ESCALATION]
CRITICAL: N, WARNING: N

— PM (Claude Opus 4.7), по результатам внешнего ревью
EOF
)
# Вычисление обязательных полей публикации.
# MODE из шага 2 (A/C/D/A-legacy); MODEL_A_NAME и MODEL_B_NAME — из таблицы 5.1.
# ITERATION — порядковый номер прохода внешнего ревью.
if [ -z "${MODE:-}" ]; then
  echo "MODE не задан. Установи переменную MODE (A/C/D/A-legacy)." >&2
  exit 1
fi
if [ -z "${MODEL_A_NAME:-}" ]; then
  echo "MODEL_A_NAME не задан. См. таблицу 5.1." >&2
  exit 1
fi
if [ -z "${MODEL_B_NAME:-}" ]; then
  # В режиме D Reviewer B отсутствует — допустимо "—".
  # В режимах A / A-legacy / C Reviewer B обязателен — молчаливый дефолт маскирует ошибку конфигурации.
  if [ "$MODE" = "D" ]; then
    MODEL_B_NAME="—"
  else
    echo "MODEL_B_NAME не задан для режима $MODE, где Reviewer B обязателен. См. таблицу 5.1." >&2
    exit 1
  fi
fi
ITERATION="${ITERATION:-1}"

BODY="${BODY//__HEAD_COMMIT__/$HEAD_COMMIT}"
BODY="${BODY//__MODEL_A_NAME__/$MODEL_A_NAME}"
BODY="${BODY//__MODEL_B_NAME__/$MODEL_B_NAME}"
BODY="${BODY//__MODE__/$MODE}"
BODY="${BODY//__ITERATION__/$ITERATION}"
gh pr comment <PR_NUMBER> --body "$BODY"
```

> ⚠️ Raw output публикуется **без редактуры** содержимого, но **с HTML-escaping** перед вставкой в `<pre><code>`: заменить `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`. Без этого attacker-controlled diff может вернуть модели строку `</code></pre>` и сломать структуру комментария (закрывает Security ISSUE Reviewer A на 8e7dce6).
>
> Пример экранирования (bash):
> ```bash
> RAW_A_ESC=$(printf '%s' "$RAW_A" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')
> # далее используй $RAW_A_ESC внутри <pre><code>...</code></pre> вместо $RAW_A
> ```
>
> Если raw слишком длинный — собрать как artifact и приложить ссылкой, но **не** сокращать пересказом.

## Шаг 6: Pre-Chat Gate

> Инвариант: review-pass НЕ завершён, пока отчёт не опубликован в PR.

Перед любым сообщением оператору проверь:

1. `gh pr comment` выполнился успешно.
2. Ссылка на комментарий зафиксирована (если доступна).
3. Только после этого сообщай оператору результат.

> ⛔ Чат-резюме без PR comment не завершает review-pass.

## Шаг 7: Обработка ошибок

| Ситуация | Действие |
| --- | --- |
| `openai-review.mjs` exit 1 (локальная или API-ошибка) | Retry × 1; если повторно падает — переход в Mode C или D. Классификация ошибки — в stderr скрипта |
| `openai-review.mjs` exit 2 (валидация) | Исправить аргументы/модель. См. `--help` |
| `openai-review.mjs` exit 3 (nothing to review) | Нормальный сигнал — `HEAD == origin/<base>`. Ревью не запускается |
| Пустой вывод от модели | Retry × 1 с увеличенным `max_output_tokens`, потом частичный отчёт |
| Оба проверяющих упали | Эскалация оператору, публикация частичного отчёта с меткой |
| Один проверяющий упал | Публикация отчёта с пометкой об упавшем проверяющем |
| Rate limit на всех повторах | Пометить как unavailable, переход в C/D |

> Никогда не пропускай ошибку молча. Частичный отчёт лучше, чем отсутствие отчёта.

## Шаг 8: Итеративные исправления

Если итоговый вердикт `CHANGES_REQUESTED`:

1. PM передаёт CRITICAL и WARNING findings Developer-субагенту.
2. Developer исправляет → `git push`.
3. PM запрашивает Copilot re-review (шаг 4).
4. PM повторно запускает `/external-review <PR_NUMBER>` на новом HEAD.
5. Каждый повторный запуск создаёт **новый** комментарий (не редактирует старый) — для audit trail.
