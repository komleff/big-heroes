// Реликвия (пассивный бонус на весь поход)
export interface IRelic {
    id: string;
    name: string;
    effect: string;       // тип эффекта: 'strength_bonus', 'armor_bonus', 'luck_bonus', 'gold_bonus', 'mass_bonus', 'enemy_strength_reduction'
    value: number;        // числовое значение
}
