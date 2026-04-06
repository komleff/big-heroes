import { generateLoot, generateShopInventory, calcShopRepairCost } from './LootSystem';
import type { IPveLootConfig, IPveShopConfig, IStarterEquipmentConfigItem, IConsumableConfig } from '../types/BalanceConfig';
import { createRng } from '../utils/Random';

// ─── Хелперы ──────────────────────────────────────────────────────────

/** Фиксированный RNG: возвращает значения из массива по порядку */
function fixedRng(values: number[]): () => number {
    let i = 0;
    return () => values[i++] ?? 0;
}

/** Конфигурация лута из balance.json */
const lootConfig: IPveLootConfig = {
    combat_loot_chance: 0.20,
    elite_loot_guaranteed: true,
    elite_relic_chance: 0.40,
    boss_loot_count: 2,
    chest_loot_count_min: 1,
    chest_loot_count_max: 2,
    pity_counter: 5,
    equipment_drop_chance: 0.5,
};

/** Конфигурация магазина из balance.json */
const shopConfig: IPveShopConfig = {
    item_count_min: 3,
    item_count_max: 4,
    price_multiplier: 1.0,
    repair_price_multiplier: 1.75,
};

/** Каталог снаряжения из balance.json */
const equipmentCatalog: IStarterEquipmentConfigItem[] = [
    { id: 'wpn_sword_t1', name: 'Меч', slot: 'weapon', tier: 1, strengthBonus: 3, armorBonus: 0, luckBonus: 0, commandId: 'cmd_attack', maxDurability: 3, basePrice: 50 },
    { id: 'wpn_axe_t1', name: 'Топор', slot: 'weapon', tier: 1, strengthBonus: 4, armorBonus: 0, luckBonus: 0, commandId: 'cmd_attack', maxDurability: 3, basePrice: 70 },
    { id: 'wpn_dagger_t1', name: 'Кинжал', slot: 'weapon', tier: 1, strengthBonus: 2, armorBonus: 0, luckBonus: 1, commandId: 'cmd_attack', maxDurability: 3, basePrice: 60 },
    { id: 'shd_buckler_t1', name: 'Баклер', slot: 'armor', tier: 1, strengthBonus: 0, armorBonus: 3, luckBonus: 0, commandId: 'cmd_block', maxDurability: 3, basePrice: 60 },
    { id: 'shd_leather_t1', name: 'Кожанка', slot: 'armor', tier: 1, strengthBonus: 0, armorBonus: 2, luckBonus: 0, commandId: 'cmd_block', maxDurability: 3, basePrice: 50 },
    { id: 'shd_helmet_t1', name: 'Шлем', slot: 'armor', tier: 1, strengthBonus: 0, armorBonus: 2, luckBonus: 1, commandId: 'cmd_block', maxDurability: 3, basePrice: 55 },
    { id: 'acc_ring_t1', name: 'Кольцо удачи', slot: 'accessory', tier: 1, strengthBonus: 0, armorBonus: 0, luckBonus: 1, commandId: 'cmd_fortune', maxDurability: 3, basePrice: 60 },
    { id: 'acc_boots_t1', name: 'Сапоги', slot: 'accessory', tier: 1, strengthBonus: 0, armorBonus: 0, luckBonus: 0, commandId: 'cmd_retreat', maxDurability: 3, basePrice: 80 },
    { id: 'acc_vial_t1', name: 'Склянка', slot: 'accessory', tier: 1, strengthBonus: 0, armorBonus: 0, luckBonus: 0, commandId: 'cmd_polymorph', maxDurability: 3, basePrice: 70 },
];

/** Расходники из balance.json */
const consumables: IConsumableConfig[] = [
    { id: 'str_pot_t1', name: 'Настойка силы', type: 'combat', tier: 1, effect: 'strength_bonus', value: 8, basePrice: 30 },
    { id: 'arm_pot_t1', name: 'Настойка брони', type: 'combat', tier: 1, effect: 'armor_bonus', value: 3, basePrice: 30 },
    { id: 'luck_pot_t1', name: 'Настойка удачи', type: 'combat', tier: 1, effect: 'luck_bonus', value: 3, basePrice: 30 },
    { id: 'poison_t1', name: 'Яд', type: 'combat', tier: 1, effect: 'enemy_strength_reduction', value: 5, basePrice: 40 },
    { id: 'repair_t1', name: 'Ремкомплект', type: 'hiking', tier: 1, effect: 'repair', value: 1, basePrice: 25 },
    { id: 'torch_t1', name: 'Факел', type: 'scout', tier: 1, effect: 'reveal_node', value: 1, basePrice: 15 },
    { id: 'spyglass_t2', name: 'Подзорная труба', type: 'scout', tier: 2, effect: 'show_enemy_stats', value: 1, basePrice: 50 },
    { id: 'compass_t2', name: 'Компас', type: 'scout', tier: 2, effect: 'safe_path', value: 1, basePrice: 60 },
    { id: 'picnic_t1', name: 'Провиант', type: 'hiking', tier: 1, effect: 'mass_bonus', value: 5, basePrice: 35 },
    { id: 'pouch_t1', name: 'Подсумок', type: 'hiking', tier: 1, effect: 'backpack_slot', value: 1, basePrice: 100 },
];

// ─── generateLoot ─────────────────────────────────────────────────────

describe('generateLoot', () => {
    test('combat: rng < combat_loot_chance → 1 предмет', () => {
        // Arrange — rng=0.1 < 0.20 → лут выпадает
        const rng = fixedRng([0.1, 0.3, 0.5]);

        // Act
        const result = generateLoot('combat', lootConfig, equipmentCatalog, consumables, 0, rng);

        // Assert
        expect(result.drops).toHaveLength(1);
    });

    test('combat: rng >= combat_loot_chance → 0 предметов', () => {
        // Arrange — rng=0.5 > 0.20 → лута нет
        const rng = fixedRng([0.5]);

        // Act
        const result = generateLoot('combat', lootConfig, equipmentCatalog, consumables, 0, rng);

        // Assert
        expect(result.drops).toHaveLength(0);
    });

    test('elite: гарантированно 1 предмет', () => {
        // Arrange
        const rng = fixedRng([0.3, 0.5]);

        // Act
        const result = generateLoot('elite', lootConfig, equipmentCatalog, consumables, 0, rng);

        // Assert
        expect(result.drops).toHaveLength(1);
    });

    test('boss: гарантированно boss_loot_count (2) предмета', () => {
        // Arrange
        const rng = fixedRng([0.3, 0.5, 0.3, 0.5]);

        // Act
        const result = generateLoot('boss', lootConfig, equipmentCatalog, consumables, 0, rng);

        // Assert
        expect(result.drops).toHaveLength(lootConfig.boss_loot_count);
    });

    test('chest: 1-2 предмета', () => {
        // Arrange — createRng для детерминизма
        const rng = createRng(42);

        // Act
        const result = generateLoot('chest', lootConfig, equipmentCatalog, consumables, 0, rng);

        // Assert
        expect(result.drops.length).toBeGreaterThanOrEqual(1);
        expect(result.drops.length).toBeLessThanOrEqual(2);
    });

    test('sanctuary: 0 предметов', () => {
        // Arrange
        const rng = fixedRng([]);

        // Act
        const result = generateLoot('sanctuary', lootConfig, equipmentCatalog, consumables, 0, rng);

        // Assert
        expect(result.drops).toHaveLength(0);
    });

    test('shop: 0 предметов', () => {
        // Arrange
        const rng = fixedRng([]);

        // Act
        const result = generateLoot('shop', lootConfig, equipmentCatalog, consumables, 0, rng);

        // Assert
        expect(result.drops).toHaveLength(0);
    });

    test('camp: 0 предметов', () => {
        // Arrange
        const rng = fixedRng([]);

        // Act
        const result = generateLoot('camp', lootConfig, equipmentCatalog, consumables, 0, rng);

        // Assert
        expect(result.drops).toHaveLength(0);
    });

    test('pity-счётчик: на 5-м предмете tierBoosted = true', () => {
        // Arrange — pityCounter = 4, следующий бросок будет 5-м (>= pity_counter)
        const rng = fixedRng([0.3, 0.5]);

        // Act
        const result = generateLoot('elite', lootConfig, equipmentCatalog, consumables, 4, rng);

        // Assert
        expect(result.drops).toHaveLength(1);
        expect(result.drops[0].tierBoosted).toBe(true);
    });

    test('pity-счётчик: сбрасывается после срабатывания', () => {
        // Arrange — pityCounter = 4, после срабатывания должен сброситься в 0
        const rng = fixedRng([0.3, 0.5]);

        // Act
        const result = generateLoot('elite', lootConfig, equipmentCatalog, consumables, 4, rng);

        // Assert
        expect(result.newPityCounter).toBe(0);
    });
});

// ─── generateShopInventory ────────────────────────────────────────────

describe('generateShopInventory', () => {
    test('возвращает 3-4 товара', () => {
        // Arrange
        const rng = createRng(42);

        // Act
        const items = generateShopInventory(shopConfig, equipmentCatalog, consumables, rng);

        // Assert
        expect(items.length).toBeGreaterThanOrEqual(3);
        expect(items.length).toBeLessThanOrEqual(4);
    });

    test('товары имеют цену на основе basePrice x price_multiplier', () => {
        // Arrange
        const rng = createRng(42);

        // Act
        const items = generateShopInventory(shopConfig, equipmentCatalog, consumables, rng);

        // Assert — каждая цена должна совпадать с basePrice * multiplier соответствующего предмета
        for (const item of items) {
            const catalogItem = item.itemType === 'equipment'
                ? equipmentCatalog.find(e => e.id === item.itemId)
                : consumables.find(c => c.id === item.itemId);
            expect(catalogItem).toBeDefined();
            expect(item.price).toBe(Math.round(catalogItem!.basePrice * shopConfig.price_multiplier));
        }
    });

    test('детерминизм: одинаковый seed = одинаковые товары', () => {
        // Arrange
        const rng1 = createRng(123);
        const rng2 = createRng(123);

        // Act
        const items1 = generateShopInventory(shopConfig, equipmentCatalog, consumables, rng1);
        const items2 = generateShopInventory(shopConfig, equipmentCatalog, consumables, rng2);

        // Assert
        expect(items1).toEqual(items2);
    });
});

// ─── calcShopRepairCost ───────────────────────────────────────────────

describe('calcShopRepairCost', () => {
    test('применяет repair_price_multiplier', () => {
        // Arrange
        const baseCost = 100;

        // Act
        const cost = calcShopRepairCost(baseCost, shopConfig);

        // Assert — 100 * 1.75 = 175
        expect(cost).toBe(175);
    });
});
