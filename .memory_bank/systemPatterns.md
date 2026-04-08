# Архитектурные паттерны — Big Heroes

**Обновлён:** 2026-04-09

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
Resolution = min(2, max(DPR, ceil(scaleFactor))) для чётких шрифтов.
Canvas = реальный размер окна (resizeTo: window, autoDensity: true).

### Сцены (`client/src/scenes/`)

- Каждая сцена — класс, наследует от `Container` (BaseScene)
- Переходы: `SceneManager` с container scale viewport (390×844 design coordinates)
- Сцена не содержит бизнес-логику — только отображение
- `removeChildren()` + `destroy({ children: true })` при пересборке UI

### PvE-поход (граф Slay the Spire)

**Два понятия:**
- **Развилка** — экран выбора (PveMapScene). 1–3 варианта.
- **Точка интереса** — место: Бой, Элита, Босс, Сундук, Древний сундук, Святилище, Магазин, Лагерь, Событие, ???

**Flow:** Развилка → выбор → сразу в точку (без "ВОЙТИ") → advanceToNextNode → развилка.

**Ключевые правила:**
- `ensureForkPaths` проверяет ТЕКУЩИЙ узел (не следующий)
- `handleForkChoice` записывает тип в `nodes[currentIdx]` → `enterNode(currentIdx)`
- Никогда `goto('pveMap')` в handleForkChoice
- Фиксированные (boss/ancient_chest/sanctuary) → 1 вариант
- Retreat: остаётся на текущем узле, ensureForkPaths перегенерирует
- Нет дубликатов типов на развилке (кроме combat/elite)
- displayStep = currentNodeIndex + 1 (12 шагов: 1–12)

**Антипаттерны (НЕ реализовывать):**
- Промежуточный экран "ВОЙТИ" после выбора на развилке
- Возврат на предыдущую развилку по isFork (кроме retreat)
- Ремонт в магазине (только в лагере)
- Двойной инкремент idx

### Конфигурация

`config/balance.json` — единственный источник числовых параметров игры.
Код не содержит хардкод-констант игрового баланса.

---

## Архитектура демо

См. полную структуру: `docs/architecture/architecture.md`

Ключевые системы:
- `GameState.ts` — центральное хранилище состояния
- `EventBus.ts` — шина событий между системами
- `BattleSystem.ts` — логика боя (PvE и PvP)
- `FormulaEngine.ts` — расчёт урона, шансов, рейтинга (shared)
- `PveSystem.ts` — генерация маршрута, generateForkPaths (shared)

Сцены: Hub → PveMap (развилка) → [Sanctuary/Battle/Shop/Camp/Event/Loot/Chest] → PveResult → Hub

---

## AI-пайплайн

### Роли и агенты
- PM → оркестрация, ветки, делегирование
- Developer → реализация (TDD), `.claude/agents/developer.md`
- Reviewer → 4 аспекта, `.claude/agents/reviewer.md`
- Tester → тесты, `.claude/agents/tester.md`
- Planner → исследование, планы

### Ревью-процесс
- 4 аспекта: Архитектура, Безопасность, Качество, Гигиена кода
- Hard gate: сессия не завершена без `git push` + `gh pr comment` (if PR exists)
- Comment-only: `gh pr comment`, не `gh pr review` (все агенты = аккаунт оператора)

### Завершение сессии
1. Issues для оставшейся работы (beads)
2. Quality gates (build + test)
3. git push
4. gh pr comment — **hard gate**
5. Memory bank + beads memory обновлены
