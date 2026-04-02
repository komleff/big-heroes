import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { THEME } from '../config/ThemeConfig';

/** Параметры конструктора ResourceBar */
interface ResourceBarOptions {
  label: string;
  value: number;
}

/**
 * Pill-shaped бейдж с лейблом и числовым значением.
 * Используется для отображения ресурсов (золото, энергия и т.п.).
 */
export class ResourceBar extends Container {
  /** Текстовый элемент значения — обновляется через updateValue */
  private readonly valueText: Text;

  /** Фон пилюли — перерисовывается при обновлении для подгонки ширины */
  private readonly bg: Graphics;

  /** Текст лейбла */
  private readonly labelText: Text;

  constructor(options: ResourceBarOptions) {
    super();

    const px = THEME.layout.spacing.pillPadding.x;
    const py = THEME.layout.spacing.pillPadding.y;
    const r = THEME.layout.borderRadius.pill;

    // Лейбл (например «Золото»)
    this.labelText = new Text({
      text: options.label,
      style: new TextStyle({
        fontSize: THEME.font.sizes.resourceBar,
        fontFamily: THEME.font.family,
        fontWeight: THEME.font.weights.bold,
        fill: THEME.colors.accent_yellow,
      }),
    });
    this.labelText.x = px;
    this.labelText.y = py;

    // Значение
    this.valueText = new Text({
      text: String(options.value),
      style: new TextStyle({
        fontSize: THEME.font.sizes.resourceBar,
        fontFamily: THEME.font.family,
        fontWeight: THEME.font.weights.bold,
        fill: THEME.colors.text_primary,
      }),
    });
    // Располагаем значение правее лейбла с небольшим отступом
    this.valueText.x = this.labelText.x + this.labelText.width + 8;
    this.valueText.y = py;

    // Фон — пилюля
    const totalW = this.valueText.x + this.valueText.width + px;
    const totalH = Math.max(this.labelText.height, this.valueText.height) + py * 2;

    this.bg = new Graphics();
    this.bg.roundRect(0, 0, totalW, totalH, r).fill(THEME.colors.bg_card);

    // Порядок: фон → лейбл → значение
    this.addChild(this.bg);
    this.addChild(this.labelText);
    this.addChild(this.valueText);
  }

  /** Обновляет числовое значение и перерисовывает фон */
  updateValue(value: number): void {
    const px = THEME.layout.spacing.pillPadding.x;
    const py = THEME.layout.spacing.pillPadding.y;
    const r = THEME.layout.borderRadius.pill;

    this.valueText.text = String(value);

    // Пересчитываем положение и размер фона
    this.valueText.x = this.labelText.x + this.labelText.width + 8;

    const totalW = this.valueText.x + this.valueText.width + px;
    const totalH = Math.max(this.labelText.height, this.valueText.height) + py * 2;

    this.bg.clear();
    this.bg.roundRect(0, 0, totalW, totalH, r).fill(THEME.colors.bg_card);
  }
}
