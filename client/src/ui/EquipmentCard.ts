import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { THEME } from '../config/ThemeConfig';
import { DurabilityPips } from './DurabilityPips';
import type { IEquipmentItem } from 'shared';

/** Параметры конструктора EquipmentCard */
interface EquipmentCardOptions {
  slotLabel: string;
  item: IEquipmentItem | null;
  onClick?: () => void;
}

/**
 * Карточка слота экипировки.
 * Показывает название слота, имя предмета и полосу прочности.
 * Пустой слот отображает текст «Пусто».
 */
export class EquipmentCard extends Container {
  /** Фон карточки */
  private readonly bg: Graphics;

  /** Контейнер содержимого — пересоздаётся при update */
  private content: Container;

  /** Название слота */
  private readonly slotLabel: string;

  /** Callback нажатия */
  private readonly onClickCb?: () => void;

  constructor(options: EquipmentCardOptions) {
    super();

    this.slotLabel = options.slotLabel;
    this.onClickCb = options.onClick;

    const w = THEME.layout.equipmentCard.width;
    const h = THEME.layout.equipmentCard.height;
    const r = THEME.layout.borderRadius.card;

    // Фон
    this.bg = new Graphics();
    this.bg.roundRect(0, 0, w, h, r).fill(THEME.colors.bg_card);
    this.addChild(this.bg);

    // Содержимое
    this.content = new Container();
    this.addChild(this.content);
    this.buildContent(options.item);

    // Интерактивность
    this.eventMode = 'static';
    this.cursor = 'pointer';
    if (this.onClickCb) {
      this.on('pointertap', this.onClickCb);
    }
  }

  /** Обновляет предмет в карточке */
  update(item: IEquipmentItem | null): void {
    this.removeChild(this.content);
    this.content.destroy({ children: true });
    this.content = new Container();
    this.addChild(this.content);
    this.buildContent(item);
  }

  /** Строит внутреннее содержимое в зависимости от наличия предмета */
  private buildContent(item: IEquipmentItem | null): void {
    const w = THEME.layout.equipmentCard.width;
    const h = THEME.layout.equipmentCard.height;
    const pad = THEME.layout.spacing.cardPadding;

    // Название слота (всегда показываем)
    const slotText = new Text({
      text: this.slotLabel.toUpperCase(),
      style: new TextStyle({
        fontSize: THEME.font.sizes.small,
        fontFamily: THEME.font.family,
        fontWeight: THEME.font.weights.bold,
        fill: THEME.colors.text_secondary,
      }),
    });
    slotText.x = pad;
    slotText.y = pad;
    this.content.addChild(slotText);

    if (item) {
      // Имя предмета
      const nameText = new Text({
        text: item.name,
        style: new TextStyle({
          fontSize: THEME.font.sizes.itemName,
          fontFamily: THEME.font.family,
          fontWeight: THEME.font.weights.bold,
          fill: THEME.colors.text_primary,
        }),
      });
      nameText.x = pad;
      nameText.y = slotText.y + slotText.height + 4;
      this.content.addChild(nameText);

      // Бонусы — компактно в одну строку
      let nextY = nameText.y + nameText.height + 4;
      const bonusParts: { label: string; color: number }[] = [];
      if (item.strengthBonus > 0) {
        bonusParts.push({ label: `+${item.strengthBonus} Str`, color: THEME.colors.accent_green });
      }
      if (item.armorBonus > 0) {
        bonusParts.push({ label: `+${item.armorBonus} Arm`, color: THEME.colors.accent_cyan });
      }
      if (item.luckBonus > 0) {
        bonusParts.push({ label: `+${item.luckBonus} Luck`, color: THEME.colors.accent_yellow });
      }
      if (bonusParts.length > 0) {
        // Собираем все бонусы в одну строку через пробел
        let bonusX = pad;
        for (let i = 0; i < bonusParts.length; i++) {
          const part = bonusParts[i];
          const prefix = i > 0 ? ' ' : '';
          const bonusText = new Text({
            text: prefix + part.label,
            style: new TextStyle({
              fontSize: THEME.font.sizes.small,
              fontFamily: THEME.font.family,
              fontWeight: THEME.font.weights.bold,
              fill: part.color,
            }),
          });
          bonusText.x = bonusX;
          bonusText.y = nextY;
          this.content.addChild(bonusText);
          bonusX += bonusText.width;
        }
        nextY += THEME.font.sizes.small + 4;
      }

      // Пипсы прочности
      const durabilityPips = new DurabilityPips({
        max: item.maxDurability,
        current: item.currentDurability,
      });
      durabilityPips.x = pad;
      durabilityPips.y = nextY;
      this.content.addChild(durabilityPips);
    } else {
      // Пустой слот — текст «Пусто» по центру
      const emptyText = new Text({
        text: 'Пусто',
        style: new TextStyle({
          fontSize: THEME.font.sizes.small,
          fontFamily: THEME.font.family,
          fontWeight: THEME.font.weights.bold,
          fill: THEME.colors.text_muted,
        }),
      });
      emptyText.anchor.set(0.5);
      emptyText.x = w / 2;
      emptyText.y = h / 2 + 8; // Немного ниже центра, т.к. сверху есть лейбл слота
      this.content.addChild(emptyText);
    }
  }
}
