import type { IStarterEquipmentConfigItem, IConsumableConfig, IPveLootConfig, IPveShopConfig } from '../types/BalanceConfig';
import type { PveNodeType } from '../types/PveNode';
import type { IBeltSlot } from '../types/GameState';
import { randInt, randPick, shuffle } from '../utils/Random';

// Элемент лута
export interface ILootDrop {
    itemId: string;          // id предмета или расходника
    itemType: 'equipment' | 'consumable';
    tierBoosted: boolean;    // true если pity-система повысила tier
}

// Результат генерации лута
export interface ILootResult {
    drops: ILootDrop[];
    newPityCounter: number;
}

// Товар магазина
export interface IShopItem {
    itemId: string;
    itemType: 'equipment' | 'consumable';
    price: number;
}

/** Сгенерировать лут для узла */
export function generateLoot(
    nodeType: PveNodeType,
    lootConfig: IPveLootConfig,
    equipmentCatalog: IStarterEquipmentConfigItem[],
    consumables: IConsumableConfig[],
    pityCounter: number,
    rng: () => number,
): ILootResult {
    const drops: ILootDrop[] = [];
    let counter = pityCounter;

    // Определить количество предметов по типу узла
    switch (nodeType) {
        case 'combat': {
            // Шанс лута combat_loot_chance (20%)
            if (rng() < lootConfig.combat_loot_chance) {
                const drop = rollDrop(equipmentCatalog, consumables, counter, lootConfig.pity_counter, rng, lootConfig.equipment_drop_chance);
                drops.push(drop.item);
                counter = drop.newCounter;
            }
            break;
        }
        case 'elite': {
            // Гарантированный лут
            if (lootConfig.elite_loot_guaranteed) {
                const drop = rollDrop(equipmentCatalog, consumables, counter, lootConfig.pity_counter, rng, lootConfig.equipment_drop_chance);
                drops.push(drop.item);
                counter = drop.newCounter;
            }
            break;
        }
        case 'boss': {
            // Гарантированные предметы (boss_loot_count = 2)
            for (let i = 0; i < lootConfig.boss_loot_count; i++) {
                const drop = rollDrop(equipmentCatalog, consumables, counter, lootConfig.pity_counter, rng, lootConfig.equipment_drop_chance);
                drops.push(drop.item);
                counter = drop.newCounter;
            }
            break;
        }
        case 'chest':
        case 'ancient_chest': {
            // 1-2 предмета
            const count = randInt(rng, lootConfig.chest_loot_count_min, lootConfig.chest_loot_count_max);
            for (let i = 0; i < count; i++) {
                const drop = rollDrop(equipmentCatalog, consumables, counter, lootConfig.pity_counter, rng, lootConfig.equipment_drop_chance);
                drops.push(drop.item);
                counter = drop.newCounter;
            }
            break;
        }
        // sanctuary, shop, camp, event — без автоматического лута
        default:
            break;
    }

    return { drops, newPityCounter: counter };
}

/** Бросок одного предмета с учётом pity-счётчика */
function rollDrop(
    equipment: IStarterEquipmentConfigItem[],
    consumables: IConsumableConfig[],
    pityCounter: number,
    pityThreshold: number,
    rng: () => number,
    equipmentDropChance: number = 0.5,
): { item: ILootDrop; newCounter: number } {
    const newCounter = pityCounter + 1;
    const tierBoosted = newCounter >= pityThreshold;

    // Шанс снаряжение vs расходник из конфига
    const isEquipment = rng() < equipmentDropChance;

    let itemId: string;
    // Фактический тип: может отличаться от isEquipment при пустом массиве
    let actualType: 'equipment' | 'consumable' = isEquipment ? 'equipment' : 'consumable';

    if (isEquipment && equipment.length > 0) {
        const item = randPick(rng, equipment);
        itemId = item.id;
    } else if (consumables.length > 0) {
        const item = randPick(rng, consumables);
        itemId = item.id;
        actualType = 'consumable';
    } else {
        itemId = 'unknown';
        actualType = 'consumable';
    }

    return {
        item: { itemId, itemType: actualType, tierBoosted },
        newCounter: tierBoosted ? 0 : newCounter,  // сбросить при срабатывании pity
    };
}

/** Сгенерировать товары магазина */
export function generateShopInventory(
    shopConfig: IPveShopConfig,
    equipmentCatalog: IStarterEquipmentConfigItem[],
    consumables: IConsumableConfig[],
    rng: () => number,
): IShopItem[] {
    const itemCount = randInt(rng, shopConfig.item_count_min, shopConfig.item_count_max);
    const items: IShopItem[] = [];

    // Перемешать каталоги
    const shuffledEquipment = shuffle(rng, equipmentCatalog);
    const shuffledConsumables = shuffle(rng, consumables);

    let eqIdx = 0;
    let conIdx = 0;

    for (let i = 0; i < itemCount; i++) {
        // Чередовать снаряжение и расходники
        if (i % 2 === 0 && eqIdx < shuffledEquipment.length) {
            const eq = shuffledEquipment[eqIdx++];
            items.push({
                itemId: eq.id,
                itemType: 'equipment',
                price: Math.round(eq.basePrice * shopConfig.price_multiplier),
            });
        } else if (conIdx < shuffledConsumables.length) {
            const con = shuffledConsumables[conIdx++];
            items.push({
                itemId: con.id,
                itemType: 'consumable',
                price: Math.round(con.basePrice * shopConfig.price_multiplier),
            });
        }
    }

    return items;
}

/** Рассчитать стоимость ремонта в магазине */
export function calcShopRepairCost(
    baseRepairCost: number,
    shopConfig: IPveShopConfig,
): number {
    return Math.round(baseRepairCost * shopConfig.repair_price_multiplier);
}

/**
 * Ищет первый свободный слот на поясе для авто-размещения расходника.
 * Возвращает индекс свободного слота или -1, если все слоты заняты.
 * Чистая функция — вход не мутируется.
 *
 * Используется при подборе consumable из сундука/магазина/события,
 * чтобы предмет автоматически помещался на пояс при наличии свободной
 * ячейки (по аналогии с autoEquip для снаряжения). Fallback — рюкзак.
 */
export function findFreeBeltSlotIndex(belt: Readonly<[IBeltSlot, IBeltSlot]>): 0 | 1 | -1 {
    if (belt[0] === null) return 0;
    if (belt[1] === null) return 1;
    return -1;
}
