# Статус проекта Big Heroes

**Обновлён:** 2026-04-06
**Фаза:** Sprint 2 — завершён, PR #4 APPROVED, ожидает merge
**last_checked_commit:** 8ea9873

---

## Текущее состояние

Sprint 2 (Новая модель данных + боевая система v5) завершён. PR #4 APPROVED всеми ревьюерами.

**Ключевые изменения Sprint 2:**
- Модель данных полностью переписана под GDD v1.2: HP=масса (50 кг старт, cap 125), strength=mass/3+bonus, durability 3
- FormulaEngine: 14 чистых функций в shared/ (TTK, 6 command chances, Elo, hitAnim, applyConsumableEffect)
- BattleSystem: resolveBattle() — чистая функция, 6 команд, fallback retreat/bypass, boss restrict, enemy initiative
- PreBattleScene: matchup, belt, 6 команд с цветовой индикацией шанса, пересчёт при выборе расходника
- BattleScene: автобой 2–3 сек (shake, float damage, баннеры)
- HubScene: фоновая картинка cover-fit + ПОХОД→PreBattle
- DurabilityPips ●●○, EquipmentCard с бонусами +Str/+Arm/+Luck
- balance.json v1.2: 9 предметов, 10 расходников, 7 мобов, 6 реликвий, starter belt/backpack
- 67 unit-тестов (44 FormulaEngine + 23 BattleSystem)

## Ревью Sprint 2

- 3 раунда, 5 ревьюеров (Copilot, GPT-5.4, GPT-5.3-Codex, Claude Opus ×2)
- 11 CRITICAL найдено → все исправлены
- ~20 WARNING → ~17 исправлены, 3 deferred
- GPT-5.4: APPROVED
- GPT-5.3-Codex: APPROVED

## Deferred issues

| ID | Приоритет | Описание |
|----|-----------|----------|
| big-heroes-7ix | P2 | setHp() бизнес-логика → shared/ |
| big-heroes-ao3 | P3 | Дублирование в SceneManager/заглушках |
| big-heroes-8y2 | P2 | Block Draw (ничья 15% PvE) → Sprint 3 |
| big-heroes-5sg | P3 | Layout хардкод в BattleScene/PreBattleScene |
| big-heroes-70l | P3 | Graphics утечки в belt/command highlight |

## Ближайшие задачи

- [ ] Merge PR #4 → master (оператор)
- [ ] Sprint 3 — PvE-поход (случайная генерация маршрута)

## Ветки

| Ветка | Статус |
|-------|--------|
| master | Sprint 1 + Pipeline Audit |
| sprint/2-data-model-battle-v5 | PR #4, APPROVED, ожидает merge |

## История изменений

- 2026-04-02 — Sprint 0: среда, Beads, docs/, Memory Bank, GDD
- 2026-04-03 — Sprint 1: SceneManager + HubScene (22 файла, 2700+ строк)
- 2026-04-05 — Pipeline Audit: ревизия AI-пайплайна
- 2026-04-06 — Sprint 2: модель v1.2 + боевая система (30 файлов, ~3500 строк, 67 тестов, 3 раунда ревью)
