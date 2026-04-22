# Sprint 6 — PvP Arena Session + bug fixes + UX polish

**Статус:** утверждён и выполнен; PR #18 на финальном ревью
**Ветка:** `sprint-6-pvp-session-and-arena-ux`
**Review tier:** Standard (утверждено оператором) · Sprint Final обязателен
**Оценка:** 3.5 дня разработки + 1 день PR/review-цикл

---

## Context

После 4 подряд пайплайн-спринтов (v3.3 → v3.4 → v3.5) игровая часть не двигалась с Sprint 4 (февраль). Аудит шоу'д: код покрывает ~70% MVP scope, но **6 критических дыр** из `docs/design/high-concept.md` не закрыты: серия PvP-боёв до истощения, аренный сундук, Gems, главы/лиги, Dev-панель, экран выбора главы. Плюс 3 игровых P1-бага, живущие в Beads.

Оператор выбрал направление **PvP Arena Session + Arena UX cluster + P1 bug fixes** — закрывает самую заметную дыру MVP (без серии боёв арена выглядит как техдемо: один бой и вылет в Hub) и параллельно чистит accumulating UX-долг арены. Это первый спринт, после которого игрок увидит цельный контур «подготовка → серия → истощение → награда».

---

## Scope

### P1 FEATURE
- **big-heroes-tgr** — PvP-арена как поход: серия боёв до истощения массы / критической прочности / ручного завершения.

### P1 BUGS
- **big-heroes-e0o** — расходник из сундука не добавляется на пояс при свободных ячейках.
- **big-heroes-bfv** — расходники: разрешить на перекрёстке, запретить в бою.
- **big-heroes-tqh** — `generateRoute` / `generateForkPaths` — дубли типов узлов на одной развилке.

### P2 UX (Arena cluster)
- **big-heroes-91e** — экран поражения арены: нормальный показ потери массы.
- **big-heroes-bb0** — очки арены +1/+2/+3 на victory (функция delta Elo).
- **big-heroes-dy3** — контраст текста арена-реликвии (зелёный на голубом нечитаемый).
- **big-heroes-7r8** — убрать секцию добычи босса после выбора арена-реликвии.
- **big-heroes-00q** — слипшиеся кнопки «Арена» / «Домой» на экране победы босса.

---

## Декомпозиция

Один пункт = один коммит. Порядок — строго TDD: тесты раньше кода. Shared-изменения первыми.

### Phase A — Shared foundation (1 день)

**T1. Типы сессии PvP** — [shared/src/types/GameState.ts](shared/src/types/GameState.ts)
Добавить `IArenaSession { active, battlesPlayed, startMass, startRating, totalMassLost, totalRatingDelta }` + опциональное `arenaSession?` в `IGameState`. Поле опциональное — не ломает save-формат.

**T2. Конфиг сессии** — [config/balance.json](config/balance.json), [shared/src/types/BalanceConfig.ts](shared/src/types/BalanceConfig.ts)
Новый блок `pvp.session: { min_mass_threshold, critical_durability_percent, max_battles, points_thresholds }`. Additive-only; тип `IPvpSessionConfig`.

**T3. Чистые функции сессии** — [shared/src/systems/PvpSystem.ts](shared/src/systems/PvpSystem.ts) + [shared/src/systems/PvpSystem.test.ts](shared/src/systems/PvpSystem.test.ts)
Три pure-функции, никаких новых классов:
- `startSession(hero, config): IArenaSession`
- `shouldEndSession(hero, equipment, session, config): { ended, reason: 'mass'|'durability'|'maxBattles'|'manual'|null }`
- `applyBattleToSession(session, massDelta, ratingDelta): IArenaSession`
Переиспользует существующий `calcPvpMassLoss` ([shared/src/systems/PvpSystem.ts:45](shared/src/systems/PvpSystem.ts#L45)) и `calcEloChange` из [shared/src/formulas/FormulaEngine.ts](shared/src/formulas/FormulaEngine.ts).

**T4. Fix big-heroes-tqh** — [shared/src/systems/PveSystem.ts](shared/src/systems/PveSystem.ts) + тесты
Сейчас инлайновая логика fork-генерации в `generateRoute` дублирует standalone `generateForkPaths` и не защищена от дублей типов. Отрефакторить `generateRoute` на вызов `generateForkPaths`. Property-test: 500 сидов, инвариант «на одной развилке нет двух узлов одного non-combat типа».

**T5. `calcArenaPoints` (для big-heroes-bb0)** — [shared/src/systems/PvpSystem.ts](shared/src/systems/PvpSystem.ts)
Pure `calcArenaPoints(eloDelta: number, thresholds): 1 | 2 | 3`. Пороги — из `pvp.session.points_thresholds`. 6+ unit-кейсов включая границы.

### Phase B — Client integration (2 дня)

**T6. PvpLobbyScene session indicator** — [client/src/scenes/PvpLobbyScene.ts](client/src/scenes/PvpLobbyScene.ts)
Заголовок «Бой N / max», две pill'ы (потеря массы в сессии, дельта рейтинга), кнопка «Завершить сессию». При `shouldEndSession.ended === true` — блок кнопок боя + оверлей «Сессия завершена» с кнопкой «В Хаб». Переиспользовать [client/src/ui/ProgressBar](client/src/ui/) и `Button`.

**T7. BattleScene PvP post-battle routing** — [client/src/scenes/BattleScene.ts:879-887](client/src/scenes/BattleScene.ts#L879-L887)
Сейчас после PvP victory — всегда Hub. Новая логика:
- Вызвать `applyBattleToSession`.
- Если `shouldEndSession.ended === false` → `goto('pvp-lobby')` с обновлённым состоянием.
- Иначе → session-summary overlay → Hub.
- На victory overlay добавить «+N очков арены» через `calcArenaPoints` (закрывает **bb0**).
- Branch fallback: если `!arenaSession?.active` — текущее поведение (совместимость со смоук-тестами).

**T8. Defeat overlay UX (big-heroes-91e)** — [client/src/scenes/BattleScene.ts](client/src/scenes/BattleScene.ts) (`showPvpResultOverlay`)
Иконка массы, крупный `−N кг`, строка «было X → стало Y», мини-прогресс-бар до `min_mass_threshold` (чтобы игрок видел, сколько ещё может проиграть).

**T9. Fix big-heroes-e0o — сундук→пояс** — [client/src/scenes/SanctuaryScene.ts](client/src/scenes/SanctuaryScene.ts), [client/src/scenes/LootScene.ts](client/src/scenes/LootScene.ts)
При подборе consumable: если есть свободный belt-slot — на пояс, иначе рюкзак. Прежде чем вводить новый helper — проверить, нет ли уже логики размещения consumable в [client/src/scenes/LootScene.ts](client/src/scenes/LootScene.ts) или в соседних сценах; если есть — переиспользовать. **Не** создавать новую `InventorySystem` в shared (в shared её сейчас нет и такой абстракции не требуется).

**T10. Fix big-heroes-bfv — расходники: перекрёсток да, бой нет** — [client/src/scenes/PveMapScene.ts](client/src/scenes/PveMapScene.ts), [client/src/scenes/BattleScene.ts](client/src/scenes/BattleScene.ts)
- Перекрёсток: разрешить scout/hiking consumable (если сейчас заблокировано — снять).
- Бой: guard на клик по belt-slot — пропускать только `type: 'combat'`.

**T11. UX big-heroes-dy3 — контраст арена-реликвии**
Grep по `arenaRelic` в `client/src/`, найти карточку в PvpLobbyScene или соответствующем UI-компоненте. Цвет текста → WCAG AA ≥ 4.5:1.

**T12. UX big-heroes-7r8 — скрыть секцию добычи после выбора реликвии** — [client/src/scenes/PveResultScene.ts](client/src/scenes/PveResultScene.ts) (extraction-экран)
После `onSelect` реликвии — скрыть секцию «Добыча босса».

**T13. UX big-heroes-00q — gap между кнопками «Арена»/«Домой»** — тот же экран
Добавить horizontal spacing; проверить на узкой ширине.

### Phase C — Wire-up (0.5 дня)

**T14.** Инициализация `arenaSession` при входе в PvpLobby из Hub; очистка при выходе в Hub через summary-экран или кнопку «Завершить».
**T15.** `npm run build && npm run test` зелёный на каждом коммите (hook `/verify`).

---

## Verification Contract

| ID | Проверка | Где | Команда |
|----|----------|-----|---------|
| VC-1 | `shouldEndSession` срабатывает по 4 причинам (mass, durability, maxBattles, manual) + `null` на ok | `PvpSystem.test.ts` — 5+ кейсов | `npm run test -w shared` |
| VC-2 | `calcPvpMassLoss` сохраняет сигнатуру и поведение на существующих снапшотах | `PvpSystem.test.ts` — без изменений старых кейсов | `npm run test -w shared` |
| VC-3 | `generateRoute` не даёт дублей non-combat типов на одной развилке на 500 сидах | `PveSystem.test.ts` — property test | `npm run test -w shared` |
| VC-4 | `calcArenaPoints` возвращает {1,2,3}, монотонна, граничные кейсы | `PvpSystem.test.ts` — 6+ кейсов | `npm run test -w shared` |
| VC-5 | После PvP victory при активной сессии — переход в PvpLobby, не в Hub | Ручной QA (чек-лист в PR) + smoke-тест сцены | `npm run dev`, пройти 3 боя |
| VC-6 | Consumable из сундука идёт на пояс при свободном slot'е | Unit для helper + ручной QA | `npm run test -w client` |
| VC-7 | В бою нельзя активировать non-combat consumable (guard) | Unit на обработчик + ручной QA | Манипуляция в BattleScene |
| VC-8 | UX 91e/dy3/00q/7r8 — скриншоты до/после в PR-описании | Attachments block | Визуальный review |
| VC-9 | `config/balance.json` — добавлен блок `pvp.session`, плюс post-QA правки существующих полей `starterBelt` (F-1 MAJOR: arm_pot_t1 вместо torch_t1) и `pvp.bot_rating_spread` (dolt-48h: 50→300 для корректного calcArenaPoints). Контракт отражает фактический diff. | `git diff config/balance.json` | Reviewer проверяет diff на соответствие scope |

Все shared-тесты идут рядом с исходниками как `*.test.ts` (конвенция проекта, см. `shared/src/systems/*.test.ts`).

---

## Критические файлы

- [shared/src/systems/PvpSystem.ts](shared/src/systems/PvpSystem.ts) + [shared/src/systems/PvpSystem.test.ts](shared/src/systems/PvpSystem.test.ts)
- [shared/src/systems/PveSystem.ts](shared/src/systems/PveSystem.ts) + [shared/src/systems/PveSystem.test.ts](shared/src/systems/PveSystem.test.ts)
- [shared/src/types/GameState.ts](shared/src/types/GameState.ts)
- [shared/src/types/BalanceConfig.ts](shared/src/types/BalanceConfig.ts)
- [config/balance.json](config/balance.json)
- [client/src/scenes/BattleScene.ts](client/src/scenes/BattleScene.ts)
- [client/src/scenes/PvpLobbyScene.ts](client/src/scenes/PvpLobbyScene.ts)
- [client/src/scenes/PveMapScene.ts](client/src/scenes/PveMapScene.ts)
- [client/src/scenes/SanctuaryScene.ts](client/src/scenes/SanctuaryScene.ts)
- [client/src/scenes/LootScene.ts](client/src/scenes/LootScene.ts)
- [client/src/scenes/PveResultScene.ts](client/src/scenes/PveResultScene.ts)

---

## Реюз существующих функций (не создавать новое)

- `calcPvpMassLoss` — [shared/src/systems/PvpSystem.ts:45](shared/src/systems/PvpSystem.ts#L45)
- `generateBots` — [shared/src/systems/PvpSystem.ts:19](shared/src/systems/PvpSystem.ts#L19)
- `calcEloChange` — [shared/src/formulas/FormulaEngine.ts](shared/src/formulas/FormulaEngine.ts)
- `generateForkPaths` — [shared/src/systems/PveSystem.ts](shared/src/systems/PveSystem.ts) (T4 вызывает её из `generateRoute`)
- UI: `ProgressBar`, `Button`, `EquipmentCard` из [client/src/ui/](client/src/ui/)

---

## Риски

| Риск | Mitigation |
|------|------------|
| Reviewer апгрейдит Standard → Critical (shared + balance.json triggers) | VC-1..4 покрывают shared полностью → доп. проход Critical бюджетно выдержим. PM фиксирует «tier: Standard, approved by operator» в PR |
| Регрессия одиночного PvP (старый flow без сессии) | В BattleScene: `if (!arenaSession?.active) → старая ветка в Hub` |
| Рефактор `generateRoute` → `generateForkPaths` ломает существующие снапшоты маршрутов | Сначала написать тесты на инварианты (нет дублей, якоря на месте, ожидаемое число узлов), затем рефактор |
| Save-формат: новое опциональное `arenaSession` на существующих save-ах | `arenaSession ??= undefined` при load; тест кейса «save без поля → load не падает» |
| UX без Figma — сложно согласовать | Скриншоты до/после в PR-описании обязательны; контраст измеряется онлайн-чекером |

---

## Beads (tracking)

PM создаёт tracking-issue `big-heroes-sprint-6` (P1) с ссылками на:
- big-heroes-tgr (FEATURE)
- big-heroes-e0o, big-heroes-bfv, big-heroes-tqh (BUG)
- big-heroes-91e, big-heroes-bb0, big-heroes-dy3, big-heroes-7r8, big-heroes-00q (UX)

При merge — закрыть все включённые issues + tracking.

---

## Review-цикл

1. **Tester gate** (Critical-subset: для shared-формул T3/T4/T5) до Reviewer'а — поиск непокрытых edge-cases в `shouldEndSession`, `generateRoute` dedup, `calcArenaPoints`.
2. **Reviewer Standard** — 4 аспекта (архитектура, безопасность, качество, гигиена). Проверка Verification Contract обязательна.
3. **Sprint Final external review** через `/external-review` (Mode A GPT-5.4, если Windows-sandbox доступен; иначе Mode C на Claude adversarial).
4. **Copilot auto-review** — фиксировать до monotonic convergence.
5. **`/finalize-pr`** (hard gate, commit binding).

---

## End-to-end verification plan

1. `npm run build` — shared → client сборка зелёная.
2. `npm run test` — все тесты зелёные (shared + client).
3. `npm run dev` — ручной прогон:
   - Старт нового сохранения → Hub → Охота → бой → победа → возврат в PveMapScene.
   - Маршрут до босса → extraction реликвии → возврат в Hub (7r8 проверяется здесь).
   - Арена → выбор противника → victory → lobby с `2/10` индикатором (tgr/bb0).
   - Ещё 2 боя → defeat → overlay с потерей массы (91e).
   - Продолжить сессию до `min_mass_threshold` → session-end overlay.
   - Кликнуть «Завершить сессию» вручную → Hub.
4. Скриншоты всех изменённых экранов в PR.
5. `bd ready` — убедиться, что все включённые issues переведены в closed при merge.
