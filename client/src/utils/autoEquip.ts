import { GameState } from '../core/GameState';
import type { IEquipmentItem, EquipmentSlotId } from 'shared';
import type { IStarterEquipmentConfigItem } from 'shared';

/**
 * Авто-экипировать предмет, если слот пустой.
 * Замена существующего предмета — только через инвентарь (будущий Sprint).
 */
export function autoEquipIfBetter(
    gameState: GameState,
    itemId: string,
    catalog: IStarterEquipmentConfigItem[],
): void {
    const configItem = catalog.find(e => e.id === itemId);
    if (!configItem) return; // Не equipment (расходник)

    const slot = configItem.slot as EquipmentSlotId;
    const current = gameState.equipment[slot];

    // Экипировать только в пустой слот (нет потери старого предмета)
    if (current) return;

    gameState.equipItem({
        id: configItem.id,
        name: configItem.name,
        slot: configItem.slot,
        tier: configItem.tier,
        strengthBonus: configItem.strengthBonus,
        armorBonus: configItem.armorBonus,
        luckBonus: configItem.luckBonus,
        commandId: configItem.commandId,
        maxDurability: configItem.maxDurability,
        currentDurability: configItem.maxDurability,
        basePrice: configItem.basePrice,
    });
}
