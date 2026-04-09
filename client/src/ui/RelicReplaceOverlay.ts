import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { THEME } from '../config/ThemeConfig';
import { Button } from './Button';
import type { IRelic } from 'shared';

/** Ширина дизайна */
const W = THEME.layout.designWidth;
const H = THEME.layout.designHeight;

/** Размеры карточки реликвии */
const CARD_W = W - 32 * 2;
const CARD_H = 80;
const CARD_RADIUS = 12;
const CARD_GAP = 8;

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
 * Оверлей выбора замены реликвии при переполнении (max_relics=3).
 * Показывает текущие реликвии + новую, игрок тапает по одной из текущих для замены.
 */
export class RelicReplaceOverlay extends Container {
    private selectionMade = false;

    constructor(
        activeRelics: IRelic[],
        newRelic: IRelic,
        onReplace: (replaceIndex: number) => void,
        onSkip: () => void,
    ) {
        super();

        // Полупрозрачный фон
        const dimBg = new Graphics();
        dimBg.rect(0, 0, W, H);
        dimBg.fill({ color: 0x000000 });
        dimBg.alpha = 0.75;
        dimBg.eventMode = 'static'; // Блокируем тапы под оверлеем
        this.addChild(dimBg);

        // Заголовок: «Новая реликвия»
        const heading = new Text({
            text: 'НОВАЯ РЕЛИКВИЯ',
            style: new TextStyle({
                fontSize: THEME.font.sizes.heading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.black,
                fill: THEME.colors.text_primary,
            }),
        });
        heading.anchor.set(0.5, 0);
        heading.x = W / 2;
        heading.y = 60;
        this.addChild(heading);

        // Карточка новой реликвии (выделена зелёным)
        const newRelicCard = this.buildRelicCard(newRelic, THEME.colors.accent_green);
        newRelicCard.x = 32;
        newRelicCard.y = 110;
        this.addChild(newRelicCard);

        // Подзаголовок: «Выберите замену»
        const sub = new Text({
            text: 'Тапните реликвию для замены:',
            style: new TextStyle({
                fontSize: THEME.font.sizes.subheading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_secondary,
            }),
        });
        sub.anchor.set(0.5, 0);
        sub.x = W / 2;
        sub.y = 210;
        this.addChild(sub);

        // Карточки текущих реликвий
        const startY = 250;
        for (let i = 0; i < activeRelics.length; i++) {
            const card = this.buildRelicCard(activeRelics[i], THEME.colors.bg_secondary);
            card.x = 32;
            card.y = startY + i * (CARD_H + CARD_GAP);
            card.eventMode = 'static';
            card.cursor = 'pointer';
            card.on('pointerdown', () => {
                if (this.selectionMade) return;
                this.selectionMade = true;
                // Подсветка выбранной карточки
                const border = new Graphics();
                border.roundRect(0, 0, CARD_W, CARD_H, CARD_RADIUS);
                border.stroke({ color: THEME.colors.accent_red, width: 3 });
                card.addChild(border);
                setTimeout(() => onReplace(i), THEME.animation.transitionMs);
            });
            this.addChild(card);
        }

        // Кнопка «Отказаться»
        const skipBtn = new Button({
            text: 'ОТКАЗАТЬСЯ',
            variant: 'danger',
            onClick: () => {
                if (this.selectionMade) return;
                this.selectionMade = true;
                onSkip();
            },
        });
        skipBtn.x = W / 2;
        skipBtn.y = startY + activeRelics.length * (CARD_H + CARD_GAP) + 20;
        this.addChild(skipBtn);
    }

    /** Построение карточки реликвии */
    private buildRelicCard(relic: IRelic, bgColor: number): Container {
        const card = new Container();

        const bg = new Graphics();
        bg.roundRect(0, 0, CARD_W, CARD_H, CARD_RADIUS);
        bg.fill(bgColor);
        card.addChild(bg);

        // Название
        const nameText = new Text({
            text: relic.name,
            style: new TextStyle({
                fontSize: 16,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
            }),
        });
        nameText.x = 12;
        nameText.y = 12;
        card.addChild(nameText);

        // Описание эффекта
        const effectText = new Text({
            text: getEffectDescription(relic.effect, relic.value),
            style: new TextStyle({
                fontSize: 12,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
                wordWrap: true,
                wordWrapWidth: CARD_W - 24,
            }),
        });
        effectText.x = 12;
        effectText.y = 40;
        card.addChild(effectText);

        return card;
    }
}
