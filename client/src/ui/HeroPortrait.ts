import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { THEME } from '../config/ThemeConfig';

/** Параметры конструктора HeroPortrait */
interface HeroPortraitOptions {
  mass: number;
  rating: number;
}

/**
 * Блок аватара героя с числами массы и рейтинга.
 * Ширина ~200, содержимое центрировано.
 */
export class HeroPortrait extends Container {
  /** Ширина контейнера */
  private static readonly WIDTH = 200;

  /** Текст числа массы */
  private readonly massText: Text;

  /** Текст числа рейтинга */
  private readonly ratingText: Text;

  constructor(options: HeroPortraitOptions) {
    super();

    const cx = HeroPortrait.WIDTH / 2;
    const avatarSize = THEME.layout.avatar.size;
    const avatarR = THEME.layout.borderRadius.avatar;
    let yOffset = 0;

    // Аватар — квадрат с обводкой
    const avatar = new Graphics();
    const avatarX = cx - avatarSize / 2;
    avatar
      .roundRect(avatarX, yOffset, avatarSize, avatarSize, avatarR)
      .fill(THEME.colors.bg_secondary)
      .stroke({ color: THEME.colors.accent_cyan, width: 3 });
    this.addChild(avatar);

    yOffset += avatarSize + 8;

    // Лейбл «Масса»
    const massLabel = new Text({
      text: 'Масса',
      style: new TextStyle({
        fontSize: THEME.font.sizes.small,
        fontFamily: THEME.font.family,
        fontWeight: THEME.font.weights.bold,
        fill: THEME.colors.text_secondary,
      }),
    });
    massLabel.anchor.set(0.5, 0);
    massLabel.x = cx;
    massLabel.y = yOffset;
    this.addChild(massLabel);

    yOffset += massLabel.height + 2;

    // Число массы
    this.massText = new Text({
      text: String(options.mass),
      style: new TextStyle({
        fontSize: THEME.font.sizes.massNumber,
        fontFamily: THEME.font.family,
        fontWeight: THEME.font.weights.extraBold,
        fill: THEME.colors.accent_cyan,
      }),
    });
    this.massText.anchor.set(0.5, 0);
    this.massText.x = cx;
    this.massText.y = yOffset;
    this.addChild(this.massText);

    yOffset += this.massText.height + 6;

    // Лейбл «Рейтинг»
    const ratingLabel = new Text({
      text: 'Рейтинг',
      style: new TextStyle({
        fontSize: THEME.font.sizes.small,
        fontFamily: THEME.font.family,
        fontWeight: THEME.font.weights.bold,
        fill: THEME.colors.text_secondary,
      }),
    });
    ratingLabel.anchor.set(0.5, 0);
    ratingLabel.x = cx;
    ratingLabel.y = yOffset;
    this.addChild(ratingLabel);

    yOffset += ratingLabel.height + 2;

    // Число рейтинга
    this.ratingText = new Text({
      text: String(options.rating),
      style: new TextStyle({
        fontSize: THEME.font.sizes.ratingNumber,
        fontFamily: THEME.font.family,
        fontWeight: THEME.font.weights.bold,
        fill: THEME.colors.text_primary,
      }),
    });
    this.ratingText.anchor.set(0.5, 0);
    this.ratingText.x = cx;
    this.ratingText.y = yOffset;
    this.addChild(this.ratingText);
  }

  /** Обновляет значения массы и рейтинга */
  update(mass: number, rating: number): void {
    this.massText.text = String(mass);
    this.ratingText.text = String(rating);
  }
}
