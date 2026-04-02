import { Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { SceneManager, TransitionType } from '../core/SceneManager';
import { Button } from '../ui/Button';
import { THEME } from '../config/ThemeConfig';

/** Отступ модального окна от краёв экрана */
const MODAL_INSET = 32;

/**
 * Заглушка модальной сцены «Dev Panel» — инструменты разработчика.
 * Открывается поверх текущей сцены с TransitionType.MODAL.
 * Overlay рисуется SceneManager'ом — здесь только содержимое модалки.
 */
export class DevPanelScene extends BaseScene {
    private readonly sceneManager: SceneManager;

    constructor(sceneManager: SceneManager) {
        super();
        this.sceneManager = sceneManager;
    }

    onEnter(): void {
        const { designWidth, designHeight } = THEME.layout;

        // Координаты и размеры модального окна
        const modalX = MODAL_INSET;
        const modalY = MODAL_INSET;
        const modalW = designWidth - MODAL_INSET * 2;
        const modalH = designHeight - MODAL_INSET * 2;

        // Фон модального окна (не на весь экран)
        const modalBg = new Graphics();
        modalBg.roundRect(modalX, modalY, modalW, modalH, THEME.layout.borderRadius.modal);
        modalBg.fill(THEME.colors.bg_secondary);
        this.addChild(modalBg);

        // Заголовок — центрирован внутри модалки
        const heading = new Text({
            text: 'DEV PANEL',
            style: new TextStyle({
                fontSize: THEME.font.sizes.heading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.black,
                fill: THEME.colors.text_primary,
            }),
        });
        heading.anchor.set(0.5, 0);
        heading.x = designWidth / 2;
        heading.y = modalY + THEME.layout.spacing.topOffset;
        this.addChild(heading);

        // Подзаголовок
        const subheading = new Text({
            text: 'Инструменты разработчика — скоро',
            style: new TextStyle({
                fontSize: THEME.font.sizes.subheading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.text_secondary,
            }),
        });
        subheading.anchor.set(0.5, 0);
        subheading.x = designWidth / 2;
        subheading.y = modalY + 100;
        this.addChild(subheading);

        // Кнопка «Закрыть» — закрывает модалку
        const closeBtn = new Button({
            text: 'ЗАКРЫТЬ',
            variant: 'danger',
            onClick: () => {
                this.sceneManager.back({ transition: TransitionType.MODAL });
            },
        });
        closeBtn.x = designWidth / 2;
        closeBtn.y = modalY + 400;
        this.addChild(closeBtn);
    }
}
