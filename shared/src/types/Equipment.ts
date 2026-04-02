// Идентификатор слота экипировки
export type EquipmentSlotId = 'weapon' | 'armor' | 'accessory';

// Описание предмета экипировки
export interface IEquipmentItem {
    id: string;              // например 'wpn_sword_t1'
    name: string;            // отображаемое название
    slot: EquipmentSlotId;
    tier: number;            // 1-5
    modifier: number;        // множитель к формуле
    maxDurability: number;
    currentDurability: number;
    basePrice: number;
}
