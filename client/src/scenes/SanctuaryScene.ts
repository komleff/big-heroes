import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { createPveBackground } from '../ui/GradientBackground';
import { BaseScene } from './BaseScene';
import { THEME } from '../config/ThemeConfig';
import type { IRelicConfig } from 'shared';

/** Данные, передаваемые в onEnter */
interface SanctuarySceneData {
    relicPool: IRelicConfig[];
    onSelect: (selectedIndex: number) => void;
    title?: string; // Заголовок экрана (по умолчанию "СВЯТИЛИЩЕ")
}

/** Ширина дизайна */
const W = THEME.layout.designWidth; // 390

/** Высота одной карточки реликвии */
const CARD_H = 140;

/** Ширина карточки (390 - 16*2) */
const CARD_W = W - THEME.layout.spacing.screenPadding * 2; // 358

/** Скругление карточки */
const CARD_RADIUS = 14;

/** Вертикальный отступ между карточками */
const CARD_GAP = THEME.layout.spacing.gap; // 12

/** Цвет редкости по строковому ключу */
function getRarityColor(rarity: string): number {
    switch (rarity) {
        case 'rare': return THEME.colors.accent_yellow;
        case 'uncommon': return THEME.colors.accent_green;
        default: return THEME.colors.text_secondary;
    }
}

/** Локализованная метка редкости */
function getRarityLabel(rarity: string): string {
    switch (rarity) {
        case 'rare': return 'Редкая';
        case 'uncommon': return 'Необычная';
        default: return 'Обычная';
    }
}

/** Человекочитаемое описание эффекта реликвии */
function getEffectDescription(effect: string, value: number): string {
    switch (effect) {
        case 'strength_bonus': return `+${value} к силе`;
        case 'armor_bonus': return `+${value} к броне`;
        case 'luck_bonus': return `+${value} к удаче`;
        case 'gold_bonus': return `+${Math.round(value * 100)}% Gold`;
        case 'mass_bonus': return `+${Math.round(value * 100)}% массы`;
        case 'extra_loot': return `+${value} предмет из сундуков`;
        case 'mass_on_win': return `+${Math.round(value * 100)}% массы за победу`;
        case 'first_strike': return `+${Math.round(value * 100)}% урона первого удара`;
        case 'thorns': return `${Math.round(value * 100)}% отражённого урона`;
        case 'enemy_strength_reduction': return `−${Math.round(value * 100)}% силы врага`;
        case 'boss_armor': return `+${value} брони vs босс`;
        case 'reveal_all': return 'Все «???» раскрыты';
        case 'safe_retreat': return 'Отступление всегда 100%';
        case 'safe_bypass': return 'Обход всегда 100%';
        case 'extra_backpack': return `+${value} слота рюкзака`;
        case 'no_durability': return 'Нет износа снаряжения';
        case 'camp_repair_bonus': return `+${value} к ремонту в лагере`;
        case 'shop_discount': return `−${Math.round(value * 100)}% в магазине`;
        case 'polymorph_bonus': return `+${Math.round(value * 100)}% полиморфа`;
        default: return effect;
    }
}

/**
 * Сцена святилища — выбор реликвии из предложенного пула.
 * Используется на узлах sanctuary, ancient_chest и после победы над боссом.
 * Бизнес-логика (формирование пула, применение реликвии) — снаружи, через onSelect callback.
 */
export class SanctuaryScene extends BaseScene {
    /** Контейнеры карточек для управления подсветкой */
    private cardContainers: Container[] = [];

    /** Callback выбора, передаётся через onEnter */
    private onSelectCallback: ((index: number) => void) | null = null;

    /** Флаг блокировки повторного тапа */
    private selectionMade = false;

    constructor() {
        super();
    }

    onEnter(data?: unknown): void {
        const enterData = data as SanctuarySceneData | undefined;
        if (!enterData?.relicPool || !enterData.onSelect) {
            throw new Error('SanctuaryScene: data.relicPool и data.onSelect обязательны');
        }

        this.onSelectCallback = enterData.onSelect;
        this.selectionMade = false;
        this.cardContainers = [];

        // Фон (градиент PvE)
        this.addChild(createPveBackground(W, THEME.layout.designHeight));

        // Заголовок (настраиваемый)
        this.buildHeading(enterData.title);

        // Подзаголовок
        this.buildSubheading();

        // Карточки реликвий
        this.buildRelicCards(enterData.relicPool);
    }

    // ───────────────────────────── Заголовок ─────────────────────────────

    private buildHeading(title?: string): void {
        const heading = new Text({
            text: title ?? 'СВЯТИЛИЩЕ',
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

    // ───────────────────────────── Подзаголовок ──────────────────────────

    private buildSubheading(): void {
        const sub = new Text({
            text: 'Выберите реликвию',
            style: new TextStyle({
                fontSize: THEME.font.sizes.subheading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_secondary,
            }),
        });
        sub.anchor.set(0.5, 0);
        sub.x = W / 2;
        sub.y = 100;
        this.addChild(sub);
    }

    // ───────────────────────────── Карточки реликвий ─────────────────────

    private buildRelicCards(relicPool: IRelicConfig[]): void {
        const startY = 160;
        const padX = THEME.layout.spacing.screenPadding; // 16

        for (let i = 0; i < relicPool.length; i++) {
            const relic = relicPool[i];
            const card = this.buildRelicCard(relic, i);
            card.x = padX;
            card.y = startY + i * (CARD_H + CARD_GAP);
            this.addChild(card);
            this.cardContainers.push(card);
        }
    }

    /** Построение одной карточки реликвии */
    private buildRelicCard(relic: IRelicConfig, index: number): Container {
        const card = new Container();
        card.eventMode = 'static';
        card.cursor = 'pointer';

        // Фон карточки
        const cardBg = new Graphics();
        cardBg.roundRect(0, 0, CARD_W, CARD_H, CARD_RADIUS);
        cardBg.fill(THEME.colors.bg_secondary);
        cardBg.label = 'card-bg';
        card.addChild(cardBg);

        // Бейдж редкости (верхний правый угол)
        this.buildRarityBadge(card, relic.rarity);

        // Название реликвии
        const nameText = new Text({
            text: relic.name,
            style: new TextStyle({
                fontSize: 18,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
            }),
        });
        nameText.x = 16;
        nameText.y = 16;
        card.addChild(nameText);

        // Описание эффекта
        const effectText = new Text({
            text: getEffectDescription(relic.effect, relic.value),
            style: new TextStyle({
                fontSize: THEME.font.sizes.rewardLabel, // 13
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
                wordWrap: true,
                wordWrapWidth: CARD_W - 32,
            }),
        });
        effectText.x = 16;
        effectText.y = 46;
        card.addChild(effectText);

        // Числовое значение эффекта
        const valueText = new Text({
            text: this.formatValue(relic.effect, relic.value),
            style: new TextStyle({
                fontSize: THEME.font.sizes.small, // 14
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.accent_cyan,
            }),
        });
        valueText.x = 16;
        valueText.y = 74;
        card.addChild(valueText);

        // Обработчик тапа
        card.on('pointerdown', () => {
            this.onCardTap(index);
        });

        return card;
    }

    /** Бейдж редкости — цветная «пилюля» в правом верхнем углу */
    private buildRarityBadge(card: Container, rarity: string): void {
        const label = getRarityLabel(rarity);
        const color = getRarityColor(rarity);

        const badgeText = new Text({
            text: label,
            style: new TextStyle({
                fontSize: 11,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
            }),
        });

        // Размеры пилюли с паддингами
        const pillPadX = THEME.layout.spacing.pillPadding.x; // 16
        const pillPadY = THEME.layout.spacing.pillPadding.y; // 8
        const pillW = badgeText.width + pillPadX * 2;
        const pillH = badgeText.height + pillPadY * 2;

        const pillBg = new Graphics();
        pillBg.roundRect(0, 0, pillW, pillH, THEME.layout.borderRadius.pill);
        pillBg.fill(color);

        // Позиция — верхний правый угол с отступом
        const pillX = CARD_W - pillW - 12;
        const pillY = 12;

        pillBg.x = pillX;
        pillBg.y = pillY;
        card.addChild(pillBg);

        badgeText.x = pillX + pillPadX;
        badgeText.y = pillY + pillPadY;
        card.addChild(badgeText);
    }

    /** Форматирование значения для отображения под описанием */
    private formatValue(effect: string, value: number): string {
        // Эффекты без числового значения — не показываем строку
        const noValueEffects = ['reveal_all', 'safe_retreat', 'safe_bypass', 'no_durability'];
        if (noValueEffects.includes(effect)) return '';

        // Процентные эффекты
        const percentEffects = [
            'gold_bonus', 'mass_bonus', 'mass_on_win', 'first_strike',
            'thorns', 'enemy_strength_reduction', 'shop_discount', 'polymorph_bonus',
        ];
        if (percentEffects.includes(effect)) {
            return `${Math.round(value * 100)}%`;
        }

        // Целочисленные эффекты
        return `+${value}`;
    }

    // ───────────────────────────── Обработка выбора ──────────────────────

    /** Обработка тапа по карточке */
    private onCardTap(index: number): void {
        if (this.selectionMade) return;
        this.selectionMade = true;

        // Подсветка выбранной карточки, затемнение остальных
        for (let i = 0; i < this.cardContainers.length; i++) {
            const card = this.cardContainers[i];

            if (i === index) {
                // Зелёная обводка выбранной карточки
                const border = new Graphics();
                border.roundRect(0, 0, CARD_W, CARD_H, CARD_RADIUS);
                border.stroke({ color: THEME.colors.accent_green, width: 3 });
                border.label = 'sel-border';
                card.addChild(border);
            } else {
                // Затемнение невыбранных карточек
                card.alpha = 0.3;
                card.eventMode = 'none';
            }
        }

        // Вызов callback с небольшой задержкой для визуальной обратной связи
        setTimeout(() => {
            this.onSelectCallback?.(index);
        }, THEME.animation.transitionMs);
    }
}
