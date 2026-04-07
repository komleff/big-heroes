import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { THEME } from '../config/ThemeConfig';
import { createPveBackground } from '../ui/GradientBackground';

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
    itemCount: number;              // количество предметов в рюкзаке экспедиции
    onChoose: (variantIndex: number) => void;
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
 * Чистая функция — без side-effects.
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
    // Варианты с жертвой предмета (lose_item) требуют наличия предметов
    if (effects.some(e => e.type === 'lose_item') && itemCount === 0) return false;
    return true;
}

/**
 * Сцена случайного PvE-события — показывает описание события
 * и 2–3 варианта выбора. Игрок обязан выбрать один из вариантов.
 */
export class EventScene extends BaseScene {
    /** Данные текущего события */
    private eventData: EventSceneData | null = null;

    constructor() {
        super();
    }

    onEnter(data?: unknown): void {
        const sceneData = data as EventSceneData;
        if (!sceneData?.event) return;

        this.eventData = sceneData;
        this.buildUI();
    }

    // ───────────────────────────── Построение UI ─────────────────────────

    private buildUI(): void {
        this.removeChildren();

        this.buildBackground();
        this.buildHeading();
        this.buildEventName();
        this.buildEventDescription();
        this.buildVariants();
    }

    // ───────────────────────────── Фон ───────────────────────────────────

    private buildBackground(): void {
        this.addChild(createPveBackground(W, THEME.layout.designHeight));
    }

    // ───────────────────────────── Заголовок ─────────────────────────────

    private buildHeading(): void {
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
    }

    // ───────────────────────────── Название события ──────────────────────

    private buildEventName(): void {
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
    }

    // ───────────────────────────── Описание события ──────────────────────

    private buildEventDescription(): void {
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
    }

    // ───────────────────────────── Варианты выбора ───────────────────────

    private buildVariants(): void {
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

        // Фон карточки
        const cardBg = new Graphics();
        cardBg.roundRect(0, 0, CARD_W, CARD_H, CARD_R);
        cardBg.fill(THEME.colors.bg_secondary);
        card.addChild(cardBg);

        // Название варианта
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

        // Описание варианта
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

        // Доступность варианта
        if (conditionMet) {
            card.eventMode = 'static';
            card.cursor = 'pointer';
            card.on('pointerdown', () => {
                this.eventData!.onChoose(index);
            });
        } else {
            // Условие не выполнено — визуально затеняем
            card.alpha = 0.4;
            card.eventMode = 'none';
        }

        this.addChild(card);
    }
}
