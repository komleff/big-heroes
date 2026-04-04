# Big Heroes Demo — Архитектура v2

> Источник: GDD v1.1 (03_battle v4, 06_inventory, 13_boosters_relics, 14_xp_levels)  
> Заменяет: docs/architecture/architecture.md (v1, основан на GDD v1.0)  
> Статус: Черновик для согласования

---

## 1. Что изменилось относительно v1

| Область | v1 (текущий код) | v2 (GDD v1.1) | Влияние |
|---------|-----------------|---------------|---------|
| Бой | Пошаговый: кнопка «Атаковать», цикл ходов | Автобой: расходник → команда (1 из 6) → анимация 2–3 сек → исход | Полная переработка BattleSystem, FormulaEngine, BattleScene |
| HP | Отдельный параметр, хранится в GameState | HP = масса. Восстанавливается перед каждым боем | Убрать hp/maxHp из IHeroState |
| Сила | base_attack × (1 + mass × 0.01) × weapon_modifier | масса / 3 + бонус_оружия + бонус_уровня / 3 | Переписать формулы |
| Броня | base_defense × (1 + armor_modifier) | Плоская: +N от щита + расходник | Упростить |
| Прочность | 80–120, −N за PvP-бой ко всем | 3–9 (по tier), −1 за использование конкретной команды | Полная переработка |
| Предметы | 3 шт tier 1, единый modifier | 9 шт tier 1 (MVP), 44 всего. +Сила/+Броня/+Удача + команда | Новый каталог |
| Расходники | Нет | 30+ расходников: походные, боевые, разведывательные | Новая система |
| Пояс | Нет | 2–4 слота расходников | Новая система |
| Реликвии | Нет | Пассивные бонусы на поход, до 3 штук | Новая система |
| Бустеры | Простые boost_hp/boost_loot | Мета-бустеры (бои + минуты), камбек-бонусы | Переработка |
| XP | Нет | Уровень героя (→ бонус массы) + путь аккаунта | Новая система |
| Pity | Нет | Каждый 5-й предмет — tier+1 | Новая система |
| Масса | Без потолка | Потолки: 125/250/500/1000/2000 | Ограничение |
| PvP потери | mass × 0.03–0.07 | −10% при поражении, 0 при победе | Упростить |
| Предбой | Нет | Выбор расходника + команда + шансы | Новая сцена |
| Святилище | Нет | Первый узел похода, выбор 1 из 3 реликвий | Новый тип узла |

---

## 2. Ограничения демо

| Аспект | Демо |
|--------|------|
| Герои | 1 |
| PvE-главы | 1 глава, 8–10 узлов |
| PvP | 1 лига, боты |
| Снаряжение | Tier 1, 9 предметов (3+3+3) |
| Расходники | Tier 1–2, базовый набор |
| Реликвии | 10–12 штук |
| Бустеры | 2–3 типа |
| Экономика | Gold. Gems — заглушка |
| XP | Героя до 10, аккаунта до 15 |
| Рюкзак | 4 слота |
| Пояс | 2 слота |

---

## 3. Структура проекта

```
shared/src/
├── types/
│   ├── Hero.ts              — IHeroState, IHeroDerivedStats
│   ├── Equipment.ts         — IEquipmentItem, EquipmentSlotId
│   ├── Consumable.ts        — IConsumable, ConsumableType
│   ├── Relic.ts             — IRelic, RelicRarity
│   ├── Booster.ts           — IBooster, BoosterCategory, IComebackBonus
│   ├── Belt.ts              — IBeltState
│   ├── Backpack.ts          — IBackpackState
│   ├── Battle.ts            — CommandId, IBattleContext, IBattleResult
│   ├── Pve.ts               — INodeType, IPveRunState
│   ├── Pvp.ts               — IBotData, IPvpSessionState
│   ├── Economy.ts           — IResources
│   ├── Xp.ts                — IXpHeroState, IXpAccountState
│   ├── Pity.ts              — IPityState
│   └── BalanceConfig.ts     — IBalanceConfig
├── formulas/
│   ├── DerivedStats.ts      — HP, Сила, Броня, Удача
│   ├── BattleTTK.ts         — TTK, base_win_chance, block_win_chance
│   ├── CommandChances.ts    — Шансы 6 команд
│   ├── Rating.ts            — Elo
│   ├── Repair.ts            — repair_cost
│   ├── MassCap.ts           — Потолки массы
│   └── Xp.ts                — XP-кривая, level_mass_bonus
├── systems/
│   ├── CommandResolver.ts   — Доступность команд + исход
│   ├── WearSystem.ts        — Команда → предмет → −1 прочность
│   ├── PitySystem.ts        — Каждый N-й → tier+1
│   └── LootResolver.ts      — Генерация лута
└── index.ts

client/src/
├── main.ts
├── config/ThemeConfig.ts
├── core/
│   ├── GameState.ts         — Масса, XP, снаряжение, пояс, бустеры, рюкзак, реликвии
│   ├── EventBus.ts
│   ├── SceneManager.ts
│   └── SaveManager.ts
├── systems/
│   ├── BattleSystem.ts      — Контекст → формулы → бросок → анимация → результат
│   ├── PveSystem.ts         — Генерация маршрута, узлы
│   ├── PvpSystem.ts         — Сессия, рейтинг, сундук
│   ├── BotFactory.ts        — Боты 60/25/15
│   ├── InventorySystem.ts   — Надеть / снять / продать / починить
│   ├── BeltSystem.ts        — Пояс
│   ├── RelicSystem.ts       — Реликвии похода (до 3)
│   ├── BoosterSystem.ts     — Бустеры + камбек
│   ├── XpSystem.ts          — XP героя и аккаунта
│   └── LootSystem.ts        — Добыча + pity
├── scenes/
│   ├── BaseScene.ts
│   ├── HubScene.ts
│   ├── PreBattleScene.ts    — Расходник + команда + шансы → «В бой!»
│   ├── BattleScene.ts       — Автобой 2–3 сек
│   ├── SanctuaryScene.ts    — Выбор 1 из 3 реликвий
│   ├── PveMapScene.ts       — Карта, развилки, «???»
│   ├── LootScene.ts
│   ├── ShopScene.ts
│   ├── CampScene.ts
│   ├── PvpLobbyScene.ts
│   ├── PvpResultScene.ts
│   ├── InventoryScene.ts
│   ├── AccountPathScene.ts  — Путь аккаунта
│   ├── DevPanelScene.ts
│   └── MainMenuScene.ts
├── ui/
│   ├── Button.ts
│   ├── ProgressBar.ts
│   ├── ResourceBar.ts
│   ├── EquipmentCard.ts     — +Сила/+Броня/+Удача, пипсы
│   ├── ConsumableSlot.ts
│   ├── RelicIcon.ts
│   ├── CommandButton.ts     — Иконка, шанс, пипсы, предмет
│   ├── HeroPortrait.ts
│   ├── BotCard.ts
│   ├── BottomNav.ts
│   └── DamageNumber.ts      — Белое / жёлтое / красное
└── utils/
    ├── Random.ts
    └── Tween.ts
```

---

## 4. Компоненты и ответственности

| Компонент | Слой | Ответственность |
|-----------|------|----------------|
| GameState | client/core | Единый источник правды |
| EventBus | client/core | Связь между системами |
| SceneManager | client/core | Жизненный цикл сцен, переходы, viewport |
| SaveManager | client/core | Сериализация в LocalStorage |
| DerivedStats | shared/formulas | HP, Сила, Броня, Удача из массы + снаряжения + бустеров + реликвий |
| BattleTTK | shared/formulas | TTK, base_win_chance, final_win_chance |
| CommandChances | shared/formulas | Шансы 6 команд |
| CommandResolver | shared/systems | Доступность команд, расчёт исхода |
| WearSystem | shared/systems | Команда → предмет → −1 прочность |
| BattleSystem | client/systems | Оркестрация боя |
| PveSystem | client/systems | Маршрут, узлы, правила выхода |
| PvpSystem | client/systems | Сессия, рейтинг, сундук |
| BotFactory | client/systems | Генерация ботов |
| BeltSystem | client/systems | Пояс |
| RelicSystem | client/systems | Реликвии похода |
| BoosterSystem | client/systems | Бустеры + камбек |
| XpSystem | client/systems | XP, level up, разблокировки |
| PitySystem | shared/systems | Каждый N-й → tier+1 |
| LootSystem | client/systems | Добыча + pity |

---

## 5. Поток данных

```
Конфиги (JSON)
     │
     ├── balance.json
     ├── equipment_catalog.json
     ├── consumables.json
     ├── relics.json
     ├── boosters.json
     ├── mobs.json
     ├── xp_table.json
     ├── account_path.json
     └── pve_chapters.json
            │
            ▼
     ┌──────────────┐
     │   GameState   │ ← SaveManager ↔ LocalStorage
     └──────┬───────┘
            │
         EventBus
         ↓      ↓
   Systems     Scenes (PixiJS)
   ↓                ↓
shared/formulas  UI-компоненты
```

### Поток боя

```
PveMapScene / PvpLobbyScene
     │ выбор узла / бота
     ▼
PreBattleScene
     │ 1. Враг: масса, снаряжение
     │ 2. Пояс: расходники
     │ 3. Команды: 6 кнопок + шансы + пипсы
     │ 4. Выбор расходника (0–1) + команды (1)
     │ 5. «В бой!»
     ▼
BattleSystem.resolve(context)
     │ 1. DerivedStats (герой + враг)
     │ 2. CommandChances
     │ 3. random() < final_chance
     │ 4. WearSystem: −1 прочность
     │ 5. Последствия (PvE / PvP)
     ▼
BattleScene
     │ Анимация 2–3 сек, числа ±30%
     ▼
Результат → LootScene / PvpResultScene
```

---

## 6. Формулы (03_battle.md v4)

### Производные

```
HP = масса
Сила = масса / 3 + оружие_сила + level_mass_bonus / 3
Броня = щит_броня + расходник_броня + реликвия_броня
Удача = аксессуар_удача + расходник_удача + реликвия_удача
```

### TTK

```
Урон = max(1, Сила_атакующего − Броня_защитника)
TTK_игрока = HP_врага / max(1, Сила_игрока − Броня_врага)
TTK_врага  = HP_игрока / max(1, Сила_врага − Броня_игрока)
base_win_chance = TTK_врага / (TTK_игрока + TTK_врага)
luck_bonus = Удача × 0.01
final_win_chance = clamp(base_win_chance + luck_bonus, 0.05, 0.95)
```

### Блок

```
block_power = 0.3 + броня_щита × 0.05
block_modifier = (0.5 − attack_win_chance) × block_power
block_win_chance = clamp(attack_win_chance + block_modifier, 0.05, 0.95) + luck_bonus
```

Ничья (PvE): 15%.

### Умения

```
Фортуна: base_win_chance + Удача × 0.02
Отступление: 70% + Удача × 0.02
Обход: 60% + Удача × 0.02
Полиморф: base (25–60%) + Удача × 0.02
```

### Рейтинг

```
expected = 1 / (1 + 10^((enemy_rating − player_rating) / 400))
rating_change = round(32 × (result − expected))
```

---

## 7. Конфигурация

| Файл | Содержимое |
|------|-----------|
| `config/balance.json` | Стартовая масса, рейтинг, билеты, потолки массы, Elo K, chest_max_progress |
| `config/equipment_catalog.json` | Предметы: id, name, slot, tier, +Сила/+Броня/+Удача/+HP, commandId, maxDurability, basePrice |
| `config/consumables.json` | Расходники: id, name, type, tier, effect |
| `config/relics.json` | Реликвии: id, name, rarity, effect, value |
| `config/boosters.json` | Бустеры + камбек-бонусы |
| `config/mobs.json` | Мобы по главам: масса, бонусы, тип |
| `config/xp_table.json` | Уровень → xp, mass_bonus, вехи |
| `config/account_path.json` | Уровень → разблокировка + награда |
| `config/pve_chapters.json` | Главы: узлы, развилки, mass_cap, mob_pool |

---

## 8. Типы: миграция shared/

### IHeroState

Убрать: `hp`, `maxHp`, `baseAttack`, `baseDefense`.  
Добавить: `level`, `xp`, `levelMassBonus`.  
Оставить: `mass`, `rating`.

### IEquipmentItem

Убрать: `modifier`.  
Добавить: `strengthBonus`, `armorBonus`, `luckBonus`, `hpBonus`, `commandId`.  
Изменить: `maxDurability` → 3/5/7/9 по tier.

### Новые типы

| Тип | Назначение |
|-----|-----------|
| CommandId | cmd_attack, cmd_block, cmd_fortune, cmd_retreat, cmd_bypass, cmd_polymorph |
| IBattleContext | Герой + враг + режим + команда + расходник |
| IBattleResult | Исход + анимация + последствия |
| IConsumable | Расходник: id, type (hiking/combat/recon), tier, effect |
| IRelic | Реликвия: id, rarity, effect, value |
| IBeltState | Пояс: slots, maxSlots |
| IBackpackState | Рюкзак: items, maxSlots, protectedSlots, tempSlots |
| IBoosterState | Бустер: id, remainingFights, expiresAt |
| IPityState | Счётчик: count, threshold |
| IXpHeroState | Уровень + XP + бонус массы + вехи |
| IXpAccountState | Уровень аккаунта + XP + разблокировки |

---

## 9. Flowchart навигации (v1.1)

```
MainMenu
    │
    ▼
HubScene ◄──────────────────────────────────────┐
    │                                            │
    ├──▶ Подготовка PvE ──▶ SanctuaryScene       │
    │                          │                 │
    │                       PveMapScene ◄────┐   │
    │                          │             │   │
    │                   combat/elite         │   │
    │                          │             │   │
    │                    PreBattleScene      │   │
    │                          │             │   │
    │                     BattleScene        │   │
    │                          │             │   │
    │                   LootScene ───────────┘   │
    │                          │                 │
    │                    boss победа ─────────────┘
    │
    ├──▶ Подготовка PvP ──▶ PvpLobbyScene ◄──┐
    │                          │              │
    │                    PreBattleScene       │
    │                          │              │
    │                     BattleScene         │
    │                          │              │
    │                    PvpResultScene ──────┘
    │                          │
    │                    завершить ────────────┘
    │
    ├──▶ InventoryScene
    ├──▶ AccountPathScene
    └──▶ DevPanelScene (модалка)
```

---

## 10. PreBattleScene — ключевой экран v1.1

| Зона | Содержимое |
|------|-----------|
| Верх | Герой vs Враг (масса, снаряжение, сравнение) |
| Середина | Пояс: расходники (0–1 на бой) |
| Низ | 6 команд: иконка, название, шанс (%), пипсы прочности, имя предмета |
| Подсказка | «Враг легче → Атака. Тяжелее → Блок. Не уверен → Отступление» |
| CTA | «В бой!» (активна при выборе команды) |

Шансы пересчитываются при выборе расходника. Пипсы: ●●○ (2 из 3).  
Визуальный референс: prebattle_scene_v9.html.

---

## 11. Роадмап спринтов

### Sprint 2: FormulaEngine + BattleSystem v4

**Цель:** Работающий бой. PreBattle → автобой → результат.

| Задача | P |
|--------|---|
| shared/formulas/DerivedStats | P0 |
| shared/formulas/BattleTTK | P0 |
| shared/formulas/CommandChances | P0 |
| shared/systems/CommandResolver | P0 |
| shared/systems/WearSystem | P0 |
| client/systems/BattleSystem | P0 |
| client/scenes/PreBattleScene | P0 |
| client/scenes/BattleScene (автобой) | P0 |
| client/ui/CommandButton | P0 |
| config/equipment_catalog.json (9 шт tier 1) | P1 |
| config/mobs.json (глава 1) | P1 |
| Миграция IHeroState, IEquipmentItem | P0 |
| Миграция balance.json | P0 |

```
Типы ──▶ DerivedStats ──▶ BattleTTK ──▶ CommandChances
                                              │
                              CommandResolver + WearSystem
                                              │
                                         BattleSystem
                                              │
                               PreBattleScene + BattleScene
```

### Sprint 3: PvE + святилище + реликвии

| Задача | P |
|--------|---|
| PveSystem — маршрут с развилками | P0 |
| PveMapScene — карта, узлы, «???» | P0 |
| SanctuaryScene — выбор реликвии | P0 |
| RelicSystem | P0 |
| LootSystem + LootScene | P0 |
| BeltSystem + ConsumableSlot | P0 |
| ShopScene, CampScene | P1 |
| config/relics.json, consumables.json | P1 |

### Sprint 4: PvP-арена

| Задача | P |
|--------|---|
| BotFactory | P0 |
| PvpSystem — рейтинг, масса −10% | P0 |
| PvpLobbyScene | P0 |
| PvpResultScene | P0 |
| Аренный сундук | P1 |

### Sprint 5: XP, бустеры, dev-панель

| Задача | P |
|--------|---|
| XpSystem | P0 |
| BoosterSystem + камбек | P1 |
| PitySystem | P1 |
| DevPanelScene (полная) | P1 |
| SaveManager | P0 |

---

## 12. Влияние на Sprint 1

### Сохраняется

SceneManager, EventBus, BaseScene, ThemeConfig, Button, ProgressBar, BottomNav, Tween, Webpack, tsconfig, jest.

### Миграция

| Файл | Изменение |
|------|----------|
| shared/types/GameState.ts | Убрать hp, maxHp, baseAttack, baseDefense. Добавить level, xp, levelMassBonus |
| shared/types/Equipment.ts | Убрать modifier. Добавить strengthBonus, armorBonus, luckBonus, hpBonus, commandId |
| shared/types/BalanceConfig.ts | Разделить на конфиги. starterItems → equipment_catalog |
| config/balance.json | Убрать startHp, baseAttack, baseDefense, starterItems. Добавить massCaps, eloK, starterEquipmentIds |
| client/core/GameState.ts | Убрать setHp(). Добавить belt, backpack, relics, boosters, xp |
| client/scenes/HubScene.ts | Обновить под новые типы |
| client/ui/EquipmentCard.ts | +Сила/+Броня/+Удача вместо modifier. Пипсы 3 вместо 100 |
| client/ui/HeroPortrait.ts | Добавить уровень |

---

## 13. Открытые вопросы

| Вопрос | Контекст | Срок |
|--------|----------|------|
| mass_per_level | «⏳ Балансировка» | До Sprint 5 |
| Цены рюкзака | «⏳ Балансировка» | До Sprint 3 |
| XP-кривая | «⏳ Балансировка» | До Sprint 5 |
| cost_per_point ремонта | «⏳ Балансировка» | До Sprint 3 |
| Оффлайн-защита (снапшоты) | Сложна для демо | Post-MVP |
| Полиморф в PvP | Лут без массы/рейтинга — зачем? | Уточнить |

---

## 14. Глоссарий (v1.1)

| Термин | Определение |
|--------|-------------|
| Команда | Одно из 6 действий: атака, блок, фортуна, отступление, обход, полиморф |
| TTK | Сколько ударов нужно для убийства. Определяет вероятность победы |
| Пояс | 2–4 слота расходников. Перед боем и на перекрёстке |
| Реликвия | Пассивный бонус на весь PvE-поход |
| Святилище | Первый узел похода. Выбор 1 из 3 реликвий |
| Камбек-бонус | Автоматический бустер при серии поражений или возвращении |
| Pity-система | Каждый N-й предмет — tier+1 |
| Путь аккаунта | XP → уровни → разблокировка фич |
| Потолок массы | Максимум массы по главе: 125/250/500/1000/2000 |
