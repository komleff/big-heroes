# Sprint 4 — Relic UX + PvP Arena MVP

## Context

Спринты 1-3.1 реализовали ядро: SceneManager, BattleSystem, PvE-поход (граф Slay the Spire), 142 теста.
В бэклоге накопились 4 P1 задачи: баг события жертвы, UX реликвий (замена, boss extraction), arenaRelic в PvP.
Sprint 4 закрывает все P1 и берёт 3 связанных P2 для целостности.

---

## Scope: 7 задач (4 P1 + 3 P2)

| ID | Приоритет | Тип | Название | Размер |
|----|-----------|-----|----------|--------|
| ne5 | P2 | TECH | Event вероятности → поле `proc_chance` в конфиге | S |
| 03b | P1 | BUG | Событие с жертвой предмета: chest гарантирован | S |
| ijf | P2 | BUG | statsText не обновляется при смене экипировки | XS |
| qnb | P1 | UX | UI выбора замены реликвии при max_relics=3 | M |
| n97 | P1 | UX | Boss — единый экран extraction + выбор arena relic | L |
| u1z | P2 | UX | Boss даёт 2 random items | S (в составе n97) |
| h24 | P1 | FEATURE | arenaRelic интеграция в PvP flow | L |

**Ожидаемый результат:** ~160 тестов (сейчас 142), 4 PR.

---

## Порядок выполнения

```
Фаза 1: ne5 + 03b + ijf  →  PR #8 (багфиксы + инфра)
Фаза 2: qnb              →  PR #9 (UI замены реликвий)
Фаза 3: n97 + u1z         →  PR #10 (boss extraction, зависит от qnb)
Фаза 4: h24              →  PR #11 (PvP arena MVP, зависит от n97)
```

---

## Фаза 1: ne5 + 03b + ijf — Багфиксы и инфра событий

### ne5 — Event вероятности в конфиг

**Проблема:** Вероятности парсятся regex из `description` (`/(\d+)%/`) — хрупко и неявно.

**Решение:**
1. `shared/src/types/BalanceConfig.ts` — добавить `proc_chance?: number` в `IEventVariant`
2. `config/balance.json` — добавить `proc_chance` к вариантам событий (fallback = 1.0)
3. Тесты: резолв proc_chance, fallback

### 03b — Баг: жертва предмета без сундука

**Корневая причина:** [PveMapScene.ts:498-499](client/src/scenes/PveMapScene.ts#L498-L499) — `rollSuccess` один раз на весь вариант. `lose_item` срабатывает всегда, а `loot_chest` рандомно.

**Решение:**
1. `shared/` — чистая функция `resolveEventOutcome(variant, rng)`: если вариант содержит `lose_item`, chest гарантирован
2. `PveMapScene.ts` — вызов shared-функции вместо inline логики
3. Тесты: lose_item + loot_chest = guaranteed; без lose_item = proc_chance; провал = нет chest

### ijf — statsText не обновляется

**Вероятная причина:** При возврате из InventoryScene в HubScene подписки EventBus неактивны или `updateDerivedHeroUi` не вызывается в `onEnter`.

**Решение:** Вызвать пересчёт stats в `HubScene.onEnter` при каждом входе.

**Критические файлы фазы 1:**
- [PveMapScene.ts](client/src/scenes/PveMapScene.ts) — inline event logic
- [BalanceConfig.ts](shared/src/types/BalanceConfig.ts) — IEventVariant
- [balance.json](config/balance.json) — event configs
- [HubScene.ts](client/src/scenes/HubScene.ts) — statsText refresh

---

## Фаза 2: qnb — UI замены реликвий

**Проблема:** При max_relics=3 автоматически заменяется последняя реликвия без выбора игрока. 4 дублирующих места: [PveMapScene.ts:363](client/src/scenes/PveMapScene.ts#L363), [PveMapScene.ts:660](client/src/scenes/PveMapScene.ts#L660), [BattleScene.ts:695](client/src/scenes/BattleScene.ts#L695), [BattleScene.ts:736](client/src/scenes/BattleScene.ts#L736).

**Решение:**
1. Единый helper `showRelicReplaceUI(newRelic, activeRelics, onReplace, onSkip)` — переиспользуемый UI-компонент
2. Экран: показать 3 текущих + 1 новую, тап для замены или "Отказаться"
3. Заменить все 4 точки вызова на единый helper
4. Тесты: replaceIndex boundaries, skip

**Критические файлы:**
- [PveMapScene.ts](client/src/scenes/PveMapScene.ts) — 2 точки
- [BattleScene.ts](client/src/scenes/BattleScene.ts) — 2 точки
- [RelicSystem.ts](shared/src/systems/RelicSystem.ts) — addRelic logic

---

## Фаза 3: n97 + u1z — Единый экран boss extraction

**Проблема:** Два отдельных шага: (1) выбор 1 из 3 boss relics, (2) extraction для арены. По GDD нужен один экран.

**Текущий flow в** [PveResultScene.ts](client/src/scenes/PveResultScene.ts): `buildBossRelicSection` → `buildExtractionSection` (двухшаговый).

**Новый flow:**
1. BattleScene генерирует 1 random boss relic (не пул из 3) + 2 random items (u1z)
2. PveResultScene: единый экран — показ boss loot (2 items) + список `[...activeRelics, bossRelic]` для выбора arena relic
3. Переиспользовать UI из qnb для отображения реликвий

**Критические файлы:**
- [PveResultScene.ts](client/src/scenes/PveResultScene.ts) — переписать flow
- [BattleScene.ts](client/src/scenes/BattleScene.ts) — данные для PveResultScene

---

## Фаза 4: h24 — arenaRelic в PvP (MVP)

**Проблема:** arenaRelic сохраняется через `GameState.saveArenaRelic()`, но не используется нигде в PvP.

**Scope MVP (не полноценный PvP matchmaking):**
1. **HubScene** — индикатор arenaRelic на кнопке "Арена"
2. **PvpLobbyScene** — расширить заглушку: показать arenaRelic, 3 AI-противника (mock из config), кнопка "Сразиться"
3. **shared/** — чистая функция `applyArenaRelicBonus(stats, relic)` для боевых бонусов
4. **BattleScene** — при `isPvp: true` применить arenaRelic бонусы
5. **GameState** — `consumeArenaRelic()` после PvP сессии
6. Тесты: applyArenaRelicBonus, consumeArenaRelic, PvP flow integration

**Критические файлы:**
- [PvpLobbyScene.ts](client/src/scenes/PvpLobbyScene.ts) — stub → MVP
- [HubScene.ts](client/src/scenes/HubScene.ts) — arena button badge
- [GameState.ts](client/src/core/GameState.ts) — consumeArenaRelic

---

## Риски

| Риск | Митигация |
|------|-----------|
| h24: PvP flow не определён полностью | MVP scope: AI-боты, один бой. Matchmaking → Sprint 5 |
| n97: Переписка PveResultScene ломает flow | 142 теста как safety net + новые тесты на extraction |
| qnb: 4 дублированных точки вызова | Единый helper, один паттерн |
| Регрессия PvE | Полный тест-сьют после каждой фазы |

---

## Verification

После каждой фазы:
```bash
npm run build && npm run test
```

После Sprint 4:
- Пройти PvE-поход до босса → проверить единый extraction screen
- Проверить событие с жертвой → chest гарантирован
- Проверить замену реликвий при max=3 → UI выбора
- Зайти в арену с arenaRelic → бонусы применены, relic потрачена
