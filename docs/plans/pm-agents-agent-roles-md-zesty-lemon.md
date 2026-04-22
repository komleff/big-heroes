# Планирование: GDD v1.3 + AGENT_ROLES v2.1 + Release v0.2.0

**Дата:** 2026-04-22  
**Спринт:** пост-Sprint 6  
**Тип:** doc-only PR + GitHub Release

---

## Контекст

Sprint 6 (PvP Arena Session) завершён, PR #18 смёрджен (HEAD master = `5e3106f`). За спринты 5–6 накопились расхождения между GDD v1.2 (последнее обновление 2026-04-05) и фактической реализацией. Параллельно: AGENT_ROLES.md v2.0 не отражает изменения Sprint Pipeline v3.4 (pre-merge landing) и v3.6 (Node.js native external review). Pipeline audit (2026-04-22) рекомендовал обновить AGENT_ROLES.md до v2.1.

**Цель:** подготовить документацию к релизу v0.2.0 — привести GDD и нормативы пайплайна в соответствие с реализацией, опубликовать GitHub Release.

---

## Задача 1: Doc-only PR — GDD v1.3 + AGENT_ROLES v2.1

### Ветка

```bash
git checkout -b docs/gdd-v1.3-agent-roles-v2.1
```

### Изменения по файлам

#### `docs/gdd/00_index.md`

1. Версия: `1.2` → `1.3`  
2. Дата: `2026-04-05` → `2026-04-22`  
3. Добавить строку в таблицу «История изменений»:

```markdown
| 1.3 | 2026-04-22 | Sprint 6 sync: 04_pvp — opponent_count 5→3, bot_rating_spread 300, условие завершения critical_durability_percent 0.25 + max_battles 10, calcArenaPoints через Elo-дельту. 06_inventory — авторазмещение лута на пояс, starterBelt. |
```

---

#### `docs/gdd/04_pvp.md` — 4 расхождения

**Изменение 1 — Количество ботов и распределение** (КРИТИЧЕСКОЕ):

Найти фрагмент с `opponent_count` (таблица параметров подбора ботов) и заменить:

| Параметр | Было | Стало |
|----------|------|-------|
| `opponent_count` | 5 | 3 |
| `bot_rating_range` | `рейтинг_игрока ± 200` | `рейтинг_игрока ± 300` (spread=300, три бота с шагом 300) |
| Распределение | «60% слабее / 25% равные / 15% сильнее» | «три бота с множителями массы [0.8, 1.0, 1.2]» |

Текстовое описание генерации ботов обновить аналогично.

**Изменение 2 — Условия завершения сессии** (ВЫСОКОЕ):

Найти таблицу «Условия завершения» и заменить строку:
```
Всё снаряжение сломано И игрок решил выйти | Добровольное
```
На две строки:
```
Суммарная прочность снаряжения < 25% от максимальной (critical_durability_percent: 0.25) | Принудительное (авто)
Достигнуто max_battles: 10 боёв за сессию | Принудительное (авто)
```

Добавить под таблицей пояснение:
> `critical_durability_percent: 0.25` — автозавершение при суммарной прочности ниже 25% от максимума по всем слотам снаряжения. Сессия завершается автоматически после текущего боя.

**Изменение 3 — calcArenaPoints: прогресс сундука** (СРЕДНЕЕ):

Найти таблицу прогресса сундука (секция «Аренный сундук», колонки «Победа +2-3 / Поражение +0-1») и заменить строки Победа/Поражение на:
```
Победа или поражение | calcArenaPoints(Elo-дельта): дельта ≤ 10 → +1 очко, дельта ≤ 25 → +2 очка, дельта > 25 → +3 очка
```

Добавить после таблицы:
> `calcArenaPoints` принимает абсолютное значение Elo-дельты боя. Победа и поражение дают очки по одной шкале.

---

#### `docs/gdd/06_inventory.md` — 2 расхождения

**Изменение 1 — Авторазмещение лута на пояс** (НИЗКОЕ, новая механика):

В раздел «Пояс» добавить новую подсекцию перед Edge cases:

```markdown
### Авторазмещение лута на пояс

При получении предмета из сундука или события:

| Условие | Результат |
|---------|-----------|
| Предмет — расходник + свободный слот пояса | Авторазмещение на пояс |
| Пояс заполнен или предмет не расходник | В рюкзак (обычный путь) |

Реализовано через `findFreeBeltSlotIndex`. Non-combat расходники (факел и т.п.) авторазмещаются, но не могут использоваться в PvP-боях.
```

**Изменение 2 — Стартовый состав пояса** (ИНФОРМАЦИОННОЕ):

В раздел «Пояс» добавить строку:
```
Стартовый состав пояса (starterBelt): [arm_pot_t1, str_pot_t1] — зелье брони и зелье силы уровня 1.
```

---

#### `.agents/AGENT_ROLES.md` — 3 правки

**Правка 1 — Шапка:**
- Строка `**Версия:** 2.0` → `**Версия:** 2.1`
- Строка `**Дата:** 2026-04-13` → `**Дата:** 2026-04-20`

**Правка 2 — Секция §3 Reviewer, строка Sprint Final в таблице тиров:**

Найти строку:
```
| **Sprint Final** | Конец спринта, перед merge в master | Добавляется к выбранному tier как отдельный gate. **Внешнее ревью через `/external-review` обязательно.** |
```

Заменить на:
```
| **Sprint Final** | Конец спринта, перед merge в master | Добавляется к выбранному tier как отдельный gate. **Внешнее ревью через `/external-review` обязательно.** С Sprint Pipeline v3.6 `/external-review` использует Node.js native script (`.claude/tools/openai-review.mjs`), не Codex CLI subprocess. Codex CLI — только legacy fallback. |
```

**Правка 3 — Секция §0 PM, подраздел «Финализация PR»:**

После строки `> Прямой комментарий «готово к merge» заблокирован hook-ом.` добавить:

```markdown
> **Pre-merge landing (v3.4):** landing-артефакты (Memory Bank, архивация плана, закрытие задач Beads) создаются inline в ветке PR до merge оператором. Отдельная ветка `chore/landing-pr-N` запрещена. Подробности: `.agents/PM_ROLE.md §2.5`.
```

---

### Коммит и PR

```bash
git add docs/gdd/00_index.md docs/gdd/04_pvp.md docs/gdd/06_inventory.md .agents/AGENT_ROLES.md
git commit -m "docs: GDD v1.2→v1.3 (Sprint 6 sync) + AGENT_ROLES v2.0→v2.1"
git push -u origin docs/gdd-v1.3-agent-roles-v2.1
```

```bash
BODY=$(cat <<'EOF'
Tier: Light

## Summary
- GDD v1.2 → v1.3: синхронизация с реализацией Sprint 6 (7 расхождений, 2 критических)
- AGENT_ROLES v2.0 → v2.1: Sprint Pipeline v3.6 (Node.js native), pre-merge landing v3.4

## Issues
Нет Beads issues (doc-only)

## Test plan
- [ ] /verify

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)
gh pr create --title "docs: GDD v1.3 + AGENT_ROLES v2.1 — Sprint 6 sync" --body "$BODY"
```

**Review tier:** Light (только `.md`, не hooks/SKILL.md/settings.json). Два аспекта: Архитектура + Гигиена кода.

---

## Задача 2: GitHub Release v0.2.0

**Выполняется после merge docs-PR**, чтобы тег указывал на master с актуальной документацией.

```bash
git fetch origin && git checkout master && git pull origin master
git log --oneline -3   # проверить что docs-PR смёрджен

# Создать аннотированный тег
git tag -a v0.2.0 -m "Sprint 6: PvP Arena Session"
git push origin v0.2.0
```

```bash
gh release create v0.2.0 \
  --title "v0.2.0 — PvP Arena Session" \
  --notes "$(cat <<'NOTES'
# Big Heroes v0.2.0 — PvP Arena Session

Sprint 6. PvP-арена переработана из одиночного боя в полноценную сессию с лобби, серией боёв и итогами.

## Новые возможности

### PvP-арена (сессия)
- `PvpSystem.ts`: `startSession`, `shouldEndSession`, `applyBattleToSession`, `calcArenaPoints`
- `IArenaSession` интерфейс в `GameState.ts`
- `PvpLobbyScene`: полный UX — лобби → бой → итоги → выход
- Условия завершения сессии: масса ниже порога, прочность < 25% (`critical_durability_percent`), `max_battles=10`, кнопка выхода

### Инвентарь / пояс
- `findFreeBeltSlotIndex`: авторазмещение расходников из лута в свободный слот пояса
- Non-combat расходники заблокированы в PvP-боях

### Маршрут (рефакторинг)
- `generateForkPaths`: централизован, перенесён из PvE-системы

## Исправленные баги

| Приоритет | Описание |
|-----------|----------|
| Critical | Non-combat расходники теряли с пояса при PvE defeat |
| Critical | Расходник из сундука не попадал на пояс при свободном слоте |
| High | Non-combat расходники доступны в PvP-боях — заблокировано |
| High | Дубли defeat/victory overlay в PvP-бою |
| High | `endArenaSession` — атомарно consume + clear (race condition) |
| Medium | `arenaRelic` consumed после серии, не каждого боя |

## Инфраструктура (Sprint Pipeline v3.6)

- `openai-review.mjs`: Node.js native script вместо Codex CLI subprocess (обход BE-11 на Windows)
- `npm ci --ignore-scripts`: supply-chain mitigation при external review

## Тесты

213 тестов (196 shared + 17 client). Все зелёные.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
NOTES
)"
```

---

## Полный порядок шагов

```
[1] git checkout -b docs/gdd-v1.3-agent-roles-v2.1
[2] Редактировать docs/gdd/00_index.md
[3] Редактировать docs/gdd/04_pvp.md
[4] Редактировать docs/gdd/06_inventory.md
[5] Редактировать .agents/AGENT_ROLES.md
[6] git commit + git push
[7] gh pr create (Light tier)
[8] Reviewer → APPROVED → оператор мержит
[9] git pull master (убедиться что смёрджен)
[10] git tag -a v0.2.0 -m "Sprint 6: PvP Arena Session" && git push origin v0.2.0
[11] gh release create v0.2.0 ...
```

---

## Верификация

- `npm run build && npm run test` — до и после (ожидаем: 0 изменений, только .md)
- PR review: Light tier, 2 аспекта
- После релиза: `gh release view v0.2.0` — проверить title и notes
- `git tag --list | grep v0.2.0` — проверить тег существует

---

## Файлы для изменения

| Файл | Тип изменения |
|------|--------------|
| [`docs/gdd/00_index.md`](docs/gdd/00_index.md) | Версия, дата, changelog entry |
| [`docs/gdd/04_pvp.md`](docs/gdd/04_pvp.md) | 4 расхождения (критические + высокие + средние) |
| [`docs/gdd/06_inventory.md`](docs/gdd/06_inventory.md) | 2 расхождения (авторазмещение, starterBelt) |
| [`.agents/AGENT_ROLES.md`](.agents/AGENT_ROLES.md) | Версия v2.1, Sprint Final tier, pre-merge landing |
