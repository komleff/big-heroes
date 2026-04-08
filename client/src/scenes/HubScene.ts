import { Container, Graphics, Text, TextStyle, Sprite, Assets } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { GameState } from '../core/GameState';
import { EventBus, GameEvents } from '../core/EventBus';
import { SceneManager, TransitionType } from '../core/SceneManager';
import { THEME } from '../config/ThemeConfig';
import { ProgressBar } from '../ui/ProgressBar';
import { BottomNav } from '../ui/BottomNav';
import { DurabilityPips } from '../ui/DurabilityPips';
import balanceConfig from '@config/balance.json';
import type { IResources, IHeroState, IEquipmentSlots, IBalanceConfig, IEquipmentItem, IRelic, IHeroLeagueConfig } from 'shared';
import { generateRoute, createRng, calcHeroStats } from 'shared';

// ─── Константы раскладки ──────────────────────────────────────────
const W = THEME.layout.designWidth;
const H = THEME.layout.designHeight;
const PAD = 12;
const balance = balanceConfig as unknown as IBalanceConfig;

function getLeagueConfig(rating: number): IHeroLeagueConfig {
    const leagues = balance.hero.leagues;
    if (leagues.length === 0) {
        return { name: 'Лига', minRating: 0, maxRating: 0 };
    }

    const matchedLeague = leagues.find(league => rating >= league.minRating && rating <= league.maxRating);
    return matchedLeague ?? leagues[leagues.length - 1];
}

/**
 * Центральный хаб — главный экран игры (v7).
 * Отображает героя, ресурсы, экипировку, пояс, действия и навигацию.
 * Не содержит бизнес-логику — только отображение и маршрутизация.
 */
export class HubScene extends BaseScene {
    private readonly gameState: GameState;
    private readonly eventBus: EventBus;
    private readonly sceneManager: SceneManager;

    // Ссылки на обновляемые UI-компоненты
    private goldText!: Text;
    private premiumText!: Text;
    private leagueLabel!: Text;
    private leagueBar!: ProgressBar;
    private massText!: Text;
    private statsText!: Text;
    private weaponCard!: Container;
    private armorCard!: Container;
    private accessoryCard!: Container;
    private bottomNav!: BottomNav;

    // Ссылки на слушатели для отписки в onExit
    private onResourcesChanged!: (data: IResources) => void;
    private onHeroChanged!: (data: IHeroState) => void;
    private onEquipmentChanged!: (data: IEquipmentSlots) => void;

    constructor(gameState: GameState, eventBus: EventBus, sceneManager: SceneManager) {
        super();
        this.gameState = gameState;
        this.eventBus = eventBus;
        this.sceneManager = sceneManager;
    }

    onEnter(): void {
        const { gameState, sceneManager } = this;

        // --- Фон — 4-точечный градиент ---
        this.buildGradientBackground();

        // --- Секция: Header (y: 10) ---
        this.buildHeader();

        // --- Секция: League bar (y: 50) ---
        this.buildLeagueBar();

        // --- Секция: Hero zone (y: 100-320) ---
        this.buildHeroZone();

        // --- Секция: Equipment slots (y: 330) ---
        this.buildEquipmentSlots();

        // --- Секция: Belt items (y: 430) ---
        this.buildBeltSlots();

        // --- Секция: Action buttons (y: 510) ---
        this.buildActionButtons();

        // --- Секция: Footer nav (y: 780) ---
        this.buildBottomNav();

        // --- Подписки на EventBus ---
        this.onResourcesChanged = (data: IResources): void => {
            this.goldText.text = String(data.gold);
        };

        this.onHeroChanged = (data: IHeroState): void => {
            this.massText.text = `${data.mass} kg`;
            this.updateDerivedHeroUi(data);
        };

        this.onEquipmentChanged = (data: IEquipmentSlots): void => {
            this.rebuildEquipmentCard(this.weaponCard, data.weapon, 'WEAPON');
            this.rebuildEquipmentCard(this.accessoryCard, data.accessory, 'ACCESS.');
            this.rebuildEquipmentCard(this.armorCard, data.armor, 'SHIELD');
            this.updateDerivedHeroUi(this.gameState.hero);
        };

        this.eventBus.on(GameEvents.STATE_RESOURCES_CHANGED, this.onResourcesChanged);
        this.eventBus.on(GameEvents.STATE_HERO_CHANGED, this.onHeroChanged);
        this.eventBus.on(GameEvents.STATE_EQUIPMENT_CHANGED, this.onEquipmentChanged);
    }

    onExit(): void {
        this.eventBus.off(GameEvents.STATE_RESOURCES_CHANGED, this.onResourcesChanged);
        this.eventBus.off(GameEvents.STATE_HERO_CHANGED, this.onHeroChanged);
        this.eventBus.off(GameEvents.STATE_EQUIPMENT_CHANGED, this.onEquipmentChanged);
    }

    // ─── Фон — полосчатый градиент ──────────────────────────────────

    private buildGradientBackground(): void {
        // Фоновое изображение (cover-fit)
        const texture = Assets.get('hub-bg-new');
        if (texture) {
            const sprite = new Sprite(texture);
            const scaleX = W / sprite.texture.width;
            const scaleY = H / sprite.texture.height;
            const scale = Math.max(scaleX, scaleY);
            sprite.scale.set(scale);
            sprite.x = (W - sprite.texture.width * scale) / 2;
            sprite.y = (H - sprite.texture.height * scale) / 2;
            this.addChild(sprite);
        } else {
            // Fallback: однотонный фон
            const bg = new Graphics();
            bg.rect(0, 0, W, H).fill(THEME.colors.gradient_hub_top);
            this.addChild(bg);
        }

        // Полупрозрачный overlay для читаемости UI
        const overlay = new Graphics();
        overlay.rect(0, 0, W, H).fill({ color: THEME.colors.bg_overlay, alpha: 0.35 });
        this.addChild(overlay);
    }

    // ─── Header ─────────────────────────────────────────────────────

    private buildHeader(): void {
        const y = 10;

        // Аватар (36x36 с зелёной обводкой)
        const avatar = new Graphics();
        avatar.roundRect(PAD, y, 36, 36, 8)
            .fill(THEME.colors.bg_secondary)
            .stroke({ color: THEME.colors.accent_green, width: 2 });
        this.addChild(avatar);

        // Иконка персонажа внутри аватара
        const avatarIcon = new Text({
            text: '👤',
            style: new TextStyle({ fontSize: 18, fontFamily: THEME.font.family }),
        });
        avatarIcon.anchor.set(0.5);
        avatarIcon.position.set(PAD + 18, y + 18);
        this.addChild(avatarIcon);

        // Ник
        const nick = new Text({
            text: 'BigHero_42',
            style: new TextStyle({
                fontSize: 13,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.text_primary,
            }),
        });
        nick.position.set(PAD + 42, y + 10);
        this.addChild(nick);

        // --- Валютные пилюли (справа) ---
        // Premium pill (самая правая)
        const premium = this.createCurrencyPill('⭐', '80');
        premium.pill.position.set(W - PAD - 80, y + 4);
        this.addChild(premium.pill);
        this.premiumText = premium.valueText;

        // Gold pill (левее premium)
        const gold = this.createCurrencyPill('🪙', String(this.gameState.resources.gold));
        gold.pill.position.set(W - PAD - 170, y + 4);
        this.addChild(gold.pill);
        this.goldText = gold.valueText;
    }

    /** Создаёт пилюлю валюты: иконка + число + «+». Возвращает [container, valueText]. */
    private createCurrencyPill(icon: string, value: string): { pill: Container; valueText: Text } {
        const pill = new Container();
        const px = 8;
        const py = 4;

        // Фон
        const bg = new Graphics();
        bg.roundRect(0, 0, 82, 28, 14).fill({ color: THEME.colors.bg_primary, alpha: 0.6 });
        pill.addChild(bg);

        // Иконка
        const iconText = new Text({
            text: icon,
            style: new TextStyle({ fontSize: 13, fontFamily: THEME.font.family }),
        });
        iconText.position.set(px, py + 1);
        pill.addChild(iconText);

        // Число
        const valueText = new Text({
            text: value,
            style: new TextStyle({
                fontSize: 12,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
            }),
        });
        valueText.position.set(px + 22, py + 2);
        pill.addChild(valueText);

        // Кнопка «+»
        const plus = new Text({
            text: '+',
            style: new TextStyle({
                fontSize: 14,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_secondary,
            }),
        });
        plus.position.set(66, py);
        pill.addChild(plus);

        return { pill, valueText };
    }

    // ─── League bar ─────────────────────────────────────────────────

    private buildLeagueBar(): void {
        const y = 52;
        const league = getLeagueConfig(this.gameState.hero.rating);

        // Лейбл лиги
        this.leagueLabel = new Text({
            text: league.name,
            style: new TextStyle({
                fontSize: 14,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.text_primary,
            }),
        });
        this.leagueLabel.position.set(PAD, y);
        this.addChild(this.leagueLabel);

        // Прогресс-бар рейтинга текущей лиги.
        const barWidth = W - PAD * 2;
        this.leagueBar = new ProgressBar({
            width: barWidth,
            max: league.maxRating,
            current: this.gameState.hero.rating,
        });
        this.leagueBar.position.set(PAD, y + 20);
        this.addChild(this.leagueBar);
    }

    // ─── Hero zone ──────────────────────────────────────────────────

    private buildHeroZone(): void {
        const y = 100;
        const centerX = W / 2;

        // Левая кнопка: «Путь» (56x56)
        const pathBtn = this.createSquareButton('🗺️', 'Путь');
        pathBtn.position.set(PAD, y + 40);
        this.addChild(pathBtn);

        // Правая кнопка: «Пропуск» (56x56)
        const passBtn = this.createSquareButton('🎫', 'Пропуск');
        passBtn.position.set(W - PAD - 56, y + 40);
        this.addChild(passBtn);

        // Центр: герой-плейсхолдер (130x150)
        const heroPlaceholder = new Graphics();
        const heroW = 130;
        const heroH = 150;
        const heroX = centerX - heroW / 2;
        heroPlaceholder.roundRect(heroX, y, heroW, heroH, 12)
            .fill({ color: THEME.colors.bg_secondary, alpha: 0.5 })
            .stroke({ color: THEME.colors.text_muted, width: 1 });
        this.addChild(heroPlaceholder);

        // Силуэт героя внутри плейсхолдера
        const heroIcon = new Text({
            text: '🧙',
            style: new TextStyle({ fontSize: 60, fontFamily: THEME.font.family }),
        });
        heroIcon.anchor.set(0.5);
        heroIcon.position.set(centerX, y + heroH / 2 - 5);
        this.addChild(heroIcon);

        // Масса — крупный текст accent_cyan
        this.massText = new Text({
            text: `${this.gameState.hero.mass} kg`,
            style: new TextStyle({
                fontSize: 34,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.accent_cyan,
                dropShadow: { distance: 2, alpha: 0.5, color: THEME.colors.bg_overlay },
            }),
        });
        this.massText.anchor.set(0.5, 0);
        this.massText.position.set(centerX, y + heroH + 6);
        this.addChild(this.massText);

        // Статы: «Сила: N, Здоровье: N»
        const heroStats = calcHeroStats(this.gameState.hero.mass, this.gameState.equipment, [...this.gameState.activeRelics] as IRelic[]);
        this.statsText = new Text({
            text: `Сила: ${heroStats.strength}, Здоровье: ${heroStats.hp}`,
            style: new TextStyle({
                fontSize: 12,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_primary,
            }),
        });
        this.statsText.anchor.set(0.5, 0);
        this.statsText.position.set(centerX, y + heroH + 44);
        this.addChild(this.statsText);
    }

    // ─── Equipment slots ────────────────────────────────────────────

    private buildEquipmentSlots(): void {
        const y = 340;
        const cardW = Math.floor((W - PAD * 2 - 12) / 3); // ~118px
        const cardH = 80;
        const gap = 6;

        const goToInventory = (): void => {
            void this.sceneManager.goto('inventory', { transition: TransitionType.SLIDE_LEFT });
        };

        this.weaponCard = this.createEquipCard(
            this.gameState.equipment.weapon, 'WEAPON', cardW, cardH, goToInventory,
        );
        this.weaponCard.position.set(PAD, y);
        this.addChild(this.weaponCard);

        this.accessoryCard = this.createEquipCard(
            this.gameState.equipment.accessory, 'ACCESS.', cardW, cardH, goToInventory,
        );
        this.accessoryCard.position.set(PAD + cardW + gap, y);
        this.addChild(this.accessoryCard);

        this.armorCard = this.createEquipCard(
            this.gameState.equipment.armor, 'SHIELD', cardW, cardH, goToInventory,
        );
        this.armorCard.position.set(PAD + (cardW + gap) * 2, y);
        this.addChild(this.armorCard);
    }

    /** Создаёт компактную карточку экипировки */
    private createEquipCard(
        item: IEquipmentItem | null,
        slotLabel: string,
        w: number,
        h: number,
        onClick?: () => void,
    ): Container {
        const card = new Container();

        const bg = new Graphics();
        bg.roundRect(0, 0, w, h, 8).fill(THEME.colors.bg_card);
        card.addChild(bg);

        this.fillEquipCard(card, item, slotLabel, w);

        if (onClick) {
            card.eventMode = 'static';
            card.cursor = 'pointer';
            card.on('pointertap', onClick);
        }
        return card;
    }

    /** Наполняет карточку экипировки данными предмета */
    private fillEquipCard(card: Container, item: IEquipmentItem | null, slotLabel: string, w: number): void {
        // Удаляем всё кроме фона (первый child)
        while (card.children.length > 1) {
            const child = card.children[card.children.length - 1];
            card.removeChild(child);
            child.destroy({ children: true });
        }

        const pad = 6;

        // Слот-лейбл
        const label = new Text({
            text: slotLabel,
            style: new TextStyle({
                fontSize: 9,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_secondary,
            }),
        });
        label.position.set(pad, pad);
        card.addChild(label);

        if (item) {
            // Иконка предмета
            const slotIcon = item.slot === 'weapon' ? '⚔️' : item.slot === 'armor' ? '🛡️' : '💎';
            const icon = new Text({
                text: slotIcon,
                style: new TextStyle({ fontSize: 18, fontFamily: THEME.font.family }),
            });
            icon.position.set(w - 28, pad);
            card.addChild(icon);

            // Имя предмета
            const nameText = new Text({
                text: item.name,
                style: new TextStyle({
                    fontSize: 11,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.bold,
                    fill: THEME.colors.text_primary,
                }),
            });
            nameText.position.set(pad, pad + 16);
            card.addChild(nameText);

            // Бонус (один главный)
            let bonusStr = '';
            if (item.strengthBonus > 0) bonusStr += `+${item.strengthBonus} Str `;
            if (item.armorBonus > 0) bonusStr += `+${item.armorBonus} Arm `;
            if (item.luckBonus > 0) bonusStr += `+${item.luckBonus} Luck`;
            if (bonusStr) {
                const bonusText = new Text({
                    text: bonusStr.trim(),
                    style: new TextStyle({
                        fontSize: 10,
                        fontFamily: THEME.font.family,
                        fontWeight: THEME.font.weights.bold,
                        fill: THEME.colors.accent_green,
                    }),
                });
                bonusText.position.set(pad, pad + 32);
                card.addChild(bonusText);
            }

            // Пипсы прочности
            const pips = new DurabilityPips({
                max: item.maxDurability,
                current: item.currentDurability,
            });
            pips.position.set(pad, pad + 48);
            card.addChild(pips);
        } else {
            // Пустой слот
            const empty = new Text({
                text: 'Пусто',
                style: new TextStyle({
                    fontSize: 11,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.bold,
                    fill: THEME.colors.text_muted,
                }),
            });
            empty.anchor.set(0.5);
            empty.position.set(w / 2, 48);
            card.addChild(empty);
        }
    }

    /** Перестраивает содержимое карточки экипировки */
    private rebuildEquipmentCard(card: Container, item: IEquipmentItem | null, slotLabel: string): void {
        const cardW = Math.floor((W - PAD * 2 - 12) / 3);
        this.fillEquipCard(card, item, slotLabel, cardW);
    }

    private updateDerivedHeroUi(hero: IHeroState): void {
        const stats = calcHeroStats(hero.mass, this.gameState.equipment, [...this.gameState.activeRelics] as IRelic[]);
        this.statsText.text = `Сила: ${stats.strength}, Здоровье: ${stats.hp}`;

        const league = getLeagueConfig(hero.rating);
        this.leagueLabel.text = league.name;
        this.leagueBar.update(hero.rating, league.maxRating);
    }

    // ─── Belt slots ─────────────────────────────────────────────────

    private buildBeltSlots(): void {
        const y = 430;
        const slotSize = 60;
        const gap = 8;
        const totalWidth = slotSize * 4 + gap * 3;
        const startX = (W - totalWidth) / 2;

        const belt = this.gameState.belt;
        const beltIcons = ['🧪', '🍖', '🔮', '🔒'];
        const beltLabels = [
            belt[0]?.name ?? 'Пусто',
            belt[1]?.name ?? 'Пусто',
            'Пусто',
            'ур. 7',
        ];

        for (let i = 0; i < 4; i++) {
            const x = startX + i * (slotSize + gap);
            const isLocked = i === 3;

            const slot = new Graphics();
            slot.roundRect(x, y, slotSize, slotSize, 8)
                .fill({ color: THEME.colors.bg_primary, alpha: 0.6 });
            if (isLocked) {
                slot.stroke({ color: THEME.colors.text_muted, width: 1 });
            }
            this.addChild(slot);

            // Иконка
            const icon = new Text({
                text: beltIcons[i],
                style: new TextStyle({ fontSize: 22, fontFamily: THEME.font.family }),
            });
            icon.anchor.set(0.5);
            icon.position.set(x + slotSize / 2, y + slotSize / 2 - 6);
            this.addChild(icon);

            // Подпись
            const label = new Text({
                text: beltLabels[i],
                style: new TextStyle({
                    fontSize: 8,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.medium,
                    fill: isLocked ? THEME.colors.text_muted : THEME.colors.text_secondary,
                }),
            });
            label.anchor.set(0.5, 0);
            label.position.set(x + slotSize / 2, y + slotSize / 2 + 12);
            this.addChild(label);
        }
    }

    // ─── Action buttons ─────────────────────────────────────────────

    private buildActionButtons(): void {
        const y = 620; // ниже для удобства нажатия большим пальцем
        const sqSize = 56;
        const bigBtnW = W - PAD * 2 - sqSize * 2 - 12 * 2;

        // Row 1: [Событие] + [Охота green] + [Рейтинг]
        const eventBtn = this.createSquareButton('📅', 'Событие', undefined, true);
        eventBtn.position.set(PAD, y);
        this.addChild(eventBtn);

        const huntBtn = this.createBigActionButton(
            'Охота', THEME.colors.accent_green, THEME.colors.accent_green_dark,
            '🎟️', '3', bigBtnW,
            () => {
                const config = balanceConfig as unknown as IBalanceConfig;
                const seed = Date.now();
                const rng = createRng(seed);
                const route = generateRoute(config.pve, config.enemies, config.events, rng, seed);
                this.gameState.startExpedition(route);
                void this.sceneManager.goto('pveMap', { transition: TransitionType.SLIDE_LEFT });
            },
        );
        huntBtn.position.set(PAD + sqSize + 12, y);
        this.addChild(huntBtn);

        const ratingBtn = this.createSquareButton('🏆', 'Рейтинг');
        ratingBtn.position.set(W - PAD - sqSize, y);
        this.addChild(ratingBtn);

        // Row 2: spacer(56) + [Арена pink] + spacer(56)
        const row2Y = y + sqSize + 8;
        const arenaBtn = this.createBigActionButton(
            'Арена', THEME.colors.accent_magenta, THEME.colors.accent_magenta_dark,
            '⚔️', '', bigBtnW,
            () => {
                void this.sceneManager.goto('pvpLobby', { transition: TransitionType.SLIDE_LEFT });
            },
        );
        arenaBtn.position.set(PAD + sqSize + 12, row2Y);
        this.addChild(arenaBtn);
    }

    // ─── Bottom nav ─────────────────────────────────────────────────

    private buildBottomNav(): void {
        this.bottomNav = new BottomNav({
            items: [
                { id: 'shop', label: 'Магазин', icon: '🏪' },
                { id: 'heroes', label: 'Герои', icon: '👤' },
                { id: 'play', label: 'Играть', icon: '🎮' },
                { id: 'inventory', label: 'Инвент.', icon: '🎒' },
                { id: 'collections', label: 'Коллекц.', icon: '📋' },
            ],
            activeId: 'play',
            onSelect: (id: string) => {
                if (id === 'inventory') {
                    void this.sceneManager.goto('inventory', { transition: TransitionType.SLIDE_LEFT });
                }
                // Остальные — noop (сцены ещё не реализованы)
            },
        });
        this.bottomNav.position.set(0, H - THEME.layout.bottomNav.height);
        this.addChild(this.bottomNav);
    }

    // ─── Хелперы ────────────────────────────────────────────────────

    /** Создаёт квадратную кнопку 56x56 с иконкой и подписью */
    private createSquareButton(
        icon: string,
        label: string,
        onClick?: () => void,
        showDot?: boolean,
    ): Container {
        const size = 56;
        const btn = new Container();

        // Фон
        const bg = new Graphics();
        bg.roundRect(0, 0, size, size, 10)
            .fill({ color: THEME.colors.bg_primary, alpha: 0.6 });
        btn.addChild(bg);

        // Иконка
        const iconText = new Text({
            text: icon,
            style: new TextStyle({ fontSize: 20, fontFamily: THEME.font.family }),
        });
        iconText.anchor.set(0.5);
        iconText.position.set(size / 2, size / 2 - 6);
        btn.addChild(iconText);

        // Подпись
        const labelText = new Text({
            text: label,
            style: new TextStyle({
                fontSize: 8,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.text_primary,
            }),
        });
        labelText.anchor.set(0.5);
        labelText.position.set(size / 2, size / 2 + 14);
        btn.addChild(labelText);

        // Красная точка уведомления
        if (showDot) {
            const dot = new Graphics();
            dot.circle(size - 8, 8, 4).fill(THEME.colors.accent_red);
            btn.addChild(dot);
        }

        // Интерактивность — только при наличии обработчика
        if (onClick) {
            btn.eventMode = 'static';
            btn.cursor = 'pointer';
            btn.on('pointertap', onClick);
        } else {
            btn.eventMode = 'passive';
        }

        return btn;
    }

    /** Создаёт широкую кнопку действия (Охота/Арена) */
    private createBigActionButton(
        label: string,
        fillColor: number,
        shadowColor: number,
        icon: string,
        badge: string,
        width: number,
        onClick: () => void,
    ): Container {
        const btn = new Container();
        const h = 56;
        const r = 12;

        // Тень
        const shadow = new Graphics();
        shadow.roundRect(0, 3, width, h, r).fill(shadowColor);
        btn.addChild(shadow);

        // Лицевая часть
        const face = new Graphics();
        face.roundRect(0, 0, width, h - 3, r).fill(fillColor);
        btn.addChild(face);

        // Текст
        const labelText = new Text({
            text: label,
            style: new TextStyle({
                fontSize: 20,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
                dropShadow: { distance: 1, alpha: 0.3 },
            }),
        });
        labelText.anchor.set(0.5);
        labelText.position.set(width / 2 - (badge ? 14 : 0), (h - 3) / 2);
        btn.addChild(labelText);

        // Иконка + бейдж (справа от текста)
        if (icon) {
            const iconText = new Text({
                text: icon,
                style: new TextStyle({ fontSize: 16, fontFamily: THEME.font.family }),
            });
            iconText.anchor.set(0.5);
            iconText.position.set(width / 2 + 30, (h - 3) / 2 - 1);
            btn.addChild(iconText);
        }
        if (badge) {
            const badgeText = new Text({
                text: badge,
                style: new TextStyle({
                    fontSize: 14,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.bold,
                    fill: THEME.colors.text_primary,
                }),
            });
            badgeText.anchor.set(0.5);
            badgeText.position.set(width / 2 + 48, (h - 3) / 2);
            btn.addChild(badgeText);
        }

        // Интерактивность
        btn.eventMode = 'static';
        btn.cursor = 'pointer';
        btn.on('pointertap', onClick);

        return btn;
    }
}
