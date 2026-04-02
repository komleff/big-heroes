import type { IEquipmentItem } from './Equipment';

// Состояние героя
export interface IHeroState {
    mass: number;
    rating: number;
    hp: number;
    maxHp: number;
    baseAttack: number;
    baseDefense: number;
}

// Ресурсы игрока
export interface IResources {
    gold: number;
    campaignTickets: number;
    maxCampaignTickets: number;
    arenaTickets: number;
    maxArenaTickets: number;
}

// Слоты экипировки
export interface IEquipmentSlots {
    weapon: IEquipmentItem | null;
    armor: IEquipmentItem | null;
    accessory: IEquipmentItem | null;
}

// Полное состояние игры
export interface IGameState {
    hero: IHeroState;
    resources: IResources;
    equipment: IEquipmentSlots;
}
