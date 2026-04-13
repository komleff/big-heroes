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

Если PR не найден — создай:

```bash
gh pr create --title "Sprint N: [краткое описание]" --body "$(cat <<'EOF'
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

## Фаза 2: Внутреннее ревью

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

```bash
gh pr comment <PR_NUMBER> --body "$(cat <<'EOF'
## Внутреннее ревью (Claude)

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
)"
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

Если вердикт `APPROVED` — переходи к Фазе 4.

## Фаза 4: Готовность к merge

Перед финальным отчётом убедись:
- [ ] Все тесты зелёные
- [ ] Внутреннее ревью: все аспекты APPROVED
- [ ] Внешнее ревью: вердикт получен
- [ ] Все review-pass опубликованы в PR

```bash
gh pr comment <PR_NUMBER> --body "## ✅ Готов к merge

Все проверки пройдены. Merge — на усмотрение оператора.

— PM (Claude Opus 4.6)"
```
