# Пайплайн разработки Big Heroes

**Версия:** 2.0
**Обновлён:** 2026-04-13

---

## 1. Философия

### Zero Trust to Human Tech Skills

1. **Человек не проверяет код.** Оператор принимает решения на основе вердиктов.
2. **Бинарный контроль.** Каждый этап: `APPROVED` или `CHANGES_REQUESTED`.
3. **Автономность качества.** Тесты + 4-аспектное ревью + разделение ролей.

Соло-разработчик управляет ИИ-агентами как менеджер, а не как программист.

### Инварианты

Полный список — `AGENTIC_PIPELINE.md` секция «Инварианты». Ключевые:

1. Все review-pass публикуются в PR одним владельцем (PM).
2. Review привязан к commit hash. Нет merge без fresh review на текущем commit.
3. Merge — отдельное решение оператора. Только через `/finalize-pr`.
4. Любое замечание имеет статус: fix now / defer to Beads (с ID) / reject with rationale.
5. PM не искажает findings ревьюверов.

---

## 2. Карта компонентов

| Компонент | Тип | Расположение | Назначение |
|-----------|-----|-------------|-----------|
| PM | Роль | `.agents/PM_ROLE.md` (детали), `AGENT_ROLES.md` (сводка) | Оркестрация спринтов |
| Architect | Роль | `.agents/AGENT_ROLES.md` | Архитектурные решения |
| Developer | Роль + агент | `.claude/agents/developer.md` | Реализация, TDD |
| Reviewer | Роль + агент | `.claude/agents/reviewer.md` | Проверка PR по 4 аспектам |
| Tester | Агент | `.claude/agents/tester.md` | Тесты и покрытие |
| Planner | Агент | `.claude/agents/planner.md` | Исследование, планы, Verification Contract |
| verify | Скилл | `.claude/skills/verify/` | Единый build/test gate |
| sprint-pr-cycle | Скилл | `.claude/skills/sprint-pr-cycle/` | Цикл PR: ревью → фикс → отчёт |
| external-review | Скилл | `.claude/skills/external-review/` | Кросс-модельное ревью (4 режима деградации) |
| finalize-pr | Скилл | `.claude/skills/finalize-pr/` | Hard gate перед merge (commit binding) |
| pipeline-audit | Скилл | `.claude/skills/pipeline-audit/` | Проверка консистентности документов |
| Rules | Правила | `.claude/rules/*.md` | Ограничения по типу кода |
| Hooks | Хуки | `.claude/settings.json` | Тесты перед коммитом, PR-gate, deny-rules |
| Memory Bank | Контекст | `.memory_bank/` | Состояние между сессиями |
| Beads | Задачи | `.beads/` | Issue tracking для ИИ |

---

## 3. Жизненный цикл спринта

```
Оператор ставит задачу
       ↓
PM читает Memory Bank + создаёт ветку
       ↓
PM → Planner → план + Verification Contract в docs/plans/
       ↓
PM → Developer → реализует против контракта (TDD)
       ↓
/verify (build + test)
       ↓
git push → gh pr create
       ↓
PM → /sprint-pr-cycle → внутреннее ревью (4 аспекта, commit-bound)
       ↓
CHANGES_REQUESTED? → triage (fix / defer+Beads / reject) → Developer → fix → повтор
       ↓
APPROVED → PM → /external-review → кросс-модельное ревью
       ↓
APPROVED → PM → /finalize-pr → hard gate (commit binding, все проверки)
       ↓
✅ Готов к merge → оператор мержит PR
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

---

## 5. Режимы деградации external-review

| Режим | Условие | Adversarial diversity |
|-------|---------|----------------------|
| A | API key | Максимальная (GPT-5.4 + GPT-5.3-Codex) |
| B | ChatGPT login | Снижена (один проход) |
| C | Codex CLI недоступен | Degraded (Claude adversarial) |
| D | Автоматика недоступна | Ручной (VS Code Copilot Agent) |

---

## 6. Связанные документы

| Документ | Назначение |
|----------|-----------|
| `AGENTIC_PIPELINE.md` | Универсальная методология (ПОЧЕМУ) |
| `PIPELINE_ADR.md` | Решения и обоснования (ПОЧЕМУ ТАК) |
| `AGENT_ROLES.md` | Роли и промпты (КАК) |
| `PM_ROLE.md` | Детальный workflow PM |
| `HOW_TO_USE.md` | Шпаргалка оператора |
| `REFERENCES.md` | Источники и референсы |
