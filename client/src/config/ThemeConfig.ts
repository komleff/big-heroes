/**
 * Конфигурация визуальной темы Big Heroes.
 * Все значения извлечены из docs/design/style-guide.md.
 * Объект заморожен — мутация запрещена.
 */
export const THEME = Object.freeze({
  // ─── Цвета (PixiJS — числовой 0x формат) ────────────────────────
  colors: {
    /** Основной фон приложения (тёмно-синий) */
    bg_primary: 0x1C2340,
    /** Фон панелей */
    bg_secondary: 0x2A3355,
    /** Фон карточек / строк списка */
    bg_card: 0x3D4670,
    /** Подсветка строки игрока (используется с alpha 0.3) */
    bg_card_highlight: 0x4A7DBA,
    /** Затемнение под модалками (alpha 0.5) */
    bg_overlay: 0x000000,

    /** Кнопки основного действия */
    accent_green: 0x5EC040,
    /** Тень / обводка зелёных кнопок */
    accent_green_dark: 0x3A8A28,
    /** Заголовки, баннеры, ленты */
    accent_pink: 0xE91E8C,
    /** Кнопки «Напасть» */
    accent_magenta: 0xD946A8,
    /** Градиент пурпурных кнопок */
    accent_magenta_dark: 0xB03090,
    /** Обводка пурпурных кнопок */
    accent_magenta_border: 0x8B2070,
    /** Масса героя, выделение чисел */
    accent_cyan: 0x4AE0E0,
    /** Валюта, награды, премиум-бонус */
    accent_yellow: 0xFFD700,
    /** Поражение, опасность */
    accent_red: 0xE53E3E,

    /** 1-е место */
    rank_gold: 0xFFB020,
    /** 2-е место */
    rank_silver: 0xA0B0C0,
    /** 3-е место */
    rank_bronze: 0x8B6E4E,

    /** Основной текст */
    text_primary: 0xFFFFFF,
    /** Вторичный текст */
    text_secondary: 0xA0AEC0,
    /** Приглушённый текст */
    text_muted: 0x8899AA,

    /** Верхняя граница BottomNav */
    border_nav: 0x4A5568,
    /** Обводка кнопки «Отступить» */
    button_danger_border: 0x5A6590,
    /** Фон ProgressBar */
    progress_track: 0x1A2030,

    /** Градиент PvE — верхняя точка */
    gradient_pve_top: 0x3A8EC2,
    /** Градиент PvE — средняя точка (35%) */
    gradient_pve_mid: 0x5A7EAA,
    /** Градиент PvE — нижняя точка */
    gradient_pve_bottom: 0x4A6A90,

    /** Градиент Hub — верхняя точка (небо) */
    gradient_hub_top: 0x3A8EC2,
    /** Градиент Hub — средняя точка 1 (30%, светлое небо) */
    gradient_hub_mid1: 0x7EC8E3,
    /** Градиент Hub — средняя точка 2 (60%, переход к зелени) */
    gradient_hub_mid2: 0xA8D8A8,
    /** Градиент Hub — нижняя точка (трава) */
    gradient_hub_bottom: 0x78B060,
  },

  // ─── Типографика ─────────────────────────────────────────────────
  font: {
    family: 'Nunito, sans-serif',

    weights: {
      regular: '400',
      medium: '500',
      bold: '700',
      extraBold: '800',
      black: '900',
    },

    sizes: {
      /** Заголовок экрана */
      heading: 40,
      /** Подзаголовок */
      subheading: 17,
      /** Имя игрока в строке списка */
      playerName: 21,
      /** Масса героя */
      massNumber: 26,
      /** Текст на зелёных кнопках */
      buttonPrimary: 28,
      /** Текст на пурпурных кнопках */
      buttonSecondary: 18,
      /** Текст кнопки «Отступить» */
      buttonDanger: 22,
      /** Мелкий текст, подписи */
      small: 14,
      /** Метки наград */
      rewardLabel: 13,
      /** Текст на прогресс-баре */
      progressText: 12,
      /** Подпись вкладки навигации */
      navLabel: 12,
      /** Ресурсная панель (Gold) */
      resourceBar: 18,
      /** Имя предмета в карточке экипировки */
      itemName: 16,
      /** Число рейтинга на портрете героя */
      ratingNumber: 18,
    },
  },

  // ─── Раскладка (portrait 390×844) ───────────────────────────────
  layout: {
    /** Референсная ширина (iPhone 14) */
    designWidth: 390,
    /** Референсная высота (iPhone 14) */
    designHeight: 844,

    borderRadius: {
      button: 16,
      buttonSecondary: 12,
      card: 12,
      pill: 20,
      avatar: 8,
      progressBar: 8,
      modal: 20,
    },

    buttonHeight: {
      primary: 68,
      secondary: 56,
      danger: 56,
    },

    /** 80% от designWidth */
    buttonWidth: 312,

    spacing: {
      screenPadding: 16,
      gap: 12,
      cardGap: 8,
      cardPadding: 12,
      pillPadding: { x: 16, y: 8 },
      /** Отступ от верхнего края (status bar) */
      topOffset: 48,
    },

    bottomNav: {
      height: 64,
      tabCount: 4,
    },

    avatar: {
      size: 100,
    },

    equipmentCard: {
      /** (390 - 16*2 - 12) / 2 */
      width: 165,
      height: 100,
    },
  },

  // ─── Анимации ────────────────────────────────────────────────────
  animation: {
    /** Появление / исчезновение экрана */
    transitionMs: 300,
    /** Скорость масштабирования при нажатии */
    pressScaleMs: 100,
    /** Масштаб кнопки при нажатии */
    pressScale: 0.95,
    /** Сдвиг кнопки вниз при нажатии (px) */
    pressOffsetY: 2,
    /** Перелёт при bounce-анимации наград */
    bounceOvershoot: 1.2,
    /** Время разгона bounce */
    bounceMs: 200,
    /** Время возврата bounce */
    bounceSettleMs: 100,
    /** Амплитуда shake (px) */
    shakeOffset: 5,
    /** Длительность одного shake (ms) */
    shakeMs: 50,
    /** Количество колебаний shake */
    shakeCount: 3,
    /** Fade in / out (ms) */
    fadeMs: 300,
    /** Начальный масштаб при появлении сцены */
    sceneEnterScale: 0.95,
  },
} as const);
