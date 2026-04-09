import { GameState } from '../core/GameState';
import type { IEquipmentItem, EquipmentSlotId } from 'shared';
import type { IStarterEquipmentConfigItem } from 'shared';

/**
 * Авто-экипировать предмет, если слот пустой или новый предмет лучше.
 * "Лучше" = выше tier, при равном tier — выше суммарный бонус.
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

    const newItem: IEquipmentItem = {
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
    };

    // Слот пустой — экипировать сразу
    if (!current) {
        gameState.equipItem(newItem);
        return;
    }

    // Новый предмет лучше: tier выше, или при равном tier суммарный бонус выше
    const currentTotal = current.strengthBonus + current.armorBonus + current.luckBonus;
    const newTotal = newItem.strengthBonus + newItem.armorBonus + newItem.luckBonus;

    if (newItem.tier > current.tier || (newItem.tier === current.tier && newTotal > currentTotal)) {
        gameState.equipItem(newItem);
    }
}
