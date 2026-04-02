import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { THEME } from '../config/ThemeConfig';

/** Варианты кнопки */
type ButtonVariant = 'primary' | 'secondary' | 'danger';

/** Параметры конструктора кнопки */
interface ButtonOptions {
  text: string;
  variant: ButtonVariant;
  width?: number;
  height?: number;
  onClick: () => void;
}

/**
 * Универсальная кнопка с тремя вариантами стиля:
 * primary (зелёная 3D), secondary (пурпурная), danger (тёмная с обводкой).
 */
export class Button extends Container {
  /** Сохраняем callback для вызова при отпускании */
  private readonly onClick: () => void;

  /** Запоминаем начальную Y-позицию для корректного возврата */
  private baseY = 0;

  /** Флаг — кнопка сейчас нажата */
  private pressed = false;

  constructor(options: ButtonOptions) {
    super();
    this.onClick = options.onClick;
    this.eventMode = 'static';
    this.cursor = 'pointer';

    switch (options.variant) {
      case 'primary':
        this.buildPrimary(options);
        break;
      case 'secondary':
        this.buildSecondary(options);
        break;
      case 'danger':
        this.buildDanger(options);
        break;
    }

    // --- Обработка нажатия ---
    this.on('pointerdown', this.handlePress, this);
    this.on('pointerup', this.handleRelease, this);
    this.on('pointerupoutside', this.handleReleaseOutside, this);
  }

  // ─── Primary (зелёная 3D) ──────────────────────────────────────

  private buildPrimary(options: ButtonOptions): void {
    const w = options.width ?? THEME.layout.buttonWidth;
    const h = options.height ?? THEME.layout.buttonHeight.primary;
    const r = THEME.layout.borderRadius.button;

    // Нижний слой — тень
    const shadow = new Graphics();
    shadow.roundRect(0, 4, w, h, r).fill(THEME.colors.accent_green_dark);
    this.addChild(shadow);

    // Верхний слой
    const face = new Graphics();
    face.roundRect(0, 0, w, h - 4, r).fill(THEME.colors.accent_green);
    this.addChild(face);

    // Текст
    const label = new Text({
      text: options.text,
      style: new TextStyle({
        fontSize: THEME.font.sizes.buttonPrimary,
        fontFamily: THEME.font.family,
        fontWeight: THEME.font.weights.bold,
        fill: THEME.colors.text_primary,
        dropShadow: {
          distance: 2,
          alpha: 0.3,
        },
      }),
    });
    label.anchor.set(0.5);
    label.x = w / 2;
    label.y = (h - 4) / 2;
    this.addChild(label);

    // Pivot по центру X для удобного центрирования
    this.pivot.x = w / 2;
  }

  // ─── Secondary (пурпурная) ─────────────────────────────────────

  private buildSecondary(options: ButtonOptions): void {
    const w = options.width ?? THEME.layout.buttonWidth;
    const h = options.height ?? THEME.layout.buttonHeight.secondary;
    const r = THEME.layout.borderRadius.buttonSecondary;

    // Нижний слой — тень / обводка
    const shadow = new Graphics();
    shadow.roundRect(0, 3, w, h, r).fill(THEME.colors.accent_magenta_border);
    this.addChild(shadow);

    // Верхний слой
    const face = new Graphics();
    face.roundRect(0, 0, w, h - 3, r).fill(THEME.colors.accent_magenta);
    this.addChild(face);

    // Текст
    const label = new Text({
      text: options.text,
      style: new TextStyle({
        fontSize: THEME.font.sizes.buttonSecondary,
        fontFamily: THEME.font.family,
        fontWeight: THEME.font.weights.bold,
        fill: THEME.colors.text_primary,
        dropShadow: {
          distance: 2,
          alpha: 0.3,
        },
      }),
    });
    label.anchor.set(0.5);
    label.x = w / 2;
    label.y = (h - 3) / 2;
    this.addChild(label);

    this.pivot.x = w / 2;
  }

  // ─── Danger (тёмная с обводкой) ────────────────────────────────

  private buildDanger(options: ButtonOptions): void {
    const w = options.width ?? THEME.layout.buttonWidth;
    const h = options.height ?? THEME.layout.buttonHeight.danger;
    const r = THEME.layout.borderRadius.button;

    // Один слой с заливкой и обводкой
    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, r)
      .fill(THEME.colors.bg_card)
      .stroke({ color: THEME.colors.button_danger_border, width: 2 });
    this.addChild(bg);

    // Текст
    const label = new Text({
      text: options.text,
      style: new TextStyle({
        fontSize: THEME.font.sizes.buttonDanger,
        fontFamily: THEME.font.family,
        fontWeight: THEME.font.weights.bold,
        fill: THEME.colors.text_primary,
      }),
    });
    label.anchor.set(0.5);
    label.x = w / 2;
    label.y = h / 2;
    this.addChild(label);

    this.pivot.x = w / 2;
  }

  // ─── Обработчики нажатия ───────────────────────────────────────

  private handlePress(): void {
    if (this.pressed) return;
    this.pressed = true;
    this.baseY = this.y;
    this.scale.set(THEME.animation.pressScale);
    this.y += THEME.animation.pressOffsetY;
  }

  private handleRelease(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.scale.set(1);
    this.y = this.baseY;
    this.onClick();
  }

  /** Отпускание вне кнопки — сбрасываем состояние без вызова onClick */
  private handleReleaseOutside(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.scale.set(1);
    this.y = this.baseY;
  }
}
