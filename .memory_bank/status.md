# Статус проекта Big Heroes

**Обновлён:** 2026-04-08
**Фаза:** Sprint 3.1 — APPROVED, готов к merge
**last_checked_commit:** daf0c1c

---

## Текущее состояние

Sprint 3.1 (UX-коррекция Hub, PvE-поход, PreBattle) — APPROVED. PR #6. 8 раундов ревью (Claude Opus + Sonnet + GPT-5.4 + GPT-5.3-Codex + Copilot). 9 CRITICAL + 13 WARNING исправлено. Ожидает merge оператором.

**Ключевые изменения Sprint 3.1:**
- HubScene: полная переработка layout (v7), currency pills, league bar из balance.json
- PveMapScene: fork-логика исправлена (isFork-гейт, двойной сдвиг устранён)
- ShopScene: восстановлен repair flow (кнопка ремонта + calcShopRepairCost)
- PreBattleScene: 3 команды (Атака/Аксессуар/Блок), сломанный аксессуар показывается корректно
- GradientBackground: единый PvE-фон для 8 сцен
- CampScene/EventScene: экраны результата с «Продолжить»
- Безопасность: webpack allowedHosts fix, CI actions pinned to SHA, publicPath через argv.mode
- getLeagueConfig → shared/FormulaEngine (бизнес-логика из клиента)
- balance.json: repair_gold_per_durability, leagues config
- 141 тестов (+5 новых: getLeagueConfig граничные значения)

## Deferred issues (13 open)

| ID | Приоритет | Описание |
|----|-----------|----------|
| big-heroes-h24 | P1 | arenaRelic интеграция в PvP flow |
| big-heroes-qnb | P1 | UI выбора замены реликвии при max_relics=3 |
| big-heroes-03b | P2 | Событие с жертвой предмета не выдаёт гарантированный сундук |
| big-heroes-rzr | P2 | Новый PvE-поход стартует с нулевой массой и нулевым золотом |
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

- [ ] Merge PR #5 → master (Sprint 3)
- [ ] Merge PR #6 → master (Sprint 3.1)
- [ ] Sprint 4 планирование

## Ветки

| Ветка | Статус |
|-------|--------|
| master | Sprint 1 + Pipeline Audit |
| sprint/2-data-model-battle-v5 | PR #4, APPROVED, ожидает merge |
| sprint/3-pve-expedition | PR #5, APPROVED, ожидает merge |
| sprint/3.1-ux-corrections | PR #6, APPROVED, ожидает merge |

## История изменений

- 2026-04-02 — Sprint 0: среда, Beads, docs/, Memory Bank, GDD
- 2026-04-03 — Sprint 1: SceneManager + HubScene (22 файла, 2700+ строк)
- 2026-04-05 — Pipeline Audit: ревизия AI-пайплайна
- 2026-04-06 — Sprint 2: модель v1.2 + боевая система (30 файлов, ~3500 строк, 67 тестов)
- 2026-04-07 — Sprint 3: PvE-поход (37 файлов, ~5500 строк, 129 тестов, 15 раундов ревью)
- 2026-04-08 — Sprint 3.1: UX-коррекция (28 файлов, +1719/−656, 141 тестов, 8 раундов ревью)
