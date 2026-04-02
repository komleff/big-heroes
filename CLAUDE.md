# CLAUDE.md — Big Heroes

**Проект:** Big Heroes
**Обновлён:** 2026-04-02

---

## Навигация

| Файл | Назначение |
|------|------------|
| `.claude/rules/universal.md` | Базовые правила для всех агентов |
| `.claude/rules/client.md` | Правила клиентского кода (`client/**`) |
| `.claude/rules/shared.md` | Правила shared-пакета (`shared/**`) |
| `.claude/rules/tests.md` | Стандарты тестирования (`**/*.test.*`) |
| `.agents/AGENT_ROLES.md` | Роли агентов и workflow |
| `.claude/agents/` | Нативные агенты (planner, developer, reviewer, tester) |
| `.claude/skills/sprint-pr-cycle/` | Скилл оркестрации PR-цикла |
| `.memory_bank/status.md` | Текущее состояние проекта |

---

## Команды

```bash
npm run dev          # сервер разработки (client)
npm run build        # полная сборка (shared → client)
npm run test         # тесты
```

## Ключевые файлы

| Файл | Назначение |
|------|------------|
| `config/balance.json` | Параметры баланса игры |
| `client/src/main.ts` | Точка входа PixiJS Application |
| `shared/src/index.ts` | Публичное API shared-пакета |
| `docs/architecture/` | Архитектурный документ |

---

## Приоритет источников правды

1. Архитектурный документ
2. Техническое задание
3. GDD / бизнес-требования
4. `.memory_bank/` — текущий контекст проекта
5. Прочие документы

При конфликте между источниками — сообщить оператору.
