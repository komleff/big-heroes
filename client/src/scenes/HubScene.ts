import { Assets, Sprite, Graphics } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { GameState } from '../core/GameState';
import { EventBus, GameEvents } from '../core/EventBus';
import { SceneManager, TransitionType } from '../core/SceneManager';
import { THEME } from '../config/ThemeConfig';
import { Button } from '../ui/Button';
import { ResourceBar } from '../ui/ResourceBar';
import { EquipmentCard } from '../ui/EquipmentCard';
import { HeroPortrait } from '../ui/HeroPortrait';
import { BottomNav } from '../ui/BottomNav';
import balanceConfig from '@config/balance.json';
import type { IResources, IHeroState, IEquipmentSlots, IBalanceConfig } from 'shared';
import { generateRoute, createRng } from 'shared';
import hubBgUrl from '../assets/hub-bg.png';

/**
 * Центральный хаб — главный экран игры.
 * Отображает героя, ресурсы, экипировку и навигацию.
 * Не содержит бизнес-логику — только отображение и маршрутизация.
 */
export class HubScene extends BaseScene {
    private readonly gameState: GameState;
    private readonly eventBus: EventBus;
    private readonly sceneManager: SceneManager;

    // Ссылки на UI-компоненты для обновления
    private resourceBar!: ResourceBar;
    private heroPortrait!: HeroPortrait;
    private weaponCard!: EquipmentCard;
    private armorCard!: EquipmentCard;
    private accessoryCard!: EquipmentCard;
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

        // --- Фон — Sprite из прелоаженного ассета (cover-fit) ---
        const bgTexture = Assets.get(hubBgUrl);
        if (bgTexture) {
            const bg = new Sprite(bgTexture);
            const scaleX = THEME.layout.designWidth / bgTexture.width;
            const scaleY = THEME.layout.designHeight / bgTexture.height;
            const coverScale = Math.max(scaleX, scaleY);
            bg.scale.set(coverScale);
            bg.x = (THEME.layout.designWidth - bgTexture.width * coverScale) / 2;
            bg.y = (THEME.layout.designHeight - bgTexture.height * coverScale) / 2;
            this.addChild(bg);
        } else {
            // Fallback — сплошной цвет
            const bg = new Graphics();
            bg.rect(0, 0, THEME.layout.designWidth, THEME.layout.designHeight);
            bg.fill(THEME.colors.bg_primary);
            this.addChild(bg);
        }

        // Полупрозрачный overlay поверх фона чтобы UI читался
        const overlay = new Graphics();
        overlay.rect(0, 0, THEME.layout.designWidth, THEME.layout.designHeight);
        overlay.fill({ color: THEME.colors.bg_primary, alpha: 0.5 });
        this.addChild(overlay);

        // --- ResourceBar (Gold) ---
        this.resourceBar = new ResourceBar({
            label: 'Gold',
            value: gameState.resources.gold,
        });
        this.resourceBar.position.set(16, 48);
        this.addChild(this.resourceBar);

        // --- HeroPortrait ---
        this.heroPortrait = new HeroPortrait({
            mass: gameState.hero.mass,
            rating: gameState.hero.rating,
        });
        this.heroPortrait.position.set(95, 108);
        this.addChild(this.heroPortrait);

        // --- Карточки экипировки ---
        const goToInventory = (): void => {
            void sceneManager.goto('inventory', { transition: TransitionType.SLIDE_LEFT });
        };

        // Weapon
        this.weaponCard = new EquipmentCard({
            slotLabel: 'WEAPON',
            item: gameState.equipment.weapon,
            onClick: goToInventory,
        });
        this.weaponCard.position.set(16, 320);
        this.addChild(this.weaponCard);

        // Armor
        this.armorCard = new EquipmentCard({
            slotLabel: 'ARMOR',
            item: gameState.equipment.armor,
            onClick: goToInventory,
        });
        this.armorCard.position.set(193, 320);
        this.addChild(this.armorCard);

        // Accessory
        this.accessoryCard = new EquipmentCard({
            slotLabel: 'ACCESS.',
            item: gameState.equipment.accessory,
            onClick: goToInventory,
        });
        this.accessoryCard.position.set(16, 432);
        this.addChild(this.accessoryCard);

        // --- Кнопка «ПОХОД» (primary) ---
        const campaignBtn = new Button({
            text: 'ПОХОД',
            variant: 'primary',
            onClick: () => {
                const config = balanceConfig as unknown as IBalanceConfig;
                const seed = Date.now();
                const rng = createRng(seed);
                const route = generateRoute(
                    config.pve,
                    config.enemies,
                    config.events,
                    rng,
                );
                gameState.startExpedition(route);
                void sceneManager.goto('pveMap', {
                    transition: TransitionType.SLIDE_LEFT,
                });
            },
        });
        // Button выставляет pivot.x = w/2, поэтому x — это центр кнопки
        campaignBtn.position.set(39 + THEME.layout.buttonWidth / 2, 556);
        this.addChild(campaignBtn);

        // --- Кнопка «АРЕНА» (secondary) ---
        const arenaBtn = new Button({
            text: 'АРЕНА',
            variant: 'secondary',
            onClick: () => {
                void sceneManager.goto('pvpLobby', { transition: TransitionType.SLIDE_LEFT });
            },
        });
        arenaBtn.position.set(39 + THEME.layout.buttonWidth / 2, 636);
        this.addChild(arenaBtn);

        // --- BottomNav ---
        this.bottomNav = new BottomNav({
            items: [
                { id: 'hero', label: 'Герой' },
                { id: 'inventory', label: 'Инвент.' },
                { id: 'repair', label: 'Ремонт' },
                { id: 'dev', label: 'Dev' },
            ],
            activeId: 'hero',
            onSelect: (id: string) => {
                if (id === 'inventory') {
                    void sceneManager.goto('inventory', { transition: TransitionType.SLIDE_LEFT });
                } else if (id === 'dev') {
                    void sceneManager.goto('devPanel', { transition: TransitionType.MODAL });
                }
                // Остальные — noop
            },
        });
        this.bottomNav.position.set(0, 780);
        this.addChild(this.bottomNav);

        // --- Подписки на EventBus ---
        this.onResourcesChanged = (data: IResources): void => {
            this.resourceBar.updateValue(data.gold);
        };

        this.onHeroChanged = (data: IHeroState): void => {
            this.heroPortrait.update(data.mass, data.rating);
        };

        this.onEquipmentChanged = (data: IEquipmentSlots): void => {
            this.weaponCard.update(data.weapon);
            this.armorCard.update(data.armor);
            this.accessoryCard.update(data.accessory);
        };

        this.eventBus.on(GameEvents.STATE_RESOURCES_CHANGED, this.onResourcesChanged);
        this.eventBus.on(GameEvents.STATE_HERO_CHANGED, this.onHeroChanged);
        this.eventBus.on(GameEvents.STATE_EQUIPMENT_CHANGED, this.onEquipmentChanged);
    }

    onExit(): void {
        // Отписка от всех событий
        this.eventBus.off(GameEvents.STATE_RESOURCES_CHANGED, this.onResourcesChanged);
        this.eventBus.off(GameEvents.STATE_HERO_CHANGED, this.onHeroChanged);
        this.eventBus.off(GameEvents.STATE_EQUIPMENT_CHANGED, this.onEquipmentChanged);
    }
}
