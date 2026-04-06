// Реликвия (пассивный бонус на весь поход)
export type RelicRarity = 'common' | 'uncommon' | 'rare';

export interface IRelic {
    id: string;
    name: string;
    effect: string;       // тип эффекта
    value: number;        // числовое значение
    rarity: RelicRarity;  // редкость
}
