import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { THEME } from '../config/ThemeConfig';

/** Элемент навигации */
export interface NavItem {
  id: string;
  label: string;
  /** Эмодзи-иконка над лейблом */
  icon?: string;
}

/** Параметры конструктора BottomNav */
interface BottomNavOptions {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Нижняя навигационная панель с табами.
 * Поддерживает эмодзи-иконки над текстом.
 * Активный таб подсвечивается цветом accent_yellow с подчёркиванием.
 */
export class BottomNav extends Container {
  /** Массив элементов навигации */
  private readonly items: NavItem[];

  /** Callback выбора таба */
  private readonly onSelect: (id: string) => void;

  /** Текущий активный ID */
  private activeId: string;

  /** Контейнер табов — пересоздаётся при смене активного */
  private tabsContainer: Container;

  /** Ширина одного таба */
  private readonly tabWidth: number;

  constructor(options: BottomNavOptions) {
    super();

    this.items = options.items;
    this.onSelect = options.onSelect;
    this.activeId = options.activeId;

    const totalWidth = THEME.layout.designWidth;
    const height = THEME.layout.bottomNav.height;
    this.tabWidth = totalWidth / this.items.length;

    // Фон панели
    const bg = new Graphics();
    bg.rect(0, 0, totalWidth, height).fill(THEME.colors.bg_secondary);
    this.addChild(bg);

    // Верхняя граница
    const border = new Graphics();
    border.moveTo(0, 0).lineTo(totalWidth, 0).stroke({ color: THEME.colors.border_nav, width: 1 });
    this.addChild(border);

    // Контейнер табов
    this.tabsContainer = new Container();
    this.addChild(this.tabsContainer);
    this.buildTabs();
  }

  /** Меняет активный таб */
  setActive(id: string): void {
    if (this.activeId === id) return;
    this.activeId = id;
    this.rebuildTabs();
  }

  /** Перестраивает табы (удаляет и создаёт заново) */
  private rebuildTabs(): void {
    this.removeChild(this.tabsContainer);
    this.tabsContainer.destroy({ children: true });
    this.tabsContainer = new Container();
    this.addChild(this.tabsContainer);
    this.buildTabs();
  }

  /** Создаёт визуальные элементы табов */
  private buildTabs(): void {
    const height = THEME.layout.bottomNav.height;

    this.items.forEach((item, index) => {
      const isActive = item.id === this.activeId;
      const tabContainer = new Container();
      tabContainer.x = index * this.tabWidth;

      const fillColor = isActive ? THEME.colors.accent_yellow : THEME.colors.text_primary;

      // Иконка (эмодзи) — над лейблом
      if (item.icon) {
        const iconText = new Text({
          text: item.icon,
          style: new TextStyle({
            fontSize: 18,
            fontFamily: THEME.font.family,
          }),
        });
        iconText.anchor.set(0.5);
        iconText.x = this.tabWidth / 2;
        iconText.y = height / 2 - 12;
        tabContainer.addChild(iconText);
      }

      // Текст лейбла
      const label = new Text({
        text: item.label,
        style: new TextStyle({
          fontSize: THEME.font.sizes.navLabel - 1,
          fontFamily: THEME.font.family,
          fontWeight: THEME.font.weights.medium,
          fill: fillColor,
        }),
      });
      label.anchor.set(0.5);
      label.x = this.tabWidth / 2;
      // Если есть иконка — лейбл ниже, иначе по центру
      label.y = item.icon ? height / 2 + 10 : height / 2;
      tabContainer.addChild(label);

      // Подчёркивание активного таба
      if (isActive) {
        const underline = new Graphics();
        const lineWidth = this.tabWidth * 0.6;
        const lineX = (this.tabWidth - lineWidth) / 2;
        underline
          .moveTo(lineX, height - 4)
          .lineTo(lineX + lineWidth, height - 4)
          .stroke({ color: THEME.colors.accent_yellow, width: 2 });
        tabContainer.addChild(underline);
      }

      // Интерактивность
      tabContainer.eventMode = 'static';
      tabContainer.cursor = 'pointer';
      // Хит-область для каждого таба
      const hitArea = new Graphics();
      hitArea.rect(0, 0, this.tabWidth, height).fill({ color: 0x000000, alpha: 0 });
      tabContainer.addChildAt(hitArea, 0);

      tabContainer.on('pointerdown', () => {
        this.setActive(item.id);
        this.onSelect(item.id);
      });

      this.tabsContainer.addChild(tabContainer);
    });
  }
}
