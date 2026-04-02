# Sprint 1: SceneManager + HubScene

## Контекст

Текущее состояние: пустой scaffold. `client/src/main.ts` создаёт PixiJS Application и монтирует canvas — больше ничего. `shared/src/index.ts` пуст. `config/balance.json` пуст.

**Цель спринта:** построить навигационный каркас игры — SceneManager (управление сценами, переходы, масштабирование viewport) и HubScene (центральный хаб между PvE/PvP). Это фундамент для всех следующих спринтов.

**Результат:** при запуске `npm run dev` открывается HubScene в стиле Surprise Arena (тёмно-синий фон, неоновые акценты, 3D-кнопки). Кнопки «Поход» и «Арена» переходят к сценам-заглушкам с плавной анимацией. Навигация работает, viewport масштабируется под любой размер экрана.

---

## Затрагиваемые файлы

### Новые файлы

| Файл | Назначение |
|------|------------|
| `shared/src/types/Equipment.ts` | Интерфейсы: `EquipmentSlotId`, `IEquipmentItem` |
| `shared/src/types/GameState.ts` | Интерфейсы: `IHeroState`, `IResources`, `IEquipmentSlots`, `IGameState` |
| `shared/src/types/BalanceConfig.ts` | Интерфейс: `IBalanceConfig` — типизация balance.json |
| `client/src/config/ThemeConfig.ts` | Все визуальные токены из style-guide.md |
| `client/src/core/EventBus.ts` | Типизированный pub/sub для коммуникации систем и сцен |
| `client/src/core/GameState.ts` | Рантайм-контейнер состояния, инициализируется из balance.json |
| `client/src/core/SceneManager.ts` | Управление сценами: реестр, lifecycle, переходы, viewport scaling |
| `client/src/scenes/BaseScene.ts` | Абстрактный базовый класс сцен (extends `Container`) |
| `client/src/scenes/HubScene.ts` | Центральный хаб |
| `client/src/scenes/PveMapScene.ts` | Заглушка — «Поход» |
| `client/src/scenes/PvpLobbyScene.ts` | Заглушка — «Арена» |
| `client/src/scenes/InventoryScene.ts` | Заглушка — «Инвентарь» |
| `client/src/scenes/DevPanelScene.ts` | Заглушка — dev-панель |
| `client/src/ui/Button.ts` | Кнопки Primary (зелёная) и Secondary (пурпурная) |
| `client/src/ui/ResourceBar.ts` | Отображение Gold (pill-бейдж) |
| `client/src/ui/EquipmentCard.ts` | Карточка слота экипировки |
| `client/src/ui/HeroPortrait.ts` | Аватар героя + масса + рейтинг |
| `client/src/ui/BottomNav.ts` | Нижняя навигация (табы) |
| `client/src/utils/Tween.ts` | Простая tweenProperty() на `Ticker` для переходов |

### Изменяемые файлы

| Файл | Что менять |
|------|------------|
| `shared/src/index.ts` | Добавить реэкспорт всех типов |
| `config/balance.json` | Заполнить стартовыми данными героя, ресурсов, экипировки |
| `client/tsconfig.json` | Добавить `resolveJsonModule`, `esModuleInterop`, `paths` для `@config` |
| `client/webpack.config.ts` | Добавить `resolve.alias` для `@config` → `../config` |
| `client/index.html` | Подключить Google Fonts (Nunito) |
| `client/src/main.ts` | Инициализация EventBus, GameState, SceneManager; регистрация сцен; переход к HubScene |

---

## Шаги реализации

### Фаза 1: Фундамент (параллельно)

**Шаг 1. Типы в shared/**
- Создать `shared/src/types/Equipment.ts`:
  - `EquipmentSlotId = 'weapon' | 'armor' | 'accessory'`
  - `IEquipmentItem { id, name, slot, tier, modifier, maxDurability, currentDurability, basePrice }`
- Создать `shared/src/types/GameState.ts`:
  - `IHeroState { mass, rating, hp, maxHp, baseAttack, baseDefense }`
  - `IResources { gold, campaignTickets, maxCampaignTickets, arenaTickets, maxArenaTickets }`
  - `IEquipmentSlots { weapon, armor, accessory }` (каждый — `IEquipmentItem | null`)
  - `IGameState { hero, resources, equipment }`
- Создать `shared/src/types/BalanceConfig.ts`:
  - `IBalanceConfig` — типизированная схема balance.json
- Обновить `shared/src/index.ts` — реэкспорт всех типов

**Шаг 2. ThemeConfig** (параллельно с шагом 1)
- Создать `client/src/config/ThemeConfig.ts` — замороженный объект `THEME`:
  - `colors` — bg_primary (#1C2340), bg_secondary (#2A3355), bg_card (#3D4670), bg_overlay (0x000000 50%), accent_green (#5EC040), accent_green_dark (#3A8A28), accent_pink (#E91E8C), accent_magenta (#D946A8), accent_cyan (#4AE0E0), accent_yellow (#FFD700), accent_red (#E53E3E), rank_gold (#FFB020), rank_silver (#A0B0C0), rank_bronze (#8B6E4E), text_primary (#FFFFFF), text_secondary (#A0AEC0), text_muted (#8899AA)
  - `font` — family: 'Nunito, sans-serif', sizes (heading: 40, subheading: 17, playerName: 21, massNumber: 26, buttonPrimary: 30, buttonSecondary: 21, small: 14, reward: 30, rewardLabel: 13)
  - `layout` — designWidth: 390, designHeight: 844, borderRadius (button: 16, card: 12, pill: 20), buttonHeight (primary: 68, secondary: 56), spacing (padding: 16, gap: 12)
  - `animation` — transitionMs: 300, pressScaleMs: 100, pressScale: 0.95, bounceOvershoot: 1.2

**Шаг 3. EventBus** (параллельно)
- Создать `client/src/core/EventBus.ts`:
  - Простой generic emitter: `on<T>(event, listener)`, `off(event, listener)`, `emit<T>(event, data)`
  - Внутренний Map<string, Set<Function>>
  - События Sprint 1: `'state:resources:changed'`, `'state:hero:changed'`, `'state:equipment:changed'`, `'scene:transition:start'`, `'scene:transition:end'`

### Фаза 2: Состояние и инфраструктура

**Шаг 4. balance.json + конфиг сборки**
- Заполнить `config/balance.json`:
  ```json
  {
    "hero": { "startMass": 420, "startRating": 1150, "startHp": 100, "baseAttack": 10, "baseDefense": 5 },
    "resources": { "startGold": 1500, "maxCampaignTickets": 5, "startCampaignTickets": 3, "maxArenaTickets": 3, "startArenaTickets": 2 },
    "equipment": {
      "starterItems": [
        { "id": "wpn_sword_t1", "name": "Меч", "slot": "weapon", "tier": 1, "modifier": 1.1, "maxDurability": 100, "basePrice": 50 },
        { "id": "arm_chain_t1", "name": "Кольчуга", "slot": "armor", "tier": 1, "modifier": 1.1, "maxDurability": 100, "basePrice": 60 },
        { "id": "acc_ring_t1", "name": "Кольцо", "slot": "accessory", "tier": 1, "modifier": 1.0, "maxDurability": 100, "basePrice": 40 }
      ]
    }
  }
  ```
- В `client/tsconfig.json` добавить: `resolveJsonModule: true`, `esModuleInterop: true`, `baseUrl: "."`, `paths: { "@config/*": ["../config/*"] }`
- В `client/webpack.config.ts` добавить: `resolve.alias: { '@config': path.resolve(__dirname, '../config') }`
- В `client/index.html` добавить `<link>` Google Fonts Nunito (wght 400;600;700;800;900)

**Шаг 5. GameState**
- Создать `client/src/core/GameState.ts`:
  - Конструктор принимает `IBalanceConfig` + `EventBus`
  - Инициализирует `IGameState` из balance.json defaults (starterItems → equipment slots с currentDurability = maxDurability × случайный для демо)
  - Геттеры: `hero`, `resources`, `equipment`
  - Сеттеры: `setGold(n)`, `setMass(n)`, `setRating(n)` — для dev-панели позже; при изменении emit в EventBus
  - **Живёт в client/, не в shared/** (имеет side-effects через EventBus)

**Шаг 6. BaseScene + Tween**
- Создать `client/src/utils/Tween.ts`:
  - `tweenProperty(target, property, from, to, durationMs, ticker, easing?): Promise<void>`
  - Easing по умолчанию — easeOutQuad
  - Использует `ticker.add()`, внутренний elapsed счётчик, resolve промиса по завершении
- Создать `client/src/scenes/BaseScene.ts`:
  - Абстрактный класс extends `Container`
  - `abstract onEnter(data?: unknown): void`
  - `onExit(): void` — по умолчанию пустой
  - `onResize(width: number, height: number): void` — по умолчанию пустой
  - `destroy()` — вызывает `super.destroy({ children: true })`

### Фаза 3: SceneManager + UI-компоненты

**Шаг 7. SceneManager**
- Создать `client/src/core/SceneManager.ts`:
  - Конструктор: `(app: Application, eventBus: EventBus)`
  - Содержит `sceneContainer: Container` на `app.stage` с viewport scaling
  - Viewport scaling: `scaleFactor = Math.min(w / 390, h / 844)`, центрирование
  - `register(name, factory: () => BaseScene): void` — ленивые фабрики
  - `goto(name, options?: { transition?: TransitionType, data?: unknown }): Promise<void>`
    1. Если есть текущая сцена — transition-out (fade/slide alpha/position)
    2. Создать новую через фабрику
    3. `onEnter(data)` на новой
    4. Добавить в `sceneContainer`
    5. Transition-in
    6. `onExit()` + `destroy()` на старой
  - `back(options?): Promise<void>` — стек истории `{ name, data }[]`
  - `resize(width, height): void` — пересчитать scaleFactor
  - `TransitionType` enum: `NONE`, `FADE`, `SLIDE_LEFT`, `SLIDE_RIGHT`, `MODAL`
  - Кеширование сцен НЕ нужно в Sprint 1 — каждый goto создаёт новую

**Шаг 8. UI-компоненты** (см. детальные спеки в секции «UX/UI спецификация» ниже)
- `client/src/ui/Button.ts` — ButtonPrimary, ButtonSecondary, ButtonDanger
- `client/src/ui/ResourceBar.ts` — pill-бейдж Gold
- `client/src/ui/EquipmentCard.ts` — карточка слота экипировки
- `client/src/ui/HeroPortrait.ts` — аватар + масса + рейтинг
- `client/src/ui/BottomNav.ts` — нижняя навигация
- `client/src/ui/ProgressBar.ts` — полоса прогресса (прочность в EquipmentCard)

### Фаза 4: Сцены

**Шаг 9. HubScene** (см. детальный layout в секции «UX/UI спецификация» ниже)
- Создать `client/src/scenes/HubScene.ts`
- Конструктор: `(gameState: GameState, eventBus: EventBus, sceneManager: SceneManager)`
- Подписка на EventBus для обновления значений при изменении GameState
- **Демо:** Gems не показываем (только Gold — ограничение демо из architecture.md)

**Шаг 10. Сцены-заглушки** (см. layout в секции «UX/UI спецификация» ниже)
- `PveMapScene`, `PvpLobbyScene`, `InventoryScene`, `DevPanelScene`
- DevPanelScene — transition MODAL (поверх текущей сцены, overlay bg_overlay)

### Фаза 5: Интеграция

**Шаг 11. main.ts**
- Обновить `client/src/main.ts`:
  ```
  1. const app = new Application()
  2. await app.init({ width: 390, height: 844, backgroundColor: 0x1C2340, resizeTo: window })
  3. document.body.appendChild(app.canvas)
  4. await document.fonts.ready  // дождаться загрузки Nunito
  5. const eventBus = new EventBus()
  6. const gameState = new GameState(balanceConfig, eventBus)
  7. const sceneManager = new SceneManager(app, eventBus)
  8. sceneManager.register('hub', () => new HubScene(gameState, eventBus, sceneManager))
  9. sceneManager.register('pveMap', () => new PveMapScene(gameState, eventBus, sceneManager))
  10. ... остальные регистрации
  11. await sceneManager.goto('hub', { transition: TransitionType.FADE })
  12. window.addEventListener('resize', () => sceneManager.resize(app.screen.width, app.screen.height))
  ```

### Фаза 6: Тесты + Проверка

**Шаг 12. Проверки**
- `npm run build` — компиляция shared + client без ошибок
- `npm run test` — тесты shared/ проходят (если есть helper-функции)
- `npm run dev` — в браузере:
  - [ ] HubScene рендерится с правильным стилем (тёмно-синий фон, зелёная кнопка, акценты)
  - [ ] ResourceBar показывает Gold: 1500
  - [ ] HeroPortrait показывает массу 420 (голубым) и рейтинг 1150
  - [ ] 3 карточки экипировки с прочностью
  - [ ] Кнопка «Поход» → slide left → PveMapScene заглушка
  - [ ] Кнопка «Арена» → slide left → PvpLobbyScene заглушка
  - [ ] «Назад» из заглушки → slide right → HubScene
  - [ ] Ресайз окна — viewport масштабируется с сохранением пропорций 390:844
  - [ ] BottomNav отображается, табы кликабельны

---

## Зависимости задач

```
Шаг 1 (shared types)  ─┐
Шаг 2 (ThemeConfig)    ├── параллельно, без зависимостей
Шаг 3 (EventBus)      ─┘
         │
         ▼
Шаг 4 (balance.json + конфиг) ── зависит от Шаг 1 (IBalanceConfig)
Шаг 5 (GameState)              ── зависит от Шаг 1, 3, 4
Шаг 6 (BaseScene + Tween)      ── зависит от Шаг 2 (design dimensions)
         │
         ▼
Шаг 7 (SceneManager) ── зависит от Шаг 3, 6
Шаг 8 (UI-компоненты) ── зависит от Шаг 2
         │
         ▼
Шаг 9 (HubScene)     ── зависит от Шаг 5, 7, 8
Шаг 10 (заглушки)     ── зависит от Шаг 6, 7
         │
         ▼
Шаг 11 (main.ts)     ── зависит от Шаг 5, 7, 9, 10
         │
         ▼
Шаг 12 (проверки)    ── зависит от Шаг 11
```

---

## Риски

| Риск | Митигация |
|------|-----------|
| **Nunito не загрузится** — PixiJS Text рендерит в canvas, шрифт должен быть загружен до первого рендера | `await document.fonts.ready` в main.ts перед первой сценой. Fallback: `sans-serif` |
| **balance.json вне rootDir** — TypeScript не найдёт `../../config/balance.json` | Webpack alias `@config` + tsconfig `paths`. Проверить первым делом при шаге 4 |
| **PixiJS v8 Ticker API** — изменился с v7, `ticker.add(fn)` передаёт Ticker, не delta | Tween.ts использует `ticker.deltaMS` внутри callback. Проверить на простом fade |
| **Утечки памяти при смене сцен** — не уничтоженные listeners/children | `BaseScene.destroy({ children: true })` + EventBus `off()` в `onExit()`. SceneManager форсирует вызов |
| **Viewport scaling — координаты «плывут»** — если элементы позиционируются в абсолютных пикселях | Все сцены работают в координатах 390×844. SceneManager масштабирует sceneContainer целиком |

---

## UX/UI спецификация

> Источник: [style-guide.md](../design/style-guide.md), [09_ui_flows.md](../gdd/09_ui_flows.md)

### Общие принципы (из style-guide.md §4)

| Параметр | Значение |
|----------|----------|
| Viewport | Portrait 390×844 (iPhone 14), масштабируется с сохранением пропорций |
| Фон приложения | bg_primary (#1C2340) |
| Боковые отступы экрана | 16px |
| Отступ от верхнего края | 48px (с учётом status bar) |
| Между карточками в списке | 8px |
| Padding внутри карточки | 12px 16px |
| Drop-shadow на кнопках/карточках | 0 4px 8px rgba(0,0,0,0.3) |
| Glow на важных элементах | box-shadow 0 0 20px accent_color (30% opacity) |
| Текстовые тени на заголовках | 0 2px 4px rgba(0,0,0,0.5) |

### ThemeConfig — полная таблица токенов

**Цвета (hex для PixiJS — 0x формат):**

| Токен | Hex | Значение 0x | Назначение |
|-------|-----|-------------|------------|
| bg_primary | #1C2340 | 0x1C2340 | Основной фон |
| bg_secondary | #2A3355 | 0x2A3355 | Фон панелей |
| bg_card | #3D4670 | 0x3D4670 | Фон карточек и строк |
| bg_card_highlight | #4A7DBA | 0x4A7DBA | Подсветка (alpha 0.3) |
| bg_overlay | #000000 | 0x000000 | Затемнение модалок (alpha 0.5) |
| accent_green | #5EC040 | 0x5EC040 | Основное действие |
| accent_green_dark | #3A8A28 | 0x3A8A28 | Тень/обводка зелёных кнопок |
| accent_pink | #E91E8C | 0xE91E8C | Баннеры, ленты |
| accent_magenta | #D946A8 | 0xD946A8 | Кнопки «Напасть» |
| accent_magenta_dark | #B03090 | 0xB03090 | Градиент/тень пурпурных кнопок |
| accent_magenta_border | #8B2070 | 0x8B2070 | Обводка пурпурных кнопок |
| accent_cyan | #4AE0E0 | 0x4AE0E0 | Масса героя |
| accent_yellow | #FFD700 | 0xFFD700 | Валюта, награды |
| accent_red | #E53E3E | 0xE53E3E | Опасность, поражение |
| rank_gold | #FFB020 | 0xFFB020 | 1-е место |
| rank_silver | #A0B0C0 | 0xA0B0C0 | 2-е место |
| rank_bronze | #8B6E4E | 0x8B6E4E | 3-е место |
| text_primary | #FFFFFF | 0xFFFFFF | Основной текст |
| text_secondary | #A0AEC0 | 0xA0AEC0 | Подзаголовки |
| text_muted | #8899AA | 0x8899AA | Мелкий текст |
| border_nav | #4A5568 | 0x4A5568 | Верхняя граница BottomNav |
| button_danger_border | #5A6590 | 0x5A6590 | Обводка кнопки Danger |

**Типографика (шрифт Nunito, sans-serif fallback):**

| Элемент | Размер | Начертание | Цвет | Доп. эффекты |
|---------|--------|------------|------|--------------|
| heading | 40px | 900 (Black) | text_primary | text-stroke 2px #000, drop-shadow 0 2px 4px rgba(0,0,0,0.5), UPPERCASE |
| subheading | 17px | 500 (Medium) | text_secondary | — |
| playerName | 21px | 700 (Bold) | text_primary | — |
| massNumber | 26px | 800 (Extra Bold) | accent_cyan | — |
| buttonPrimary | 28px | 700 (Bold) | text_primary | drop-shadow 0 2px 0 rgba(0,0,0,0.3) |
| buttonSecondary | 18px | 700 (Bold) | text_primary | — |
| buttonDanger | 22px | 700 (Bold) | text_primary | — |
| small | 14px | 400 (Regular) | text_muted | — |
| rewardLabel | 13px | 700 (Bold) | accent_yellow | — |

**Скругления:**

| Элемент | borderRadius |
|---------|-------------|
| ButtonPrimary | 16px |
| ButtonSecondary | 12px |
| ButtonDanger | 16px |
| Карточки | 12px |
| Аватары | 8px |
| Pill (ResourceBar) | 20px |
| ProgressBar | 8px |
| Модалки | 20px |

**Анимации:**

| Действие | Параметры |
|----------|-----------|
| Появление экрана | fade in 300ms + scale 0.95→1.0 |
| Нажатие кнопки | scale→0.95 за 100ms, возврат за 100ms, сдвиг Y +2px |
| Появление награды | scale 0→1.2→1.0 (200ms + 100ms bounce) |
| Удар в бою | shake ±5px 50ms × 3 |
| Полоса HP | tween ширины 300ms easeOut |
| Slide-переход | translateX ±390 за 300ms easeOut |
| Fade-переход | alpha 0↔1 за 300ms |

---

### Компонент: ButtonPrimary (`client/src/ui/Button.ts`, variant='primary')

```
Источник: style-guide.md §3.1
```

| Параметр | Значение |
|----------|----------|
| Ширина | 80% от designWidth = 312px (или параметр) |
| Высота | 68px (64–72 по гайду) |
| borderRadius | 16px |
| Фон | Линейный градиент сверху вниз: accent_green (#5EC040) → accent_green_dark (#3A8A28) |
| Обводка | 3px, accent_green_dark; нижний край толще — эффект 3D |
| Тень | Нижний rect: y + 4px, цвет accent_green_dark (создаёт 3D-объём) |
| Drop-shadow | 0 4px 8px rgba(0,0,0,0.3) |
| Текст | Белый, Nunito Bold 28px, text-shadow 0 2px 0 rgba(0,0,0,0.3) |
| Press-state | scale 0.95, сдвиг Y +2px, тень уменьшается (100ms) |
| Release | Возврат к scale 1.0 и Y=0 (100ms) |

**Реализация в PixiJS:**
- `Graphics` для фона: `roundRect(0, 4, w, h, 16)` заливка accent_green_dark (тень-подложка)
- `Graphics` для основной поверхности: `roundRect(0, 0, w, h-4, 16)` заливка accent_green
- `Text` по центру
- `eventMode = 'static'`, `cursor = 'pointer'`
- `on('pointerdown')` → tween scale + Y
- `on('pointerup'/'pointerupoutside')` → tween обратно + вызов onClick

### Компонент: ButtonSecondary (variant='secondary')

```
Источник: style-guide.md §3.2
```

| Параметр | Значение |
|----------|----------|
| Ширина | По контенту + padding 16px 24px (или параметр) |
| Высота | 56px |
| borderRadius | 12px |
| Фон | Градиент accent_magenta (#D946A8) → #B03090 |
| Обводка | 2px, #8B2070 |
| Тень | 0 3px 0 #8B2070 |
| Текст | Белый, Nunito Bold 18px |
| Press-state | Аналогично Primary |

### Компонент: ButtonDanger (variant='danger')

```
Источник: style-guide.md §3.3
```

| Параметр | Значение |
|----------|----------|
| Ширина | 80% от designWidth = 312px |
| Высота | 56px |
| borderRadius | 16px |
| Фон | bg_card (#3D4670) |
| Обводка | 2px, #5A6590 |
| Текст | Белый, Nunito Bold 22px |
| Подпись | Мелкий текст 14px text_muted под кнопкой (опционально) |

---

### Компонент: ResourceBar (`client/src/ui/ResourceBar.ts`)

```
Источник: style-guide.md §3.9
```

| Параметр | Значение |
|----------|----------|
| Форма | Pill-shape (скруглённый прямоугольник) |
| borderRadius | 20px |
| Фон | bg_card (#3D4670) |
| Padding | 8px 16px |
| Иконка | Текст «Gold» или символ монеты (accent_yellow), 18px Bold |
| Значение | Белый, 18px Bold |
| Расположение | Верхняя часть экрана |

**Layout:** `[💰 Gold: 1500]` — иконка слева, число справа

**API:**
```
constructor(options: { label: string; value: number })
updateValue(value: number): void
```

---

### Компонент: ProgressBar (`client/src/ui/ProgressBar.ts`)

```
Источник: style-guide.md §3.8
```

| Параметр | Значение |
|----------|----------|
| Высота | 16px |
| borderRadius | 8px |
| Фон трека | #1A2030 |
| Обводка | 2px bg_secondary |
| Заполнение | Градиент accent_green → accent_yellow |
| Текст по центру | «70 / 100» белый 12px Bold |

**API:**
```
constructor(options: { width: number; max: number; current: number })
update(current: number, max?: number): void  // анимирует ширину 300ms easeOut
```

---

### Компонент: EquipmentCard (`client/src/ui/EquipmentCard.ts`)

```
Источник: style-guide.md §3.4 (адаптация PlayerRow), §4 отступы
```

| Параметр | Значение |
|----------|----------|
| Ширина | 165px (два в ряд: (390 − 16×2 − 12) / 2) |
| Высота | 100px |
| borderRadius | 12px |
| Фон | bg_card (#3D4670) |
| Padding | 12px |
| Drop-shadow | 0 4px 8px rgba(0,0,0,0.3) |

**Содержимое (сверху вниз внутри карточки):**

| Элемент | Стиль |
|---------|-------|
| Название слота | text_secondary, 14px Regular, UPPERCASE («WEAPON», «ARMOR», «ACCESS.») |
| Имя предмета | text_primary, 16px Bold («Меч», «Кольчуга») |
| ProgressBar прочности | Мини-бар шириной 100%, высота 10px |
| Текст прочности | text_muted, 12px Regular («70/100») |

**Пустой слот:**
- Фон bg_card с пунктирной обводкой 2px text_muted
- Текст «Пусто» по центру, text_muted 14px

**Интерактивность:**
- `eventMode = 'static'`, `cursor = 'pointer'`
- Hover: подсветка bg_card_highlight (alpha 0.3)
- Tap → onClick callback (для перехода в инвентарь)

---

### Компонент: HeroPortrait (`client/src/ui/HeroPortrait.ts`)

| Параметр | Значение |
|----------|----------|
| Ширина контейнера | 200px (центрирован) |
| Высота | 180px |

**Содержимое (сверху вниз):**

| Элемент | Размер | Стиль |
|---------|--------|-------|
| Аватар-placeholder | 100×100px, borderRadius 8px | Фон bg_secondary, обводка 3px accent_cyan (glow 0 0 20px accent_cyan 30%) |
| Лейбл «Масса» | 14px Regular | text_secondary, выравнивание по центру |
| Число массы | 26px Extra Bold (800) | accent_cyan (#4AE0E0), выравнивание по центру |
| Лейбл «Рейтинг» | 14px Regular | text_secondary |
| Число рейтинга | 18px Bold | text_primary |

**API:**
```
constructor(options: { mass: number; rating: number })
update(mass: number, rating: number): void
```

---

### Компонент: BottomNav (`client/src/ui/BottomNav.ts`)

```
Источник: style-guide.md §3.7
```

| Параметр | Значение |
|----------|----------|
| Ширина | 390px (полная ширина) |
| Высота | 64px |
| Фон | bg_secondary (#2A3355) |
| Верхняя граница | 1px #4A5568 |
| Позиция | Нижний край экрана: y = 844 − 64 = 780 |

**Табы (4 штуки для Sprint 1):**

| Tab | id | Label |
|-----|----|-------|
| 1 | hero | Герой |
| 2 | inventory | Инвент. |
| 3 | repair | Ремонт |
| 4 | dev | Dev |

**Каждый таб:**
- Ширина: 390 / 4 = 97.5px
- Иконка: текст-эмоджи или placeholder 32×32px (Sprint 1 — только текст)
- Подпись: 12px Medium
- Неактивный: text_primary (белый)
- Активный: accent_yellow (#FFD700) для текста

**Интерактивность:**
- `eventMode = 'static'`
- Tap → `onSelect(id)` callback
- Активный таб визуально выделен (accent_yellow + подчёркивание 2px снизу)

---

### Экран: HubScene — детальный layout

```
Источник: 09_ui_flows.md — HubScene, style-guide.md §3–4
Координаты: для viewport 390×844
```

```
┌─────────────────────────────────────┐  y=0
│                                     │
│  ┌─[ResourceBar]────────────────┐   │  y=48, x=16
│  │  💰 Gold: 1500               │   │  pill bg_card, borderRadius 20
│  └──────────────────────────────┘   │  высота ~40px
│                                     │
│         ┌──────────────┐            │  y=108, центрирован (x=145)
│         │              │            │
│         │   [Аватар]   │            │  100×100, borderRadius 8
│         │   placeholder│            │  фон bg_secondary
│         │              │            │  glow accent_cyan 30%
│         └──────────────┘            │
│           Масса                     │  y=218, text_secondary 14px
│            420                      │  y=234, accent_cyan 26px ExBold
│          Рейтинг                    │  y=268, text_secondary 14px
│           1150                      │  y=284, text_primary 18px Bold
│                                     │
│  ┌──────────┐  ┌──────────┐         │  y=320, x=16
│  │ WEAPON   │  │ ARMOR    │         │  165×100 каждая, gap=12
│  │ Меч      │  │ Кольчуга │         │  фон bg_card, borderRadius 12
│  │ ████░ 70 │  │ ████░ 45 │         │  ProgressBar прочности
│  └──────────┘  └──────────┘         │
│       ┌──────────┐                  │  y=432, x=16
│       │ ACCESS.  │                  │  165×100
│       │ Кольцо   │                  │
│       │ █████ 100│                  │
│       └──────────┘                  │
│                                     │
│  ┌──────────────────────────────┐   │  y=556, x=39 (центр)
│  │       ПОХОД (3/5)            │   │  ButtonPrimary 312×68
│  │  accent_green gradient, 3D   │   │  borderRadius 16
│  └──────────────────────────────┘   │
│                                     │  gap=12
│  ┌──────────────────────────────┐   │  y=636, x=39 (центр)
│  │       АРЕНА (2/3)            │   │  ButtonSecondary 312×56
│  │  accent_magenta gradient     │   │  borderRadius 12
│  └──────────────────────────────┘   │
│                                     │
│  ── необязательный gap ──           │
│                                     │
├─────────────────────────────────────┤  y=780
│  [Герой] [Инвент.] [Ремонт] [Dev]  │  BottomNav 390×64
│  bg_secondary, верхняя граница 1px  │  активный=accent_yellow
└─────────────────────────────────────┘  y=844
```

**Навигация из HubScene:**

| Действие | Цель | Переход |
|----------|------|---------|
| Кнопка «ПОХОД» | PveMapScene | SLIDE_LEFT 300ms |
| Кнопка «АРЕНА» | PvpLobbyScene | SLIDE_LEFT 300ms |
| Тап по EquipmentCard | InventoryScene | SLIDE_LEFT 300ms |
| BottomNav → «Инвент.» | InventoryScene | SLIDE_LEFT 300ms |
| BottomNav → «Dev» | DevPanelScene | MODAL (overlay) |
| BottomNav → «Герой» | (текущий экран, noop) | — |
| BottomNav → «Ремонт» | (заглушка, Sprint 5) | — |

**Подписки на EventBus:**
- `'state:resources:changed'` → обновить ResourceBar
- `'state:hero:changed'` → обновить HeroPortrait (масса, рейтинг)
- `'state:equipment:changed'` → обновить EquipmentCards

---

### Экран: Сцены-заглушки — layout

Каждая заглушка имеет единый шаблон:

```
┌─────────────────────────────────────┐  y=0
│                                     │
│  фон: bg_primary (#1C2340)          │
│                                     │
│         НАЗВАНИЕ ЭКРАНА             │  y=48, heading 40px Black
│                                     │  text_primary, UPPERCASE
│         Подзаголовок                │  y=100, subheading 17px
│    «Этот экран будет реализован     │  text_secondary
│     в следующем спринте»            │
│                                     │
│                                     │
│  ┌──────────────────────────────┐   │  y=400, x=39 (центр)
│  │     ← НАЗАД В ХАБ           │   │  ButtonDanger 312×56
│  │  bg_card, обводка #5A6590    │   │  borderRadius 16
│  └──────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Конкретные заголовки:**
- PveMapScene: «ПОХОД» / «Карта главы — скоро»
- PvpLobbyScene: «АРЕНА» / «Список противников — скоро»
- InventoryScene: «ИНВЕНТАРЬ» / «Управление снаряжением — скоро»
- DevPanelScene: «DEV PANEL» / «Инструменты разработчика — скоро» (открывается как MODAL с overlay bg_overlay alpha 0.5, borderRadius 20, фон bg_secondary, отступ 32px от краёв)

**Навигация из заглушек:**
- Все (кроме DevPanel): «Назад» → `sceneManager.back({ transition: SLIDE_RIGHT })`
- DevPanelScene: «Закрыть» → `sceneManager.back({ transition: MODAL })` (снятие overlay)

---

### Переходы между сценами (анимации)

| Тип | Описание | Реализация в PixiJS |
|-----|----------|---------------------|
| FADE | alpha 1→0 на старой, 0→1 на новой, 300ms | tweenProperty(scene, 'alpha', ...) |
| SLIDE_LEFT | Старая: x 0 → −390, новая: x 390 → 0, 300ms easeOut | tweenProperty(scene, 'x', ...) |
| SLIDE_RIGHT | Старая: x 0 → 390, новая: x −390 → 0, 300ms easeOut | Обратный slide |
| MODAL | Overlay (Graphics bg_overlay alpha 0→0.5), новая сцена scale 0.95→1.0 + alpha 0→1, 300ms | Overlay НЕ уничтожает старую сцену; back() убирает overlay |
| NONE | Мгновенная замена | Без анимации |

**MODAL — особый случай:**
- Старая сцена остаётся на экране (не уничтожается)
- Поверх добавляется полупрозрачный overlay (Graphics, fill 0x000000, alpha 0.5)
- Новая сцена появляется поверх overlay
- `back()` убирает новую сцену + overlay, старая становится видимой
- Overlay кликабелен → вызывает `back()`

---

## Архитектурные решения

1. **SceneManager создаёт сцены лениво** через фабрики, не заранее
2. **Кеширование сцен НЕ нужно** в Sprint 1 — goto() создаёт новую, уничтожает старую
3. **GameState живёт в client/**, не в shared/ — имеет side-effects (EventBus). Чистые интерфейсы — в shared/
4. **ThemeConfig — замороженный const-объект**, не класс. Импортируется напрямую
5. **balance.json загружается синхронно** через Webpack (бандлится в JS). Без async fetch
6. **Один файл Button.ts** с параметром `variant: 'primary' | 'secondary'` вместо двух классов
7. **Демо показывает только Gold** (не Gems) — ограничение из architecture.md раздел 1
