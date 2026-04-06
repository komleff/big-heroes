# Sprint 3: Промпты для внешнего ревью

## GPT-5.4 (Архитектура + Качество)

```
Ты Reviewer. Задача: проверь PR #5 в репозитории komleff/big-heroes.

Ветка: sprint/3-pve-expedition
Контекст: Sprint 3 — PvE-поход со случайной генерацией маршрута. 27 файлов, ~4100 строк, 129 тестов.

Фокус:
1. АРХИТЕКТУРА: разделение client/ (PixiJS UI) и shared/ (чистые функции, без side-effects). Бизнес-логика только в shared/.
2. КАЧЕСТВО: покрытие тестами, edge-cases, соответствие GDD (docs/gdd/02_pve.md, 13_boosters_relics.md).

Ключевые файлы:
- shared/src/systems/PveSystem.ts — генерация маршрута
- shared/src/systems/RelicSystem.ts — пул реликвий
- shared/src/systems/LootSystem.ts — лут + pity-система
- shared/src/utils/Random.ts — детерминированный PRNG
- client/src/scenes/PveMapScene.ts — навигация похода
- config/balance.json — секции pve, relics, events

Формат: вердикт APPROVED / CHANGES_REQUESTED по каждому аспекту с обоснованием. Уровни: CRITICAL / WARNING / INFO.
Подписать: — Reviewer (GPT-5.4)
```

## GPT-5.3-Codex (Безопасность + Тесты)

```
Ты Reviewer. Задача: проверь PR #5 в репозитории komleff/big-heroes.

Ветка: sprint/3-pve-expedition
Контекст: Sprint 3 — PvE-поход. Клиентское PixiJS-приложение (без сервера). 129 тестов.

Фокус:
1. БЕЗОПАСНОСТЬ: XSS, утечки, OWASP top-10, бесконечные циклы, prototype pollution.
2. ТЕСТЫ: покрытие shared/ (PveSystem, RelicSystem, LootSystem, Random), edge-cases, детерминизм.

Ключевые файлы:
- shared/src/systems/*.ts + *.test.ts
- shared/src/utils/Random.ts + Random.test.ts
- client/src/scenes/*.ts (новые: Sanctuary, Loot, Shop, Camp, Event, PveResult)

Формат: вердикт APPROVED / CHANGES_REQUESTED по каждому аспекту. Уровни: CRITICAL / WARNING / INFO.
Подписать: — Reviewer (GPT-5.3-Codex)
```
