# Статус проекта Big Heroes

**Обновлён:** 2026-04-06
**Фаза:** Sprint 3 — PvE-поход, реализация завершена, ожидает ревью
**last_checked_commit:** 6ef2ba5

---

## Текущее состояние

Sprint 3 (PvE-поход со случайной генерацией маршрута) — реализация завершена. Ветка `sprint/3-pve-expedition` запушена. Ожидает PR и ревью.

**Ключевые изменения Sprint 3:**
- Random (mulberry32 PRNG): createRng, randInt, randPick, shuffle, weightedPick
- PveSystem: generateRoute (якоря sanctuary/ancient_chest/boss + заполнение + валидация ограничений), createExpeditionState, advanceToNode, applyBattleResult, exitExpedition
- RelicSystem: generateRelicPool, selectRelic, configToRelic, множители массы/золота/скидки
- LootSystem: generateLoot (pity-система каждые 5 предметов), generateShopInventory, calcShopRepairCost
- Типы: PveNode (9 типов узлов), IPveRoute, IPveExpeditionState
- balance.json: секция pve (генерация 8-10 узлов, 3-4 развилки, веса типов, ограничения), 19 реликвий с rarity, 6 событий с вариантами
- 6 новых сцен: SanctuaryScene, LootScene, ShopScene, CampScene, EventScene, PveResultScene
- PveMapScene: полная перезапись (стаб → навигация похода с развилками)
- GameState: expedition state management
- HubScene: кнопка ПОХОД генерирует маршрут
- BattleScene: возврат на карту при экспедиции, поражение → итоги
- 129 тестов (67 Sprint 2 + 62 новых)

## Deferred issues

| ID | Приоритет | Описание |
|----|-----------|----------|
| big-heroes-7ix | P2 | setHp() бизнес-логика → shared/ |
| big-heroes-8y2 | P2 | Block Draw (ничья 15% PvE) — не решена |
| big-heroes-5sg | P3 | Layout хардкод в BattleScene/PreBattleScene |
| big-heroes-70l | P3 | Graphics утечки в belt/command highlight |

## Ближайшие задачи

- [ ] Создать PR для Sprint 3
- [ ] Ревью-цикл (Standard → Sprint Final)
- [ ] Merge PR #4 (Sprint 2) → master (оператор)

## Ветки

| Ветка | Статус |
|-------|--------|
| master | Sprint 1 + Pipeline Audit |
| sprint/2-data-model-battle-v5 | PR #4, APPROVED, ожидает merge |
| sprint/3-pve-expedition | Реализация завершена, ожидает PR |

## История изменений

- 2026-04-02 — Sprint 0: среда, Beads, docs/, Memory Bank, GDD
- 2026-04-03 — Sprint 1: SceneManager + HubScene (22 файла, 2700+ строк)
- 2026-04-05 — Pipeline Audit: ревизия AI-пайплайна
- 2026-04-06 — Sprint 2: модель v1.2 + боевая система (30 файлов, ~3500 строк, 67 тестов, 3 раунда ревью)
- 2026-04-06 — Sprint 3: PvE-поход (27 файлов, ~4100 строк, 129 тестов)
