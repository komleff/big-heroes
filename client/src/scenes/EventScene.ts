import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { THEME } from '../config/ThemeConfig';
import { createPveBackground } from '../ui/GradientBackground';
import { Button } from '../ui/Button';

/** Данные, передаваемые в сцену через onEnter */
interface EventSceneData {
    event: {
        id: string;
        name: string;
        description: string;
        variants: Array<{
            id: string;
            label: string;
            description: string;
            condition?: { type: string; value: number };
            effects: Array<{ type: string; value: number }>;
        }>;
    };
    gold: number;
    itemCount: number;
    onChoose: (variantIndex: number) => string;  // возвращает описание результата
    onContinue: () => void;                       // продолжить поход
}

/** Ширина дизайна */
const W = THEME.layout.designWidth; // 390

/** Ширина карточки варианта */
const CARD_W = 358;
/** Высота карточки варианта */
const CARD_H = 90;
/** Радиус скругления карточки */
const CARD_R = 14;
/** Начальная Y-позиция списка вариантов */
const VARIANTS_START_Y = 240;
/** Вертикальный отступ между карточками */
const VARIANTS_GAP = 16;

/**
 * Проверка выполнения условия варианта.
 */
function isConditionMet(
    condition: { type: string; value: number } | undefined,
    gold: number,
    itemCount: number,
    effects: Array<{ type: string; value: number }>,
): boolean {
    if (condition) {
        if (condition.type === 'gold_min' && gold < condition.value) return false;
    }
    if (effects.some(e => e.type === 'lose_item') && itemCount === 0) return false;
    return true;
}

/**
 * Сцена случайного PvE-события — показывает описание события
 * и 2–3 варианта выбора. После выбора — экран результата с «Продолжить».
 */
export class EventScene extends BaseScene {
    private eventData: EventSceneData | null = null;

    constructor() {
        super();
    }

    onEnter(data?: unknown): void {
        const sceneData = data as EventSceneData;
        if (!sceneData?.event) return;

        this.eventData = sceneData;
        this.buildChoiceUI();
    }

    // ───────────────────────────── Экран выбора ──────────────────────────

    private buildChoiceUI(): void {
        // Уничтожаем дочерние элементы для освобождения GPU-памяти
        for (const child of this.removeChildren()) {
            child.destroy({ children: true });
        }

        this.addChild(createPveBackground(W, THEME.layout.designHeight));

        // Заголовок
        const heading = new Text({
            text: 'СОБЫТИЕ',
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

        // Название события
        const name = new Text({
            text: this.eventData!.event.name,
            style: new TextStyle({
                fontSize: 22,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.accent_cyan,
            }),
        });
        name.anchor.set(0.5, 0);
        name.x = W / 2;
        name.y = 110;
        this.addChild(name);

        // Описание события
        const desc = new Text({
            text: this.eventData!.event.description,
            style: new TextStyle({
                fontSize: THEME.font.sizes.small,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_secondary,
                wordWrap: true,
                wordWrapWidth: CARD_W,
            }),
        });
        desc.anchor.set(0.5, 0);
        desc.x = W / 2;
        desc.y = 150;
        this.addChild(desc);

        // Варианты
        const variants = this.eventData!.event.variants;
        const gold = this.eventData!.gold;
        const itemCount = this.eventData!.itemCount ?? 0;

        variants.forEach((variant, index) => {
            const met = isConditionMet(variant.condition, gold, itemCount, variant.effects);
            const cardY = VARIANTS_START_Y + index * (CARD_H + VARIANTS_GAP);
            this.buildVariantCard(variant, index, cardY, met);
        });
    }

    /** Карточка одного варианта */
    private buildVariantCard(
        variant: EventSceneData['event']['variants'][number],
        index: number,
        y: number,
        conditionMet: boolean,
    ): void {
        const card = new Container();
        card.x = (W - CARD_W) / 2;
        card.y = y;

        const cardBg = new Graphics();
        cardBg.roundRect(0, 0, CARD_W, CARD_H, CARD_R);
        cardBg.fill(THEME.colors.bg_secondary);
        card.addChild(cardBg);

        const label = new Text({
            text: variant.label,
            style: new TextStyle({
                fontSize: 16,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
            }),
        });
        label.x = THEME.layout.spacing.cardPadding;
        label.y = THEME.layout.spacing.cardPadding;
        card.addChild(label);

        const desc = new Text({
            text: variant.description,
            style: new TextStyle({
                fontSize: 11,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
                wordWrap: true,
                wordWrapWidth: CARD_W - THEME.layout.spacing.cardPadding * 2,
            }),
        });
        desc.x = THEME.layout.spacing.cardPadding;
        desc.y = THEME.layout.spacing.cardPadding + label.height + 6;
        card.addChild(desc);

        if (conditionMet) {
            card.eventMode = 'static';
            card.cursor = 'pointer';
            card.on('pointerdown', () => {
                const result = this.eventData!.onChoose(index);
                this.buildResultUI(variant.label, result);
            });
        } else {
            card.alpha = 0.4;
            card.eventMode = 'none';
        }

        this.addChild(card);
    }

    // ───────────────────────────── Экран результата ──────────────────────

    private buildResultUI(choiceName: string, description: string): void {
        // Уничтожаем дочерние элементы для освобождения GPU-памяти
        for (const child of this.removeChildren()) {
            child.destroy({ children: true });
        }

        this.addChild(createPveBackground(W, THEME.layout.designHeight));

        // Заголовок
        const heading = new Text({
            text: 'СОБЫТИЕ',
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
            text: '\u2753',
            style: new TextStyle({ fontSize: 64, fontFamily: THEME.font.family }),
        });
        icon.anchor.set(0.5, 0);
        icon.x = W / 2;
        icon.y = 140;
        this.addChild(icon);

        // Название выбора
        const titleText = new Text({
            text: choiceName,
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
            onClick: () => this.eventData!.onContinue(),
        });
        continueBtn.x = W / 2;
        continueBtn.y = 420;
        this.addChild(continueBtn);
    }
}
