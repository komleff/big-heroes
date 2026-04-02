# Архитектурные паттерны — Big Heroes

**Обновлён:** 2026-04-02

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

- Паттерн SceneManager (Sprint 1)
- Система ассетов и манифест
- Игровой цикл и update-loop
