import type { IStarterEquipmentConfigItem, IConsumableConfig, IPveLootConfig, IPveShopConfig } from '../types/BalanceConfig';
import { randInt, randPick, shuffle } from '../utils/Random';

// Тип узла (локальный, чтобы не зависеть от порядка создания файлов)
type PveNodeType = 'sanctuary' | 'combat' | 'elite' | 'shop' | 'camp' | 'event' | 'chest' | 'ancient_chest' | 'boss';

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
                const drop = rollDrop(equipmentCatalog, consumables, counter, lootConfig.pity_counter, rng);
                drops.push(drop.item);
                counter = drop.newCounter;
            }
            break;
        }
        case 'elite': {
            // Гарантированный лут
            if (lootConfig.elite_loot_guaranteed) {
                const drop = rollDrop(equipmentCatalog, consumables, counter, lootConfig.pity_counter, rng);
                drops.push(drop.item);
                counter = drop.newCounter;
            }
            break;
        }
        case 'boss': {
            // Гарантированные предметы (boss_loot_count = 2)
            for (let i = 0; i < lootConfig.boss_loot_count; i++) {
                const drop = rollDrop(equipmentCatalog, consumables, counter, lootConfig.pity_counter, rng);
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
                const drop = rollDrop(equipmentCatalog, consumables, counter, lootConfig.pity_counter, rng);
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
): { item: ILootDrop; newCounter: number } {
    const newCounter = pityCounter + 1;
    const tierBoosted = newCounter >= pityThreshold;

    // 50/50 шанс снаряжение vs расходник
    const isEquipment = rng() < 0.5;

    let itemId: string;
    if (isEquipment && equipment.length > 0) {
        const item = randPick(rng, equipment);
        itemId = item.id;
    } else if (consumables.length > 0) {
        const item = randPick(rng, consumables);
        itemId = item.id;
    } else {
        itemId = 'unknown';
    }

    return {
        item: { itemId, itemType: isEquipment ? 'equipment' : 'consumable', tierBoosted },
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
