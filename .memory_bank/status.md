# Статус проекта Big Heroes

**Обновлён:** 2026-04-09
**Фаза:** Pipeline enhancement — MERGED (PR #7)
**last_checked_commit:** b6fe78d

---

## Текущее состояние

Скилл `/external-review` создан и смержен в master (PR #7).
Автоматизация Sprint Final (Фаза 3 sprint-pr-cycle) через Codex CLI.
14 коммитов, 6 раундов ревью ChatGPT-5.4, 13 раундов Copilot.

**Ключевые изменения:**
- Новый скилл `/external-review <PR_NUMBER>` — кросс-модельное ревью
- API key режим: GPT-5.4 + GPT-5.3-Codex (2 ревьюера по всем 4 аспектам)
- ChatGPT login режим: один проход дефолтной модели (ограничение CLI)
- Copilot re-review запрашивается автоматически после fix-циклов
- sprint-pr-cycle Фаза 3 → вызывает `/external-review`
- PIPELINE_ADR: решение 3.10 с обоснованием
- Синхронизация 8 pipeline-документов

**Ограничения:**
- Codex CLI rate limit на ChatGPT login — периодически блокирует
- `--base` нельзя комбинировать с кастомным промптом (ограничение CLI)
- Dry-run не выполнен из-за rate limit

## Дизайн-решения (НЕ откатывать)
- PvE = граф (Slay the Spire), нет линейной цепочки
- Нет промежуточного экрана "ВОЙТИ" после выбора на развилке
- ensureForkPaths смотрит на ТЕКУЩИЙ узел
- handleForkChoice записывает тип в currentIdx → enterNode напрямую
- Ремонт только в лагере, не в магазине
- Retreat: остаётся на текущем узле, ensureForkPaths перегенерирует

## Deferred issues (20 open + 6 in_progress от старых спринтов)

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
