import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { THEME } from '../config/ThemeConfig';

/** Параметры конструктора ProgressBar */
interface ProgressBarOptions {
  width: number;
  max: number;
  current: number;
}

/**
 * Полоса прогресса с фоновым треком, заливкой и текстом «current / max».
 */
export class ProgressBar extends Container {
  /** Графика заливки — перерисовывается при обновлении */
  private readonly fillBar: Graphics;

  /** Текст текущего/максимального значения */
  private readonly valueLabel: Text;

  /** Ширина компонента */
  private readonly barWidth: number;

  /** Высота полосы */
  private readonly barHeight = 16;

  /** Текущее значение */
  private current: number;

  /** Максимальное значение */
  private max: number;

  constructor(options: ProgressBarOptions) {
    super();

    this.barWidth = options.width;
    this.current = options.current;
    this.max = options.max;

    const r = THEME.layout.borderRadius.progressBar;

    // Трек (фоновая дорожка)
    const track = new Graphics();
    track.roundRect(0, 0, this.barWidth, this.barHeight, r).fill(THEME.colors.progress_track);
    this.addChild(track);

    // Заливка
    this.fillBar = new Graphics();
    this.addChild(this.fillBar);
    this.drawFill();

    // Текст по центру
    this.valueLabel = new Text({
      text: `${this.current} / ${this.max}`,
      style: new TextStyle({
        fontSize: THEME.font.sizes.progressText,
        fontFamily: THEME.font.family,
        fontWeight: THEME.font.weights.bold,
        fill: THEME.colors.text_primary,
      }),
    });
    this.valueLabel.anchor.set(0.5);
    this.valueLabel.x = this.barWidth / 2;
    this.valueLabel.y = this.barHeight / 2;
    this.addChild(this.valueLabel);
  }

  /** Обновляет прогресс; max — необязателен */
  update(current: number, max?: number): void {
    this.current = current;
    if (max !== undefined) {
      this.max = max;
    }
    this.drawFill();
    this.valueLabel.text = `${this.current} / ${this.max}`;
  }

  /** Перерисовывает полоску заливки */
  private drawFill(): void {
    const r = THEME.layout.borderRadius.progressBar;
    const ratio = this.max > 0 ? Math.min(this.current / this.max, 1) : 0;
    const fillWidth = this.barWidth * ratio;

    this.fillBar.clear();
    if (fillWidth > 0) {
      this.fillBar.roundRect(0, 0, fillWidth, this.barHeight, r).fill(THEME.colors.accent_green);
    }
  }
}
