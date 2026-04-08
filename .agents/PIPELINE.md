# Пайплайн разработки Big Heroes

**Версия:** 1.0
**Обновлён:** 2026-04-02

---

## 1. Философия

### Zero Trust to Human Tech Skills

1. **Человек не проверяет код.** Оператор принимает решения на основе вердиктов.
2. **Бинарный контроль.** Каждый этап: `APPROVED` или `CHANGES_REQUESTED`.
3. **Автономность качества.** Тесты + многоуровневое ревью + разделение ролей.

Соло-разработчик управляет ИИ-агентами как менеджер, а не как программист.

---

## 2. Карта компонентов

| Компонент | Тип | Расположение | Назначение |
|-----------|-----|-------------|-----------|
| PM | Роль | `.agents/PM_ROLE.md` (детали), `AGENT_ROLES.md` (сводка) | Оркестрация спринтов |
| Architect | Роль | `.agents/AGENT_ROLES.md` | Архитектурные решения |
| Developer | Роль + агент | `.claude/agents/developer.md` | Реализация, TDD |
| Reviewer | Роль + агент | `.claude/agents/reviewer.md` | Проверка PR по 4 аспектам |
| Tester | Агент | `.claude/agents/tester.md` | Тесты и покрытие |
| Planner | Агент | `.claude/agents/planner.md` | Исследование, планы |
| sprint-pr-cycle | Скилл | `.claude/skills/sprint-pr-cycle/` | Цикл PR: ревью → фикс → отчёт |
| Rules | Правила | `.claude/rules/*.md` | Ограничения по типу кода |
| Hooks | Хуки | `.claude/settings.json` | Тесты перед коммитом, PR-gate |
| Memory Bank | Контекст | `.memory_bank/` | Состояние между сессиями |
| external-review | Скилл | `.claude/skills/external-review/` | Кросс-модельное ревью через Codex CLI |
| Beads | Задачи | `.beads/` | Issue tracking для ИИ |

---

## 3. Жизненный цикл спринта

```
Оператор ставит задачу
       ↓
PM читает Memory Bank + создаёт ветку
       ↓
PM → Planner → создаёт план в docs/plans/
       ↓
PM → Developer → реализует (TDD)
       ↓
build + test (зелёные)
       ↓
git push → gh pr create
       ↓
PM → /sprint-pr-cycle → внутреннее ревью (4 аспекта)
       ↓
CHANGES_REQUESTED? → Developer → fix → повтор
       ↓
APPROVED → PM → /external-review → кросс-модельное ревью (внешние модели + Copilot)
       ↓
APPROVED → оператор мержит PR
       ↓
PM обновляет Memory Bank
```

---

## 4. Контекстный бюджет (lazy loading)

| Роль | Файлы Memory Bank при старте |
|------|------------------------------|
| Developer, Tester | `status.md` |
| Planner | `status.md` + `techContext.md` + `systemPatterns.md` |
| Reviewer | `status.md` + `systemPatterns.md` |
| PM | `status.md` |
