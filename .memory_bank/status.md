# Статус проекта Big Heroes

**Обновлён:** 2026-04-09
**Фаза:** Sprint 3.1 — APPROVED, готов к merge
**last_checked_commit:** e52fd5c

---

## Текущее состояние

Sprint 3.1 (UX-коррекция Hub, PvE-поход, PreBattle) — APPROVED всеми ревьюерами. PR #6.
39 коммитов, 142 теста. 5 раундов ревью (Claude Opus + GPT-5.4 + Copilot).

**Ключевые изменения Sprint 3.1:**
- PvE-поход: граф Slay the Spire (всегда 1-3 варианта, 12 шагов)
- HubScene: полная переработка layout (v7), фон из арта, 5-tab BottomNav
- PreBattleScene: 3 команды (Атака/Аксессуар/Блок), expedition.massGained в бою
- ShopScene: только покупка (ремонт УБРАН — только в лагере)
- SanctuaryScene: настраиваемый title ("ВЫБОР РЕЛИКВИИ" для ancient_chest)
- CampScene/EventScene: экраны результата с «Продолжить»
- calcBaseWinChance: исправлена инверсия формулы (ttkHero вместо ttkEnemy)
- Чёткие шрифты: resolution = min(2, max(DPR, ceil(scaleFactor)))
- Реликвия reveal_all раскрывает скрытые пути
- GDD, архитектура, стайлгайд обновлены

## Дизайн-решения (НЕ откатывать)
- PvE = граф (Slay the Spire), нет линейной цепочки
- Нет промежуточного экрана "ВОЙТИ" после выбора на развилке
- ensureForkPaths смотрит на ТЕКУЩИЙ узел
- handleForkChoice записывает тип в currentIdx → enterNode напрямую
- Ремонт только в лагере, не в магазине
- Retreat: остаётся на текущем узле, ensureForkPaths перегенерирует

## Deferred issues (20 open)

| ID | Приоритет | Описание |
|----|-----------|----------|
| big-heroes-03b | P1 | событие с жертвой предмета не выдаёт гарантированный сундук |
| big-heroes-h24 | P1 | arenaRelic интеграция в PvP flow |
| big-heroes-n97 | P1 | босс — объединить выбор реликвии и extraction |
| big-heroes-qnb | P1 | UI выбора замены реликвии при max_relics=3 |
| big-heroes-3nc | P2 | сломанное снаряжение удаляется из инвентаря |
| big-heroes-dhi | P2 | client scene-level тесты для PvE flow |
| big-heroes-ijf | P2 | statsText не обновляется при смене экипировки |
| big-heroes-u1z | P2 | босс дарит две случайные вещи |
| big-heroes-24s | P2 | tierBoosted → реальный tier+1 |
| big-heroes-5yi | P2 | клиентский PvE seed — Date.now |
| big-heroes-7ix | P2 | вынести setHp() в shared |
| big-heroes-8y2 | P2 | Block Draw (ничья 15% в PvE) |
| big-heroes-ne5 | P2 | event вероятности → поле в конфиге |
| big-heroes-q6m | P2 | бизнес-логика PvE → shared (рефакторинг) |
| big-heroes-kuq | P3 | generateForkPaths дублирует generateRoute |
| big-heroes-a3h | P3 | Premium pill placeholder |
| big-heroes-1l7 | P3 | iconColor не используется |
| big-heroes-5sg | P3 | Layout хардкод |
| big-heroes-70l | P3 | Graphics утечки |
| big-heroes-y1o | P3 | applyBattleResult → RelicSystem |
