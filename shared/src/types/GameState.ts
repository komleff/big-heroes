import type { IEquipmentItem } from './Equipment';
import type { IConsumable } from './Consumable';
import type { IRelic } from './Relic';

// Базовое состояние героя (сохраняемое)
export interface IHeroState {
    mass: number;          // масса в кг (= HP в бою)
    rating: number;        // Elo-рейтинг
    massCap: number;       // потолок массы для текущей главы
}

// Вычисляемые боевые характеристики (через FormulaEngine)
export interface IHeroStats {
    hp: number;            // = mass
    strength: number;      // = mass/3 + weapon bonus + relic bonus
    armor: number;         // = shield bonus + relic bonus
    luck: number;          // = accessory bonus + relic bonus
}

// Ресурсы игрока
export interface IResources {
    gold: number;
}

// Слоты экипировки
export interface IEquipmentSlots {
    weapon: IEquipmentItem | null;
    armor: IEquipmentItem | null;
    accessory: IEquipmentItem | null;
}

// Слот пояса (2 слота)
export type IBeltSlot = IConsumable | null;

// Полное состояние игры
export interface IGameState {
    hero: IHeroState;
    resources: IResources;
    equipment: IEquipmentSlots;
    belt: [IBeltSlot, IBeltSlot];
    backpack: Array<IEquipmentItem | IConsumable | null>;  // max 4
    stash: IEquipmentItem[];
    activeRelics: IRelic[];
}
