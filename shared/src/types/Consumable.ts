// Тип расходника
export type ConsumableType = 'combat' | 'hiking' | 'scout';

// Расходник в инвентаре игрока
export interface IConsumable {
    id: string;
    name: string;
    type: ConsumableType;
    tier: number;
    effect: string;
    value: number;
}
