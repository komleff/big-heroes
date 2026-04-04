# Статус проекта Big Heroes

**Обновлён:** 2026-04-03
**Фаза:** Sprint 1 — завершён, PR #2 ожидает merge
**last_checked_commit:** 84c403d

---

## Текущее состояние

Sprint 1 (SceneManager + HubScene) завершён. 2 раунда ревью пройдены.

- `shared/` — типы: IGameState, IEquipmentItem, IBalanceConfig, IStarterEquipmentConfigItem
- `client/src/core/` — EventBus, GameState, SceneManager (5 типов переходов, viewport 390×844)
- `client/src/ui/` — Button (3 варианта), ResourceBar, ProgressBar, EquipmentCard, HeroPortrait, BottomNav
- `client/src/scenes/` — BaseScene, HubScene, 4 заглушки (PveMap, PvpLobby, Inventory, DevPanel)
- `client/src/config/ThemeConfig.ts` — полная таблица токенов из style-guide.md
- `config/balance.json` — стартовые параметры героя, ресурсов, экипировки
- Nunito font подключён, webpack alias @config настроен

## Ревью

- Наше ревью (архитектура/качество/безопасность): 1 CRITICAL + 5 WARNING → все исправлены
- GitHub Copilot (8 inline): типизация, UX, promise safety → все исправлены
- Deferred: setHp() бизнес-логика → shared/ (FormulaEngine), дублирование кода (рефакторинг)

## Ближайшие задачи

- [ ] Merge PR #2 → master (оператор)
- [ ] Sprint 2 — BattleSystem + BattleScene (пошаговый бой)

## Ветки

| Ветка | Статус |
|-------|--------|
| master | Sprint 0 merged |
| sprint/1-scene-manager-hub | Sprint 1, PR #2 ожидает merge |

## История изменений

- 2026-04-02 — Sprint 0: среда, Beads, docs/, Memory Bank, GDD (13 файлов)
- 2026-04-03 — Sprint 1: SceneManager + HubScene (22 новых файла, 2700+ строк)
