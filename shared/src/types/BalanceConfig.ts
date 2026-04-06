import type { EquipmentSlotId, CommandId } from './Equipment';

// Конфигурация стартового предмета в balance.json
export interface IStarterEquipmentConfigItem {
    id: string;
    name: string;
    slot: EquipmentSlotId;
    tier: number;
    strengthBonus: number;
    armorBonus: number;
    luckBonus: number;
    commandId: CommandId | null;
    maxDurability: number;
    basePrice: number;
}

// Конфигурация моба
export interface IMobConfig {
    id: string;
    name: string;
    type: 'combat' | 'elite' | 'boss';
    mass: number;           // масса = HP
    strength: number;
    armor: number;
    massReward: number;     // +кг массы при победе
    goldReward: number;
}

// Конфигурация расходника
export interface IConsumableConfig {
    id: string;
    name: string;
    type: 'combat' | 'hiking' | 'scout';
    tier: number;
    effect: string;         // описание эффекта
    value: number;          // числовое значение эффекта
    basePrice: number;
}

// Конфигурация реликвии
export interface IRelicConfig {
    id: string;
    name: string;
    effect: string;
    value: number;
    rarity: string;
}

// Конфигурация формул
export interface IFormulaConfig {
    baseBlockPower: number;       // 0.3
    shieldArmorBlockCoeff: number; // 0.05
    luckAttackCoeff: number;      // 0.01
    luckAbilityCoeff: number;     // 0.02
    retreatBase: number;          // 0.70
    bypassBase: number;           // 0.60
    eloK: number;                 // 32
    winChanceMin: number;         // 0.05
    winChanceMax: number;         // 0.95
}

// Конфигурация PvE-генерации маршрута
export interface IPveNodeWeights {
    combat: number;
    elite: number;
    shop: number;
    camp: number;
    event: number;
    chest: number;
}

export interface IPveConstraints {
    max_combats_in_row: number;
    max_shops: number;
    min_camps_before_boss: number;
}

export interface IPveCampConfig {
    repair_amount: number;
    train_mass_min: number;
    train_mass_max: number;
}

export interface IPveShopConfig {
    item_count_min: number;
    item_count_max: number;
    price_multiplier: number;
    repair_price_multiplier: number;
}

export interface IPveLootConfig {
    combat_loot_chance: number;
    elite_loot_guaranteed: boolean;
    elite_relic_chance: number;
    boss_loot_count: number;
    chest_loot_count_min: number;
    chest_loot_count_max: number;
    pity_counter: number;
}

export interface IPveConfig {
    total_nodes_min: number;
    total_nodes_max: number;
    fork_count_min: number;
    fork_count_max: number;
    paths_per_fork_min: number;
    paths_per_fork_max: number;
    hidden_path_chance: number;
    ancient_chest_node_min: number;
    ancient_chest_node_max: number;
    node_weights: IPveNodeWeights;
    constraints: IPveConstraints;
    camp: IPveCampConfig;
    shop: IPveShopConfig;
    loot: IPveLootConfig;
}

// Конфигурация эффекта события
export interface IEventEffect {
    type: 'gold' | 'mass' | 'repair' | 'item' | 'loot_chest' | 'lose_item';
    value: number;
}

// Конфигурация варианта события
export interface IEventVariant {
    id: string;
    label: string;
    description: string;
    condition?: { type: string; value: number };
    effects: IEventEffect[];
}

// Конфигурация события PvE
export interface IEventConfig {
    id: string;
    name: string;
    description: string;
    variants: IEventVariant[];
}

// Типизация config/balance.json (GDD v1.2)
export interface IBalanceConfig {
    hero: {
        startMass: number;
        startRating: number;
        massCap: number;
    };
    resources: {
        startGold: number;
    };
    formulas: IFormulaConfig;
    equipment: {
        starterItems: IStarterEquipmentConfigItem[];
        catalog: IStarterEquipmentConfigItem[];
    };
    consumables: IConsumableConfig[];
    enemies: IMobConfig[];
    relics: IRelicConfig[];
    starterBelt: [string | null, string | null];   // id расходников
    starterBackpack: Array<string | null>;          // id предметов/расходников
    pve: IPveConfig;
    events: IEventConfig[];
}
