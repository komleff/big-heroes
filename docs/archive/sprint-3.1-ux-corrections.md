# Sprint 3.1 — Коррекция UX: Hub, PvE-поход, PreBattle

## Context

Sprint 3 (PvE-экспедиция) завершён, но Hub-экран расходится с макетом `hub_scene_v7.html`, PvE-поход имеет UX-проблемы (лишние промежуточные экраны, отсутствие выбора после сундука), а экран PreBattle показывает 6 команд вместо 3. Этот спринт — коррекция/полировка перед следующим функциональным спринтом.

---

## Задачи (6 штук, в порядке реализации)

### 1. Переименовать "ПРЕДБОЙ" → "ПОДГОТОВКА К БОЮ"

**Файлы:** [PreBattleScene.ts:148](client/src/scenes/PreBattleScene.ts#L148)

Заменить строку `'ПРЕДБОЙ'` на `'ПОДГОТОВКА К БОЮ'`. Уменьшить `fontSize` с 40 до ~28, чтобы длинный текст помещался в 390px.

---

### 2. Убрать промежуточный экран после выбора пути на развилке

**Файлы:** [PveMapScene.ts](client/src/scenes/PveMapScene.ts) — метод `handleForkChoice()` (строки 242-269)

**Проблема:** После выбора пути на развилке игрок видит лишний экран "ВСТУПИТЬ В БОЙ" / "ВОЙТИ" с одной кнопкой. Из контекста выбора уже ясно, что будет дальше.

**Решение:** В `handleForkChoice()` после обновления типа следующего узла (строки 248-261) — вызвать `this.enterNode(updatedNodes[nextIndex])` напрямую вместо `goto('pveMap')`.

Конкретно:
- Оставить строки 248-261 (обновление route)
- Удалить строки 263-265 (ручное обновление `currentNodeIndex` — это сделает `enterNode` → `advanceToNode`)
- Заменить строку 268 (`goto('pveMap')`) на `this.enterNode(updatedNodes[nextIndex])`

**Edge-case:** `enterNode` проверяет `alreadyVisited` через `visitedNodes`. Следующий узел ещё не в `visitedNodes`, так что guard пройдёт корректно.

---

### 3. PreBattle — только 3 слота команд

**Файлы:** [PreBattleScene.ts](client/src/scenes/PreBattleScene.ts) — массив `COMMANDS` (строки 43-74), метод `buildCommandGrid()` (строки 432-589)

**Проблема:** Сейчас 6 команд в сетке 3×2. По макету `prebattle_scene_v9.html` — только 3 в один ряд.

**Решение:**

Три слота:
1. **Атака** (weapon) — всегда
2. **Кастомное умение из аксессуара** — определяется `commandId` экипированного аксессуара (Fortune/Retreat/Bypass/Polymorph). Если аксессуар не экипирован → заблокированный слот
3. **Блок** (armor) — всегда

Изменения:
- Переименовать `COMMANDS` → `ALL_COMMANDS` (справочник)
- Добавить функцию `getActiveCommands(equipment): CommandDef[]` — возвращает 3 команды
- В `buildCommandGrid()` — сетка 1×3, итерация по 3 командам
- Обновить `updateCommandHighlight()`, `rebuildCommandGrid()` — цикл по 3

**Зависимость:** Нужно проверить, что у каждого аксессуара в `balance.json` есть поле `commandId`. Если нет — добавить маппинг в shared типы.

---

### 4. После сундука — возврат на перекрёсток

**Файлы:** [PveMapScene.ts](client/src/scenes/PveMapScene.ts) — метод `advanceToNextNode()` (строки 693-727)

**Проблема:** После выхода из сундука (и других некомбатных узлов) `advanceToNextNode()` продвигает игрока на следующий линейный узел. Если там нет развилки — игрок видит одну кнопку "ВСТУПИТЬ В БОЙ" без альтернативы.

**Решение:** В `advanceToNextNode()` после проверки на конец маршрута (строка 697-718):

```
const nextNode = expedition.route.nodes[nextIndex];

// Боссы, древние сундуки, развилки — переход как обычно
if (nextNode.type === 'boss' || nextNode.type === 'ancient_chest' || nextNode.isFork) {
    // стандартный advance
    return;
}

// Иначе: найти ближайшую предыдущую развилку и вернуться к ней
let forkIndex = -1;
for (let i = expedition.currentNodeIndex - 1; i >= 0; i--) {
    if (expedition.route.nodes[i].isFork) {
        forkIndex = i;
        break;
    }
}

if (forkIndex >= 0) {
    // Очистить nextIndex из visitedNodes (чтобы можно было пройти заново с другим типом)
    const filteredVisited = expedition.visitedNodes.filter(idx => idx !== nextIndex);
    const updated = { ...expedition, currentNodeIndex: forkIndex, visitedNodes: filteredVisited };
    this.gameState.updateExpeditionState(updated);
    goto('pveMap');
    return;
}

// Fallback: если развилок нет — линейное продвижение как раньше
```

**Edge-cases:**
- Если предыдущей развилки нет → fallback на линейное продвижение
- При возврате на развилку `forkPaths` сохранены (handleForkChoice меняет только target-узел, не fork-узел)
- `visitedNodes` очищается от forward-узла → `enterNode` не пропустит его при повторном входе с другим типом

**Взаимодействие с Задачей 2:** После fork→enter (без промежуточного экрана) → некомбатный encounter → advanceToNextNode → возврат на fork. Тестировать вместе.

---

### 5. PvE-экраны — единый визуальный стиль

**Файлы:**
- [ThemeConfig.ts](client/src/config/ThemeConfig.ts) — добавить градиентные цвета
- [PveMapScene.ts](client/src/scenes/PveMapScene.ts)
- [SanctuaryScene.ts](client/src/scenes/SanctuaryScene.ts)
- [LootScene.ts](client/src/scenes/LootScene.ts)
- [CampScene.ts](client/src/scenes/CampScene.ts)
- [ShopScene.ts](client/src/scenes/ShopScene.ts)
- [EventScene.ts](client/src/scenes/EventScene.ts)
- [PveResultScene.ts](client/src/scenes/PveResultScene.ts)
- [PreBattleScene.ts](client/src/scenes/PreBattleScene.ts)

**Изменения:**
1. В `ThemeConfig.ts` добавить цвета градиента PvE: `gradient_pve: { top: 0x3A8EC2, mid: 0x5A7EAA, bottom: 0x4A6A90 }`
2. Создать утилиту `drawGradientBg()` с использованием `FillGradient` из PixiJS v8
3. Во всех PvE-сценах заменить `bg.fill(THEME.colors.bg_primary)` на градиентный фон
4. Опционально: извлечь `PveResourceHeader` (ресурсы экспедиции + реликвии) в отдельный UI-компонент для переиспользования

---

### 6. Hub-экран — привести в соответствие с макетом

**Файлы:**
- [HubScene.ts](client/src/scenes/HubScene.ts) — переписать layout (~400-500 строк)
- [BottomNav.ts](client/src/ui/BottomNav.ts) — 5 табов с иконками вместо 4 текстовых
- [ThemeConfig.ts](client/src/config/ThemeConfig.ts) — градиент Hub, новые размеры

**Новые UI-компоненты** (опционально вынести):
- `LeagueBar` — прогресс-бар лиги
- `CurrencyPill` — pill с иконкой + значение + кнопка "+"

**Секции по макету hub_scene_v7.html:**

| Секция | Текущее состояние | Необходимые изменения |
|--------|-------------------|----------------------|
| Header | Нет | Добавить: аватар + ник + currency pills |
| League bar | Нет | Добавить: ProgressBar с названием лиги |
| Hero zone | HeroPortrait | Добавить боковые кнопки (Путь / Пропуск), рестуктурировать |
| Equipment | 2 колонки | 3 слота в ряд, 80px каждый |
| Belt | Нет | 4 визуальных слота (2 рабочих + 2 locked) |
| Actions | Вертикальный стек | Горизонтальный: [Событие] [Охота] [Рейтинг] + [Арена] |
| BottomNav | 4 текстовых таба | 5 табов с эмодзи-иконками |
| Background | Картинка + overlay | Градиент: #3a8ec2 → #7ec8e3 → #a8d8a8 → #78b060 |

---

## Verification

1. `npm run build` — компиляция без ошибок
2. `npm run test` — все тесты проходят
3. Визуальная проверка в браузере (localhost:3000):
   - Hub: сравнить с `hub_scene_v7.html`
   - PvE-поход: выбор пути → прямой переход без промежуточного экрана
   - После сундука → возврат на развилку
   - PreBattle: 3 команды, заголовок "ПОДГОТОВКА К БОЮ"
   - Все PvE-экраны: градиентный фон

## Beads-задачи (создать при выходе из Plan Mode)

| # | Приоритет | Заголовок | Тип |
|---|-----------|-----------|-----|
| 1 | P2 | UX: переименовать "ПРЕДБОЙ" → "ПОДГОТОВКА К БОЮ" | task |
| 2 | P1 | UX: убрать промежуточный экран после выбора на развилке | bug |
| 3 | P1 | UX: PreBattle — 3 команды вместо 6 (Атака / Аксессуар / Блок) | feature |
| 4 | P1 | UX: после сундука возврат на перекрёсток, а не линейный advance | bug |
| 5 | P2 | STYLE: единый градиентный фон для всех PvE-экранов | task |
| 6 | P1 | UI: Hub-экран привести в соответствие с макетом hub_scene_v7 | feature |
