# Big Heroes

Асинхронный hybrid RPG battler с PvE-походами и PvP-ареной. PixiJS v8 + TypeScript.

**Demo:** [komleff.github.io/big-heroes](https://komleff.github.io/big-heroes/)

## Концепция

Игрок ведёт героя через roguelike-поход с развилками, боями, событиями, лагерями и магазинами. Добывает массу, снаряжение и валюту. Затем проверяет силу подготовки на PvP-арене.

**Главный цикл:** PvE-поход &rarr; экипировка &rarr; PvP-арена &rarr; награды &rarr; новый поход.

## Быстрый старт

```bash
npm install
npm run dev
```

Откроется `http://localhost:5173/`. Для тестирования с телефона в локальной сети: `http://<ваш-IP>:5173/`.

## Команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Сервер разработки (client) |
| `npm run build` | Полная сборка (shared &rarr; client) |
| `npm run test` | Тесты (shared) |

## Структура проекта

```
big-heroes/
  client/          PixiJS-клиент (сцены, UI, ассеты)
  shared/          Игровая математика и типы (чистые функции)
  config/          balance.json — параметры баланса
  docs/
    gdd/           Game Design Document (13 файлов)
    architecture/  Архитектура демо
    design/        HTML-макеты, стайлгайд
    plans/         Планы спринтов
```

## Технологии

- **PixiJS v8** — рендеринг (canvas, 390x844 design coordinates)
- **TypeScript** — строгая типизация
- **Webpack** — сборка клиента
- **Jest** — тесты shared-пакета

## PvE-поход

Граф точек интереса (модель Slay the Spire). На каждом шаге игрок выбирает 1 из 2-3 вариантов:

- Бой / Элитный бой / Босс
- Сундук / Древний сундук
- Святилище (выбор реликвии)
- Магазин / Лагерь / Событие

12 шагов: Святилище (1) &rarr; развилки (2-5) &rarr; Древний сундук (6) &rarr; развилки (7-11) &rarr; Босс (12).

## Документация

- [GDD](docs/gdd/00_index.md) — игровой дизайн
- [Архитектура](docs/architecture/architecture.md) — техническая архитектура
- [Стайлгайд](docs/design/style-guide.md) — UI-стиль
- [High Concept](docs/design/high-concept.md) — концепция и MVP scope

## Лицензия

Proprietary. All rights reserved.
