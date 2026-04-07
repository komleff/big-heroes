import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { THEME } from '../config/ThemeConfig';
import { Button } from '../ui/Button';
import { createPveBackground } from '../ui/GradientBackground';

/** Данные, передаваемые в сцену через onEnter */
interface ShopSceneData {
    shopItems: Array<{ itemId: string; itemType: 'equipment' | 'consumable'; price: number }>;
    gold: number;
    onBuy: (index: number) => void;
    onRepair: () => void;
    onLeave: () => void;
    repairCost: number;
}

/** Ширина дизайна */
const W = THEME.layout.designWidth; // 390

/** Ширина карточки товара */
const CARD_W = 358;
/** Высота карточки товара */
const CARD_H = 80;
/** Радиус скругления карточки */
const CARD_R = THEME.layout.borderRadius.card; // 12

/**
 * Сцена магазина PvE — показывает 3-4 товара и кнопку ремонта.
 * Игрок может купить предмет, починить снаряжение или уйти.
 */
export class ShopScene extends BaseScene {
    /** Текущее золото игрока */
    private gold = 0;
    /** Список товаров */
    private shopItems: ShopSceneData['shopItems'] = [];
    /** Callback покупки */
    private onBuy: ((index: number) => void) | null = null;
    /** Callback ремонта */
    private onRepairCb: (() => void) | null = null;
    /** Callback выхода */
    private onLeaveCb: (() => void) | null = null;
    /** Стоимость ремонта */
    private repairCost = 0;

    constructor() {
        super();
    }

    onEnter(data?: unknown): void {
        const d = data as ShopSceneData;
        this.shopItems = d.shopItems ?? [];
        this.gold = d.gold ?? 0;
        this.onBuy = d.onBuy ?? null;
        this.onRepairCb = d.onRepair ?? null;
        this.onLeaveCb = d.onLeave ?? null;
        this.repairCost = d.repairCost ?? 0;
        this.buildUI();
    }

    // ───────────────────────────── Построение UI ─────────────────────────

    /** Собрать весь интерфейс магазина */
    private buildUI(): void {
        this.removeChildren();
        this.buildBackground();
        this.buildHeading();
        this.buildGoldDisplay();
        this.buildShopItems();
        this.buildRepairButton();
        this.buildLeaveButton();
    }

    // ───────────────────────────── Фон ───────────────────────────────────

    private buildBackground(): void {
        this.addChild(createPveBackground(W, THEME.layout.designHeight));
    }

    // ───────────────────────────── Заголовок ─────────────────────────────

    private buildHeading(): void {
        const heading = new Text({
            text: 'МАГАЗИН',
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

    // ───────────────────────────── Отображение золота ────────────────────

    private buildGoldDisplay(): void {
        const goldText = new Text({
            text: `Gold: ${this.gold}`,
            style: new TextStyle({
                fontSize: THEME.font.sizes.resourceBar,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.accent_yellow,
            }),
        });
        goldText.anchor.set(0.5, 0);
        goldText.x = W / 2;
        goldText.y = 100;
        this.addChild(goldText);
    }

    // ───────────────────────────── Карточки товаров ──────────────────────

    private buildShopItems(): void {
        const startY = 150;
        const gap = THEME.layout.spacing.gap; // 12

        this.shopItems.forEach((item, index) => {
            const canAfford = this.gold >= item.price;
            const cardY = startY + index * (CARD_H + gap);
            this.buildItemCard(item, index, cardY, canAfford);
        });
    }

    /** Карточка одного товара */
    private buildItemCard(
        item: ShopSceneData['shopItems'][number],
        index: number,
        y: number,
        canAfford: boolean,
    ): void {
        const card = new Container();
        card.x = (W - CARD_W) / 2;
        card.y = y;

        // Фон карточки
        const cardBg = new Graphics();
        cardBg.roundRect(0, 0, CARD_W, CARD_H, CARD_R);
        cardBg.fill(THEME.colors.bg_secondary);
        card.addChild(cardBg);

        // Иконка типа предмета (слева)
        const icon = new Text({
            text: item.itemType === 'equipment' ? '\u2694\uFE0F' : '\uD83E\uDDEA',
            style: new TextStyle({
                fontSize: 28,
                fontFamily: THEME.font.family,
            }),
        });
        icon.anchor.set(0, 0.5);
        icon.x = THEME.layout.spacing.cardPadding;
        icon.y = CARD_H / 2;
        card.addChild(icon);

        // Название предмета
        const nameLabel = new Text({
            text: item.itemId,
            style: new TextStyle({
                fontSize: THEME.font.sizes.itemName,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
            }),
        });
        nameLabel.anchor.set(0, 0.5);
        nameLabel.x = 52;
        nameLabel.y = CARD_H / 2;
        card.addChild(nameLabel);

        // Цена (справа)
        const priceLabel = new Text({
            text: `${item.price} Gold`,
            style: new TextStyle({
                fontSize: THEME.font.sizes.itemName,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: canAfford ? THEME.colors.accent_yellow : THEME.colors.text_muted,
            }),
        });
        priceLabel.anchor.set(1, 0.5);
        priceLabel.x = CARD_W - THEME.layout.spacing.cardPadding;
        priceLabel.y = CARD_H / 2;
        card.addChild(priceLabel);

        // Если не хватает золота — приглушаем карточку
        if (!canAfford) {
            card.alpha = 0.5;
        }

        // Обработка нажатия — только если хватает золота
        if (canAfford) {
            card.eventMode = 'static';
            card.cursor = 'pointer';
            card.on('pointertap', () => {
                this.onBuy?.(index);
            });
        }

        this.addChild(card);
    }

    // ───────────────────────────── Кнопка ремонта ────────────────────────

    private buildRepairButton(): void {
        const itemCount = this.shopItems.length;
        const startY = 150;
        const gap = THEME.layout.spacing.gap;
        const repairY = startY + itemCount * (CARD_H + gap) + gap;

        const canAffordRepair = this.gold >= this.repairCost;

        const repairBtn = new Button({
            text: `РЕМОНТ — ${this.repairCost} Gold`,
            variant: 'secondary',
            width: CARD_W,
            onClick: () => {
                if (canAffordRepair) {
                    this.onRepairCb?.();
                }
            },
        });
        repairBtn.x = W / 2;
        repairBtn.y = repairY;

        // Приглушаем, если не хватает золота
        if (!canAffordRepair) {
            repairBtn.alpha = 0.5;
            repairBtn.eventMode = 'none';
        }

        this.addChild(repairBtn);
    }

    // ───────────────────────────── Кнопка выхода ────────────────────────

    private buildLeaveButton(): void {
        const leaveBtn = new Button({
            text: 'УЙТИ',
            variant: 'danger',
            onClick: () => {
                this.onLeaveCb?.();
            },
        });
        leaveBtn.x = W / 2;
        leaveBtn.y = 700;
        this.addChild(leaveBtn);
    }
}
