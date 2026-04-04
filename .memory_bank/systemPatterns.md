# Архитектурные паттерны — Big Heroes

**Обновлён:** 2026-04-05

---

## Ключевые паттерны

### Разделение слоёв

```
client/       — отображение и ввод
shared/       — игровая математика и типы (без side-effects)
```

`client/` импортирует из `shared/`, не наоборот.
`shared/` — единственный источник формул и констант.

### Точка входа

`client/src/main.ts` создаёт `Application` и монтирует `canvas` в `document.body`.
Все остальные системы запускаются из `main.ts`.

### Сцены (`client/src/scenes/`)

- Каждая сцена — класс, наследует от `Container`
- Переходы управляются будущим `SceneManager`
- Сцена не содержит бизнес-логику — только отображение

### Конфигурация

`config/balance.json` — единственный источник числовых параметров игры.
Код не содержит хардкод-констант игрового баланса.

---

## Архитектура демо (из docs/architecture/architecture.md)

См. полную структуру: `docs/architecture/architecture.md`

Ключевые системы демо:
- `GameState.ts` — центральное хранилище состояния
- `EventBus.ts` — шина событий между системами
- `BattleSystem.ts` — логика боя (PvE и PvP)
- `FormulaEngine.ts` → выносится в `shared/` (расчёт урона, массы, рейтинга)

Сцены: MainMenu → Hub → PveMap → Battle/Loot/Shop/Camp/Boss → PvpLobby → PvpResult

---

## Что ещё не определено

- Система ассетов и манифест
- Игровой цикл и update-loop

---

## AI-пайплайн (установлен Pipeline Audit, PR #3)

### Роли и агенты
- PM → оркестрация, ветки, делегирование
- Developer → реализация (TDD), `.claude/agents/developer.md`
- Reviewer → 4 аспекта, `.claude/agents/reviewer.md`
- Tester → тесты, `.claude/agents/tester.md`
- Planner → исследование, планы

### Ревью-процесс
- 4 аспекта: Архитектура, Безопасность, Качество, Гигиена кода
- 4 уровня: Light (doc-only), Standard (фичи), Critical (shared/balance), Sprint Final (внешние модели)
- Hard gate: сессия не завершена без `git push` + `gh pr comment` (if PR exists)
- Comment-only: `gh pr comment`, не `gh pr review` (все агенты = аккаунт оператора)

### Завершение сессии
1. Issues для оставшейся работы
2. Quality gates (build + test)
3. git push
4. gh pr comment (if PR exists) — **hard gate**
5. Verify + hand off
