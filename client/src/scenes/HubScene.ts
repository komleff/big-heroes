import { Graphics } from 'pixi.js';
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
import type { IResources, IHeroState, IEquipmentSlots } from 'shared';

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

        // --- Фон ---
        const bg = new Graphics();
        bg.rect(0, 0, THEME.layout.designWidth, THEME.layout.designHeight);
        bg.fill(THEME.colors.bg_primary);
        this.addChild(bg);

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
            sceneManager.goto('inventory', { transition: TransitionType.SLIDE_LEFT });
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
            text: `ПОХОД (${gameState.resources.campaignTickets}/${gameState.resources.maxCampaignTickets})`,
            variant: 'primary',
            onClick: () => {
                sceneManager.goto('pveMap', { transition: TransitionType.SLIDE_LEFT });
            },
        });
        // Button выставляет pivot.x = w/2, поэтому x — это центр кнопки
        campaignBtn.position.set(39 + THEME.layout.buttonWidth / 2, 556);
        this.addChild(campaignBtn);

        // --- Кнопка «АРЕНА» (secondary) ---
        const arenaBtn = new Button({
            text: `АРЕНА (${gameState.resources.arenaTickets}/${gameState.resources.maxArenaTickets})`,
            variant: 'secondary',
            onClick: () => {
                sceneManager.goto('pvpLobby', { transition: TransitionType.SLIDE_LEFT });
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
                    sceneManager.goto('inventory', { transition: TransitionType.SLIDE_LEFT });
                } else if (id === 'dev') {
                    sceneManager.goto('devPanel', { transition: TransitionType.MODAL });
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
