# Статус проекта Big Heroes

**Обновлён:** 2026-04-05
**Фаза:** Sprint 1 — завершён и смержен; Pipeline Audit — APPROVED, готов к merge
**last_checked_commit:** f633d08

---

## Текущее состояние

Sprint 1 (SceneManager + HubScene) завершён. PR #2 смержен в master.

Pipeline Audit (PR #3, ветка `review/pipeline-audit`) — APPROVED после 11 раундов ревью.
Изменения: дедупликация инструкций, 4 аспекта ревью (было 3), main→master, hard gate на публикацию отчётов, comment-only правило, унификация нейминга моделей, bd sync удалён, doc-only исключение для тестов.

- `shared/` — типы: IGameState, IEquipmentItem, IBalanceConfig, IStarterEquipmentConfigItem
- `client/src/core/` — EventBus, GameState, SceneManager (5 типов переходов, viewport 390×844)
- `client/src/ui/` — Button (3 варианта), ResourceBar, ProgressBar, EquipmentCard, HeroPortrait, BottomNav
- `client/src/scenes/` — BaseScene, HubScene, 4 заглушки (PveMap, PvpLobby, Inventory, DevPanel)
- `client/src/config/ThemeConfig.ts` — полная таблица токенов из style-guide.md
- `config/balance.json` — стартовые параметры героя, ресурсов, экипировки
- Nunito font подключён, webpack alias @config настроен

## AI-пайплайн (после Pipeline Audit)

- 5 ролей: PM, Architect, Developer, Reviewer, Tester
- 4 аспекта ревью: Архитектура, Безопасность, Качество, Гигиена кода
- 4 уровня ревью: Light, Standard, Critical, Sprint Final
- Hard gate: push + report (if PR exists) = обязательное условие завершения сессии
- Внешние модели: GPT-5.4 + GPT-5.3-Codex (Sprint Final)
- Comment-only: все агенты используют `gh pr comment`, не `gh pr review`

## Ревью

- Наше ревью (архитектура/качество/безопасность): 1 CRITICAL + 5 WARNING → все исправлены
- GitHub Copilot (8 inline): типизация, UX, promise safety → все исправлены
- Deferred: setHp() бизнес-логика → shared/ (FormulaEngine), дублирование кода (рефакторинг)

## Ближайшие задачи

- [ ] Merge PR #3 (Pipeline Audit) — оператор
- [ ] Sprint 2 — BattleSystem + BattleScene (пошаговый бой)

## Ветки

| Ветка | Статус |
|-------|--------|
| master | Sprint 1 merged |
| review/pipeline-audit | PR #3, APPROVED, ожидает merge |

## История изменений

- 2026-04-02 — Sprint 0: среда, Beads, docs/, Memory Bank, GDD (13 файлов)
- 2026-04-03 — Sprint 1: SceneManager + HubScene (22 новых файла, 2700+ строк)
- 2026-04-05 — Pipeline Audit: ревизия AI-пайплайна (14 файлов, 11 раундов ревью)
