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
| `.agents/pipeline-adr.md` | ADR: почему пайплайн устроен так (решения + обоснования) |

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
| `docs/gdd/00_index.md` | GDD — индекс (13 файлов) |
| `docs/architecture/architecture.md` | Архитектура демо: сцены, системы, актёры |
| `docs/design/high-concept.md` | High Concept, MVP Scope, System Design |
| `docs/design/style-guide.md` | UI стайлгайд |
| `docs/business/market-research.md` | Исследование рынка и GTM |
| `docs/plans/` | Планы спринтов (создаются Planner-агентом) |

---

## Приоритет источников правды

1. Архитектурный документ
2. Техническое задание
3. GDD / бизнес-требования
4. `.memory_bank/` — текущий контекст проекта
5. Прочие документы

При конфликте между источниками — сообщить оператору.
