# Технический контекст — Big Heroes

**Обновлён:** 2026-04-02

---

## Стек

| Слой | Технология |
|------|-----------|
| Рендер | PixiJS v8 (WebGL / WebGPU) |
| Язык | TypeScript 5.4+ |
| Бандлер | Webpack 5 |
| Dev-сервер | webpack-dev-server |
| Тесты | Jest + ts-jest |
| Монорепо | npm workspaces |

## Пакеты

- `client/` — игровой клиент, зависит от `shared`
- `shared/` — чистые функции, типы, формулы; нет зависимостей от `client/`

## Команды

```bash
npm run dev       # webpack-dev-server на порту 3000
npm run build     # production сборка (shared → client)
npm run test      # jest во всех воркспейсах
```

## Структура `client/src/`

```
main.ts          — точка входа, создаёт PixiJS Application
scenes/          — классы сцен (пока пусто)
ui/              — HUD и компоненты (пока пусто)
assets/          — манифест ассетов (пока пусто)
utils/           — утилиты (пока пусто)
```
