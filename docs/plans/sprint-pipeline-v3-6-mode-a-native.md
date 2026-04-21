# Спринт v3.6 — переносимый Mode A через Node.js native OpenAI SDK

## Контекст

Черновик плана v3.6 писался, когда OpenAI API-баланс считался недоступным. К 2026-04-21 баланс восстановлен, Mode A через Codex CLI (`npx @openai/codex review`) работает — но хрупко. Критический анализ выявил четыре проблемы:

1. **BE-11 Windows sandbox блокирует Codex CLI.** `CreateProcessWithLogonW failed: 1326` — Codex CLI subprocess не запускается на Windows без `-c sandbox_mode='"danger-full-access"'`. Оператор работает на двух машинах (домашний Windows + рабочий ноутбук), половина времени — на Windows. `danger-full-access` — неприемлемая заглушка: отключает sandbox-изоляцию, формализовать её как convention нельзя.

2. **BE-11 workaround не в скиллах.** Обход документирован только в [.memory_bank/status.md](../../.memory_bank/status.md) (секция Sprint v3.5 Cleanup, convention change). В [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md) — ни строчки. Любой первый запуск `/external-review` на Windows упадёт.

3. **`/finalize-pr` не проверяет, что Mode A реально применялся.** JSON META (`"mode": "A"`) валидируется синтаксически, но нет hard gate. Тихая деградация Codex → Mode C пройдёт как валидный review — регрессия v3.4 воспроизводится.

4. **Главная регрессия v3.4 осталась.** PM-агент может уйти в следующий pass без публикации отчёта. Оператор не видит происходящее.

**Корневое решение проблем 1–2:** уйти от Codex CLI subprocess в пользу Node.js native скрипта с прямым вызовом OpenAI SDK. Node.js не упирается в Win32 CreateProcessWithLogonW — BE-11 устраняется по определению, sandbox-хаки больше не нужны.

**Дополнительные требования оператора.** Решение должно быть переносимым между машинами и пользователями, работать в Claude Code, VS Code, Cursor одинаково. Node.js уже обязательная зависимость Claude Code — нулевое increment требований.

## Цели спринта

1. Заменить Codex CLI subprocess на Node.js native script для Mode A, убрав BE-11 как класс проблемы.
2. Закрыть главную регрессию v3.4 (hook publish-after-each-pass).
3. Закрыть регрессию молчаливой деградации (Mode A strict gate в /finalize-pr).
4. Обеспечить видимость процесса для оператора (heartbeat).

## Состав правок

Правки 1–3 — P1, блокеры спринта. Правки 4–5 — P2, устойчивость. Правки 6–7 — P3, polish.

---

### Правка 1 (P1, новая). Node.js native OpenAI review script

**Назначение.** Устранить Codex CLI subprocess как путь вызова внешних ревьюеров. Вместо `npx @openai/codex review` — локальный Node.js script, вызывающий **OpenAI Chat Completions API** через `openai` npm package. Обе модели review — исключительно chat-capable (см. Err5 allowlist): `gpt-5.4` (Reviewer A) + `gpt-5.4-mini` (Reviewer B). `*-codex` / `*-pro` модели **не используются** — requires different endpoint, добавляет complexity без выгоды (adversarial diversity достигается через размерность chat-capable моделей одной семьи).

**Архитектура.**
- Файл: `.claude/tools/openai-review.mjs` (~150 LoC).
- Зависимости: `.claude/tools/package.json` с `"openai": "4.70.0"` без `^` (pinned, см. Риск 1); `.claude/tools/package-lock.json` коммитится в репозиторий для воспроизводимости между машинами. **Важно:** lockfile — локальный для `.claude/tools/`, не корневой `package-lock.json` проекта (root lockfile управляет shared/client workspaces). Первая установка: `cd .claude/tools && npm install`. Повторяемая переустановка на чистой машине: `cd .claude/tools && npm ci` (строго по lockfile, без разрешения версий).
- Вызов: PM-агент через Bash subprocess `node .claude/tools/openai-review.mjs --model gpt-5.4 --base "$(gh pr view <PR_NUMBER> --json baseRefName --jq '.baseRefName')"`. Base-ветка берётся из PR-метаданных, не хардкодится как `master`/`main` — consistent с паттерном `external-review/SKILL.md` (`BASE_BRANCH=$(gh pr view ...)`). API key — из `$OPENAI_API_KEY`.
- Поддерживаемые модели (chat-capable allowlist по Err5): `gpt-5.4` (Reviewer A, full reasoning) + `gpt-5.4-mini` (Reviewer B, smaller model того же семейства — adversarial diversity через размерность). Обе verified chat-capable (API probe 2026-04-22). Script отказывается вызывать модели вне allowlist с явным сообщением.
- Выход: raw markdown на stdout. PM мапит на 4 аспекта при консолидации (как сейчас в external-review).

**Подкоманды скрипта.**
- `openai-review.mjs --ping` — проверка валидности API-ключа (GET `/v1/models`, exit code 0/1, см. Правку 5).
- `openai-review.mjs --model <id> --base <branch>` — основной вызов review; `<branch>` — это `baseRefName` текущего PR, не захардкоженный `master`.

**Интеграция в скилл.**
В [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md) шаг 3.1 — заменить блок «Режимы A и B — через Codex CLI» на «Режим A — через native script». Codex CLI остаётся как Mode A-fallback, если script упал. Mode B (ChatGPT OAuth) — удалить (пользователь всегда может использовать API key). Mode C/D (Claude adversarial, manual emergency) — остаются.

**Критерий приёмки.**
1. На Windows dev-host запуск `/external-review` для любого PR проходит без CreateProcessWithLogonW, без `sandbox_mode=danger-full-access`, без `npx codex`.
2. На macOS — тот же флоу, без изменений в поведении.
3. Node.js script переносится копированием `.claude/tools/` + `npm install` на другой компьютер с Claude Code. Никаких дополнительных установок.
4. Два прохода (`gpt-5.4` + `gpt-5.4-mini`, см. Err5 allowlist) публикуются в одном PR-комментарии, META JSON `"mode": "A"` валиден.

**Файлы.**
- `.claude/tools/openai-review.mjs` — новый, ~150 LoC.
- `.claude/tools/package.json` — новый, `openai` dep.
- `.claude/tools/README.md` — setup и troubleshooting для переноса на другую машину.
- [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md) — шаги 1.4, 2, 3.1 переписаны.
- [.agents/CODEX_AUTH.md](../../.agents/CODEX_AUTH.md) — пометка «Codex CLI deprecated в v3.6, legacy fallback; основной путь — `.claude/tools/openai-review.mjs`».
- [.claude/hooks/codex-login.sh](../../.claude/hooks/codex-login.sh) — остаётся для Codex CLI fallback, но не блокирующий.
- `.beads/` — закрыть `big-heroes-1l6` (BE-11) с reason «obsolete: Mode A migrated from Codex CLI to Node.js native». Beads issues не имеют GitHub URL — хранятся в Dolt, поиск через `bd show <id>`.

---

### Правка 2 (P1). Hook publish-after-each-pass

**Назначение.** Блокировать переход PM-агента к следующему шагу пайплайна, если в PR отсутствует комментарий с итогом завершённого review-pass, привязанный к текущему commit HEAD.

**Интеграция.**
Хук `PreToolUse` в [.claude/settings.json](../../.claude/settings.json) вешается **не на общий `Bash(*)`**, а на **первый гарантированный `Bash(...)` entrypoint** каждого шага, который начинает новый pass/этап: `developer-fix`, `external-review`, `finalize-pr` и старт следующего `review-pass`. Если у skill нет одного стабильного первого `Bash(...)` matcher — проверка переносится в начало entry-скрипта skill как обязательный первый шаг. Цель: hook срабатывает ровно один раз на входе в этап, не дублируется на каждый последующий shell-вызов внутри skill.

Скрипт `.claude/hooks/check-pass-published.py` — идемпотентный, без состояния. Текущий commit hook получает через `git rev-parse HEAD`, текущий PR — через `gh pr view --json number,comments` из текущей ветки (без явных параметров). Проверка ищет PM-комментарий с меткой завершения pass N и commit binding (regex `Commit:\s*\`?<hash>` ИЛИ JSON `"commit": "<hash>"`). Если `gh pr view` не находит связанный PR — hook завершает этап отказом с явным сообщением, не silent pass.

**Критерий приёмки.**
PM пытается запустить следующий pass без публикации отчёта — отказ с пояснением. После публикации — проходит. Override через явный operator ack-token, не молчаливый обход.

**Файлы.**
- [.claude/settings.json](../../.claude/settings.json) — регистрация hook.
- `.claude/hooks/check-pass-published.py` — новый, ~80 LoC.
- [.claude/skills/pipeline-audit/SKILL.md](../../.claude/skills/pipeline-audit/SKILL.md) — новый инвариант.

---

### Правка 3 (P1, новая). Mode A strict gate в /finalize-pr

**Назначение.** Закрыть регрессию молчаливой деградации Mode A → Mode C. Для Sprint Final tier при merge в базовую ветку PR / на landing HEAD требовать явного `"mode": "A"` в META JSON.

**Требования.**
В [.claude/skills/finalize-pr/SKILL.md](../../.claude/skills/finalize-pr/SKILL.md) шаг 4 (external review check) добавить:
- Парсить `"mode"` из HTML META JSON в PM-комментарии (формат определён в шаблоне [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md), секция «Шаг 5: Консолидация и публикация»).
- Sprint Final tier при merge в базовую ветку PR / на landing HEAD:
  - `mode == "A"` — проход без вопросов.
  - `mode == "B"` (включая label `B-manual`) — degraded manual fallback, не эквивалент Mode A. Допускается только с operator ack через `--accept-degraded=<reason>` или файл `.finalize-pr-ack`.
  - `mode ∈ {"C", "D"}` — то же требование ack.
  - `mode` отсутствует, не распарсился или имеет неизвестное значение — трактовать как degraded attestation и требовать ack (fail-secure, не silent bypass).
- Critical tier (не Sprint Final) — warning, но не block. Mode B/C/D в обычных pass не блокируются.
- `/finalize-pr --pre-landing` наследует то же поведение для landing HEAD — landing-commit не должен пропускать pipeline с dishonest-mode.

**Критерий приёмки.**
- Test 1: `"mode": "C"` без ack → `/finalize-pr` на Sprint Final возвращает отказ.
- Test 2: `"mode": "B"` / label `B-manual` без ack → отказ на Sprint Final.
- Test 3: `"mode": "C"` или `"mode": "B"`/`B-manual` с ack → проходит с пометкой в итоговом выводе.
- Test 4: `"mode"` отсутствует/malformed → отказ (fail-secure).
- Test 5: `"mode": "A"` → проходит без вопросов.

**Файлы.**
- [.claude/skills/finalize-pr/SKILL.md](../../.claude/skills/finalize-pr/SKILL.md) — шаг 4.
- `.claude/skills/finalize-pr/validators/check_mode_attestation.sh` — новый ~40 LoC.
- [.claude/skills/pipeline-audit/SKILL.md](../../.claude/skills/pipeline-audit/SKILL.md) — новый инвариант.

---

### Правка 4 (P2). Heartbeat status.md

**Назначение.** Мгновенная видимость текущей фазы пайплайна без открытия чата.

**Требования.**
PM-агент обновляет [.memory_bank/status.md](../../.memory_bank/status.md) при смене фазы и перед каждым вызовом субагента. Содержимое: timestamp, текущая фаза, активный субагент/Beads-задача, краткий статус (одна строка).

**Интеграция.**
В [.claude/skills/sprint-pr-cycle/SKILL.md](../../.claude/skills/sprint-pr-cycle/SKILL.md) — шаг `update_status_md` в начале каждой фазы.

**Критерий приёмки.**
В следующем автономном спринте `status.md` обновляется минимум 10 раз, последнее обновление отражает актуальную фазу.

**Файлы.**
- [.claude/skills/sprint-pr-cycle/SKILL.md](../../.claude/skills/sprint-pr-cycle/SKILL.md) — добавление шага в каждую фазу.

---

### Правка 5 (P2). Pre-flight API key validation

**Назначение.** Ловить невалидный/revoke'нутый ключ до первого большого review-запроса.

**Требования.**
В [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md) шаг 1.4 добавить вызов `node .claude/tools/openai-review.mjs --ping`. При exit code != 0 — ранний exit с инструкцией, зависящей от типа ошибки:
- `401 / 403` → невалидный/revoke'нутый ключ, инструкция по ротации ([.agents/CODEX_AUTH.md §5 «Ротация ключа»](../../.agents/CODEX_AUTH.md#5-ротация-ключа)).
- `429` → rate limit / quota exceeded. Инструкция: подождать, уменьшить частоту, проверить лимиты OpenAI Project.
- network error / timeout → инструкция: проверить соединение и прокси.

Внутри `openai-review.mjs` команда `--ping` делает `client.models.list()` (дешёвый запрос, ~20ms), возвращает 0 при 200 OK, 1 при ошибке. Diagnostic message на stderr разделяет: `401`/`403` vs `429` vs network — чтобы PM/оператор получили корректную actionable инструкцию.

**Критерий приёмки.**
Запуск `/external-review` с revoke'нутым ключом падает на шаге 1.4 с понятной ошибкой за <2 секунды, не ожидает 30+ секунд до шага 3.

**Файлы.**
- `.claude/tools/openai-review.mjs` — добавить подкоманду `--ping` (встроено в Правку 1).
- [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md) — шаг 1.4.

---

### Правка 6 (P3). Mode-label унификация в комментариях PM

**Назначение.** В [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md) шаблон публикации отчёта уже начинается со строки `Режим: __MODE__`. Распространить формат на комментарии из `sprint-pr-cycle` и `finalize-pr`.

**Требования.**
Каждый комментарий PM в PR начинается с первой строки `Режим: <label>` где label ∈ {A, B-manual, C, D}. Формат `Режим:` (не `Mode:`) — такой же, как уже в шаблоне [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md); единый ключ нужен для будущих парсеров. Label `B-manual` включён для совместимости с Правкой 7. Без hook enforcement — соглашение в шаблоне.

**Файлы.**
- [.claude/skills/sprint-pr-cycle/SKILL.md](../../.claude/skills/sprint-pr-cycle/SKILL.md) — шаблоны комментариев.
- [.claude/skills/finalize-pr/SKILL.md](../../.claude/skills/finalize-pr/SKILL.md) — шаблон финального отчёта.

---

### Правка 7 (P3, опционально). Mode B-manual формализация

**Назначение.** Сохранить fallback-документацию для ручного транспорта через ChatGPT web на случай полного outage OpenAI API. Mode A теперь приоритет, но insurance policy нужна.

**Формат.**
Один файл запроса на pass в `.review-requests/sprint-N/pass-K.md` с шапкой, diff, инструкцией по 4 аспектам. Ответ оператора — в `.review-responses/sprint-N/pass-K.md`. PM публикует raw + парсинг в 2 комментариях с меткой `Режим: B-manual` (единый формат с Правкой 6).

**Антипаттерн (явно запрещён).** Разбиение запроса на 4 отдельных файла по аспектам.

**Условия.** Делается только при наличии времени после Правок 1–5. Иначе де-факто протокол Sprint v3.4 остаётся source of truth.

**Файлы.**
- [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md) — новая секция «Mode B-manual».

---

## Удалённые из черновика правки

- **Черновая Правка 2 (BE-11 Windows sandbox workaround в скилле).** Правка 1 текущей редакции (Node.js native) устраняет BE-11 по определению, формализовывать `sandbox_mode=danger-full-access` не нужно.
- **Черновая Правка 5 (MCP-коннектор).** Node.js native script покрывает use case без MCP overhead (токены в system prompt, slow startup, VS Code частичная совместимость). MCP зафиксирован как возможное будущее направление при росте числа OpenAI-инструментов.
- **Mode B (Codex CLI + ChatGPT OAuth).** Заменяется на Mode A через API key, Codex CLI deprecated как основной путь. OAuth-путь не имеет преимуществ перед API-ключом для автоматизированного пайплайна.

## Порядок выполнения

1. **Правка 1** первой — закрывает три связанных проблемы (BE-11, переносимость, subprocess-фрагильность). Оценка: 6–8 часов (написание script, тесты, миграция external-review skill, README для другой машины).
2. **Правки 2 и 3** — параллельно или последовательно после merge Правки 1. Каждая ~2–3 часа.
3. **Правки 4 и 5** — параллельно с 2/3, независимы. По ~1 часу.
4. **Правки 6 и 7** — polish при остатке времени.

## Критерии завершения спринта

- Правка 1 выполнена, dogfood-прогон на тестовом Sprint Final прошёл на обеих машинах (Windows home + рабочий ноутбук).
- Правки 2, 3 выполнены и прошли unit/regression тесты.
- Правки 4, 5 выполнены или явно отложены в Beads.
- Правки 6, 7 — по остатку времени, без блокировки merge.
- Beads `big-heroes-1l6` (BE-11) закрыт как obsolete.

## Verification Contract

### Acceptance criteria

По завершении спринта должны одновременно выполняться:

- AC1. `.claude/tools/openai-review.mjs` существует, запускается через `node` на Windows и macOS без CreateProcessWithLogonW и без `sandbox_mode=danger-full-access`.
- AC2. `/external-review <PR_NUMBER>` для Mode A использует Node.js native script как основной путь; Codex CLI остаётся fallback с явной пометкой в отчёте.
- AC3. Hook publish-after-each-pass блокирует переход к следующему шагу пайплайна, если PM не опубликовал отчёт предыдущего pass с commit binding на текущий HEAD.
- AC4. `/finalize-pr` на Sprint Final при `mode ∈ {B, C, D, missing, malformed}` блокирует merge без operator ack.
- AC5. В ходе живого спринта `.memory_bank/status.md` обновляется ≥10 раз, последнее обновление отражает актуальную фазу.
- AC6. Pre-flight ping API-ключа завершается за <2 секунды при 401/429/network error.
- AC7. Beads `big-heroes-1l6` (BE-11) закрыт как obsolete; в плане v3.6 нет формализованного sandbox workaround.

### Expected behaviors

- B1. `node openai-review.mjs --ping` с валидным `$OPENAI_API_KEY` → exit 0 + stdout `OK` или эквивалент.
- B2. `node openai-review.mjs --model <id> --base <branch>` → stdout содержит структурированный review в 4 аспектах + вердикт APPROVED/CHANGES_REQUESTED.
- B3. `--base` берётся динамически из `gh pr view --json baseRefName --jq '.baseRefName'` (не хардкод `master`).
- B4. При Mode A-fallback на Codex CLI отчёт явно помечен, PM не выдаёт его за native-режим.
- B5. `/finalize-pr --accept-degraded=<reason>` пропускает degraded mode с явной строкой в итоговом комментарии.

### Edge cases

- E1. `$OPENAI_API_KEY` unset → exit с понятной ошибкой, не crash.
- E2. Network timeout при API call → exit с сообщением, не silent hang.
- E3. Rate limit 429 → ранний exit на `--ping`, не продолжение main call.
- E4. Diff пустой (нет изменений относительно base-ветки PR) → exit с сообщением «nothing to review», не отправка пустого prompt в API. Критерий в коде: `BASE_REF=$(gh pr view --json baseRefName --jq '.baseRefName'); git diff --quiet "origin/$BASE_REF...HEAD"` (exit 0 = нет изменений). **Важно:** используем `origin/$BASE_REF`, не просто `$BASE_REF` — локальный ref с именем ветки может не существовать (для PR из fork / feature-base). Fetch `origin/<baseRefName>` должен быть актуальным (`git fetch origin` перед проверкой).
- E5. `baseRefName` PR != `master` (репозиторий с `main` или feature-base) → работает без изменений.
- E6. Mode A script crash посреди pass → PM детектирует и документирует в отчёте, не молчаливый фолбэк в Mode C.
- E7. META JSON c неизвестным `mode` value → fail-secure: требует ack, не silent pass.

### Error cases

- Err1. `npm install` в `.claude/tools/` упал (нет сети) → setup-instruction в README описывает offline workflow.
- Err2. Node.js версия < 18 (отсутствует `parseArgs`) → exit с сообщением о требовании версии.
- Err3. OpenAI SDK breaking change в major → lockfile защищает, pinned version без caret.
- Err4. Hook publish-after-each-pass ложно блокирует легитимный переход → override через operator ack-token, не silent bypass.
- Err5. **Endpoint mismatch: `*-codex` и `*-pro` модели completion-only** (найдено live Mode A dogfood на `81aca54`, verified API probe на `c399f48`). Список проверен реальными вызовами `POST /v1/chat/completions` с `max_completion_tokens: 1000` по состоянию API 2026-04-22:

    **Chat-capable (verified):** `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.1-chat-latest`, `gpt-5.3-chat-latest`.

    **Completion-only (verified, возвращают 400 «This is not a chat model»):** `gpt-5.3-codex`, `gpt-5.1-codex`, `gpt-5.2-codex`, `gpt-5.2-pro`.

    **Acceptance criterion Правки 1:** script `.claude/tools/openai-review.mjs` поддерживает **только chat-capable allowlist** (CHAT_MODELS = приведённый verified список). При попытке вызвать модель вне allowlist → exit с сообщением «model X is completion-only, use chat-capable model from: gpt-5.4 | gpt-5.4-mini | gpt-5.4-nano | gpt-5.1-chat-latest | gpt-5.3-chat-latest». Никаких runtime-endpoint-dispatch гипотез — жёсткий whitelist.

    **Adversarial diversity Правки 1:** Ревьюер A = `gpt-5.4` (full reasoning), Ревьюер B = `gpt-5.4-mini` (smaller, different training cutoff — даёт diversity при той же chat-совместимости). Замена для Codex-ревьюера — не совместимая `*-codex`/`*-pro`, а chat-capable модель иной размерности.

### Invariants

- I1. Mode A никогда не использует `npx codex review` как основной путь после v3.6 (только как fallback с меткой).
- I2. `/finalize-pr` никогда не пропускает Sprint Final без валидного `mode == "A"` в META без явного ack.
- I3. Ни один скилл не содержит хардкода `master`/`main` для base-ветки — только через `baseRefName` PR-метаданных.
- I4. Codex CLI sandbox-параметры (`sandbox_mode=danger-full-access`) не появляются ни в одном скилле или инструкции.
- I5. PM публикует комментарий в PR перед переходом к следующему шагу — hook enforce'ит.

### Test list

Обязательные тесты/прогоны, покрывающие AC+B+E+Err+I:

1. **T1. Правка 1 переносимость (покрывает AC1, AC2, B1, B2, B3, E5, Err1, Err2, I4).**
   ```bash
   # Шаг 1: на Windows dev-host
   cd .claude/tools && npm install && cd -
   BASE_REF="$(gh pr view --json baseRefName --jq '.baseRefName')"
   node .claude/tools/openai-review.mjs --ping   # ожидаем exit 0
   node .claude/tools/openai-review.mjs --model gpt-5.4 --base "$BASE_REF" > .claude/tools/review.md
   # Ожидаем: reviewer output сохранён в .claude/tools/review.md, без CreateProcessWithLogonW, без sandbox-параметров.

   # Шаг 2: те же команды на рабочем ноутбуке (macOS) — идентичное поведение.
   # Шаг 3: перенос на чистую машину — только копирование .claude/tools/ + npm install.
   ```

2. **T2. Правка 2 hook publish-after-each-pass (покрывает AC3, Err4, I5).** Создать mock PR, попытаться запустить pass без публикации предыдущего отчёта → hook block. После публикации — проходит. С operator ack-token — проходит с warning, не silent bypass.

3. **T3. Правка 3 Mode A strict gate (покрывает AC4, E7, I2).** Пять тест-кейсов:
   - T3.1: комментарий с `"mode": "C"` без ack → `/finalize-pr` на Sprint Final отказ.
   - T3.2: `"mode": "B"` / label `B-manual` без ack → отказ на Sprint Final.
   - T3.3: `"mode": "C"` или `"mode": "B"` с `--accept-degraded=<reason>` → проходит с пометкой.
   - T3.4: `"mode"` отсутствует/malformed → отказ (fail-secure).
   - T3.5: `"mode": "A"` → проходит без вопросов.

4. **T4. Правка 4 heartbeat (покрывает AC5).** Запустить `/sprint-pr-cycle` на тестовой ветке, наблюдать серию обновлений `.memory_bank/status.md` с monotonic timestamp. Минимум 10 обновлений за спринт.

5. **T5. Правка 5 pre-flight (покрывает AC6, B1, E1, E2, E3, Err3).** Временно экспортировать невалидный `OPENAI_API_KEY`, запустить `/external-review` → ранний exit на шаге 1.4 за <2 сек. Repeat для rate limit (mock 429).

6. **T6. Dogfood на двух машинах (покрывает AC1, AC2, AC7, B4, E5, E6, I1, I3, I4).** Полный Sprint Final цикл прогоняется на Windows home и на рабочем ноутбуке. Оба прогона завершаются без ручных workaround'ов. Проверить `grep -r "sandbox_mode" .claude/` и `grep -r "npx @openai/codex" .claude/skills/` — только в legacy fallback контексте.

7. **T7. Pipeline-audit инварианты (покрывает I1, I3, I4).** Запустить `/pipeline-audit`. Новые инварианты из Правок 1-3 должны быть OK (0 drift).

8. **T8. Beads закрытие (покрывает AC7).** `bd show big-heroes-1l6` → status=closed, reason=«obsolete: Mode A migrated from Codex CLI to Node.js native».

## Риски

1. **Правка 1 — OpenAI SDK breaking changes.** Зависимость `openai@4.70.0` (pinned, без caret) может потребовать явного обновления после v3.6. Это npm-зависимость, не vendoring — разрешение версий фиксируется через `package-lock.json`. Митигация: держать pinned version + lockfile, update только через explicit Beads-задачу (не автоматически npm update).

2. **Правка 1 — Codex CLI и Node.js native дают разный формат вывода.** `codex review` выдаёт структурированный вывод в своём формате, `gpt-4`-style API — свободный markdown. Митигация — system prompt в script задаёт жёсткий формат ответа, PM консолидация адаптирована.

3. **Правка 3 — hard gate слишком строгий, блокирует легитимную Mode C при временной недоступности OpenAI.** Митигация — `--accept-degraded=<reason>` argument, operator ack без повторного запуска.

4. **Миграция с Codex CLI сломает существующие pipeline-audit инварианты.** Митигация — обновить инварианты в pipeline-audit, прогнать `/pipeline-audit` как часть Правки 1 merge.

## Что явно не входит

- MCP-коннектор — зафиксирован как будущее направление при росте числа OpenAI-инструментов.
- Scope-creep-guard, governance-path-deny, destructive-git-guard, handoff-structured JSON, token telemetry jsonl, operator notifications, protected branches, append-only audit-лог — избыточны для соло-пользователя.
- Cross-model review с 3+ моделями параллельно — отложено до роста команды.

## Критические файлы

| Файл | Роль |
|------|------|
| `.claude/tools/openai-review.mjs` | Новый, Правка 1 — сердце Mode A |
| `.claude/tools/package.json` | Новый, Правка 1 — pinned openai SDK |
| `.claude/tools/README.md` | Новый, Правка 1 — setup для другой машины |
| [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md) | Правки 1, 5, 6, 7 |
| [.claude/skills/finalize-pr/SKILL.md](../../.claude/skills/finalize-pr/SKILL.md) | Правки 3, 6 |
| [.claude/skills/sprint-pr-cycle/SKILL.md](../../.claude/skills/sprint-pr-cycle/SKILL.md) | Правки 4, 6 |
| [.claude/skills/pipeline-audit/SKILL.md](../../.claude/skills/pipeline-audit/SKILL.md) | Новые инварианты по Правкам 1, 2, 3 |
| [.claude/settings.json](../../.claude/settings.json) | Правка 2 (hook регистрация) |
| [.agents/CODEX_AUTH.md](../../.agents/CODEX_AUTH.md) | Правка 1 (deprecation note) |
| [.memory_bank/status.md](../../.memory_bank/status.md) | Правка 4 (runtime-target) |
