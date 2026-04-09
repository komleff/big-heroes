# Big Heroes Demo — Архитектура v1.2

> Источник: GDD v1.2 (2026-04-05), включая аудит R1–R8
> Заменяет: architecture_v2.md (основана на GDD v1.1)
> Статус: Черновик для согласования

---

## 1. Что изменилось относительно кода Sprint 1

| Область | Sprint 1 (код) | GDD v1.2 | Влияние |
|---------|----------------|----------|---------|
| Бой | Пошаговый: кнопка «Атаковать», цикл ходов | Автобой: расходник → команда (1 из 6) → анимация 2–3 сек → исход | Полная переработка |
| HP | Отдельный параметр, хранится в GameState | HP = масса (кг). Восстанавливается перед каждым боем (PvE и PvP). Прочность — единственный ресурс истощения в походе | Убрать hp/maxHp |
| Сила | base_attack × (1 + mass × 0.01) × weapon_modifier | масса / 3 + бонус оружия + бонус уровня / 3 | Переписать формулы |
| Броня | base_defense × (1 + armor_modifier) | Плоская: +N от щита + расходник | Упростить |
| Прочность | 80–120, −N за PvP-бой ко всем | 3–9 (по tier), −1 за команду конкретного предмета (PvE и PvP) | Полная переработка |
| Предметы | 3 шт, единый modifier | 9 шт tier 1, +Сила/+Броня/+Удача + привязка к команде | Новый каталог |
| Расходники | Нет | 26 расходников: походные (без аптечек), боевые, разведывательные | Новая система |
| Пояс | Нет | 2–4 слота. Разблокируется с уровня аккаунта 2 | Новая система |
| Реликвии | Нет | 17 реликвий. Пассивные бонусы на поход, до 3 штук | Новая система |
| Бустеры | Простые boost_hp/boost_loot | Мета-бустеры (бои + минуты), камбек-бонусы | Переработка |
| XP | Нет | Уровень героя (→ бонус массы) + путь аккаунта (→ разблокировка фич) | Новая система |
| Pity | Нет | Каждый 5-й предмет — tier+1 | Новая система |
| Масса | Без потолка, единицы не определены | Потолки: 125/250/500/1000/2000 кг. Единицы: кг | Ограничение |
| PvP потери | mass × 0.03–0.07 | −10% при поражении, 0 при победе | Упростить |
| PvE потери массы | defeat_mass_retain_ratio | Поражение = масса на входе в проигранный бой. Добровольный выход = вся масса | R1 |
| Лагерь | Восстановление HP | Починка +1 прочность ИЛИ тренировка +3–5 кг + пересборка пояса | R2 |
| Полиморф PvP | Не определён | 0 рейтинга, 0 сундука, 0 массы. Аксессуар −1 | R5 |
| Гейты глав | Босс + лига | Тройной гейт: босс + лига + уровень аккаунта | R6 |
| Мобы | Формульные | Кастомные профили: слабый, быстрый, бронированный, стеклянная пушка, танк | R4 |

---

## 2. Ограничения демо

| Аспект | Демо |
|--------|------|
| Герои | 1 |
| PvE-главы | 1 глава, 12 узлов (граф с развилками, Slay the Spire модель) |
| PvP | 1 лига, боты |
| Снаряжение | Tier 1, 9 предметов (3+3+3) |
| Расходники | Tier 1–2, базовый набор (26 штук без аптечек) |
| Реликвии | 17 штук |
| Бустеры | 2–3 типа |
| Экономика | Gold. Gems — заглушка |
| XP | Героя до 10, аккаунта до 15 |
| Рюкзак | 4 слота |
| Пояс | 2 слота (с уровня аккаунта 2) |

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
│   ├── DerivedStats.ts      — HP (= масса), Сила, Броня, Удача
│   ├── BattleTTK.ts         — TTK, base_win_chance, block_win_chance
│   ├── CommandChances.ts    — Шансы 6 команд
│   ├── Rating.ts            — Elo
│   ├── Repair.ts            — repair_cost
│   ├── MassCap.ts           — Потолки массы по главам
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
│   ├── PveSystem.ts         — Генерация маршрута, узлы, правила выхода (R1)
│   ├── PvpSystem.ts         — Сессия, рейтинг, сундук, полиморф = 0/0/0 (R5)
│   ├── BotFactory.ts        — Боты 60/25/15
│   ├── InventorySystem.ts   — Надеть / снять / продать / починить
│   ├── BeltSystem.ts        — Пояс (разблокируется с ур. аккаунта 2)
│   ├── RelicSystem.ts       — Реликвии похода (до 3)
│   ├── BoosterSystem.ts     — Бустеры + камбек
│   ├── XpSystem.ts          — XP героя и аккаунта, тройной гейт глав (R6)
│   └── LootSystem.ts        — Добыча + pity
├── scenes/
│   ├── BaseScene.ts
│   ├── HubScene.ts
│   ├── PreBattleScene.ts    — Подготовка к бою: 3 команды (Атака/Аксессуар/Блок)
│   ├── BattleScene.ts       — Автобой 2–3 сек
│   ├── SanctuaryScene.ts    — Выбор 1 из N реликвий (title настраивается)
│   ├── PveMapScene.ts       — Развилка: 1-3 варианта (граф Slay the Spire)
│   ├── LootScene.ts
│   ├── ShopScene.ts         — Только покупка (ремонта НЕТ)
│   ├── CampScene.ts         — Починка ИЛИ тренировка + экран результата
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
| DerivedStats | shared/formulas | HP (= масса кг), Сила, Броня, Удача |
| BattleTTK | shared/formulas | TTK, base_win_chance, final_win_chance |
| CommandChances | shared/formulas | Шансы 6 команд |
| CommandResolver | shared/systems | Доступность команд, расчёт исхода |
| WearSystem | shared/systems | Команда → предмет → −1 прочность |
| BattleSystem | client/systems | Оркестрация боя |
| PveSystem | client/systems | Маршрут, узлы, правила выхода (R1), процедурная генерация |
| PvpSystem | client/systems | Сессия, рейтинг, сундук, полиморф PvP = 0/0/0 (R5) |
| BotFactory | client/systems | Генерация ботов с кастомными профилями (R4) |
| BeltSystem | client/systems | Пояс (разблокируется с ур. аккаунта 2, R7) |
| RelicSystem | client/systems | Реликвии похода (без целебных — R2) |
| BoosterSystem | client/systems | Бустеры + камбек |
| XpSystem | client/systems | XP, уровни, тройной гейт разблокировки глав (R6) |
| PitySystem | shared/systems | Каждый N-й → tier+1 |
| LootSystem | client/systems | Добыча + pity |

---

## 5. Поток данных

```
Конфиги (JSON)
     │
     ├── balance.json
     ├── equipment_catalog.json
     ├── consumables.json          — 26 штук (аптечки удалены, R2)
     ├── relics.json               — 17 штук (целебные заменены, R2)
     ├── boosters.json
     ├── mobs.json                 — кастомные профили (R4)
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
     │ 1. Враг: масса (кг), снаряжение
     │ 2. Пояс: расходники (без аптечек)
     │ 3. Команды: 6 кнопок + шансы + пипсы
     │ 4. Выбор расходника (0–1) + команды (1)
     │ 5. «В бой!»
     ▼
BattleSystem.resolve(context)
     │ 1. DerivedStats (герой + враг)
     │ 2. CommandChances
     │ 3. random() < final_chance
     │ 4. WearSystem: −1 прочность
     │ 5. Последствия:
     │    PvE — масса + лут при победе; масса на входе при поражении (R1)
     │    PvP — рейтинг + сундук; −10% массы при поражении; полиморф = 0/0/0 (R5)
     ▼
BattleScene
     │ Анимация 2–3 сек, числа ±30%
     ▼
Результат → LootScene / PvpResultScene
```

### Правила массы при выходе из PvE (R1)

| Условие | Масса |
|---------|-------|
| Победа над боссом | Вся набранная за поход сохраняется |
| Поражение в бою | Масса на момент входа в проигранный бой |
| Добровольный выход | Вся набранная сохраняется |

defeat_mass_retain_ratio упразднён.

---

## 6. Формулы (03_battle.md v4)

### Производные

```
HP = масса (кг)
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

### Блок (выравниватель)

```
block_power = 0.3 + броня_щита × 0.05
block_modifier = (0.5 − attack_win_chance) × block_power
block_win_chance = clamp(attack_win_chance + block_modifier, 0.05, 0.95) + luck_bonus
```

Ничья (только PvE): 15%.

### Умения

```
Фортуна: base_win_chance + Удача × 0.02
Отступление: 70% + Удача × 0.02
Обход: 60% + Удача × 0.02
Полиморф: base (25–60%) + Удача × 0.02
```

### Полиморф в PvP (R5)

| Параметр | Значение |
|----------|----------|
| Рейтинг | 0 (не меняется) |
| Сундук | 0 (не продвигается) |
| Масса | 0 (не меняется) |
| Прочность аксессуара | −1 |

### Рейтинг (Elo)

```
expected = 1 / (1 + 10^((enemy_rating − player_rating) / 400))
rating_change = round(32 × (result − expected))
```

---

## 7. Ключевые принципы v1.2

### Прочность — единственный ресурс истощения в походе (R2)

HP = масса, полностью восстанавливается перед каждым боем. Расходные аптечки удалены. Бой — чистое решение «команда + расходник vs враг». Прочность снаряжения (3–9 по tier) — единственный ограничитель длины похода и аренной сессии.

### Лагерь = ремонт/тренировка, не лечение (R2)

| Вариант | Эффект |
|---------|--------|
| Починить | +1 прочность к выбранному предмету (бесплатно) |
| Тренироваться | +3–5 кг массы |
| Пересобрать пояс | Переложить расходники между рюкзаком и поясом (доступно всегда) |

Одно действие за лагерь (починить или тренироваться). Пересборка — дополнительно.

### Тройной гейт разблокировки глав (R6)

Для открытия следующей главы нужно выполнить три условия одновременно:

1. Победить босса текущей главы.
2. Достичь нужной PvP-лиги.
3. Достичь нужного уровня аккаунта.

### Пояс разблокируется с уровня аккаунта 2 (R7)

На уровне 1 расходники хранятся только в рюкзаке, используются между боями. Боевые расходники перед боем недоступны до разблокировки пояса.

### Единицы: кг (R8)

Масса измеряется в килограммах. Стартовая: 50 кг. Потолок главы 1: 125 кг.

### Сломанное снаряжение удаляется из слота (R9)

При `currentDurability = 0` предмет **удаляется** из экипировки (`slot = null`).
Цель: разнообразие геймплея — игрок получает новый случайный предмет с другим умением через лут.
Модель «сломанный предмет остаётся в слоте» **отменена**. Решение оператора 2026-04-10.

### Авто-экипировка лута (R10)

Найденный equipment-предмет автоматически надевается, если:
- Слот пустой → экипировать сразу
- Новый предмет лучше (tier выше, или tier== и бонусы выше) → экипировать, **старый предмет в походный рюкзак**

Старый предмет помещается в `expedition.itemsFound` (походный рюкзак).
**При defeat рюкзак теряется** — это по GDD. Игрок рискует потерять старый предмет.
Телепорт на домашний склад (stash) **запрещён** — против игровой логики.
В будущем: UI выбора что сохранить, лимит рюкзака, компенсация золотом при боссе.
Решение оператора 2026-04-10.

### PvP Elo: только victory/defeat (R11)

- `victory` → +Elo (формула calcEloChange)
- `defeat` → −Elo + потеря 10% массы
- `retreat` → 0 Elo, 0 массы (бой не засчитан)
- `bypass` → 0 Elo, 0 массы (обход)
- `polymorph` → 0 Elo, 0 сундука, 0 массы (GDD R5)

Решение оператора 2026-04-10.

### Bypass в PvE: продвижение без лута (R12)

Успешный `bypass` продвигает экспедицию к следующему узлу, но **не генерирует лут**.
По GDD: «Обход — вперёд мимо врага. Ни лута, ни массы». Решение оператора 2026-04-10.

---

## 8. Конфигурация

| Файл | Содержимое | Изменения v1.2 |
|------|-----------|----------------|
| balance.json | Стартовая масса (50 кг), рейтинг, билеты, потолки массы, Elo K, chest_max_progress | Без изменений |
| equipment_catalog.json | 9 предметов tier 1: +Сила/+Броня/+Удача/+HP, commandId, maxDurability (3), basePrice | acc_vial_t1 → cmd_polymorph (R3) |
| consumables.json | 26 расходников: походные, боевые, разведывательные | Аптечки heal_t1–t4 удалены (R2) |
| relics.json | 17 реликвий: восстановление, фарм, боевые, карта, особые | relic_heal_after → relic_mass_on_win, relic_heal_camp → relic_camp_repair, relic_full_heal_boss → relic_boss_armor, добавлена relic_thick_skin (R2) |
| boosters.json | 7 бустеров + 3 камбек-бонуса | Без изменений |
| mobs.json | 7 мобов главы 1: кастомные профили (слабый, быстрый, бронированный, стеклянная пушка, танк) | Убраны формульные множители, введены профили (R4) |
| xp_table.json | Уровень → xp, mass_bonus, вехи | Без изменений |
| account_path.json | Уровень → разблокировка + награда. Пояс: ур. 2. Ремонт: ур. 3 | R7: пояс с ур. 2 |
| pve_chapters.json | Главы: узлы, развилки, mass_cap, mob_pool, тройной гейт | R6: + условие уровня аккаунта |

### Статистика контента (GDD v1.2)

| Категория | Количество |
|-----------|-----------|
| Снаряжение MVP (tier 1) | 9 |
| Расходники (без аптечек) | 26 |
| Реликвии | 17 |
| Бустеры | 7 |
| Камбек-бонусы | 3 |
| Мобы (глава 1) | 7 |
| События PvE | 6 |
| Имена ботов | 30 |

---

## 9. Типы: миграция shared/

### IHeroState

Убрать: `hp`, `maxHp`, `baseAttack`, `baseDefense`.
Добавить: `level`, `xp`, `levelMassBonus`.
Оставить: `mass` (кг), `rating`.

### IEquipmentItem

Убрать: `modifier`.
Добавить: `strengthBonus`, `armorBonus`, `luckBonus`, `hpBonus`, `commandId`.
Изменить: `maxDurability` → 3/5/7/9 по tier.

### Новые типы

| Тип | Назначение |
|-----|-----------|
| CommandId | cmd_attack, cmd_block, cmd_fortune, cmd_retreat, cmd_bypass, cmd_polymorph |
| IBattleContext | Герой + враг + режим + команда + расходник |
| IBattleResult | Исход + анимация + последствия. Полиморф PvP: outcome = polymorph, ratingChange = 0, chestProgress = 0, massChange = 0 |
| IConsumable | Расходник: id, type (hiking/combat/recon), tier, effect. Без аптечек |
| IRelic | Реликвия: id, rarity, effect, value. Целебные заменены на relic_mass_on_win, relic_camp_repair, relic_boss_armor, relic_thick_skin |
| IBeltState | Пояс: slots, maxSlots, unlocked (false до ур. аккаунта 2) |
| IBackpackState | Рюкзак: items, maxSlots, protectedSlots, tempSlots |
| IBoosterState | Бустер: id, remainingFights, expiresAt |
| IPityState | Счётчик: count, threshold (5; с бустером — 3) |
| IXpHeroState | Уровень + XP + бонус массы + вехи |
| IXpAccountState | Уровень аккаунта + XP + разблокировки |
| IMobProfile | Масса (кг), сила, броня — кастомные значения, не формульные |

---

## 10. Flowchart навигации (v1.2)

```
MainMenu
    │
    ▼
HubScene ◄──────────────────────────────────────────┐
    │                                                │
    ├──▶ PveMapScene (развилка: 1-3 варианта) ◄──┐   │
    │         │                                  │   │
    │    handleForkChoice → enterNode             │   │
    │         │                                  │   │
    │    ┌────┼────┬────┬────┬────┬────┐         │   │
    │    │    │    │    │    │    │    │         │   │
    │  святил. бой элит магаз лаг. событ сунд.  │   │
    │    │    │    │    │    │    │    │         │   │
    │    │  PreBattle  │  Shop Camp Event Loot  │   │
    │    │    │    │    │    │    │    │         │   │
    │ Sanctu. Battle   │   (нет  (экр.  │      │   │
    │    │    │    │    │  ремонт) рез.) │      │   │
    │    └────┴────┴────┴────┴────┴────┘         │   │
    │         │ advanceToNextNode → idx+1 ────────┘   │
    │         │                                      │
    │    boss победа → PveResultScene ────────────────┘
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

## 11. PreBattleScene — ключевой экран

| Зона | Содержимое |
|------|-----------|
| Верх | Герой vs Враг (масса кг, снаряжение, сравнение) |
| Середина | Пояс: расходники (0–1 на бой). Без аптечек. Пояс скрыт если ур. аккаунта < 2 |
| Низ | 6 команд: иконка, название, шанс (%), пипсы прочности, имя предмета. Полиморф в PvP → подсказка «0 рейтинга, 0 сундука» |
| Подсказка | «Враг легче → Атака. Тяжелее → Блок. Не уверен → Отступление» |
| CTA | «В бой!» (активна при выборе команды) |

Визуальный референс: prebattle_scene_v9.html.

---

## 12. Роадмап спринтов

### Sprint 2: FormulaEngine + BattleSystem v4

**Цель:** Работающий бой. PreBattle → автобой → результат.

| Задача | P |
|--------|---|
| shared/formulas/DerivedStats (HP = масса кг) | P0 |
| shared/formulas/BattleTTK | P0 |
| shared/formulas/CommandChances (полиморф PvP = 0/0/0) | P0 |
| shared/systems/CommandResolver | P0 |
| shared/systems/WearSystem | P0 |
| client/systems/BattleSystem | P0 |
| client/scenes/PreBattleScene | P0 |
| client/scenes/BattleScene (автобой) | P0 |
| client/ui/CommandButton | P0 |
| config/equipment_catalog.json (9 шт, acc_vial_t1 → cmd_polymorph) | P1 |
| config/mobs.json (7 мобов, кастомные профили) | P1 |
| Миграция IHeroState, IEquipmentItem | P0 |
| Миграция balance.json (startMass 50 кг, massCap 125) | P0 |

### Sprint 3: PvE + святилище + реликвии

| Задача | P |
|--------|---|
| PveSystem — маршрут с развилками, правила выхода (R1) | P0 |
| PveMapScene — карта, узлы, «???» | P0 |
| SanctuaryScene — выбор реликвии | P0 |
| RelicSystem (без целебных: relic_mass_on_win, relic_camp_repair и т.д.) | P0 |
| LootSystem + LootScene | P0 |
| BeltSystem (разблокировка с ур. 2) + ConsumableSlot | P0 |
| ShopScene | P1 |
| CampScene (починка +1 / тренировка +3–5 кг / пересборка пояса) | P1 |
| config/relics.json (17 шт), consumables.json (26 шт, без аптечек) | P1 |

### Sprint 4: PvP-арена

| Задача | P |
|--------|---|
| BotFactory (кастомные профили) | P0 |
| PvpSystem — рейтинг, масса −10%, полиморф = 0/0/0 (R5) | P0 |
| PvpLobbyScene | P0 |
| PvpResultScene | P0 |
| Аренный сундук | P1 |

### Sprint 5: XP, бустеры, dev-панель

| Задача | P |
|--------|---|
| XpSystem (тройной гейт глав: R6) | P0 |
| BoosterSystem + камбек | P1 |
| PitySystem | P1 |
| DevPanelScene (полная) | P1 |
| SaveManager | P0 |

---

## 13. Влияние на Sprint 1

### Сохраняется

SceneManager, EventBus, BaseScene, ThemeConfig, Button, ProgressBar, BottomNav, Tween, Webpack, tsconfig, jest.

### Миграция (Sprint 2)

| Файл | Изменение |
|------|----------|
| shared/types/GameState.ts | Убрать hp, maxHp, baseAttack, baseDefense → level, xp, levelMassBonus |
| shared/types/Equipment.ts | Убрать modifier → strengthBonus, armorBonus, luckBonus, hpBonus, commandId |
| shared/types/BalanceConfig.ts | Разделить. starterItems → equipment_catalog |
| config/balance.json | startMass 50 кг, massCaps, eloK. Убрать startHp, baseAttack, baseDefense |
| client/core/GameState.ts | Убрать setHp(). Добавить belt, backpack, relics, boosters, xp |
| client/scenes/HubScene.ts | Обновить под новые типы |
| client/ui/EquipmentCard.ts | +Сила/+Броня/+Удача, пипсы 3 вместо бара 100 |
| client/ui/HeroPortrait.ts | Добавить уровень, единицы кг |

---

## 14. Решённые вопросы (закрыты в GDD v1.2)

| Вопрос | Решение | Ссылка |
|--------|---------|--------|
| Масса при поражении PvE | Масса на входе в проигранный бой | R1 |
| HP между боями | HP = масса, полное восстановление перед каждым боем | R2 |
| Аптечки | Удалены. Прочность — единственное истощение | R2 |
| Целебные реликвии | Заменены: relic_mass_on_win, relic_camp_repair, relic_boss_armor, relic_thick_skin | R2 |
| Лагерь | Починка +1 ИЛИ тренировка +3–5 кг + пересборка пояса | R2 |
| cmd_poison | Переименован в cmd_polymorph (acc_vial_t1) | R3 |
| Статы мобов | Кастомные профили вместо формульных множителей | R4 |
| Полиморф в PvP | 0 рейтинга, 0 сундука, 0 массы | R5 |
| Гейты глав | Тройной: босс + лига + уровень аккаунта | R6 |
| Пояс | С уровня аккаунта 2 | R7 |
| Единицы массы | кг | R8 |
| Сломанное снаряжение | durability=0 → удаляется из слота | R9 |
| Авто-экипировка лута | Пустой слот → надеть; лучше → надеть, старый в рюкзак | R10 |
| PvP Elo | Только victory/defeat. Retreat/bypass/polymorph = 0 | R11 |
| Bypass PvE | Продвижение без лута | R12 |

### Открытые вопросы (⏳ Балансировка)

| Вопрос | Срок |
|--------|------|
| mass_per_level | До Sprint 5 |
| Цены рюкзака | До Sprint 3 |
| XP-кривая | До Sprint 5 |
| cost_per_point ремонта (лагерь) | До Sprint 4 |
| Оффлайн-защита (снапшоты) | Post-MVP |

---

## 15. Глоссарий (v1.2)

| Термин | Определение |
|--------|-------------|
| Масса | HP героя (кг). Сила = масса/3. Потолки: 125/250/500/1000/2000 кг |
| Прочность | −1 за команду предмета. Tier 1=3, 2=5, 3=7, 4=9. Единственный ресурс истощения в походе |
| Команда | 1 из 6 действий: атака, блок, фортуна, отступление, обход, полиморф |
| TTK | Число ударов до убийства. Определяет вероятность победы |
| Пояс | 2–4 слота расходников. Разблокируется с уровня аккаунта 2 |
| Реликвия | Пассивный бонус на поход. До 3. Без целебных |
| Святилище | Первый узел похода. Выбор 1 из 3 реликвий |
| Лагерь | Починка +1 / тренировка +3–5 кг / пересборка пояса |
| Камбек-бонус | Автобустер при серии поражений или возвращении |
| Pity | Каждый 5-й предмет — tier+1 (с бустером — каждый 3-й) |
| Путь аккаунта | XP → уровни → фичи (пояс ур. 2, ремонт ур. 3, арена ур. 5) |
| Тройной гейт | Босс + лига + уровень аккаунта — для разблокировки следующей главы |
| Профиль моба | Кастомные статы: слабый, быстрый, бронированный, стеклянная пушка, танк |
| Полиморф PvP | 0 рейтинга, 0 сундука, 0 массы. Аксессуар −1 прочность |

---

## История изменений архитектуры

| Версия | Дата | Изменения |
|--------|------|-----------|
| 1.0 | 2026-04-02 | Первая версия. Пошаговый бой, формулы v1 |
| 2.0 (черновик) | 2026-04-05 | Переработка под GDD v1.1: автобой, 6 команд, TTK, пояс, реликвии, XP |
| 1.2 | 2026-04-05 | Синхронизация с GDD v1.2 (аудит R1–R8): правила массы PvE, удаление аптечек, лагерь=починка/тренировка, полиморф PvP=0/0/0, тройной гейт, пояс с ур. 2, кг, кастомные мобы, контент 26/17/7 |
