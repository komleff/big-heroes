# Статус проекта Big Heroes

**Обновлён:** 2026-04-10
**Фаза:** Sprint 4 — Relic UX + PvP Arena MVP — PR #8 (ожидает merge)
**last_checked_commit:** 2aa6d2a

---

## Текущее состояние

Sprint 4 реализован, PR #8 открыт. 20+ коммитов, 168 тестов.
Ревью: 3 pass Claude (APPROVED), 9 pass Copilot, 5 pass GPT-5.4.
9 CRITICAL + 13 WARNING найдено и исправлено.

**Реализовано в Sprint 4:**
- EventSystem (shared): resolveEventOutcome + proc_chance — баг жертвы предмета исправлен
- RelicReplaceOverlay + addRelicWithUI — UI замены реликвий при max=3
- PveResultScene: единый экран boss extraction (1 relic + 2 items)
- PvP Arena MVP: PvpLobbyScene, 3 AI-бота, arenaRelic бонусы, Elo рейтинг
- PvpSystem (shared): generateBots + calcPvpMassLoss
- Авто-экипировка лута (autoEquipIfBetter)
- Сломанное снаряжение удаляется из слота (R9)
- UX: предупреждение о поломке, PvP defeat оверлей, параметры героя в лобби
- R9-R12 задокументированы в architecture.md

**Закрытые issues Sprint 4:**
- big-heroes-03b (P1 BUG) — событие жертвы → гарантированный сундук
- big-heroes-ne5 (P2 TECH) — proc_chance в конфиге
- big-heroes-qnb (P1 UX) — UI замены реликвий
- big-heroes-n97 (P1 UX) — единый экран boss extraction
- big-heroes-u1z (P2 UX) — boss даёт 2 items
- big-heroes-h24 (P1 FEATURE) — arenaRelic в PvP
- big-heroes-ijf (P2 BUG) — уже исправлен
- big-heroes-3nc (P1 FEATURE) — сломанное снаряжение удаляется
- big-heroes-5gd (P1 FIX) — PvP mass loss только при defeat
- big-heroes-5jk (P1 FIX) — bypass в PvE не застревает

## Дизайн-решения (НЕ откатывать)

- PvE = граф (Slay the Spire), нет линейной цепочки
- Нет промежуточного экрана "ВОЙТИ" после выбора на развилке
- ensureForkPaths смотрит на ТЕКУЩИЙ узел
- handleForkChoice записывает тип в currentIdx → enterNode напрямую
- Ремонт только в лагере, не в магазине
- Retreat: остаётся на текущем узле, ensureForkPaths перегенерирует
- **R9:** Сломанное снаряжение удаляется из слота (durability=0 → null)
- **R10:** Авто-экипировка лута (пустой слот или лучше; старый в походный рюкзак, теряется при defeat)
- **R11:** PvP Elo только victory/defeat, остальное = 0
- **R12:** Bypass PvE без лута (только продвижение)

## Открытые issues (26)

### P1 (5):
| ID | Описание |
|----|----------|
| big-heroes-tgr | PvP-арена как поход — серия боёв до лиги или поражения |
| big-heroes-tqh | generateRoute — дубли типов на развилках |
| big-heroes-bfv | походные расходники — на перекрёстке да, в бою нет |
| big-heroes-z3l | DOCS: PM_ROLE.md — нет Sprint Final gate |
| big-heroes-6bs | DOCS: PM_ROLE.md — конфликт владения review-pass |

### P2 (15):
| ID | Описание |
|----|----------|
| big-heroes-91e | UX: экран поражения Арены — показать потерю массы |
| big-heroes-bb0 | UX: очки арены (+1/+2/+3) после победы |
| big-heroes-2lw | UX: событие обмена — показать какой предмет |
| big-heroes-cwp | UX: лагерь — «нет снаряжения» вместо «всё в порядке» |
| big-heroes-o2v | UX: реликвия reveal_all — зачёркнутый ??? + название |
| big-heroes-d56 | chest рядом с ancient_chest |
| big-heroes-e0n | DOCS: sprint-pr-cycle Critical review level |
| big-heroes-fkv | DOCS: HOW_TO_USE split source of truth |
| big-heroes-24s | tierBoosted → реальный tier+1 |
| big-heroes-5yi | PvE seed — Date.now |
| big-heroes-7ix | setHp() → shared |
| big-heroes-8y2 | Block Draw (ничья 15%) |
| big-heroes-dhi | client scene-level тесты |
| big-heroes-q6m | бизнес-логика PvE → shared |
| big-heroes-4l2 | dry-run external-review |

### P3 (6):
| ID | Описание |
|----|----------|
| big-heroes-1l7 | iconColor не используется |
| big-heroes-5sg | Layout хардкод |
| big-heroes-70l | Graphics утечки |
| big-heroes-a3h | Premium pill placeholder |
| big-heroes-kuq | generateForkPaths дублирует generateRoute |
| big-heroes-y1o | applyBattleResult → RelicSystem |
