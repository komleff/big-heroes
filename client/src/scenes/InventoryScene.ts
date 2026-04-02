import { Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { SceneManager, TransitionType } from '../core/SceneManager';
import { Button } from '../ui/Button';
import { THEME } from '../config/ThemeConfig';

/**
 * Заглушка сцены «Инвентарь» — управление снаряжением.
 * Будет заменена полноценной реализацией.
 */
export class InventoryScene extends BaseScene {
    private readonly sceneManager: SceneManager;

    constructor(sceneManager: SceneManager) {
        super();
        this.sceneManager = sceneManager;
    }

    onEnter(): void {
        // Фон на весь экран
        const bg = new Graphics();
        bg.rect(0, 0, THEME.layout.designWidth, THEME.layout.designHeight);
        bg.fill(THEME.colors.bg_primary);
        this.addChild(bg);

        // Заголовок
        const heading = new Text({
            text: 'ИНВЕНТАРЬ',
            style: new TextStyle({
                fontSize: THEME.font.sizes.heading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.black,
                fill: THEME.colors.text_primary,
            }),
        });
        heading.anchor.set(0.5, 0);
        heading.x = THEME.layout.designWidth / 2;
        heading.y = THEME.layout.spacing.topOffset;
        this.addChild(heading);

        // Подзаголовок
        const subheading = new Text({
            text: 'Управление снаряжением — скоро',
            style: new TextStyle({
                fontSize: THEME.font.sizes.subheading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.text_secondary,
            }),
        });
        subheading.anchor.set(0.5, 0);
        subheading.x = THEME.layout.designWidth / 2;
        subheading.y = 100;
        this.addChild(subheading);

        // Кнопка «Назад в хаб»
        const backBtn = new Button({
            text: '← НАЗАД В ХАБ',
            variant: 'danger',
            onClick: () => {
                this.sceneManager.back({ transition: TransitionType.SLIDE_RIGHT });
            },
        });
        backBtn.x = 39 + THEME.layout.buttonWidth / 2;
        backBtn.y = 400;
        this.addChild(backBtn);
    }
}
