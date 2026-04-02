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

## Фаза 1: Подготовка PR

### Шаг 1.1: Проверка готовности

```bash
npm run build && npm run test
```

Если тесты падают — **СТОП**. Исправь перед продолжением.

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
- [ ] npm run build
- [ ] npm run test

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## Фаза 2: Внутреннее ревью

### Шаг 2.1: Запуск reviewer субагентов (параллельно)

**Архитектура:**
```
Ты Reviewer. Прочитай .agents/AGENT_ROLES.md секция "3. Reviewer".
Задача: проверь PR #<NUMBER> — аспект АРХИТЕКТУРА.
Фокус: разделение слоёв (client/shared), чистота shared-пакета, паттерны сцен.
Результат: вердикт APPROVED / CHANGES_REQUESTED с обоснованием.
```

**Безопасность:**
```
Ты Reviewer. Прочитай .agents/AGENT_ROLES.md секция "3. Reviewer".
Задача: проверь PR #<NUMBER> — аспект БЕЗОПАСНОСТЬ.
Фокус: XSS, утечка данных, OWASP top-10.
Результат: вердикт APPROVED / CHANGES_REQUESTED с обоснованием.
```

**Качество:**
```
Ты Reviewer. Прочитай .agents/AGENT_ROLES.md секция "3. Reviewer".
Задача: проверь PR #<NUMBER> — аспект КАЧЕСТВО.
Фокус: покрытие тестами, edge-cases, производительность < 16мс/кадр.
Результат: вердикт APPROVED / CHANGES_REQUESTED с обоснованием.
```

### Шаг 2.2: Публикация отчёта

```bash
gh pr comment <NUMBER> --body "$(cat <<'EOF'
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

— PM (Claude Opus 4.6)
EOF
)"
```

### Шаг 2.3: Исправление замечаний (если есть)

Если хотя бы один аспект `CHANGES_REQUESTED` — запусти developer субагента на исправления, потом `git push` и повтори ревью.

## Фаза 3: Внешнее ревью

> **OPTIONAL для прototipa.** Для прototipa достаточно внутреннего ревью (Фаза 2).
> Фаза 3 обязательна только для релиза / production-версии.

### Шаг 3.1: Подготовка промптов для внешних моделей

Создай файл `docs/plans/sprint-N-review-prompts.md` с промптами для:
- GPT-5.4 (архитектура + качество)
- ChatGPT-5.3-Codex (безопасность + тесты)

### Шаг 3.2: Публикация результатов внешнего ревью

После получения вердиктов от оператора — опубликуй в PR:

```bash
gh pr comment <NUMBER> --body-file external-review.md
```

## Фаза 4: Готовность к merge

Перед финальным отчётом убедись:
- [ ] Все тесты зелёные
- [ ] Внутреннее ревью: все аспекты APPROVED
- [ ] Внешнее ревью: вердикт получен *(или пропущено — режим прototipa)*

```bash
gh pr comment <NUMBER> --body "## ✅ Готов к merge

Все проверки пройдены. Merge — на усмотрение оператора.

— PM (Claude Opus 4.6)"
```
