// Идентификатор команды, привязанной к предмету
export type CommandId = 'cmd_attack' | 'cmd_block' | 'cmd_fortune' | 'cmd_retreat' | 'cmd_bypass' | 'cmd_polymorph';

// Идентификатор слота экипировки
export type EquipmentSlotId = 'weapon' | 'armor' | 'accessory';

// Предмет экипировки (GDD v1.2)
export interface IEquipmentItem {
    id: string;                    // например 'wpn_sword_t1'
    name: string;                  // отображаемое название
    slot: EquipmentSlotId;
    tier: number;                  // 1-5
    strengthBonus: number;         // +N к силе
    armorBonus: number;            // +N к броне
    luckBonus: number;             // +N к удаче
    commandId: CommandId | null;   // привязанная команда (null = нет)
    maxDurability: number;         // 3 (tier 1), 5, 7, 9
    currentDurability: number;
    basePrice: number;
}
