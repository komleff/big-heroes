import type { EquipmentSlotId } from './Equipment';

// Предмет в конфиге баланса (без runtime-состояния вроде currentDurability)
export interface IStarterEquipmentConfigItem {
    id: string;
    name: string;
    slot: EquipmentSlotId;
    tier: number;
    modifier: number;
    maxDurability: number;
    basePrice: number;
}

// Типизация config/balance.json
export interface IBalanceConfig {
    hero: {
        startMass: number;
        startRating: number;
        startHp: number;
        baseAttack: number;
        baseDefense: number;
    };
    resources: {
        startGold: number;
        maxCampaignTickets: number;
        startCampaignTickets: number;
        maxArenaTickets: number;
        startArenaTickets: number;
    };
    equipment: {
        starterItems: IStarterEquipmentConfigItem[];
    };
}
