import { Text, TextStyle } from 'pixi.js';
import { createPveBackground } from '../ui/GradientBackground';
import { BaseScene } from './BaseScene';
import { THEME } from '../config/ThemeConfig';
import { Button } from '../ui/Button';

/** Данные, передаваемые в сцену через onEnter */
interface CampSceneData {
    onRepair: () => void;       // починить +1 прочность
    onTrain: () => void;        // тренировка +3-5 кг массы
    onLeave: () => void;        // выход из лагеря
    trainMassMin: number;       // 3
    trainMassMax: number;       // 5
}

/** Ширина дизайна */
const W = THEME.layout.designWidth; // 390

/**
 * Сцена лагеря — привал с возможностью починки или тренировки.
 * По GDD разрешено только ОДНО действие за привал (починка ИЛИ тренировка).
 * После выбора вызывается соответствующий callback; PveMapScene управляет дальнейшим.
 */
export class CampScene extends BaseScene {
    /** Callback починки */
    private onRepair: (() => void) | null = null;
    /** Callback тренировки */
    private onTrain: (() => void) | null = null;
    /** Callback выхода */
    private onLeave: (() => void) | null = null;
    /** Минимальная масса тренировки */
    private trainMassMin = 0;
    /** Максимальная масса тренировки */
    private trainMassMax = 0;

    constructor() {
        super();
    }

    onEnter(data?: unknown): void {
        const d = data as CampSceneData;
        this.onRepair = d.onRepair;
        this.onTrain = d.onTrain;
        this.onLeave = d.onLeave;
        this.trainMassMin = d.trainMassMin;
        this.trainMassMax = d.trainMassMax;
        this.buildUI();
    }

    // ───────────────────────────── Построение UI ─────────────────────────

    private buildUI(): void {
        this.removeChildren();
        this.buildBackground();
        this.buildHeading();
        this.buildIcon();
        this.buildSubheading();
        this.buildRepairButton();
        this.buildTrainButton();
        this.buildLeaveButton();
    }

    // ───────────────────────────── Фон ───────────────────────────────────

    private buildBackground(): void {
        this.addChild(createPveBackground(W, THEME.layout.designHeight));
    }

    // ───────────────────────────── Заголовок ─────────────────────────────

    private buildHeading(): void {
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
        heading.y = THEME.layout.spacing.topOffset; // 48
        this.addChild(heading);
    }

    // ───────────────────────────── Иконка ────────────────────────────────

    private buildIcon(): void {
        const icon = new Text({
            text: '🏕️',
            style: new TextStyle({
                fontSize: 64,
                fontFamily: THEME.font.family,
            }),
        });
        icon.anchor.set(0.5, 0);
        icon.x = W / 2;
        icon.y = 120;
        this.addChild(icon);
    }

    // ───────────────────────────── Подзаголовок ──────────────────────────

    private buildSubheading(): void {
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
    }

    // ───────────────────────────── Кнопка «ПОЧИНИТЬ» ─────────────────────

    private buildRepairButton(): void {
        const btn = new Button({
            text: 'ПОЧИНИТЬ',
            variant: 'primary',
            onClick: () => this.onRepair?.(),
        });
        btn.x = W / 2;
        btn.y = 280;
        this.addChild(btn);

        // Подпись под кнопкой
        const subtitle = new Text({
            text: '+1 прочность',
            style: new TextStyle({
                fontSize: 10,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
            }),
        });
        subtitle.anchor.set(0.5, 0);
        subtitle.x = W / 2;
        subtitle.y = 280 + THEME.layout.buttonHeight.primary + 4;
        this.addChild(subtitle);
    }

    // ───────────────────────────── Кнопка «ТРЕНИРОВКА» ───────────────────

    private buildTrainButton(): void {
        const btn = new Button({
            text: 'ТРЕНИРОВКА',
            variant: 'secondary',
            onClick: () => this.onTrain?.(),
        });
        btn.x = W / 2;
        btn.y = 380;
        this.addChild(btn);

        // Подпись под кнопкой
        const subtitle = new Text({
            text: `+${this.trainMassMin}-${this.trainMassMax} кг массы`,
            style: new TextStyle({
                fontSize: 10,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
            }),
        });
        subtitle.anchor.set(0.5, 0);
        subtitle.x = W / 2;
        subtitle.y = 380 + THEME.layout.buttonHeight.secondary + 4;
        this.addChild(subtitle);
    }

    // ───────────────────────────── Кнопка «УЙТИ» ────────────────────────

    private buildLeaveButton(): void {
        const btn = new Button({
            text: 'УЙТИ',
            variant: 'danger',
            onClick: () => this.onLeave?.(),
        });
        btn.x = W / 2;
        btn.y = 500;
        this.addChild(btn);
    }
}
