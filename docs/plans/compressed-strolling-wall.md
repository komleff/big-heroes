# Sprint 2: Новая модель данных + боевая система v5

> Источники: `sprint_decomposition_v1.2.md`, `mvp_prototype_proposal.md`, `architecture.md v1.2`, GDD v1.2

## Контекст

Sprint 1 merged (SceneManager + HubScene + UI). Текущая модель данных (hp/maxHp/baseAttack/baseDefense, durability 100, modifier) **полностью устарела** — GDD v1.2 вводит:
- **HP = масса** (полное восстановление перед каждым боем)
- **Strength = mass/3 + weapon bonus**, Armor = shield bonus, Luck = accessory bonus
- **Durability 3** (пипсы ●●○), не 100
- **6 команд** (attack, block, fortune, retreat, bypass, polymorph) с привязкой к экипировке
- **Автобой** (2–3 сек анимация), не пошаговый

**Цель:** рефакторинг модели данных + работающий автобой. Экран предбоя → выбор расходника + команда → автобой → результат. «ПОХОД» из HubScene запускает тестовый бой с «Слизнем».

**Доп. задача оператора:** фоновая картинка (`airtist_...png`) на задний план HubScene.

### Визуальные источники (docs/design/)

| Файл | Назначение | Используется |
|------|------------|-------------|
| `hub_scene_v7.html` | HTML-макет HubScene: gradient bg, hero stats, equipment slots с pips, belt (2 слота), PvE/PvP кнопки | S2-08 (HubScene layout) |
| `prebattle_scene_v9.html` | HTML-макет PreBattleScene: matchup, belt consumables, 6 command buttons, color chance, hint | S2-06 (PreBattleScene layout) |
| `battle_scene_v1.html` | HTML-макет BattleScene: автобой анимация, damage floats, HP bars, combat log, victory overlay | S2-07 (BattleScene layout) |
| `airtist_...png` | Фоновое изображение (силуэт воин vs босс) | S2-00/S2-08 (фон HubScene) |
| `Gemini_...png` | Титульная картинка «Big Heroes: The Titan's Challenge» | Sprint 6 (MainMenuScene) |
| `style-guide.md` | Цвета, типографика, компоненты, анимации | Все UI-компоненты |

---

## Что НЕ трогаем

ThemeConfig, SceneManager, EventBus (структура), BaseScene, Button, ResourceBar, ProgressBar, BottomNav, Tween, Webpack, tsconfig, CI.

## Что переписываем

| Файл | Причина |
|------|---------|
| `shared/src/types/Equipment.ts` | modifier → strengthBonus/armorBonus/luckBonus/hpBonus/commandId, durability 3 |
| `shared/src/types/GameState.ts` | Убрать hp/maxHp/baseAttack/baseDefense. Добавить massCap |
| `shared/src/types/BalanceConfig.ts` | Новая схема: formulas, enemies, consumables, relics |
| `client/src/core/GameState.ts` | Новая модель: belt (2), backpack (4), stash, relics |
| `config/balance.json` | startMass 50, startGold 100, 9 предметов, 10 расходников, 7 мобов |
| `client/src/ui/EquipmentCard.ts` | DurabilityPips вместо ProgressBar, показ бонусов |
| `client/src/scenes/HubScene.ts` | Новая модель + belt + фоновая картинка |

## Что создаём

| Файл | Назначение |
|------|------------|
| `shared/src/types/Battle.ts` | CommandId, IBattleContext, IBattleResult, ITurnHit |
| `shared/src/types/Consumable.ts` | IConsumable, ConsumableType |
| `shared/src/types/Relic.ts` | IRelic |
| `shared/src/types/Mob.ts` | IMob, MobType |
| `shared/src/formulas/FormulaEngine.ts` | Все формулы (чистые функции) |
| `shared/src/formulas/FormulaEngine.test.ts` | Unit-тесты |
| `shared/src/systems/BattleSystem.ts` | Resolve: context → result (чистая функция) |
| `client/src/ui/DurabilityPips.ts` | ●●○ компонент |
| `client/src/scenes/PreBattleScene.ts` | Выбор расходника + команда → «В бой!» |
| `client/src/scenes/BattleScene.ts` | Автобой 2–3 сек анимация |
| `client/src/assets/hub-bg.png` | Фоновая картинка (copy) |
| `client/src/assets/assets.d.ts` | TS-декларация для PNG |

---

## Шаги реализации

### Фаза 1: Рефакторинг типов + конфиги (параллельно)

**S2-01. Переписать shared/ types**
- `Equipment.ts`: убрать `modifier`. Добавить `strengthBonus`, `armorBonus`, `luckBonus`, `hpBonus`, `commandId: CommandId | null`
  - `CommandId = 'cmd_attack' | 'cmd_block' | 'cmd_fortune' | 'cmd_retreat' | 'cmd_bypass' | 'cmd_polymorph'`
  - `maxDurability`: 3 (tier 1)
- `GameState.ts`: `IHeroState = { mass, rating, massCap }` (убрать hp, maxHp, baseAttack, baseDefense)
  - `IHeroStats = { hp, strength, armor, luck }` — вычисляемый через FormulaEngine
  - `IBeltState = [IConsumable | null, IConsumable | null]`
  - `IBackpackState = Array<IEquipmentItem | IConsumable | null>` (max 4)
  - `IGameState`: hero, resources, equipment, belt, backpack, stash, activeRelics
- `BalanceConfig.ts`: новая схема с formulas, enemies, consumables, relics, starterBelt, starterBackpack
- Новые: `Battle.ts`, `Consumable.ts`, `Relic.ts`, `Mob.ts`
- Обновить `index.ts`

**S2-02. Переписать balance.json** (из MVP Proposal)

```
hero: { startMass: 50, startRating: 1000, massCap: 125 }
resources: { startGold: 100 }
formulas: { massDamageCoeff: 0.333, minDamage: 1, baseCritChance: 0, baseBlockPower: 0.3,
            shieldArmorBlockCoeff: 0.05, luckAttackCoeff: 0.01, luckAbilityCoeff: 0.02,
            retreatBase: 0.70, bypassBase: 0.60, eloK: 32, winChanceMin: 0.05, winChanceMax: 0.95 }
equipment.starterItems: [wpn_sword_t1 (+3 str), shd_buckler_t1 (+3 arm), acc_ring_t1 (cmd_fortune)]
equipment.catalog: 9 предметов (3 weapon + 3 shield + 3 accessory)
consumables: 10 штук (str_pot, arm_pot, luck_pot, poison, repair, torch, spyglass, compass, picnic, pouch)
enemies: 7 мобов (slime 35kg, goblin 50kg, wolf 45kg, skeleton 55kg, elite_ogre 90kg, elite_mage 60kg, boss_dragon 150kg)
relics: 6 штук (strength +2, armor +3, gold_bonus +30%, mass_bonus +20%, thick_skin −15% enemy str, luck +2)
starterBelt: [torch_t1, str_pot_t1]
starterBackpack: [str_pot_t1, str_pot_t1, repair_t1, null]
```

**S2-11. MobConfig, ConsumableConfig** — отдельные конфиги или секции balance.json (решение: всё в balance.json для простоты прототипа)

**S2-12. EventBus: новые события**
- `battle:start`, `battle:result`, `battle:animation:hit`

**S2-00. Webpack PNG + копирование картинки** (параллельно)
- webpack: `{ test: /\.(png|jpe?g|gif|svg)$/i, type: 'asset/resource' }`
- `client/src/assets/assets.d.ts`: `declare module '*.png'`
- Copy `docs/design/airtist_...png` → `client/src/assets/hub-bg.png`

### Фаза 2: FormulaEngine + BattleSystem (shared/)

**S2-04. FormulaEngine** — чистые функции, без side-effects:

| Функция | Формула |
|---------|---------|
| `calcHeroStats(mass, equipment, relics)` | hp=mass, str=mass/3+weapon.strengthBonus+relic, armor=shield.armorBonus+relic, luck=acc.luckBonus+relic |
| `calcDamage(strength, armor)` | `max(1, strength − armor)` |
| `calcTTK(hp, damagePerHit)` | `hp / max(1, damagePerHit)` |
| `calcBaseWinChance(ttkHero, ttkEnemy)` | `ttkEnemy / (ttkHero + ttkEnemy)` |
| `calcAttackWinChance(base, luck)` | `clamp(base + luck × 0.01, 0.05, 0.95)` |
| `calcBlockWinChance(attackChance, shieldArmor, luck)` | block_power=0.3+shieldArmor×0.05, mod=(0.5−attackChance)×block_power, `clamp(attackChance+mod+luck×0.01, 0.05, 0.95)` |
| `calcFortuneChance(base, luck)` | `clamp(base + luck × 0.02, 0.05, 0.95)` |
| `calcRetreatChance(luck)` | `clamp(0.70 + luck × 0.02, 0.05, 0.95)` |
| `calcBypassChance(luck)` | `clamp(0.60 + luck × 0.02, 0.05, 0.95)` |
| `calcPolymorphChance(base, luck)` | `clamp(base + luck × 0.02, 0.05, 0.95)` |
| `calcEloChange(playerR, enemyR, result)` | K=32, expected = 1/(1+10^((enemyR−playerR)/400)) |
| `generateHitAnimation(winner, heroDmg, enemyDmg)` | 2–3 хита × rand(0.7–1.3), сумма = total damage |

**S2-13. Тесты FormulaEngine** — AAA-паттерн:
- calcHeroStats: герой mass=50, sword (+3 str) → str = 50/3 + 3 ≈ 19.67
- calcDamage: str=20 vs armor=5 → 15; str=1 vs armor=10 → 1 (min)
- calcTTK: hp=50, dmg=10 → 5
- calcBaseWinChance: ttkH=5, ttkE=3 → 3/8 = 0.375
- calcBlockWinChance: блок-выравниватель для слабого vs сильного
- clamp: проверка 0.05–0.95 границ
- calcEloChange: win/loss, equal ratings

**S2-05. BattleSystem** — в shared/src/systems/:
- Чистая функция `resolveBattle(context: IBattleContext): IBattleResult`
  - Input: `{ mode, heroStats, enemyConfig, command, consumable?, rng }`
  - Process: рассчитать шанс → rng() → win/loss → generateHitAnimation → wear (−1 durability к предмету команды)
  - Output: `{ outcome, winChance, hits[], durabilityTarget, massReward, goldReward }`
- rng параметр для детерминированных тестов

### Фаза 3: Обновление client/

**S2-03. GameState** — переписать:
- Конструктор из нового balance.json
- hero: `{ mass, rating, massCap }`
- equipment: 3 слота с новыми типами
- belt: 2 слота (IConsumable | null)
- backpack: 4 слота
- stash: IEquipmentItem[] (запас)
- activeRelics: IRelic[] (max 3)
- Сеттеры: setMass, setRating, setGold, equipItem, useConsumable, addRelic, wearItem (−1 durability)

**S2-09. DurabilityPips** — новый UI-компонент:
- `●●○` для durability 2/3, `●●●` для 3/3, `○○○` для 0/3
- Filled pip: accent_green, empty: text_muted
- Размер pip: 8×8, gap 4px

**S2-10. EquipmentCard** — рефакторинг:
- DurabilityPips вместо ProgressBar
- Показ бонусов: «+3 Str» (accent_green), «+3 Arm» (accent_cyan), «+1 Luck» (accent_yellow)
- Имя команды под названием: «cmd: Атака» (text_muted)

**S2-06. PreBattleScene** — ключевой новый экран:

```
y=48    «ПРЕДБОЙ» (heading)
y=100   Панель врага: [Аватар] | Имя, масса, HP, сила, броня
y=240   Сравнение: Герой stats vs Враг stats (2 колонки)
y=350   Пояс: [slot 1] [slot 2] — тап для применения расходника (0–1 за бой)
y=440   6 кнопок команд (2 ряда × 3):
         [⚔ Атака 65%] [🛡 Блок 58%] [🍀 Фортуна 62%]
         [🏃 Отступ 72%] [💨 Обход 62%] [🔮 Полиморф 45%]
        Цвет: зелёный ≥60%, жёлтый 40–59%, красный <40%
        Серый + замок: durability=0 на привязанном предмете
y=700   Кнопка «В БОЙ!» (primary, активна после выбора команды)
```

**S2-07. BattleScene** — автобой 2–3 сек:

```
Анимация:
0.0–0.3с  Сближение (два аватара сходятся к центру)
0.3–2.0с  2–3 удара: аватар трясётся, число урона всплывает
           Белый = обычный, жёлтый = сильный (×1.15+), красный + «МОЩНЫЙ!» = крит (×1.25+)
2.0–2.5с  Финал: проигравший падает/улетает
2.5–3.0с  Баннер: «ПОБЕДА!» (зелёный) или «ПОРАЖЕНИЕ» (красный)
           + награда: «+6 кг массы, +10 Gold»
           Кнопка «Продолжить» → HubScene
```

Данные берёт из `IBattleResult.hits[]` — BattleSystem уже рассчитал результат до начала анимации.

**S2-08. HubScene** — обновить:
- Фоновая картинка (Sprite из `hub-bg.png`, cover-fit)
- Данные из нового GameState (mass вместо hp, belt display)
- HeroPortrait: масса = HP
- EquipmentCard: новые бонусы + пипсы
- Кнопка «ПОХОД»: → PreBattleScene с первым мобом из balance.json

### Фаза 4: Интеграция + тесты

**main.ts:**
- Прелоад `hub-bg.png` через `Assets.load()`
- Регистрация PreBattleScene, BattleScene
- Инициализация GameState из нового balance.json

**Проверки:**
- `npm run build` — чисто
- `npm run test` — FormulaEngine тесты проходят
- `npm run dev`:
  - [ ] HubScene: фоновая картинка, mass=50, belt (2 слота), пипсы прочности ●●●
  - [ ] «ПОХОД» → PreBattleScene (Слизень, mass 35, HP 35)
  - [ ] 6 команд с цветовой индикацией шанса
  - [ ] Выбрать расходник + команду → «В бой!»
  - [ ] BattleScene: автобой 2–3 сек, числа, финал
  - [ ] «ПОБЕДА!» → +6 кг массы → HubScene (масса обновлена)
  - [ ] «ПОРАЖЕНИЕ» → HubScene (масса не изменилась)
  - [ ] Durability −1 на предмете выбранной команды

---

## Зависимости

```
S2-01 (types)     ──┬── S2-02 (balance.json)
                     ├── S2-03 (GameState)
                     ├── S2-04 (FormulaEngine) ── S2-13 (тесты)
                     ├── S2-11 (MobConfig/ConsumableConfig)
                     └── S2-05 (BattleSystem)

S2-00 (webpack PNG) ──── S2-08 (HubScene bg)

S2-09 (DurabilityPips) ── S2-10 (EquipmentCard)

S2-04 + S2-05 ──── S2-06 (PreBattleScene)
                     └── S2-07 (BattleScene)

S2-03 + S2-10 + S2-06 + S2-07 ── S2-08 (HubScene)
```

Параллельные группы:
- **A:** S2-00, S2-01, S2-12 (параллельно, без зависимостей)
- **B:** S2-02, S2-03, S2-04, S2-11 (после A)
- **C:** S2-05, S2-09, S2-13 (после B)
- **D:** S2-06, S2-07, S2-10 (после C)
- **E:** S2-08 (после D) + main.ts интеграция

---

## Риски

| Риск | Митигация |
|------|-----------|
| Рефакторинг ломает Sprint 1 код | Поэтапно: types → GameState → scenes. Build после каждой фазы |
| 6 команд сложны в балансе | FormulaEngine с тестами, clamp 0.05–0.95 |
| Автобой анимация без Spine | Простые tweens: position + shake + float numbers. Достаточно для прототипа |
| PNG ~970KB | asset/resource (отдельный файл, не base64) |
| Много новых типов | Все в shared/ с реэкспортом, один build проверяет всё |

## Архитектурные решения

1. **BattleSystem в shared/** — чистая функция, не класс с состоянием. resolveBattle() принимает контекст, возвращает результат. Тестируемо без PixiJS.
2. **FormulaEngine — отдельные функции**, не класс. Tree-shakeable, каждая тестируется независимо.
3. **rng параметр** в rollBattle() и generateHitAnimation() — для детерминированных тестов.
4. **Всё в balance.json** (не отдельные JSON-файлы) — для простоты прототипа. Выносить в отдельные файлы при масштабировании.
5. **PreBattleScene — отдельная сцена**, не модалка. Переход SLIDE_LEFT из HubScene, FADE в BattleScene.
6. **BattleScene получает готовый IBattleResult** — анимация по заранее рассчитанным данным, не в реальном времени.
