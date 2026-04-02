import type { IBalanceConfig } from 'shared';
import type { IHeroState, IResources, IEquipmentSlots, IEquipmentItem } from 'shared';
import { EventBus, GameEvents } from './EventBus';

/**
 * Рантайм-контейнер состояния игры.
 * Инициализируется из balance.json, уведомляет об изменениях через EventBus.
 */
export class GameState {
    private _hero: IHeroState;
    private _resources: IResources;
    private _equipment: IEquipmentSlots;
    private eventBus: EventBus;

    constructor(config: IBalanceConfig, eventBus: EventBus) {
        this.eventBus = eventBus;

        // Инициализация героя из конфига
        this._hero = {
            mass: config.hero.startMass,
            rating: config.hero.startRating,
            hp: config.hero.startHp,
            maxHp: config.hero.startHp,
            baseAttack: config.hero.baseAttack,
            baseDefense: config.hero.baseDefense,
        };

        // Инициализация ресурсов
        this._resources = {
            gold: config.resources.startGold,
            campaignTickets: config.resources.startCampaignTickets,
            maxCampaignTickets: config.resources.maxCampaignTickets,
            arenaTickets: config.resources.startArenaTickets,
            maxArenaTickets: config.resources.maxArenaTickets,
        };

        // Инициализация экипировки из стартовых предметов
        this._equipment = { weapon: null, armor: null, accessory: null };
        for (const item of config.equipment.starterItems) {
            const slot = item.slot;
            // Явная проверка слота без unsafe-каста
            if (slot === 'weapon' || slot === 'armor' || slot === 'accessory') {
                this._equipment[slot] = {
                    ...item,
                    slot,
                    currentDurability: item.maxDurability,
                };
            }
        }
    }

    // --- Геттеры ---

    get hero(): Readonly<IHeroState> {
        return this._hero;
    }

    get resources(): Readonly<IResources> {
        return this._resources;
    }

    get equipment(): Readonly<IEquipmentSlots> {
        return this._equipment;
    }

    // --- Сеттеры с уведомлениями ---

    setGold(value: number): void {
        this._resources = { ...this._resources, gold: Math.max(0, value) };
        this.eventBus.emit(GameEvents.STATE_RESOURCES_CHANGED, this._resources);
    }

    setMass(value: number): void {
        this._hero = { ...this._hero, mass: Math.max(0, value) };
        this.eventBus.emit(GameEvents.STATE_HERO_CHANGED, this._hero);
    }

    setRating(value: number): void {
        this._hero = { ...this._hero, rating: Math.max(0, value) };
        this.eventBus.emit(GameEvents.STATE_HERO_CHANGED, this._hero);
    }

    setHp(value: number): void {
        this._hero = { ...this._hero, hp: Math.max(0, Math.min(value, this._hero.maxHp)) };
        this.eventBus.emit(GameEvents.STATE_HERO_CHANGED, this._hero);
    }

    equipItem(item: IEquipmentItem): void {
        this._equipment = { ...this._equipment, [item.slot]: item };
        this.eventBus.emit(GameEvents.STATE_EQUIPMENT_CHANGED, this._equipment);
    }

    unequipSlot(slot: 'weapon' | 'armor' | 'accessory'): IEquipmentItem | null {
        const item = this._equipment[slot];
        this._equipment = { ...this._equipment, [slot]: null };
        this.eventBus.emit(GameEvents.STATE_EQUIPMENT_CHANGED, this._equipment);
        return item;
    }
}
