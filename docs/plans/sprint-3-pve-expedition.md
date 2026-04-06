# Sprint 3: PvE-поход — План реализации

## Context

Sprint 2 завершён (PR #4 APPROVED): модель данных v1.2, FormulaEngine (14 функций), BattleSystem, PreBattleScene, BattleScene, 67 тестов. Следующий шаг по `sprint_decomposition_v1.2.md` — Sprint 3: полный PvE-поход со случайной генерацией маршрута (14 задач, S3-01..S3-14).

**Цель:** Полный поход от святилища до босса. Случайная генерация маршрута. Каждый поход уникален.

---

## Фазы реализации

### Фаза 1: Фундамент (конфиги + PRNG) — параллельно

| Задача | Приоритет | Файлы |
|--------|-----------|-------|
| **S3-04 Random с seed** | P0 | Создать: `shared/src/utils/Random.ts`, `Random.test.ts` |
| **S3-01 PveConfig** | P0 | Изменить: `config/balance.json` (+секция `pve`), `shared/src/types/BalanceConfig.ts` (+`IPveConfig`) |
| **S3-02 RelicConfig** | P0 | Изменить: `config/balance.json` (6→17 реликвий + поле `rarity`), `shared/src/types/Relic.ts` (+`RelicRarity`), `shared/src/types/BalanceConfig.ts` (IRelicConfig +rarity) |
| **S3-03 EventConfig** | P1 | Изменить: `config/balance.json` (+секция `events`, 6 событий), `shared/src/types/BalanceConfig.ts` (+`IEventConfig`, `IEventVariant`, `IEventEffect`) |

Все 4 задачи независимы — можно реализовать параллельно.

#### S3-04: Random (mulberry32)

```typescript
// shared/src/utils/Random.ts
export function createRng(seed: number): () => number;      // mulberry32 PRNG
export function randInt(rng: () => number, min: number, max: number): number;
export function randPick<T>(rng: () => number, arr: T[]): T;
export function shuffle<T>(rng: () => number, arr: T[]): T[];
export function weightedPick<T>(rng: () => number, items: T[], weights: number[]): T;
```

Тесты: детерминизм (одинаковый seed = одинаковая последовательность), корректность границ randInt, распределение weightedPick.

#### S3-01: PveConfig — добавить в balance.json

```json
"pve": {
  "total_nodes_min": 8, "total_nodes_max": 10,
  "fork_count_min": 3, "fork_count_max": 4,
  "paths_per_fork_min": 2, "paths_per_fork_max": 3,
  "hidden_path_chance": 0.3,
  "ancient_chest_node_min": 5, "ancient_chest_node_max": 6,
  "node_weights": { "combat": 0.40, "elite": 0.12, "shop": 0.12, "camp": 0.12, "event": 0.08, "chest": 0.16 },
  "constraints": { "max_combats_in_row": 2, "max_shops": 1, "min_camps_before_boss": 1 },
  "camp": { "repair_amount": 1, "train_mass_min": 3, "train_mass_max": 5 },
  "shop": { "item_count_min": 3, "item_count_max": 4, "price_multiplier": 1.0, "repair_price_multiplier": 1.75 },
  "loot": { "combat_loot_chance": 0.20, "elite_loot_guaranteed": true, "elite_relic_chance": 0.40, "boss_loot_count": 2, "chest_loot_count_min": 1, "chest_loot_count_max": 2, "pity_counter": 5 }
}
```

#### S3-02: RelicConfig — расширить до 17 реликвий по GDD 13

Добавить `rarity: RelicRarity` в `IRelic` и `IRelicConfig`. Реликвии из GDD: gold_bonus, mass_bonus, extra_loot, mass_on_win, strength, armor, luck, first_strike, thorns, thick_skin, boss_armor, reveal, safe_retreat, bypass_safe, extra_backpack, no_durability, camp_repair, shop_discount, polymorph_bonus.

#### S3-03: EventConfig — 6 событий по GDD 11

Типы: `IEventConfig { id, name, description, variants: IEventVariant[] }`, `IEventVariant { id, label, description, condition?, effects: IEventEffect[] }`, `IEventEffect { type: 'gold'|'mass'|'repair'|'item'|'loot_chest'|'lose_item', value }`.

---

### Фаза 2: Системы (shared/) — параллельно после Фазы 1

| Задача | Приоритет | Файлы |
|--------|-----------|-------|
| **S3-05 PveSystem** | P0 | Создать: `shared/src/systems/PveSystem.ts`, `PveSystem.test.ts`, `shared/src/types/PveNode.ts` |
| **S3-06 RelicSystem** | P0 | Создать: `shared/src/systems/RelicSystem.ts`, `RelicSystem.test.ts` |
| **S3-07 LootSystem** | P0 | Создать: `shared/src/systems/LootSystem.ts`, `LootSystem.test.ts` |

#### S3-05: PveSystem — ключевые типы и функции

**Типы** (`shared/src/types/PveNode.ts`):
```typescript
export type PveNodeType = 'sanctuary' | 'combat' | 'elite' | 'shop' | 'camp' | 'event' | 'chest' | 'ancient_chest' | 'boss';

export interface IPveNode {
    index: number;
    type: PveNodeType;
    enemyId?: string;
    eventId?: string;
    isFork: boolean;
    forkPaths?: IPveForkPath[];
}

export interface IPveForkPath {
    targetNodeIndex: number;
    nodeType: PveNodeType;
    hidden: boolean;
}

export interface IPveRoute {
    seed: number;
    nodes: IPveNode[];
    totalNodes: number;
}

export type PveExpeditionStatus = 'active' | 'victory' | 'defeat' | 'exited';

export interface IPveExpeditionState {
    route: IPveRoute;
    currentNodeIndex: number;
    status: PveExpeditionStatus;
    visitedNodes: number[];
    massGained: number;
    goldGained: number;
    itemsFound: string[];
    pityCounter: number;
    combatsInRow: number;
}
```

**Функции** (`shared/src/systems/PveSystem.ts`):
```typescript
export function generateRoute(config: IPveConfig, enemies: IMobConfig[], events: IEventConfig[], rng: () => number): IPveRoute;
export function createExpeditionState(route: IPveRoute): IPveExpeditionState;
export function advanceToNode(state: IPveExpeditionState, nodeIndex: number): IPveExpeditionState;
export function exitExpedition(state: IPveExpeditionState): IPveExpeditionState;
export function applyBattleResult(state: IPveExpeditionState, result: IBattleResult, relics: IRelic[]): IPveExpeditionState;
```

**Алгоритм генерации маршрута:**
1. `totalNodes = randInt(rng, min, max)` (8-10)
2. Якоря: `nodes[0] = sanctuary`, `nodes[randInt(4,5)] = ancient_chest`, `nodes[last] = boss`
3. `forkCount = randInt(rng, 3, 4)` — выбрать позиции из доступных
4. Заполнить остальные узлы через `weightedPick` по `node_weights`
5. Назначить `enemyId` для combat/elite, `eventId` для event
6. Генерация развилок: 2-3 пути, часть скрыта ("???")
7. **Валидация ограничений:** ≤2 боёв подряд, ≤1 магазин, ≥1 лагерь до босса — если нарушено, заменить узлы

Тесты (~15): якоря на местах, детерминизм, ограничения соблюдены, fork count в пределах, все combat/elite имеют enemyId.

#### S3-06: RelicSystem

```typescript
export function generateRelicPool(allRelics: IRelicConfig[], activeRelics: IRelic[], count: number, rng: () => number): IRelicConfig[];
export function selectRelic(activeRelics: IRelic[], newRelic: IRelic, maxRelics: number, replaceIndex?: number): IRelic[];
```

Тесты: пул исключает уже имеющиеся, лимит 3 реликвии, замена работает.

#### S3-07: LootSystem

```typescript
export function generateLoot(nodeType: PveNodeType, config: IPveConfig, catalog, consumables, pityCounter: number, rng): { drops: ILootDrop[]; newPityCounter: number };
export function generateShopInventory(config: IPveConfig, catalog, consumables, rng): Array<{ item; price: number }>;
```

Тесты: pity-счётчик срабатывает на 5-м предмете, combat шанс лута ~20%, elite гарантированный, магазин 3-4 товара.

---

### Фаза 3: Карта + ключевые сцены — после Фазы 2

| Задача | Приоритет | Файлы |
|--------|-----------|-------|
| **S3-09 PveMapScene** | P0 | Переписать: `client/src/scenes/PveMapScene.ts` (стаб → полная реализация) |
| **S3-08 SanctuaryScene** | P0 | Создать: `client/src/scenes/SanctuaryScene.ts` |
| **S3-10 LootScene** | P0 | Создать: `client/src/scenes/LootScene.ts` |

**S3-09 PveMapScene** — центральная сцена похода:
- Получает expedition state, отображает текущий узел, иконки типов, развилки, кнопку "Выход"
- Навигация: по типу узла переходит в соответствующую сцену (PreBattle, Sanctuary, Loot, Shop, Camp, Event)
- На boss-узле: retreat/bypass скрыты

**Состояние экспедиции** хранить в `client/src/core/GameState.ts`:
```typescript
private _expeditionState: IPveExpeditionState | null = null;
startExpedition(route: IPveRoute): void;
updateExpeditionState(state: IPveExpeditionState): void;
endExpedition(): void;  // перенести массу/золото/предметы в постоянное состояние
```

**Изменить** `client/src/scenes/HubScene.ts` — кнопка "ПОХОД" генерирует маршрут и стартует экспедицию.

**Зарегистрировать** новые сцены в `client/src/main.ts`.

**Поток переходов:**
```
HubScene → [генерация маршрута] → PveMapScene
  → node 0: SanctuaryScene (выбор реликвии)
  → node 1..N-1: по типу → PreBattle/Shop/Camp/Event/Loot
  → node N (boss): PreBattle (retreat/bypass скрыты)
    → victory: SanctuaryScene (реликвия-награда) → PveResultScene
    → defeat: PveResultScene
  → [кнопка "Выход"]: PveResultScene
PveResultScene → HubScene
```

---

### Фаза 4: Вспомогательные сцены — после Фазы 3

| Задача | Приоритет | Файлы |
|--------|-----------|-------|
| **S3-11 ShopScene** | P1 | Создать: `client/src/scenes/ShopScene.ts` |
| **S3-12 CampScene** | P1 | Создать: `client/src/scenes/CampScene.ts` |
| **S3-13 EventScene** | P1 | Создать: `client/src/scenes/EventScene.ts` |
| **S3-14 PveResultScene** | P0 | Создать: `client/src/scenes/PveResultScene.ts` |

Все сцены следуют паттерну: наследуют BaseScene, получают данные через `onEnter(data)`, не содержат бизнес-логики (только отображение).

---

## Deferred Issues из Sprint 2

| Issue | Решение |
|-------|---------|
| big-heroes-8y2: Block Draw (15% ничьих в PvE) | **Включить в Sprint 3** — PvE-бои это ядро спринта. Добавить `'draw'` в BattleOutcome, обработать в PveMapScene (остаёмся на узле). |
| big-heroes-7ix: setHp → shared | Отложить (Sprint 4) |
| big-heroes-ao3: SceneManager дублирование | Автоматически решится заменой стабов |
| big-heroes-5sg: Layout хардкод | Отложить |
| big-heroes-70l: Graphics утечки | Отложить |

---

## Сводка файлов

### Новые (15):
- `shared/src/utils/Random.ts` + `.test.ts`
- `shared/src/types/PveNode.ts`
- `shared/src/systems/PveSystem.ts` + `.test.ts`
- `shared/src/systems/RelicSystem.ts` + `.test.ts`
- `shared/src/systems/LootSystem.ts` + `.test.ts`
- `client/src/scenes/SanctuaryScene.ts`
- `client/src/scenes/LootScene.ts`
- `client/src/scenes/ShopScene.ts`
- `client/src/scenes/CampScene.ts`
- `client/src/scenes/EventScene.ts`
- `client/src/scenes/PveResultScene.ts`

### Изменяемые (8):
- `config/balance.json` — секции pve, relics (6→17+), events
- `shared/src/types/BalanceConfig.ts` — IPveConfig, IEventConfig, расширение IBalanceConfig
- `shared/src/types/Relic.ts` — +RelicRarity
- `shared/src/index.ts` — экспорт новых модулей
- `client/src/scenes/PveMapScene.ts` — полная перезапись (стаб → навигация похода)
- `client/src/scenes/HubScene.ts` — кнопка "ПОХОД" генерирует маршрут
- `client/src/core/GameState.ts` — expedition state management
- `client/src/main.ts` — регистрация 6 новых сцен

---

## Верификация

1. `npm run build` — сборка без ошибок
2. `npm run test` — все тесты проходят (существующие 67 + новые ~40-50)
3. Ручная проверка: запустить `npm run dev`, нажать "ПОХОД" в хабе → пройти весь поход от святилища до босса
4. Проверить детерминизм: два похода с одинаковым seed дают одинаковый маршрут
5. Проверить ограничения: не более 2 боёв подряд, не более 1 магазина, минимум 1 лагерь
