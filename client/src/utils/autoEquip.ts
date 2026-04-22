import { GameState } from '../core/GameState';
import { findFreeBeltSlotIndex } from 'shared';
import type { IEquipmentItem, EquipmentSlotId, IConsumable, IConsumableConfig } from 'shared';
import type { IStarterEquipmentConfigItem, IPveExpeditionState } from 'shared';

/**
 * Помещает расходник на пояс и регистрирует слот в expeditionState.beltAdditions,
 * чтобы endExpedition на defeat очистил этот слот (loot-loss инвариант).
 * Если экспедиция не активна (fallback single-PvP / starterBelt init) — регистрация no-op.
 * Используем gameState.appendBeltAddition вместо updateExpeditionState, чтобы
 * обойти stale overwrite от callsite-ов вызывающих updateExpeditionState
 * со старым snapshot-ом (adversarial F-1).
 */
function placeOnBeltWithExpeditionTracking(
    gameState: GameState, slotIdx: 0 | 1, consumable: IConsumable,
): void {
    gameState.setBelt(slotIdx, consumable);
    gameState.appendBeltAddition(slotIdx);
}

/**
 * Пытается поместить расходник на пояс при наличии свободного слота.
 * Возвращает true, если расходник размещён (fallback в рюкзак — задача вызывающей стороны).
 * Если itemId не является расходником — возвращает false (обрабатывать как equipment).
 *
 * Закрывает баг big-heroes-e0o: при подборе consumable из сундука при свободной
 * ячейке пояса предмет должен автоматически занять слот, а не уходить в рюкзак.
 *
 * dolt-ebh: non-combat расходники (scout / hiking) НЕ кладём на пояс — на поясе
 * их невозможно использовать (в бою блокируется guard'ом, на fork-узле нет UI —
 * см. dolt-zxc). Non-combat идут в рюкзак как обычное снаряжение; когда появится
 * UI для non-combat на перекрёстке (dolt-zxc), правило можно ослабить.
 */
export function autoPlaceConsumableOnBelt(
    gameState: GameState,
    itemId: string,
    consumables: IConsumableConfig[],
): boolean {
    const cfg = consumables.find(c => c.id === itemId);
    if (!cfg) return false;

    // На пояс — только combat-расходники. Non-combat (scout/hiking) → fallback в рюкзак.
    if (cfg.type !== 'combat') return false;

    const freeIdx = findFreeBeltSlotIndex(gameState.belt);
    if (freeIdx === -1) return false; // Свободных слотов нет — fallback в рюкзак

    const consumable: IConsumable = {
        id: cfg.id,
        name: cfg.name,
        type: cfg.type,
        tier: cfg.tier,
        effect: cfg.effect,
        value: cfg.value,
    };
    placeOnBeltWithExpeditionTracking(gameState, freeIdx, consumable);
    return true;
}

/**
 * Авто-экипировать предмет, если слот пустой или новый предмет лучше.
 * "Лучше" = выше tier, или при равном tier выше суммарный бонус.
 * Старый предмет помещается в походный рюкзак (expedition.itemsFound).
 * При defeat рюкзак теряется — это по GDD (игрок рискует).
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

    // Сравнение: tier выше, или при равном tier суммарный бонус выше
    const currentTotal = current.strengthBonus + current.armorBonus + current.luckBonus;
    const newTotal = newItem.strengthBonus + newItem.armorBonus + newItem.luckBonus;
    const isBetter = newItem.tier > current.tier
        || (newItem.tier === current.tier && newTotal > currentTotal);

    if (!isBetter) return;

    // Старый предмет → в походный рюкзак (рискует потеряться при defeat — по GDD)
    const expedition = gameState.expeditionState;
    if (expedition) {
        const state = expedition as IPveExpeditionState;
        gameState.updateExpeditionState({
            ...state,
            itemsFound: [...state.itemsFound, current.id],
        });
    }

    gameState.equipItem(newItem);
}
