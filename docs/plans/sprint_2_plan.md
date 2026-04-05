# Sprint 2: FormulaEngine + BattleSystem + BattleScene + Background Image

## Контекст

Sprint 1 merged (PR #2). Есть: SceneManager, HubScene, GameState, EventBus, UI-компоненты, ThemeConfig, Tween. Задний фон HubScene — сплошной цвет.

**Цель спринта:** добавить фоновое изображение в HubScene + реализовать пошаговый бой: формулы в shared/, BattleSystem (логика ходов), BattleScene (визуализация). Кнопка «ПОХОД» в HubScene запускает тестовый бой с мобом «Слизень».

**Результат:** при нажатии «ПОХОД» открывается BattleScene с двумя аватарами, HP-полосами, кнопкой «Атаковать» и логом боя. Пошаговый бой до победы/поражения. Баннер результата → возврат в HubScene.

---

## Файлы

### Новые (7)

| Файл | Назначение |
|------|------------|
| `client/src/assets/hub-bg.png` | Фоновое изображение (копия из docs/design/) |
| `client/src/assets/assets.d.ts` | TypeScript-декларация для PNG-импортов |
| `shared/src/types/Battle.ts` | Типы: IBattleContext, ITurnResult, IBattleResult, IEnemyConfig, IFormulaConfig |
| `shared/src/formulas/FormulaEngine.ts` | Чистые функции: урон, защита, крит, HP |
| `shared/src/formulas/FormulaEngine.test.ts` | Unit-тесты формул (TDD) |
| `client/src/systems/BattleSystem.ts` | Оркестратор боя: ходы, HP, проверка победы/поражения |
| `client/src/scenes/BattleScene.ts` | Визуальный экран боя |

### Изменяемые (9)

| Файл | Что менять |
|------|------------|
| `client/webpack.config.ts` | Добавить asset module для PNG (`type: 'asset/resource'`) |
| `config/balance.json` | Секции `formulas` и `enemies` |
| `shared/src/types/BalanceConfig.ts` | Добавить `formulas: IFormulaConfig`, `enemies: IEnemyConfig[]` |
| `shared/src/index.ts` | Реэкспорт новых типов и формул |
| `client/src/core/EventBus.ts` | Battle-события: TURN_COMPLETE, BATTLE_ENDED, HP_UPDATED |
| `client/src/ui/ProgressBar.ts` | Добавить `fillColor` опцию + `setFillColor()` метод |
| `client/src/config/ThemeConfig.ts` | Battle-токены: цвета HP, лог, баннеры, анимации |
| `client/src/scenes/HubScene.ts` | Фоновое изображение + wiring кнопки ПОХОД → BattleSystem |
| `client/src/main.ts` | Прелоад bg-ассета + регистрация BattleScene |

---

## Шаги реализации

### Фаза 1: Фундамент (параллельно)

**Шаг 1. Webpack PNG + копирование картинки**
- В `client/webpack.config.ts` добавить в `module.rules`: `{ test: /\.(png|jpe?g|gif|svg)$/i, type: 'asset/resource' }`
- Создать `client/src/assets/assets.d.ts`: `declare module '*.png' { const value: string; export default value; }`
- Скопировать `docs/design/airtist_...png` → `client/src/assets/hub-bg.png`

**Шаг 2. Типы Battle в shared/**
- `shared/src/types/Battle.ts`:
  - `EnemyType`, `IEnemyConfig`, `IFormulaConfig`, `IBattleContext`, `ITurnResult`, `BattleOutcome`, `IBattleResult`
- Обновить `BalanceConfig.ts`: `formulas: IFormulaConfig`, `enemies: IEnemyConfig[]`
- Обновить `shared/src/index.ts`

**Шаг 3. balance.json + GameEvents + ThemeConfig + ProgressBar**
- `config/balance.json` — добавить `formulas` и `enemies`
- `EventBus.ts` — добавить `BATTLE_TURN_COMPLETE`, `BATTLE_ENDED`, `BATTLE_HP_UPDATED`
- `ThemeConfig.ts` — battle-токены (цвета: hp_bar_enemy, hp_bar_player, battle_log_bg, crit_color, victory/defeat_ribbon; sizes: battleLog, damageNumber, critDamageNumber, resultBanner; animation: damageFloatMs, damageFloatDistance, pulseMs, turnDelayMs, resultDelayMs)
- `ProgressBar.ts` — `fillColor?: number` в опции, `setFillColor()` метод

### Фаза 2: Формулы + тесты

**Шаг 4. FormulaEngine в shared/**
- `shared/src/formulas/FormulaEngine.ts` — чистые функции:
  - `calcRawDamage(baseAttack, mass, coeff, weaponMod)` → `base × (1 + mass × coeff) × weaponMod`
  - `calcDefense(baseDef, armorMod)` → `base × (1 + armorMod)`
  - `calcActualDamage(raw, def, minDmg)` → `max(min, raw − def)`
  - `rollCrit(critChance, rng?)` → boolean (rng для тестов)
  - `calcFinalDamage(actual, isCrit, critMult)` → число
  - `calcMaxHp(baseHp, mass, hpPerMass)` → `base + mass × hpPerMass`
  - `getMobHpMultiplier(type)` → `combat=1.0, elite=2.0, boss=4.0`

**Шаг 5. Unit-тесты FormulaEngine**
- Тесты AAA-паттерн: базовые кейсы, граничные значения, нулевые входы, крит-порог

### Фаза 3: BattleSystem + BattleScene

**Шаг 6. BattleSystem**
- `client/src/systems/BattleSystem.ts`:
  - `startBattle(context)` — инициализация HP
  - `playerAttack(): ITurnResult | null` — расчёт + emit
  - `enemyAttack(): ITurnResult | null` — ответный удар + emit
  - `isFinished`, `hpState`, `outcome` геттеры
  - Без game loop — вызывается сценой

**Шаг 7. BattleScene** — layout 390×844:
```
y=48    «БОЙ» (heading)
y=120   Аватары: Герой (cyan) | Враг (red), масса под каждым
y=310   HP героя: ProgressBar green (340px)
y=350   HP врага: ProgressBar red (340px)
y=400   Лог боя: bg_secondary, 3 строки
y=600   Кнопка «АТАКОВАТЬ» (primary)
```
- Цикл: кнопка → disable → playerAttack → shake + float damage → delay 600ms → enemyAttack → shake + float → enable
- Крит: крупное число + «КРИТ!» yellow
- HP < 25%: красная полоса + пульсация
- Победа: зелёный баннер «ПОБЕДА!» + «Продолжить» → hub
- Поражение: красный баннер + darken → hub

### Фаза 4: Интеграция

**Шаг 8. HubScene bg + wiring + main.ts**
- `main.ts`: прелоад `hub-bg.png` через `Assets.load()`, регистрация BattleScene
- HubScene: `Sprite` из `Assets.get()` вместо Graphics rect, cover-fit 390×844
- Кнопка «ПОХОД»: создать BattleSystem, startBattle(enemies[0]), goto('battle')

### Фаза 5: Проверка

**Шаг 9.** `npm run build` + `npm run test` + браузер:
- [ ] Фон HubScene — картинка (cover-fit)
- [ ] «ПОХОД» → BattleScene FADE
- [ ] HP-бары: зелёная (игрок), красная (враг)
- [ ] Пошаговый бой работает до конца
- [ ] Анимации: shake, float damage, крит
- [ ] Баннеры победы/поражения → возврат в HubScene

---

## Зависимости

```
Шаг 1 (webpack + image)    ─┐
Шаг 2 (Battle types)       ─┼── параллельно
Шаг 3 (balance/events/     ─┘
        theme/ProgressBar)    
         │
         ▼
Шаг 4 (FormulaEngine) ── Шаг 5 (тесты)
         │
         ▼
Шаг 6 (BattleSystem) ─┐
                        ├── Шаг 7 (BattleScene)
                        │
                        ├── Шаг 8 (HubScene + main.ts)
                        │
                        └── Шаг 9 (проверка)
```

---

## Риски

| Риск | Митигация |
|------|-----------|
| PNG ~970KB раздувает бандл | `asset/resource` эмитит файл отдельно |
| `Assets.load()` async в sync `onEnter()` | Прелоад в main.ts |
| Тайминг ходов/анимаций | BattleScene управляет через setTimeout + disable кнопки |
| Float-point артефакты | Math.round() в BattleSystem |

## Архитектурные решения

1. FormulaEngine — отдельные функции, не класс (tree-shakeable, тестируемые)
2. BattleSystem без game loop — вызывается сценой
3. rollCrit(critChance, rng?) — rng параметр для детерминированных тестов
4. Фон HubScene — прелоад в main.ts, Assets.get() синхронно в onEnter
5. balance.json расширяется, существующие секции не тронуты
