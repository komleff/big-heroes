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
    hpBonus: number;
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
}
