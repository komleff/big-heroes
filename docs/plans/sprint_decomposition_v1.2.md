# Big Heroes — Декомпозиция спринтов v1.2 (по реальному коду)

**Версия:** 1.2
**Дата:** 2026-04-05
**Источники:** GDD v1.1, MVP Prototype Proposal v1.1, реальный код komleff/big-heroes
**Статус:** Готово к реализации

---

## Аудит текущего кода

### Что уже реализовано (Sprint 1 старого роадмапа)

| Компонент | Файл | Статус | Можно переиспользовать? |
|-----------|------|--------|------------------------|
| Монорепо scaffold | package.json, webpack, tsconfig | ✅ Готово | Да, без изменений |
| CI | .github/workflows/ci.yml | ✅ Готово | Да |
| ThemeConfig | client/src/config/ThemeConfig.ts | ✅ Готово | Да, без изменений |
| EventBus | client/src/core/EventBus.ts | ✅ Готово | Да, добавить новые события |
| SceneManager | client/src/core/SceneManager.ts | ✅ Готово | Да, без изменений |
| BaseScene | client/src/scenes/BaseScene.ts | ✅ Готово | Да |
| HubScene | client/src/scenes/HubScene.ts | ✅ Готово | **Переработать** (новая модель данных) |
| 4 заглушки | PveMap, PvpLobby, Inventory, DevPanel | ✅ Заглушки | Заменить реализациями |
| Button (3 варианта) | client/src/ui/Button.ts | ✅ Готово | Да |
| ResourceBar | client/src/ui/ResourceBar.ts | ✅ Готово | Да |
| ProgressBar | client/src/ui/ProgressBar.ts | ✅ Готово | Да |
| EquipmentCard | client/src/ui/EquipmentCard.ts | ✅ Готово | **Переработать** (пипсы вместо полосы) |
| HeroPortrait | client/src/ui/HeroPortrait.ts | ✅ Готово | Да, обновить отображение |
| BottomNav | client/src/ui/BottomNav.ts | ✅ Готово | Да |
| Tween | client/src/utils/Tween.ts | ✅ Готово | Да |
| GameState | client/src/core/GameState.ts | ✅ Готово | **Переписать** (новая модель) |
| Shared types | shared/src/types/*.ts | ✅ Готово | **Переписать** (новая модель) |
| balance.json | config/balance.json | ✅ Готово | **Переписать** (новые параметры) |
| Агентный пайплайн | .agents/, .claude/, .memory_bank/ | ✅ Готово | Да |
| GDD v1.0 | docs/gdd/*.md | ✅ 13 файлов | **Заменить на GDD v1.1** (уже в проекте project knowledge) |

### Что нужно переписать и почему

| Компонент | Проблема | Что делать |
|-----------|----------|------------|
| IHeroState | Старая модель: отдельные hp, maxHp, baseAttack, baseDefense | Новая: HP = mass, strength = mass/3 + bonus, armor = shield, luck = accessory |
| IEquipmentItem | Старая: generic modifier, durability 100 | Новая: +strength/+armor/+luck, durability 3, привязка к командам |
| IBalanceConfig | Старая: startHp, baseAttack, baseDefense | Новая: startMass 50, потолок 125, 9 предметов с конкретными бонусами |
| GameState | Сеттеры setHp(), вычисления не по GDD v1.1 | Новые: calcHeroStats из FormulaEngine, belt, backpack, relics |
| balance.json | startMass: 420, durability: 100 | startMass: 50, durability: 3, 9 предметов tier 1 |
| EquipmentCard | ProgressBar для прочности (100/100) | Пипсы прочности (●●○ = 2/3) |
| HubScene | Зависит от старого GameState | Обновить под новую модель, добавить пояс |

### Что НЕ нужно трогать

| Компонент | Почему |
|-----------|--------|
| ThemeConfig | Визуальные токены не изменились |
| SceneManager | 5 типов переходов работают |
| EventBus | Архитектура pub/sub универсальна |
| BaseScene | Абстрактный класс не зависит от модели |
| Button, ResourceBar, ProgressBar, BottomNav | UI-компоненты независимы от игровой модели |
| Tween | Утилита без зависимостей |
| Webpack config, tsconfig | Инфраструктура сборки |
| CI pipeline | GitHub Actions |
| Агентный пайплайн | .agents/, .claude/ — инфраструктура разработки |

---

## Новая структура спринтов

Старый Sprint 1 (SceneManager + HubScene) выполнен. Боевой системы нет. PvE нет. Нумерация спринтов продолжается: следующий — Sprint 2.

### Sprint 2: Новая модель данных + боевая система v4

**Цель:** Переход на модель GDD v1.1. Работающий автобой с 6 командами.

**Время:** 1–2 сессии.

#### Задачи

| ID | Задача | Приоритет | Тип | Критерий готовности |
|----|--------|-----------|-----|---------------------|
| S2-01 | Переписать shared/ types под GDD v1.1 | P0 | Рефакторинг | IHeroState: mass (HP=mass, strength=mass/3+bonus). IEquipmentItem: strength_bonus, armor_bonus, luck_bonus, durability 3, command_id |
| S2-02 | Переписать balance.json | P0 | Рефакторинг | startMass: 50, massCap: 125, 9 предметов из MVP Proposal, 12 расходников, 7 мобов |
| S2-03 | Переписать GameState под новую модель | P0 | Рефакторинг | Убрать hp/maxHp/baseAttack/baseDefense. Добавить belt (2 слота), backpack (4 слота), stash, activeRelics |
| S2-04 | FormulaEngine в shared/ | P0 | Новый | calcHeroStats, calcDamage, calcTTK, calcAttackWinChance, calcBlockWinChance, calcRetreatChance, calcBypassChance, calcPolymorphChance, calcEloChange, generateHitAnimation |
| S2-05 | BattleSystem в shared/ | P0 | Новый | Вход: {mode, hero, enemy, command, consumable}. Выход: {result, win_chance, hits, durability_target, mass_reward}. 6 команд. Правило износа |
| S2-06 | PreBattleScene | P0 | Новый | Панель врага, слот расходника с пояса, 6 кнопок команд (заблокированные — серые), цветовая индикация шанса |
| S2-07 | BattleScene (автобой) | P0 | Новый | Анимация 2–3 сек: сближение → удары с числами ±30% → финал. Цвета: белый/жёлтый/красный |
| S2-08 | Обновить HubScene | P1 | Рефакторинг | Новая модель данных, отображение belt (2 слота), масса = HP |
| S2-09 | DurabilityPips (UI) | P1 | Новый | Пипсы ●●○ вместо ProgressBar в EquipmentCard |
| S2-10 | Обновить EquipmentCard | P1 | Рефакторинг | Использовать DurabilityPips, показывать +strength/+armor/+luck |
| S2-11 | MobConfig, ConsumableConfig | P1 | Новый | 7 мобов, 12 расходников из MVP Proposal |
| S2-12 | EventBus: новые события | P2 | Обновление | battle:start, battle:result, pve:node:enter, pvp:battle:result |
| S2-13 | Тесты FormulaEngine | P0 | Тесты | TTK-формула, блок-выравниватель, граничные значения |

#### Детализация ключевых изменений

**S2-01: Новые типы в shared/src/types/**

Старый `IHeroState`:
```
{ mass, rating, hp, maxHp, baseAttack, baseDefense }
```

Новый `IHeroState`:
```
{ mass, rating, massCap }
```

Новый `IHeroStats` (вычисляемый через FormulaEngine):
```
{ hp, strength, armor, luck }
```

Старый `IEquipmentItem`:
```
{ id, name, slot, tier, modifier, maxDurability, currentDurability, basePrice }
```

Новый `IEquipmentItem`:
```
{ id, name, slot, tier, strengthBonus, armorBonus, luckBonus, hpBonus,
  maxDurability, currentDurability, basePrice, commandId }
```

Где commandId привязывает предмет к команде: weapon → cmd_attack, shield → cmd_block, accessory → cmd_fortune / cmd_retreat / cmd_polymorph.

Новые типы:
```
IConsumable { id, name, type (combat/hiking/scout), tier, effect, value }
IBeltSlot = IConsumable | null
IBackpackSlot = IEquipmentItem | IConsumable | null
IRelic { id, name, effect, rarity }
IMob { id, name, mass, hp, strength, armor, massReward, type (combat/elite/boss) }
```

**S2-02: Новый balance.json**

Ключевые изменения значений:

| Параметр | Было | Стало |
|----------|------|-------|
| startMass | 420 | 50 |
| startRating | 1150 | 1000 |
| startHp | 100 | убрано (HP = mass) |
| baseAttack | 10 | убрано (strength = mass/3 + bonus) |
| baseDefense | 5 | убрано (armor = shield bonus) |
| startGold | 1500 | 100 |
| equipment.starterItems | 3 предмета с modifier и durability 100 | 3 предмета с конкретными бонусами и durability 3 |
| — | — | + mobs (7 штук), consumables (12), relics (6), events (3) |

**S2-04: FormulaEngine — переносится в shared/src/formulas/**

Чистые функции без side-effects. Тестируются юнит-тестами. Все формулы из 03_battle.md GDD v1.1.

| Функция | Из GDD |
|---------|--------|
| calcHeroStats(mass, equipment, relics) → {hp, strength, armor, luck} | 03_battle: параметры героя |
| calcDamage(strength, armor) → number | max(1, strength − armor) |
| calcTTK(hp, damagePerHit) → number | hp / damagePerHit |
| calcBaseWinChance(ttkPlayer, ttkEnemy) → number | TTK-метод |
| calcAttackWinChance(hero, enemy) → number | base + luck × 0.01 |
| calcBlockWinChance(hero, enemy) → number | Блок-выравниватель |
| calcFortuneWinChance(hero, enemy) → number | base + luck × 0.02 |
| calcRetreatChance(luck) → number | 0.70 + luck × 0.02 |
| calcBypassChance(luck) → number | 0.60 + luck × 0.02 |
| calcPolymorphChance(base, luck) → number | base + luck × 0.02 |
| calcEloChange(playerRating, enemyRating, result) → number | K=32 |
| generateHitAnimation(winner, heroDmg, enemyDmg) → Hit[] | 2–3 удара × 0.7–1.3 |

#### Диаграмма зависимостей Sprint 2

```
S2-01 (types) ──┬──▶ S2-02 (balance.json)
                ├──▶ S2-03 (GameState)
                ├──▶ S2-04 (FormulaEngine) ──▶ S2-13 (тесты)
                └──▶ S2-11 (MobConfig, ConsumableConfig)

S2-04 + S2-05 (BattleSystem) ──▶ S2-06 (PreBattle) ──▶ S2-07 (Battle)

S2-03 ──▶ S2-08 (HubScene update)
S2-09 (DurabilityPips) ──▶ S2-10 (EquipmentCard update) ──▶ S2-08
```

**Результат:** Экран предбоя (Слизень, масса 35) → выбор расходника + команда → автобой 2–3 сек → результат. HubScene обновлён под новую модель.

---

### Sprint 3: PvE-поход (случайная генерация)

**Цель:** Полный поход от святилища до босса. Случайная генерация маршрута.

**Время:** 1–2 сессии.

| ID | Задача | Приоритет | Тип | Критерий готовности |
|----|--------|-----------|-----|---------------------|
| S3-01 | PveConfig | P0 | Новый | Параметры генерации: total_nodes 8–10, fork_count 3–4, веса типов, ограничения |
| S3-02 | RelicConfig | P0 | Новый | 6 реликвий из MVP Proposal (включая relic_thick_skin) |
| S3-03 | EventConfig | P1 | Новый | 3 события с вариантами |
| S3-04 | Random (с seed) | P0 | Новый | Детерминированный генератор для воспроизводимости |
| S3-05 | PveSystem (генерация) | P0 | Новый | Алгоритм: якоря (sanctuary, ancient_chest, boss) + случайное заполнение + валидация ограничений |
| S3-06 | RelicSystem | P0 | Новый | Пул, выбор 1 из 3, применение эффектов к calcHeroStats |
| S3-07 | LootSystem | P0 | Новый | Таблицы лута по типу узла, drop-rate |
| S3-08 | SanctuaryScene | P0 | Новый | Выбор реликвии, 3 карточки |
| S3-09 | PveMapScene (замена заглушки) | P0 | Замена | Карта похода: текущий узел, развилки, «???», кнопка выхода |
| S3-10 | LootScene | P0 | Новый | Предмет → рюкзак или пропустить |
| S3-11 | ShopScene | P1 | Новый | 3–4 товара + ремонт (дороже) |
| S3-12 | CampScene | P1 | Новый | +30–50% HP, или +масса / −HP |
| S3-13 | EventScene | P1 | Новый | 2–3 варианта, эффекты |
| S3-14 | PveResultScene | P0 | Новый | Итог похода: масса, Gold, рюкзак → инвентарь |

**Результат:** Полный PvE-поход со случайной генерацией. Каждый поход уникален.

---

### Sprint 4: Хаб, инвентарь, ремонт

**Цель:** Полноценный хаб. Экипировка, пояс, ремонт.

| ID | Задача | Приоритет | Тип |
|----|--------|-----------|-----|
| S4-01 | InventorySystem | P0 | Новый | 3 слота, надевание/снятие, проверка durability |
| S4-02 | BeltSystem | P0 | Новый | 2 слота, лимиты использования |
| S4-03 | BackpackSystem | P0 | Новый | 4 слота, правило выноса |
| S4-04 | RepairSystem | P0 | Новый | cost = (max − current) × cost_per_point × tier |
| S4-05 | EconomyConfig | P1 | Новый | Цены ремонта, награды |
| S4-06 | InventoryScene (замена заглушки) | P0 | Замена | Экипировка + запас + пояс |
| S4-07 | HubScene (финальная версия) | P0 | Рефакторинг | Ремонт, пояс, полные данные |

**Результат:** Игрок экипируется, идёт в PvE, возвращается с лутом, экипирует, чинит.

---

### Sprint 5: PvP-арена

**Цель:** Арена с ботами, рейтинг, потеря массы, сундук.

| ID | Задача | Приоритет | Тип |
|----|--------|-----------|-----|
| S5-01 | BotFactory | P0 | Новый | 5 ботов, HP=mass, strength=mass/3, распределение 60/25/15 |
| S5-02 | PvpConfig | P0 | Новый | K=32, bot_mass_range, chest_size=10 |
| S5-03 | PvpSystem | P0 | Новый | Сессия: бот → бой → рейтинг → масса → сундук |
| S5-04 | PvpLobbyScene (замена заглушки) | P0 | Замена | 5 ботов, цветовая индикация |
| S5-05 | PvpResultScene | P0 | Новый | Рейтинг, масса −10%, прочность −1, сундук |
| S5-06 | ChestOpenScene | P1 | Новый | Анимация, награды |

**Результат:** Полный цикл PvE → Хаб → PvP → Хаб замкнут.

---

### Sprint 6: Полировка + dev-панель + сохранение

**Цель:** Демо готово к плейтесту.

| ID | Задача | Приоритет | Тип |
|----|--------|-----------|-----|
| S6-01 | SaveManager | P0 | Новый | LocalStorage |
| S6-02 | MainMenuScene | P0 | Новый | «Новая игра» / «Продолжить» |
| S6-03 | DevPanelScene (замена заглушки) | P1 | Замена | Gold ±, масса ±, рейтинг ±, предметы, seed |
| S6-04 | Подсказки FTUE | P2 | Новый | 5–7 подсказок по сценарию |
| S6-05 | Обновить .memory_bank/ и docs/gdd/ | P1 | Обновление | Привести в соответствие с GDD v1.1 |

**Результат:** 10-минутный сценарий плейтеста проходится. Сохранение. Dev-панель.

---

## Сравнение с предыдущей декомпозицией (v1.1)

| Аспект | v1.1 (без кода) | v1.2 (по реальному коду) |
|--------|-----------------|--------------------------|
| Спринтов | 5 (с нуля) | 5 новых (Sprint 2–6), Sprint 1 выполнен |
| Sprint 1 | Init + ThemeConfig + GameState + FormulaEngine + BattleSystem | **Выполнен:** SceneManager + HubScene + UI компоненты |
| Sprint 2 | PvE-поход | **Новая модель + боевая система v4** (рефакторинг + новое) |
| Сборщик | Vite (предполагался) | **Webpack** (реальный) |
| Структура | Плоская src/ | **Монорепо: client/ + shared/** |
| FormulaEngine | client/src/core/ | **shared/src/formulas/** (чистые функции, тестируемые) |
| BattleSystem | client/src/systems/ | **shared/src/systems/** (чистые функции) |
| Конфиги | src/config/*.ts | **config/balance.json** + client/src/config/ThemeConfig.ts |
| Тесты | Не было | **Jest + ts-jest** (настроен, shared/ и client/) |
| CI | Не было | **GitHub Actions** (build + test) |
| Агентный пайплайн | Не было | **Beads + .agents/ + .claude/** (PM, Developer, Reviewer, Tester) |

---

## Структура файлов (дельта к текущему коду)

```
shared/src/
├── index.ts                          ← ОБНОВИТЬ (реэкспорт новых типов)
├── types/
│   ├── Equipment.ts                  ← ПЕРЕПИСАТЬ (новые бонусы, commandId)
│   ├── GameState.ts                  ← ПЕРЕПИСАТЬ (убрать hp/baseAttack/baseDefense)
│   ├── BalanceConfig.ts              ← ПЕРЕПИСАТЬ (новая схема)
│   ├── Consumable.ts                 ← НОВЫЙ
│   ├── Relic.ts                      ← НОВЫЙ
│   ├── Mob.ts                        ← НОВЫЙ
│   ├── Battle.ts                     ← НОВЫЙ (BattleContext, BattleResult, CommandId)
│   └── PveNode.ts                    ← НОВЫЙ (типы узлов, маршрут)
├── formulas/
│   ├── FormulaEngine.ts              ← НОВЫЙ
│   └── FormulaEngine.test.ts         ← НОВЫЙ
└── systems/
    └── BattleSystem.ts               ← НОВЫЙ
    └── BattleSystem.test.ts          ← НОВЫЙ

client/src/
├── core/
│   ├── GameState.ts                  ← ПЕРЕПИСАТЬ
│   └── EventBus.ts                   ← ОБНОВИТЬ (новые события)
├── scenes/
│   ├── PreBattleScene.ts             ← НОВЫЙ
│   ├── BattleScene.ts                ← НОВЫЙ
│   ├── SanctuaryScene.ts             ← НОВЫЙ
│   ├── PveMapScene.ts                ← ЗАМЕНИТЬ заглушку
│   ├── LootScene.ts                  ← НОВЫЙ
│   ├── ShopScene.ts                  ← НОВЫЙ
│   ├── CampScene.ts                  ← НОВЫЙ
│   ├── EventScene.ts                 ← НОВЫЙ
│   ├── PveResultScene.ts             ← НОВЫЙ
│   ├── PvpLobbyScene.ts              ← ЗАМЕНИТЬ заглушку
│   ├── PvpResultScene.ts             ← НОВЫЙ
│   ├── ChestOpenScene.ts             ← НОВЫЙ
│   ├── MainMenuScene.ts              ← НОВЫЙ
│   ├── InventoryScene.ts             ← ЗАМЕНИТЬ заглушку
│   ├── DevPanelScene.ts              ← ЗАМЕНИТЬ заглушку
│   └── HubScene.ts                   ← ОБНОВИТЬ
├── systems/
│   ├── PveSystem.ts                  ← НОВЫЙ (генерация маршрута)
│   ├── PvpSystem.ts                  ← НОВЫЙ
│   ├── InventorySystem.ts            ← НОВЫЙ
│   ├── BeltSystem.ts                 ← НОВЫЙ
│   ├── BackpackSystem.ts             ← НОВЫЙ
│   ├── RelicSystem.ts                ← НОВЫЙ
│   ├── LootSystem.ts                 ← НОВЫЙ
│   ├── RepairSystem.ts               ← НОВЫЙ
│   └── BotFactory.ts                 ← НОВЫЙ
├── ui/
│   ├── DurabilityPips.ts             ← НОВЫЙ
│   └── EquipmentCard.ts              ← ОБНОВИТЬ
└── utils/
    └── Random.ts                     ← НОВЫЙ (с seed)

config/
└── balance.json                      ← ПЕРЕПИСАТЬ
```

**Итого:** 6 файлов переписать, ~25 новых файлов, ~3 обновить.

---

## Промпт для Claude Code (Sprint 2)

> Ты Developer. Прочитай .agents/AGENT_ROLES.md секция "2. Developer".
>
> Задача: Sprint 2 — Новая модель данных + боевая система v4.
>
> Контекст: Sprint 1 (SceneManager + HubScene) выполнен. PR #2. Текущая модель данных устарела — переходим на GDD v1.1.
>
> **Фаза 1: Рефакторинг типов (shared/)**
> 1. Переписать shared/src/types/Equipment.ts: убрать generic modifier, добавить strengthBonus, armorBonus, luckBonus, hpBonus, commandId. Durability: 3 (не 100).
> 2. Переписать shared/src/types/GameState.ts: IHeroState = { mass, rating, massCap }. Убрать hp, maxHp, baseAttack, baseDefense. Добавить IBeltState (2 слота), IBackpackState (4 слота), IRelicState.
> 3. Переписать shared/src/types/BalanceConfig.ts под новую схему: startMass 50, massCap 125, 9 предметов с конкретными бонусами.
> 4. Создать новые типы: Consumable.ts, Relic.ts, Mob.ts, Battle.ts (CommandId, BattleContext, BattleResult), PveNode.ts.
> 5. Обновить shared/src/index.ts — реэкспорт.
>
> **Фаза 2: FormulaEngine + BattleSystem (shared/)**
> 6. Создать shared/src/formulas/FormulaEngine.ts: calcHeroStats (HP=масса, сила=масса/3+бонус оружия, броня=бонус щита, удача=бонус аксессуара), calcDamage (max(1, сила−броня)), calcTTK, calcAttackWinChance (TTK-метод + luck×0.01), calcBlockWinChance (выравниватель: block_power = 0.3 + shield_armor × 0.05, modifier = (0.5 − attack_chance) × block_power), calcRetreatChance (0.70+luck×0.02), calcBypassChance (0.60+luck×0.02), calcPolymorphChance, calcEloChange (K=32), generateHitAnimation (2–3 удара ×0.7–1.3).
> 7. Написать тесты shared/src/formulas/FormulaEngine.test.ts: TTK-формула, блок-выравниватель при разных соотношениях сил, граничные значения (clamp 0.05–0.95).
> 8. Создать shared/src/systems/BattleSystem.ts: вход {mode, hero, enemy, command, consumable} → выход {result, winChance, hits, durabilityTarget, massReward}. 6 команд. Износ: ломается предмет чьё действие выбрано.
>
> **Фаза 3: Обновление client/**
> 9. Переписать config/balance.json: startMass 50, startGold 100, rating 1000, 9 предметов tier 1, 12 расходников, 7 мобов, 6 реликвий.
> 10. Переписать client/src/core/GameState.ts под новые типы: mass, equipment, belt, backpack, stash, relics.
> 11. Создать client/src/ui/DurabilityPips.ts: пипсы ●●○ для прочности 3.
> 12. Обновить client/src/ui/EquipmentCard.ts: DurabilityPips вместо ProgressBar, показывать +strength/+armor/+luck.
> 13. Создать client/src/scenes/PreBattleScene.ts: панель врага (масса, сила, броня), слот расходника, 6 кнопок команд в 2 ряда (заблокированные — серые + замок при durability=0 аксессуара), цветовая индикация шанса (зелёный ≥60%, жёлтый 40–59%, красный <40%).
> 14. Создать client/src/scenes/BattleScene.ts: автобой 2–3 сек — сближение (0.3с), обмен 2–3 ударами с числами (1.5–2с), финал (0.5с). Числа: белый=обычный, жёлтый=сильный (×1.15+), красный+«МОЩНЫЙ УДАР!»=критический (×1.25+).
> 15. Обновить HubScene: новая модель данных, отображение belt.
>
> Визуальный стиль: без изменений (ThemeConfig.ts). Бандлер: Webpack (не Vite).
