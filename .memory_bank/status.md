# Статус проекта Big Heroes

**Обновлён:** 2026-04-06
**Фаза:** Sprint 2 — завершён, PR #4 на ревью (Copilot + GPT-5.4 + GPT-5.3-Codex)
**last_checked_commit:** 86b8d44

---

## Текущее состояние

Sprint 2 (Новая модель данных + боевая система v5) завершён. PR #4 ожидает ревью.

**Ключевые изменения Sprint 2:**
- Модель данных полностью переписана под GDD v1.2: HP=масса, strength=mass/3+bonus, durability 3
- FormulaEngine: 13 чистых функций в shared/ (TTK, 6 command chances, Elo, hitAnim)
- BattleSystem: resolveBattle() — чистая функция контекст→результат
- PreBattleScene: matchup, belt, 6 команд с цветовой индикацией шанса
- BattleScene: автобой 2–3 сек (shake, float damage, баннеры)
- HubScene: фоновая картинка cover-fit + ПОХОД→PreBattle
- DurabilityPips ●●○, EquipmentCard с бонусами
- balance.json v1.2: 9 предметов, 10 расходников, 7 мобов, 6 реликвий
- 45 unit-тестов FormulaEngine — все проходят

## AI-пайплайн

- 5 ролей: PM, Architect, Developer, Reviewer, Tester
- 4 аспекта ревью: Архитектура, Безопасность, Качество, Гигиена кода
- Sprint Final: GPT-5.4 + GPT-5.3-Codex (запущен для PR #4)

## Ближайшие задачи

- [ ] Ревью PR #4 (Copilot + GPT-5.4 + GPT-5.3-Codex) — ожидаем
- [ ] Исправления по ревью → merge PR #4
- [ ] Sprint 3 — PvE-поход (случайная генерация маршрута)

## Ветки

| Ветка | Статус |
|-------|--------|
| master | Sprint 1 merged + Pipeline Audit merged |
| sprint/2-data-model-battle-v5 | PR #4, ожидает ревью |

## История изменений

- 2026-04-02 — Sprint 0: среда, Beads, docs/, Memory Bank, GDD
- 2026-04-03 — Sprint 1: SceneManager + HubScene (22 файла, 2700+ строк)
- 2026-04-05 — Pipeline Audit: ревизия AI-пайплайна
- 2026-04-06 — Sprint 2: модель данных v1.2 + боевая система (24 файла, ~3000 строк, 45 тестов)
