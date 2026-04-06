# Статус проекта Big Heroes

**Обновлён:** 2026-04-07
**Фаза:** Sprint 3 — APPROVED, готов к merge
**last_checked_commit:** 698e7c6

---

## Текущее состояние

Sprint 3 (PvE-поход со случайной генерацией маршрута) — APPROVED. PR #5. 15 раундов ревью (Claude + GPT-5.4 + GPT-5.3-Codex + Copilot). 22+ CRITICAL исправлено. Ожидает merge оператором.

**Ключевые изменения Sprint 3:**
- Random (mulberry32 PRNG): createRng, randInt, randPick, shuffle, weightedPick
- PveSystem: generateRoute (якоря + заполнение + валидация ограничений), createExpeditionState, advanceToNode, applyBattleResult, exitExpedition
- RelicSystem: generateRelicPool, selectRelic, configToRelic, множители
- LootSystem: generateLoot (pity-система), generateShopInventory, calcShopRepairCost
- balance.json: секция pve, 19 реликвий с rarity, 6 событий с вариантами
- 6 новых сцен: SanctuaryScene, LootScene, ShopScene, CampScene, EventScene, PveResultScene
- PveMapScene: полная перезапись — навигация похода, развилки, node actions
- BattleScene: интеграция с экспедицией (retreat→fork, loot, boss relic)
- PveResultScene: boss relic выбор + arena extraction
- GameState: expedition state, arenaRelic, collectedItemIds
- 129 тестов (67 Sprint 2 + 62 новых)

## Deferred issues (11 open)

| ID | Приоритет | Описание |
|----|-----------|----------|
| big-heroes-h24 | P1 | arenaRelic интеграция в PvP flow |
| big-heroes-qnb | P1 | UI выбора замены реликвии при max_relics=3 |
| big-heroes-24s | P2 | tierBoosted → реальный tier+1 в LootSystem |
| big-heroes-5yi | P2 | Клиентский seed (Date.now → expedition seed) |
| big-heroes-7ix | P2 | setHp() бизнес-логика → shared/ |
| big-heroes-8y2 | P2 | Block Draw (ничья 15% в PvE) |
| big-heroes-ne5 | P2 | Event вероятности → поле в конфиге |
| big-heroes-q6m | P2 | Бизнес-логика PvE → shared/ (рефакторинг) |
| big-heroes-5sg | P3 | Layout хардкод в BattleScene/PreBattleScene |
| big-heroes-70l | P3 | Graphics утечки в belt/command highlight |
| big-heroes-y1o | P3 | applyBattleResult → RelicSystem функции |

## Ближайшие задачи

- [ ] Merge PR #5 → master (оператор)
- [ ] Sprint 4 планирование

## Ветки

| Ветка | Статус |
|-------|--------|
| master | Sprint 1 + Pipeline Audit |
| sprint/2-data-model-battle-v5 | PR #4, APPROVED, ожидает merge |
| sprint/3-pve-expedition | PR #5, APPROVED, ожидает merge |

## История изменений

- 2026-04-02 — Sprint 0: среда, Beads, docs/, Memory Bank, GDD
- 2026-04-03 — Sprint 1: SceneManager + HubScene (22 файла, 2700+ строк)
- 2026-04-05 — Pipeline Audit: ревизия AI-пайплайна
- 2026-04-06 — Sprint 2: модель v1.2 + боевая система (30 файлов, ~3500 строк, 67 тестов)
- 2026-04-07 — Sprint 3: PvE-поход (37 файлов, ~5500 строк, 129 тестов, 15 раундов ревью)
