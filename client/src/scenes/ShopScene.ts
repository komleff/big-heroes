import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { THEME } from '../config/ThemeConfig';
import { Button } from '../ui/Button';
import { createPveBackground } from '../ui/GradientBackground';

/** Данные, передаваемые в сцену через onEnter */
interface ShopSceneData {
    shopItems: Array<{ itemId: string; name?: string; itemType: 'equipment' | 'consumable'; price: number }>;
    gold: number;
    repairCost: number;                  // стоимость полного ремонта (0 = ремонт не нужен)
    onBuy: (index: number) => number;    // возвращает оставшееся золото
    onRepair: () => number;              // ремонт, возвращает оставшееся золото
    onLeave: () => void;
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
 * Сцена магазина PvE — показывает 3-4 товара.
 * После покупки UI обновляется (золото, доступность).
 */
export class ShopScene extends BaseScene {
    private gold = 0;
    private repairCost = 0;
    private repaired = false;
    private shopItems: ShopSceneData['shopItems'] = [];
    private boughtIndices = new Set<number>();
    private onBuyCb: ((index: number) => number) | null = null;
    private onRepairCb: (() => number) | null = null;
    private onLeaveCb: (() => void) | null = null;

    constructor() {
        super();
    }

    onEnter(data?: unknown): void {
        const d = data as ShopSceneData;
        this.shopItems = d.shopItems ?? [];
        this.gold = d.gold ?? 0;
        this.repairCost = d.repairCost ?? 0;
        this.repaired = false;
        this.boughtIndices = new Set();
        this.onBuyCb = d.onBuy ?? null;
        this.onRepairCb = d.onRepair ?? null;
        this.onLeaveCb = d.onLeave ?? null;
        this.buildUI();
    }

    // ───────────────────────────── Построение UI ─────────────────────────

    private buildUI(): void {
        // Уничтожаем дочерние элементы для освобождения GPU-памяти
        for (const child of this.removeChildren()) {
            child.destroy({ children: true });
        }

        // Фон
        this.addChild(createPveBackground(W, THEME.layout.designHeight));

        // Заголовок
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

        // Золото
        const goldText = new Text({
            text: `Золото: ${this.gold}`,
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

        // Товары
        const startY = 150;
        const gap = THEME.layout.spacing.gap;

        this.shopItems.forEach((item, index) => {
            const bought = this.boughtIndices.has(index);
            const canAfford = !bought && this.gold >= item.price;
            const cardY = startY + index * (CARD_H + gap);

            const card = new Container();
            card.x = (W - CARD_W) / 2;
            card.y = cardY;

            // Фон карточки
            const cardBg = new Graphics();
            cardBg.roundRect(0, 0, CARD_W, CARD_H, CARD_R);
            cardBg.fill(THEME.colors.bg_secondary);
            card.addChild(cardBg);

            // Иконка
            const icon = new Text({
                text: item.itemType === 'equipment' ? '\u2694\uFE0F' : '\uD83E\uDDEA',
                style: new TextStyle({ fontSize: 28, fontFamily: THEME.font.family }),
            });
            icon.anchor.set(0, 0.5);
            icon.x = THEME.layout.spacing.cardPadding;
            icon.y = CARD_H / 2;
            card.addChild(icon);

            // Название
            const nameLabel = new Text({
                text: item.name ?? item.itemId,
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

            // Цена / статус
            const priceText = bought ? 'Куплено' : `${item.price} Gold`;
            const priceColor = bought
                ? THEME.colors.accent_green
                : canAfford ? THEME.colors.accent_yellow : THEME.colors.text_muted;
            const priceLabel = new Text({
                text: priceText,
                style: new TextStyle({
                    fontSize: THEME.font.sizes.itemName,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.bold,
                    fill: priceColor,
                }),
            });
            priceLabel.anchor.set(1, 0.5);
            priceLabel.x = CARD_W - THEME.layout.spacing.cardPadding;
            priceLabel.y = CARD_H / 2;
            card.addChild(priceLabel);

            if (bought || !canAfford) {
                card.alpha = bought ? 0.6 : 0.5;
            } else {
                card.eventMode = 'static';
                card.cursor = 'pointer';
                card.on('pointertap', () => {
                    this.gold = this.onBuyCb?.(index) ?? this.gold;
                    this.boughtIndices.add(index);
                    this.buildUI(); // перестроить UI с обновлённым золотом
                });
            }

            this.addChild(card);
        });

        let bottomY = startY + this.shopItems.length * (CARD_H + gap) + gap;

        // Кнопка «РЕМОНТ» (если есть повреждённое снаряжение)
        if (this.repairCost > 0 && !this.repaired) {
            const canRepair = this.gold >= this.repairCost;
            const repairBtn = new Button({
                text: `🔧 РЕМОНТ (${this.repairCost} Gold)`,
                variant: canRepair ? 'secondary' : 'danger',
                onClick: () => {
                    if (!canRepair) return;
                    this.gold = this.onRepairCb?.() ?? this.gold;
                    this.repaired = true;
                    this.buildUI();
                },
            });
            repairBtn.x = W / 2;
            repairBtn.y = bottomY;
            this.addChild(repairBtn);
            bottomY += 60;
        } else if (this.repaired) {
            const repairedText = new Text({
                text: '✅ Снаряжение отремонтировано',
                style: new TextStyle({
                    fontSize: THEME.font.sizes.itemName,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.bold,
                    fill: THEME.colors.accent_green,
                }),
            });
            repairedText.anchor.set(0.5, 0);
            repairedText.x = W / 2;
            repairedText.y = bottomY;
            this.addChild(repairedText);
            bottomY += 40;
        }

        // Кнопка «УЙТИ»
        const leaveBtn = new Button({
            text: 'УЙТИ',
            variant: 'danger',
            onClick: () => this.onLeaveCb?.(),
        });
        leaveBtn.x = W / 2;
        leaveBtn.y = bottomY + 20;
        this.addChild(leaveBtn);
    }
}
