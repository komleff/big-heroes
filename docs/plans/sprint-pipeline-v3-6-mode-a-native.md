# Спринт v3.6 — переносимый Mode A через Node.js native OpenAI SDK

## Контекст

Черновик плана v3.6 писался, когда OpenAI API-баланс считался недоступным. К 2026-04-21 баланс восстановлен, Mode A через Codex CLI (`npx @openai/codex review`) работает — но хрупко. Критический анализ выявил четыре проблемы:

1. **BE-11 Windows sandbox блокирует Codex CLI.** `CreateProcessWithLogonW failed: 1326` — Codex CLI subprocess не запускается на Windows без `-c sandbox_mode='"danger-full-access"'`. Оператор работает на двух машинах (домашний Windows + рабочий ноутбук), половина времени — на Windows. `danger-full-access` — неприемлемая заглушка: отключает sandbox-изоляцию, формализовать её как convention нельзя.

2. **BE-11 workaround не в скиллах.** Обход документирован только в [.memory_bank/status.md:25](../../.memory_bank/status.md). В [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md) — ни строчки. Любой первый запуск `/external-review` на Windows упадёт.

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

**Назначение.** Устранить Codex CLI subprocess как путь вызова внешних ревьюеров. Вместо `npx @openai/codex review` — локальный Node.js script, вызывающий OpenAI Chat Completions API напрямую через `openai` npm package.

**Архитектура.**
- Файл: `.claude/tools/openai-review.mjs` (~150 LoC).
- Зависимости: `.claude/tools/package.json` с `"openai": "4.70.0"` без `^` (pinned, см. Риск 1); `package-lock.json` коммитится в репозиторий для воспроизводимости между машинами. Одноразовый `npm install` при первой настройке.
- Вызов: PM-агент через Bash subprocess `node .claude/tools/openai-review.mjs --model gpt-5.4 --base master`. API key — из `$OPENAI_API_KEY`.
- Поддерживаемые модели: `gpt-5.4` (Ревьюер A, high reasoning), `gpt-5.3-codex` (Ревьюер B, фокус на коде). Оба прохода — adversarial diversity как в черновом режиме A.
- Выход: raw markdown на stdout. PM мапит на 4 аспекта при консолидации (как сейчас в external-review).

**Подкоманды скрипта.**
- `openai-review.mjs --ping` — проверка валидности API-ключа (GET `/v1/models`, exit code 0/1, см. Правку 5).
- `openai-review.mjs --model <id> --base <branch>` — основной вызов review.

**Интеграция в скилл.**
В [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md) шаг 3.1 — заменить блок «Режимы A и B — через Codex CLI» на «Режим A — через native script». Codex CLI остаётся как Mode A-fallback, если script упал. Mode B (ChatGPT OAuth) — удалить (пользователь всегда может использовать API key). Mode C/D (Claude adversarial, manual emergency) — остаются.

**Критерий приёмки.**
1. На Windows dev-host запуск `/external-review` для любого PR проходит без CreateProcessWithLogonW, без `sandbox_mode=danger-full-access`, без `npx codex`.
2. На macOS — тот же флоу, без изменений в поведении.
3. Node.js script переносится копированием `.claude/tools/` + `npm install` на другой компьютер с Claude Code. Никаких дополнительных установок.
4. Два прохода (gpt-5.4 + gpt-5.3-codex) публикуются в одном PR-комментарии, META JSON `"mode": "A"` валиден.

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
Хук `PreToolUse` в [.claude/settings.json](../../.claude/settings.json) перед запуском субагентов нового review-pass, developer-fix, external-review, finalize-pr. Скрипт `.claude/hooks/check-pass-published.py` — идемпотентный, без состояния. Проверка через `gh pr view --json comments` наличия PM-комментария с меткой завершения pass N и commit binding (regex `Commit:\s*\`?<hash>` ИЛИ JSON `"commit": "<hash>"`).

**Критерий приёмки.**
PM пытается запустить следующий pass без публикации отчёта — отказ с пояснением. После публикации — проходит. Override через явный operator ack-token, не молчаливый обход.

**Файлы.**
- [.claude/settings.json](../../.claude/settings.json) — регистрация hook.
- `.claude/hooks/check-pass-published.py` — новый, ~80 LoC.
- [.claude/skills/pipeline-audit/SKILL.md](../../.claude/skills/pipeline-audit/SKILL.md) — новый инвариант.

---

### Правка 3 (P1, новая). Mode A strict gate в /finalize-pr

**Назначение.** Закрыть регрессию молчаливой деградации Mode A → Mode C. Для Sprint Final tier требовать явного `"mode": "A"` в META JSON.

**Требования.**
В [.claude/skills/finalize-pr/SKILL.md](../../.claude/skills/finalize-pr/SKILL.md) шаг 4 (external review check) добавить:
- Парсить `"mode"` из HTML META JSON в PM-комментарии (формат в external-review:249).
- Sprint Final tier на master-merge:
  - `mode == "A"` — проход без вопросов.
  - `mode == "B"` (включая label `B-manual`) — degraded manual fallback, не эквивалент Mode A. Допускается только с operator ack через `--accept-degraded=<reason>` или файл `.finalize-pr-ack`.
  - `mode ∈ {"C", "D"}` — то же требование ack.
  - `mode` отсутствует, не распарсился или имеет неизвестное значение — трактовать как degraded attestation и требовать ack (fail-secure, не silent bypass).
- Critical tier (не Sprint Final) — warning, но не block. Mode B/C/D в обычных pass не блокируются.
- `/finalize-pr --pre-landing` наследует поведение — landing-commit не валидирует pipeline с dishonest-mode.

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
В [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md) шаг 1.4 добавить вызов `node .claude/tools/openai-review.mjs --ping`. При exit code != 0 — ранний exit с инструкцией по ротации ключа (ссылка на `.agents/CODEX_AUTH.md §5`).

Внутри `openai-review.mjs` команда `--ping` делает `client.models.list()` (дешёвый запрос, ~20ms), возвращает 0 при 200 OK, 1 при 401/429/network error + сообщение.

**Критерий приёмки.**
Запуск `/external-review` с revoke'нутым ключом падает на шаге 1.4 с понятной ошибкой за <2 секунды, не ожидает 30+ секунд до шага 3.

**Файлы.**
- `.claude/tools/openai-review.mjs` — добавить подкоманду `--ping` (встроено в Правку 1).
- [.claude/skills/external-review/SKILL.md](../../.claude/skills/external-review/SKILL.md) — шаг 1.4.

---

### Правка 6 (P3). Mode-label унификация в комментариях PM

**Назначение.** В [.claude/skills/external-review/SKILL.md:246](../../.claude/skills/external-review/SKILL.md) первая строка уже содержит `Режим: __MODE__`. Распространить формат на комментарии из `sprint-pr-cycle` и `finalize-pr`.

**Требования.**
Каждый комментарий PM в PR начинается с первой строки `Режим: <label>` где label ∈ {A, B-manual, C, D}. Формат `Режим:` (не `Mode:`) — такой же, как уже в шаблоне `external-review/SKILL.md:246`; единый ключ нужен для будущих парсеров. Label `B-manual` включён для совместимости с Правкой 7. Без hook enforcement — соглашение в шаблоне.

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

## Верификация

1. **Правка 1 — переносимость.**
   ```bash
   # Шаг 1: на Windows dev-host
   cd .claude/tools && npm install && cd -
   node .claude/tools/openai-review.mjs --ping   # ожидаем exit 0
   node .claude/tools/openai-review.mjs --model gpt-5.4 --base master > .claude/tools/review.md
   # Ожидаем: reviewer output сохранён в .claude/tools/review.md (кроссплатформенный путь),
   # без CreateProcessWithLogonW, без sandbox-параметров.

   # Шаг 2: те же команды на рабочем ноутбуке (macOS) — идентичное поведение.

   # Шаг 3: перенос на чистую машину — только копирование .claude/tools/ + npm install.
   ```

2. **Правка 2 (hook publish-after-each-pass).** Создать mock PR, попытаться запустить pass без публикации предыдущего отчёта — ожидаем hook block. После публикации — проходит.

3. **Правка 3 (Mode A strict gate).** Опубликовать mock-комментарий с `"mode": "C"` через `gh pr comment`. Запустить `/finalize-pr` на Sprint Final — ожидаем hard block. С `--accept-degraded=test` — проходит с warning.

4. **Правка 4 (heartbeat).** Запустить `/sprint-pr-cycle` на тестовой ветке, наблюдать серию обновлений `.memory_bank/status.md` с monotonic timestamp.

5. **Правка 5 (pre-flight).** Временно экспортировать невалидный `OPENAI_API_KEY`, запустить `/external-review` — ожидаем ранний exit на шаге 1.4 за <2 сек.

6. **Dogfood на двух машинах.** Полный Sprint Final цикл прогоняется на Windows home и на рабочем ноутбуке. Оба прогона завершаются без ручных workaround'ов.

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
