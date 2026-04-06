import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { THEME } from '../config/ThemeConfig';
import { Button } from '../ui/Button';

/** Элемент лута */
interface LootDrop {
    itemId: string;
    itemType: 'equipment' | 'consumable';
    tierBoosted: boolean;
}

/** Данные, передаваемые в сцену через onEnter */
interface LootSceneData {
    drops: LootDrop[];
    onTake?: (drop: LootDrop) => void;
    onComplete: () => void;
}

/** Ширина дизайна */
const W = THEME.layout.designWidth; // 390

/**
 * Сцена добычи — показывает найденные предметы по одному,
 * позволяя игроку взять каждый предмет или пропустить его.
 */
export class LootScene extends BaseScene {
    /** Массив найденных предметов */
    private drops: LootDrop[] = [];
    /** Callback при взятии предмета */
    private onTakeCallback: ((drop: LootDrop) => void) | null = null;
    /** Callback завершения */
    private onComplete: (() => void) | null = null;
    /** Индекс текущего отображаемого предмета */
    private currentIndex = 0;

    constructor() {
        super();
    }

    onEnter(data?: unknown): void {
        const sceneData = data as LootSceneData;
        if (!sceneData?.drops?.length) {
            sceneData?.onComplete?.();
            return;
        }
        this.drops = sceneData.drops;
        this.onTakeCallback = sceneData.onTake ?? null;
        this.onComplete = sceneData.onComplete;
        this.currentIndex = 0;
        this.buildUI();
    }

    // ───────────────────────────── Построение UI ─────────────────────────

    /** Пересобрать весь интерфейс для текущего предмета */
    private buildUI(): void {
        // Очистка предыдущего содержимого
        this.removeChildren();

        const item = this.drops[this.currentIndex];

        // --- Фон ---
        this.buildBackground();

        // --- Заголовок ---
        this.buildHeading();

        // --- Счётчик предметов ---
        this.buildCounter();

        // --- Карточка предмета ---
        this.buildItemCard(item);

        // --- Кнопки действий ---
        this.buildButtons();
    }

    // ───────────────────────────── Фон ───────────────────────────────────

    private buildBackground(): void {
        const bg = new Graphics();
        bg.rect(0, 0, W, THEME.layout.designHeight);
        bg.fill(THEME.colors.bg_primary);
        this.addChild(bg);
    }

    // ───────────────────────────── Заголовок ─────────────────────────────

    private buildHeading(): void {
        const heading = new Text({
            text: 'ДОБЫЧА',
            style: new TextStyle({
                fontSize: THEME.font.sizes.heading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.black,
                fill: THEME.colors.accent_yellow,
            }),
        });
        heading.anchor.set(0.5, 0);
        heading.x = W / 2;
        heading.y = THEME.layout.spacing.topOffset;
        this.addChild(heading);
    }

    // ───────────────────────────── Счётчик ───────────────────────────────

    private buildCounter(): void {
        const counter = new Text({
            text: `Предмет ${this.currentIndex + 1} / ${this.drops.length}`,
            style: new TextStyle({
                fontSize: THEME.font.sizes.subheading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_secondary,
            }),
        });
        counter.anchor.set(0.5, 0);
        counter.x = W / 2;
        counter.y = 100;
        this.addChild(counter);
    }

    // ───────────────────────────── Карточка предмета ─────────────────────

    private buildItemCard(item: LootSceneData['drops'][number]): void {
        const cardW = 300;
        const cardH = 200;
        const cardX = (W - cardW) / 2;
        const cardY = 200;
        const radius = 14;

        const card = new Container();
        card.x = cardX;
        card.y = cardY;

        // Фон карточки
        const cardBg = new Graphics();
        cardBg.roundRect(0, 0, cardW, cardH, radius);
        cardBg.fill(THEME.colors.bg_secondary);
        card.addChild(cardBg);

        // Иконка типа предмета
        const icon = new Text({
            text: item.itemType === 'equipment' ? '\u2694\uFE0F' : '\uD83E\uDDEA',
            style: new TextStyle({
                fontSize: 48,
                fontFamily: THEME.font.family,
            }),
        });
        icon.anchor.set(0.5, 0);
        icon.x = cardW / 2;
        icon.y = 20;
        card.addChild(icon);

        // Название предмета (itemId)
        const nameLabel = new Text({
            text: item.itemId,
            style: new TextStyle({
                fontSize: 18,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
            }),
        });
        nameLabel.anchor.set(0.5, 0);
        nameLabel.x = cardW / 2;
        nameLabel.y = 100;
        card.addChild(nameLabel);

        // Тип предмета
        const typeLabel = new Text({
            text: item.itemType === 'equipment' ? 'Снаряжение' : 'Расходник',
            style: new TextStyle({
                fontSize: THEME.font.sizes.rewardLabel,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
            }),
        });
        typeLabel.anchor.set(0.5, 0);
        typeLabel.x = cardW / 2;
        typeLabel.y = 128;
        card.addChild(typeLabel);

        // Бейдж "PITY!" для tierBoosted предметов
        if (item.tierBoosted) {
            this.buildPityBadge(card, cardW);
        }

        this.addChild(card);
    }

    /** Бейдж «PITY!» — золотая пилюля в верхнем правом углу карточки */
    private buildPityBadge(card: Container, cardW: number): void {
        const badgeText = new Text({
            text: 'PITY!',
            style: new TextStyle({
                fontSize: 12,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.bg_primary,
            }),
        });

        const padX = THEME.layout.spacing.pillPadding.x;
        const padY = THEME.layout.spacing.pillPadding.y;
        const pillW = badgeText.width + padX * 2;
        const pillH = badgeText.height + padY * 2;

        const pill = new Graphics();
        pill.roundRect(0, 0, pillW, pillH, THEME.layout.borderRadius.pill);
        pill.fill(THEME.colors.accent_yellow);

        const badge = new Container();
        badge.x = cardW - pillW - 10;
        badge.y = 10;
        badge.addChild(pill);

        badgeText.x = padX;
        badgeText.y = padY;
        badge.addChild(badgeText);

        card.addChild(badge);
    }

    // ───────────────────────────── Кнопки ────────────────────────────────

    private buildButtons(): void {
        const btnWidth = 140;

        // Кнопка «ВЗЯТЬ»
        const takeBtn = new Button({
            text: 'ВЗЯТЬ',
            variant: 'primary',
            width: btnWidth,
            height: THEME.layout.buttonHeight.primary,
            onClick: () => this.onTake(),
        });
        takeBtn.x = W / 2 - btnWidth / 2 - 10;
        takeBtn.y = 460;
        this.addChild(takeBtn);

        // Кнопка «ПРОПУСТИТЬ»
        const skipBtn = new Button({
            text: 'ПРОПУСТИТЬ',
            variant: 'danger',
            width: btnWidth,
            height: THEME.layout.buttonHeight.danger,
            onClick: () => this.onSkip(),
        });
        skipBtn.x = W / 2 + btnWidth / 2 + 10;
        skipBtn.y = 460;
        this.addChild(skipBtn);
    }

    // ───────────────────────────── Обработчики ───────────────────────────

    /** Игрок берёт предмет — сохранить в экспедицию */
    private onTake(): void {
        const drop = this.drops[this.currentIndex];
        this.onTakeCallback?.(drop);
        this.advance();
    }

    /** Игрок пропускает предмет */
    private onSkip(): void {
        this.advance();
    }

    /** Перейти к следующему предмету или завершить */
    private advance(): void {
        this.currentIndex++;
        if (this.currentIndex >= this.drops.length) {
            this.onComplete?.();
        } else {
            this.buildUI();
        }
    }
}
