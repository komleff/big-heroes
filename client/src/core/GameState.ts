import type {
    IBalanceConfig,
    IConsumableConfig,
} from 'shared';
import type {
    IHeroState,
    IResources,
    IEquipmentSlots,
    IBeltSlot,
    IEquipmentItem,
    IConsumable,
    IRelic,
    IPveRoute,
    IPveExpeditionState,
} from 'shared';
import { createExpeditionState, MAX_RELICS } from 'shared';
import { EventBus, GameEvents } from './EventBus';

/**
 * Создаёт IConsumable из IConsumableConfig (без basePrice).
 */
function consumableFromConfig(cfg: IConsumableConfig): IConsumable {
    return {
        id: cfg.id,
        name: cfg.name,
        type: cfg.type,
        tier: cfg.tier,
        effect: cfg.effect,
        value: cfg.value,
    };
}

/**
 * Рантайм-контейнер состояния игры (GDD v1.2).
 * Инициализируется из balance.json, уведомляет об изменениях через EventBus.
 */
export class GameState {
    private _hero: IHeroState;
    private _resources: IResources;
    private _equipment: IEquipmentSlots;
    private _belt: [IBeltSlot, IBeltSlot];
    private _backpack: Array<IEquipmentItem | IConsumable | null>;
    private _stash: IEquipmentItem[];
    private _activeRelics: IRelic[];
    private _arenaRelic: IRelic | null = null; // Реликвия для арены (extraction после босса)
    private _expeditionState: IPveExpeditionState | null = null;
    private eventBus: EventBus;

    constructor(config: IBalanceConfig, eventBus: EventBus) {
        this.eventBus = eventBus;

        // Инициализация героя из конфига
        this._hero = {
            mass: config.hero.startMass,
            rating: config.hero.startRating,
            massCap: config.hero.massCap,
        };

        // Инициализация ресурсов
        this._resources = {
            gold: config.resources.startGold,
        };

        // Инициализация экипировки из стартовых предметов
        this._equipment = { weapon: null, armor: null, accessory: null };
        for (const item of config.equipment.starterItems) {
            const slot = item.slot;
            if (slot === 'weapon' || slot === 'armor' || slot === 'accessory') {
                this._equipment[slot] = {
                    ...item,
                    slot,
                    currentDurability: item.maxDurability,
                };
            }
        }

        // Инициализация пояса: ищем расходники по id в config.consumables
        this._belt = [
            this._resolveConsumable(config.starterBelt[0], config.consumables),
            this._resolveConsumable(config.starterBelt[1], config.consumables),
        ];

        // Инициализация рюкзака (4 слота): предметы или расходники по id
        this._backpack = config.starterBackpack.map(
            (id) => this._resolveBackpackItem(id, config),
        );

        // Запас предметов — пустой при старте
        this._stash = [];

        // Активные реликвии — пустые при старте
        this._activeRelics = [];
    }

    // --- Вспомогательные методы инициализации ---

    /** Найти расходник по id в массиве конфигов */
    private _resolveConsumable(
        id: string | null,
        consumables: IConsumableConfig[],
    ): IConsumable | null {
        if (!id) return null;
        const cfg = consumables.find((c) => c.id === id);
        if (!cfg) return null;
        return consumableFromConfig(cfg);
    }

    /** Найти предмет/расходник по id (сначала оборудование, затем расходники) */
    private _resolveBackpackItem(
        id: string | null,
        config: IBalanceConfig,
    ): IEquipmentItem | IConsumable | null {
        if (!id) return null;

        // Поиск среди стартовых предметов и каталога экипировки
        const allEquipment = [
            ...config.equipment.starterItems,
            ...config.equipment.catalog,
        ];
        const equipCfg = allEquipment.find((e) => e.id === id);
        if (equipCfg) {
            return {
                ...equipCfg,
                currentDurability: equipCfg.maxDurability,
            };
        }

        // Поиск среди расходников
        const consCfg = config.consumables.find((c) => c.id === id);
        if (consCfg) {
            return consumableFromConfig(consCfg);
        }

        return null;
    }

    // --- Геттеры (readonly) ---

    get hero(): Readonly<IHeroState> {
        return this._hero;
    }

    get resources(): Readonly<IResources> {
        return this._resources;
    }

    get equipment(): Readonly<IEquipmentSlots> {
        return this._equipment;
    }

    get belt(): Readonly<[IBeltSlot, IBeltSlot]> {
        return this._belt;
    }

    get backpack(): ReadonlyArray<IEquipmentItem | IConsumable | null> {
        return this._backpack;
    }

    get stash(): ReadonlyArray<IEquipmentItem> {
        return this._stash;
    }

    get activeRelics(): ReadonlyArray<IRelic> {
        return this._activeRelics;
    }

    get arenaRelic(): Readonly<IRelic> | null {
        return this._arenaRelic;
    }

    get expeditionState(): Readonly<IPveExpeditionState> | null {
        return this._expeditionState;
    }

    // --- Сеттеры с уведомлениями ---

    /** Установить массу героя (клэмп 0..massCap) */
    setMass(value: number): void {
        this._hero = {
            ...this._hero,
            mass: Math.max(0, Math.min(value, this._hero.massCap)),
        };
        this.eventBus.emit(GameEvents.STATE_HERO_CHANGED, this._hero);
    }

    /** Установить рейтинг героя (минимум 0) */
    setRating(value: number): void {
        this._hero = { ...this._hero, rating: Math.max(0, value) };
        this.eventBus.emit(GameEvents.STATE_HERO_CHANGED, this._hero);
    }

    /** Установить золото (минимум 0) */
    setGold(value: number): void {
        this._resources = { ...this._resources, gold: Math.max(0, value) };
        this.eventBus.emit(GameEvents.STATE_RESOURCES_CHANGED, this._resources);
    }

    /** Экипировать предмет в соответствующий слот */
    equipItem(item: IEquipmentItem): void {
        this._equipment = { ...this._equipment, [item.slot]: item };
        this.eventBus.emit(GameEvents.STATE_EQUIPMENT_CHANGED, this._equipment);
    }

    /** Снять предмет из слота экипировки */
    unequipSlot(slot: 'weapon' | 'armor' | 'accessory'): IEquipmentItem | null {
        const item = this._equipment[slot];
        this._equipment = { ...this._equipment, [slot]: null };
        this.eventBus.emit(GameEvents.STATE_EQUIPMENT_CHANGED, this._equipment);
        return item;
    }

    /** Уменьшить прочность предмета в слоте на 1 */
    wearItem(slot: 'weapon' | 'armor' | 'accessory'): void {
        const item = this._equipment[slot];
        if (!item) return;

        this._equipment = {
            ...this._equipment,
            [slot]: {
                ...item,
                currentDurability: Math.max(0, item.currentDurability - 1),
            },
        };
        this.eventBus.emit(GameEvents.STATE_EQUIPMENT_CHANGED, this._equipment);
    }

    /** Добавить реликвию в активные (максимум 3) */
    addRelic(relic: IRelic): void {
        if (this._activeRelics.length >= MAX_RELICS) return;
        this._activeRelics = [...this._activeRelics, relic];
    }

    /** Сохранить реликвию для арены (extraction после босса, GDD: max 1) */
    saveArenaRelic(relic: IRelic): void {
        this._arenaRelic = relic;
    }

    /** Начать экспедицию */
    startExpedition(route: IPveRoute): void {
        this._expeditionState = createExpeditionState(route);
        this._activeRelics = []; // Очистить реликвии предыдущего похода
    }

    /** Обновить состояние экспедиции */
    updateExpeditionState(state: IPveExpeditionState): void {
        this._expeditionState = state;
    }

    /** Завершить экспедицию — перенести результаты в постоянное состояние */
    endExpedition(): void {
        if (!this._expeditionState) return;
        const exp = this._expeditionState;
        this.setMass(this._hero.mass + exp.massGained);
        this.setGold(this._resources.gold + exp.goldGained);
        // Предметы из похода → рюкзак (пока добавляем id как заглушку, полная инвентарная система — Sprint 4)
        this._expeditionState = null;
        this._activeRelics = []; // Реликвии не переносятся между экспедициями
    }

    /** Установить расходник в слот пояса (0 или 1) */
    setBelt(index: 0 | 1, consumable: IConsumable | null): void {
        const newBelt: [IBeltSlot, IBeltSlot] = [...this._belt];
        newBelt[index] = consumable;
        this._belt = newBelt;
    }

    /** Использовать расходник из слота пояса (обнуляет слот) */
    useConsumable(index: 0 | 1): IConsumable | null {
        const consumable = this._belt[index];
        if (!consumable) return null;

        const newBelt: [IBeltSlot, IBeltSlot] = [...this._belt];
        newBelt[index] = null;
        this._belt = newBelt;

        return consumable;
    }
}
