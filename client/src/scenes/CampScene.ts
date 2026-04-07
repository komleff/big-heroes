import { Text, TextStyle } from 'pixi.js';
import { createPveBackground } from '../ui/GradientBackground';
import { BaseScene } from './BaseScene';
import { THEME } from '../config/ThemeConfig';
import { Button } from '../ui/Button';

/** Данные, передаваемые в сцену через onEnter */
interface CampSceneData {
    onRepair: () => string;     // починить → возвращает описание результата
    onTrain: () => string;      // тренировка → возвращает описание результата
    onContinue: () => void;     // продолжить (переход к следующему узлу)
    trainMassMin: number;       // 3
    trainMassMax: number;       // 5
}

/** Ширина дизайна */
const W = THEME.layout.designWidth; // 390

/**
 * Сцена лагеря — привал с возможностью починки или тренировки.
 * По GDD разрешено только ОДНО действие за привал (починка ИЛИ тренировка).
 * После выбора показывается экран результата с кнопкой «Продолжить».
 */
export class CampScene extends BaseScene {
    private sceneData: CampSceneData | null = null;

    constructor() {
        super();
    }

    onEnter(data?: unknown): void {
        this.sceneData = data as CampSceneData;
        this.buildChoiceUI();
    }

    // ───────────────────────────── Экран выбора действия ─────────────────

    private buildChoiceUI(): void {
        // Уничтожаем дочерние элементы для освобождения GPU-памяти
        for (const child of this.removeChildren()) {
            child.destroy({ children: true });
        }

        // Фон
        this.addChild(createPveBackground(W, THEME.layout.designHeight));

        // Заголовок
        const heading = new Text({
            text: 'ЛАГЕРЬ',
            style: new TextStyle({
                fontSize: THEME.font.sizes.heading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.black,
                fill: THEME.colors.text_primary,
            }),
        });
        heading.anchor.set(0.5, 0);
        heading.x = W / 2;
        heading.y = THEME.layout.spacing.topOffset;
        this.addChild(heading);

        // Иконка
        const icon = new Text({
            text: '\uD83C\uDFD5\uFE0F',
            style: new TextStyle({ fontSize: 64, fontFamily: THEME.font.family }),
        });
        icon.anchor.set(0.5, 0);
        icon.x = W / 2;
        icon.y = 120;
        this.addChild(icon);

        // Подзаголовок
        const sub = new Text({
            text: 'Выберите действие',
            style: new TextStyle({
                fontSize: THEME.font.sizes.subheading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_secondary,
            }),
        });
        sub.anchor.set(0.5, 0);
        sub.x = W / 2;
        sub.y = 200;
        this.addChild(sub);

        // Кнопка «ПОЧИНИТЬ»
        const repairBtn = new Button({
            text: 'ПОЧИНИТЬ',
            variant: 'primary',
            onClick: () => {
                const result = this.sceneData!.onRepair();
                this.buildResultUI('\uD83D\uDD27', 'Починка', result);
            },
        });
        repairBtn.x = W / 2;
        repairBtn.y = 280;
        this.addChild(repairBtn);

        const repairHint = new Text({
            text: '+1 прочность',
            style: new TextStyle({
                fontSize: 10,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
            }),
        });
        repairHint.anchor.set(0.5, 0);
        repairHint.x = W / 2;
        repairHint.y = 280 + THEME.layout.buttonHeight.primary + 4;
        this.addChild(repairHint);

        // Кнопка «ТРЕНИРОВКА»
        const trainBtn = new Button({
            text: 'ТРЕНИРОВКА',
            variant: 'secondary',
            onClick: () => {
                const result = this.sceneData!.onTrain();
                this.buildResultUI('\uD83C\uDFCB\uFE0F', 'Тренировка', result);
            },
        });
        trainBtn.x = W / 2;
        trainBtn.y = 380;
        this.addChild(trainBtn);

        const trainHint = new Text({
            text: `+${this.sceneData!.trainMassMin}-${this.sceneData!.trainMassMax} кг массы`,
            style: new TextStyle({
                fontSize: 10,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
            }),
        });
        trainHint.anchor.set(0.5, 0);
        trainHint.x = W / 2;
        trainHint.y = 380 + THEME.layout.buttonHeight.secondary + 4;
        this.addChild(trainHint);
    }

    // ───────────────────────────── Экран результата ──────────────────────

    private buildResultUI(icon: string, title: string, description: string): void {
        // Уничтожаем дочерние элементы для освобождения GPU-памяти
        for (const child of this.removeChildren()) {
            child.destroy({ children: true });
        }

        // Фон
        this.addChild(createPveBackground(W, THEME.layout.designHeight));

        // Заголовок
        const heading = new Text({
            text: 'ЛАГЕРЬ',
            style: new TextStyle({
                fontSize: THEME.font.sizes.heading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.black,
                fill: THEME.colors.text_primary,
            }),
        });
        heading.anchor.set(0.5, 0);
        heading.x = W / 2;
        heading.y = THEME.layout.spacing.topOffset;
        this.addChild(heading);

        // Иконка результата
        const iconText = new Text({
            text: icon,
            style: new TextStyle({ fontSize: 64, fontFamily: THEME.font.family }),
        });
        iconText.anchor.set(0.5, 0);
        iconText.x = W / 2;
        iconText.y = 140;
        this.addChild(iconText);

        // Название действия
        const titleText = new Text({
            text: title,
            style: new TextStyle({
                fontSize: 24,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.accent_cyan,
            }),
        });
        titleText.anchor.set(0.5, 0);
        titleText.x = W / 2;
        titleText.y = 230;
        this.addChild(titleText);

        // Описание результата
        const descText = new Text({
            text: description,
            style: new TextStyle({
                fontSize: THEME.font.sizes.subheading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.text_primary,
                wordWrap: true,
                wordWrapWidth: W - 48,
                align: 'center',
            }),
        });
        descText.anchor.set(0.5, 0);
        descText.x = W / 2;
        descText.y = 280;
        this.addChild(descText);

        // Кнопка «ПРОДОЛЖИТЬ»
        const continueBtn = new Button({
            text: 'ПРОДОЛЖИТЬ',
            variant: 'primary',
            onClick: () => this.sceneData!.onContinue(),
        });
        continueBtn.x = W / 2;
        continueBtn.y = 420;
        this.addChild(continueBtn);
    }
}
