# PM-ревью плана zesty-lemon + операционный чек-лист

**Роль:** PM (Claude Opus 4.7)
**Дата:** 2026-04-22
**Базовый план:** [docs/archive/sprint-post-6-gdd-v1.3-agent-roles-v2.1-zesty-lemon.md](../archive/sprint-post-6-gdd-v1.3-agent-roles-v2.1-zesty-lemon.md)

---

## Контекст

После merge PR #18 (Sprint 6: PvP Arena Session, `5e3106f`) накопились расхождения между документацией и кодом. Pipeline audit от 2026-04-22 рекомендовал обновить AGENT_ROLES.md до v2.1. Оператор попросил PM провести ревью плана zesty-lemon и, после согласования, приступить к его выполнению.

### Четыре цели (уточнение оператора)

1. **Обновление документации по игре** — GDD v1.2 → v1.3 (sync со Sprint 6: 04_pvp, 06_inventory, 00_index).
2. **Обновление документации по пайплайну** — AGENT_ROLES.md v2.0 → v2.1 (Sprint Pipeline v3.4 pre-merge landing, v3.6 Node.js native external review).
3. **Подготовка патч-ноутс** — release notes для v0.2.0 (формируются в `gh release create --notes`).
4. **Новый релиз на GitHub** — аннотированный тег `v0.2.0` на master + GitHub Release.

Цели 1–2 → единый doc-PR. Цель 3 → текст release notes (готовится до merge). Цель 4 → выполняется PM после merge оператором.

Цель PM-ревью — убедиться, что все конкретные цифры, сигнатуры функций и пути в плане соответствуют фактическому коду на HEAD, и что операционные шаги реально исполнимы на текущем состоянии репозитория.

---

## PM-вердикт: APPROVED (с 4 малыми корректировками)

### Подтверждения фактов (снимок 2026-04-22)

| Утверждение плана | Факт на HEAD | Статус |
|--------------------|--------------|--------|
| `config/balance.json: opponent_count=3`, `bot_rating_spread=300` | Подтверждено | ✅ |
| `critical_durability_percent=0.25`, `max_battles=10` | Подтверждено | ✅ |
| `starterBelt: [arm_pot_t1, str_pot_t1]` | Подтверждено (строка 84) | ✅ |
| `calcArenaPoints`: пороги 10/25, нестрогое `≤` | [shared/src/systems/PvpSystem.ts:180-184](../../shared/src/systems/PvpSystem.ts#L180-L184), thresholds `small:10 medium:25` | ✅ |
| `startSession / shouldEndSession / applyBattleToSession` в PvpSystem.ts | Подтверждено, покрыты 22 тестами | ✅ |
| `findFreeBeltSlotIndex` в LootSystem.ts, экспортирован | [shared/src/systems/LootSystem.ts:179-183](../../shared/src/systems/LootSystem.ts#L179-L183), 4 теста | ✅ |
| `IArenaSession` в GameState.ts | [shared/src/types/GameState.ts:37-44](../../shared/src/types/GameState.ts#L37-L44) | ✅ |
| GDD текущая версия 1.2 от 2026-04-05 | Подтверждено (`docs/gdd/00_index.md:155`) | ✅ |
| AGENT_ROLES.md текущая версия 2.0 от 2026-04-13 | Подтверждено | ✅ |
| PM_ROLE.md §2.5 "Landing the Plane" (ссылка в правке 3) | Существует (строка 153) | ✅ |
| `.claude/tools/openai-review.mjs` (ссылка в правке 2) | Существует | ✅ |

### Корректировки к плану zesty-lemon

**C1 (NIT):** Шаг `[1] git checkout -b docs/gdd-v1.3-agent-roles-v2.1` излишен — ветка уже создана и активна. Пропускаем.

**C2 (NIT):** В плане дата AGENT_ROLES v2.1 указана как `2026-04-20`. Поскольку изменения публикуются 2026-04-22 и pipeline audit датирован 2026-04-22 — использовать `**Дата:** 2026-04-22`.

**C3 (LOW):** Файл плана [`docs/archive/sprint-post-6-gdd-v1.3-agent-roles-v2.1-zesty-lemon.md`](../archive/sprint-post-6-gdd-v1.3-agent-roles-v2.1-zesty-lemon.md) (ранее в `docs/plans/`) и этот файл (`cheerful-fairy.md`) untracked. По правилу `universal.md` ("не удалять AI-артефакты без запроса") — включаем оба в коммит PR. Superseded-план перемещён в `docs/archive/` досрочно (iter 3 external review: чтобы не хранить дубль в активной зоне).

**C4 (INFO):** Изменение 1 в 04_pvp.md для строки `bot_rating_range` — переформулировать как `"рейтинг_игрока ± bot_rating_spread (spread=300)"` вместо «три бота с шагом 300», поскольку код генерации может варьировать реализацию распределения, а `spread` — это параметр конфига, который однозначен. Множители массы `[0.8, 1.0, 1.2]` оставляем как в плане (это факт `bot_mass_multipliers`).

---

## Операционный чек-лист

### Фаза 1 — Doc-only PR (выполнимо автономно)

1. Отредактировать 4 файла согласно плану zesty-lemon (с корректировками C2, C4):
   - [docs/gdd/00_index.md](../gdd/00_index.md) — версия, дата, changelog
   - [docs/gdd/04_pvp.md](../gdd/04_pvp.md) — 3 изменения (opponent_count/bots, условия завершения, calcArenaPoints)
   - [docs/gdd/06_inventory.md](../gdd/06_inventory.md) — авторазмещение + starterBelt
   - [.agents/AGENT_ROLES.md](../../.agents/AGENT_ROLES.md) — v2.1, Sprint Final tier, pre-merge landing
2. `npm run build && npm run test` — убедиться что 213 тестов зелёные (smoke, хотя doc-only — поведение не меняется).
3. `git add` (явные пути, не `-A`) + коммит: `docs: GDD v1.2→v1.3 (Sprint 6 sync) + AGENT_ROLES v2.0→v2.1`
4. `git push -u origin docs/gdd-v1.3-agent-roles-v2.1`
5. `gh pr create --title "docs: GDD v1.3 + AGENT_ROLES v2.1 — Sprint 6 sync"` с телом из zesty-lemon.
6. Запустить Reviewer-субагента (Light tier, 2 аспекта: Архитектура + Гигиена кода).
7. PM консолидирует findings и публикует единый комментарий в PR через `gh pr comment` с привязкой к commit hash и подписью `— PM (Claude Opus 4.7)`.
8. По APPROVED — рапорт оператору, landing-артефакты (inline в ветке), `/finalize-pr`.

### Фаза 2 — Патч-ноутс и v0.2.0 Release

Release notes готовятся **до merge** (черновик в плане zesty-lemon, строки 184-226), чтобы после merge выполнение было одним шагом.

После merge PR #18-docs оператором в master:

1. `git fetch origin && git checkout master && git pull origin master`
2. Sanity check: `git log --oneline -3` — подтверждение что merge-commit присутствует.
3. **Точка подтверждения оператором** перед публикацией тега (тег и release — публичные и необратимые).
4. `git tag -a v0.2.0 -m "Sprint 6: PvP Arena Session"`
5. `git push origin v0.2.0`
6. `gh release create v0.2.0 --title "v0.2.0 — PvP Arena Session" --notes "..."` (notes = патч-ноутс из zesty-lemon с возможными правками после ревью).
7. Верификация: `gh release view v0.2.0`, `git tag --list | grep v0.2.0`.
8. Отчёт оператору со ссылкой на релиз.

---

## Файлы для изменения

| Файл | Операция |
|------|----------|
| [docs/gdd/00_index.md](../gdd/00_index.md) | Edit (версия/дата/changelog) |
| [docs/gdd/04_pvp.md](../gdd/04_pvp.md) | Edit (3 таблицы) |
| [docs/gdd/06_inventory.md](../gdd/06_inventory.md) | Edit (раздел «Пояс») |
| [.agents/AGENT_ROLES.md](../../.agents/AGENT_ROLES.md) | Edit (3 правки) |
| [docs/archive/sprint-post-6-gdd-v1.3-agent-roles-v2.1-zesty-lemon.md](../archive/sprint-post-6-gdd-v1.3-agent-roles-v2.1-zesty-lemon.md) | Add → в коммит; затем перемещён в `docs/archive/` (iter 3) |
| [docs/plans/pm-agents-agent-roles-md-cheerful-fairy.md](pm-agents-agent-roles-md-cheerful-fairy.md) | Add (этот файл → в коммит) |

---

## Верификация

- До и после: `npm run build && npm run test` (ожидаем ΔТ=0, doc-only).
- `git diff --stat master` — только .md-файлы, никакого кода.
- PR: Light tier review, 2 аспекта (Архитектура + Гигиена кода).
- После merge: `gh release view v0.2.0` — tag и notes (фаза 2, с оператором).
- Проверка финальная: `git log master --oneline -3` показывает merge PR; `git tag --list` содержит `v0.2.0` (после фазы 2).
