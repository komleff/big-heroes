import {
    configToRelic,
    generateRelicPool,
    selectRelic,
    calcRelicMassMultiplier,
    calcRelicGoldMultiplier,
    calcRelicShopDiscount,
    hasRelicEffect,
    calcRelicCampRepairBonus,
    MAX_RELICS,
} from './RelicSystem';
import type { IRelicConfig } from '../types/BalanceConfig';
import type { IRelic } from '../types/Relic';
import { createRng } from '../utils/Random';

// ─── Хелперы ──────────────────────────────────────────────────────────

/** Создать реликвию для тестов */
function makeRelic(overrides: Partial<IRelic> = {}): IRelic {
    return {
        id: 'relic_test',
        name: 'Тестовая реликвия',
        effect: 'mass_bonus',
        value: 0.2,
        rarity: 'common',
        ...overrides,
    };
}

/** Создать конфиг реликвии для тестов */
function makeRelicConfig(overrides: Partial<IRelicConfig> = {}): IRelicConfig {
    return {
        id: 'relic_test',
        name: 'Тестовая реликвия',
        effect: 'mass_bonus',
        value: 0.2,
        rarity: 'common',
        ...overrides,
    };
}

/** Набор конфигов реликвий для тестов пула */
const testRelicConfigs: IRelicConfig[] = [
    makeRelicConfig({ id: 'r1', name: 'Реликвия 1', effect: 'mass_bonus', value: 0.2, rarity: 'common' }),
    makeRelicConfig({ id: 'r2', name: 'Реликвия 2', effect: 'gold_bonus', value: 0.3, rarity: 'common' }),
    makeRelicConfig({ id: 'r3', name: 'Реликвия 3', effect: 'shop_discount', value: 0.3, rarity: 'uncommon' }),
    makeRelicConfig({ id: 'r4', name: 'Реликвия 4', effect: 'mass_on_win', value: 0.15, rarity: 'rare' }),
    makeRelicConfig({ id: 'r5', name: 'Реликвия 5', effect: 'camp_repair_bonus', value: 1, rarity: 'uncommon' }),
];

// ─── configToRelic ────────────────────────────────────────────────────

describe('RelicSystem — configToRelic', () => {
    test('корректно преобразует IRelicConfig в IRelic', () => {
        // Arrange
        const config = makeRelicConfig({
            id: 'relic_iron_skin',
            name: 'Железная кожа',
            effect: 'armor_bonus',
            value: 2,
            rarity: 'rare',
        });

        // Act
        const relic = configToRelic(config);

        // Assert
        expect(relic).toEqual({
            id: 'relic_iron_skin',
            name: 'Железная кожа',
            effect: 'armor_bonus',
            value: 2,
            rarity: 'rare',
        });
    });
});

// ─── generateRelicPool ───────────────────────────────────────────────

describe('RelicSystem — generateRelicPool', () => {
    test('возвращает count реликвий из доступных', () => {
        // Arrange
        const rng = createRng(42);

        // Act
        const pool = generateRelicPool(testRelicConfigs, [], 3, rng);

        // Assert
        expect(pool).toHaveLength(3);
    });

    test('исключает уже активные реликвии', () => {
        // Arrange
        const rng = createRng(42);
        const active = [makeRelic({ id: 'r1' }), makeRelic({ id: 'r2' })];

        // Act
        const pool = generateRelicPool(testRelicConfigs, active, 3, rng);

        // Assert
        const poolIds = pool.map(r => r.id);
        expect(poolIds).not.toContain('r1');
        expect(poolIds).not.toContain('r2');
        expect(pool).toHaveLength(3); // осталось ровно 3 доступных
    });

    test('если доступных меньше count — возвращает все доступные', () => {
        // Arrange
        const rng = createRng(42);
        const active = [makeRelic({ id: 'r1' }), makeRelic({ id: 'r2' }), makeRelic({ id: 'r3' }), makeRelic({ id: 'r4' })];

        // Act
        const pool = generateRelicPool(testRelicConfigs, active, 3, rng);

        // Assert
        expect(pool).toHaveLength(1);
        expect(pool[0].id).toBe('r5');
    });

    test('детерминизм — одинаковый seed даёт одинаковый пул', () => {
        // Arrange & Act
        const pool1 = generateRelicPool(testRelicConfigs, [], 3, createRng(123));
        const pool2 = generateRelicPool(testRelicConfigs, [], 3, createRng(123));

        // Assert
        expect(pool1.map(r => r.id)).toEqual(pool2.map(r => r.id));
    });
});

// ─── selectRelic ─────────────────────────────────────────────────────

describe('RelicSystem — selectRelic', () => {
    test('добавляет реликвию если есть место (< MAX_RELICS)', () => {
        // Arrange
        const active = [makeRelic({ id: 'r1' })];
        const newRelic = makeRelic({ id: 'r2' });

        // Act
        const result = selectRelic(active, newRelic);

        // Assert
        expect(result).toHaveLength(2);
        expect(result[1].id).toBe('r2');
    });

    test('заменяет реликвию по индексу если лимит достигнут', () => {
        // Arrange
        const active = [
            makeRelic({ id: 'r1' }),
            makeRelic({ id: 'r2' }),
            makeRelic({ id: 'r3' }),
        ];
        const newRelic = makeRelic({ id: 'r4' });

        // Act
        const result = selectRelic(active, newRelic, 1);

        // Assert
        expect(result).toHaveLength(3);
        expect(result[1].id).toBe('r4');
        expect(result[0].id).toBe('r1');
        expect(result[2].id).toBe('r3');
    });

    test('не изменяет массив если лимит и нет индекса замены', () => {
        // Arrange
        const active = [
            makeRelic({ id: 'r1' }),
            makeRelic({ id: 'r2' }),
            makeRelic({ id: 'r3' }),
        ];
        const newRelic = makeRelic({ id: 'r4' });

        // Act
        const result = selectRelic(active, newRelic);

        // Assert
        expect(result).toHaveLength(3);
        expect(result.map(r => r.id)).toEqual(['r1', 'r2', 'r3']);
    });

    test('MAX_RELICS = 3', () => {
        expect(MAX_RELICS).toBe(3);
    });
});

// ─── calcRelicMassMultiplier ─────────────────────────────────────────

describe('RelicSystem — calcRelicMassMultiplier', () => {
    test('без реликвий = 1.0', () => {
        expect(calcRelicMassMultiplier([])).toBe(1.0);
    });

    test('mass_bonus +0.2 = 1.2', () => {
        const relics = [makeRelic({ effect: 'mass_bonus', value: 0.2 })];
        expect(calcRelicMassMultiplier(relics)).toBeCloseTo(1.2);
    });

    test('mass_bonus + mass_on_win стакаются', () => {
        const relics = [
            makeRelic({ id: 'r1', effect: 'mass_bonus', value: 0.2 }),
            makeRelic({ id: 'r2', effect: 'mass_on_win', value: 0.15 }),
        ];
        expect(calcRelicMassMultiplier(relics)).toBeCloseTo(1.35);
    });
});

// ─── calcRelicGoldMultiplier ─────────────────────────────────────────

describe('RelicSystem — calcRelicGoldMultiplier', () => {
    test('без реликвий = 1.0', () => {
        expect(calcRelicGoldMultiplier([])).toBe(1.0);
    });

    test('gold_bonus +0.3 = 1.3', () => {
        const relics = [makeRelic({ effect: 'gold_bonus', value: 0.3 })];
        expect(calcRelicGoldMultiplier(relics)).toBeCloseTo(1.3);
    });
});

// ─── calcRelicShopDiscount ───────────────────────────────────────────

describe('RelicSystem — calcRelicShopDiscount', () => {
    test('без реликвий = 0', () => {
        expect(calcRelicShopDiscount([])).toBe(0);
    });

    test('shop_discount возвращает значение скидки', () => {
        const relics = [makeRelic({ effect: 'shop_discount', value: 0.3 })];
        expect(calcRelicShopDiscount(relics)).toBe(0.3);
    });
});

// ─── hasRelicEffect ──────────────────────────────────────────────────

describe('RelicSystem — hasRelicEffect', () => {
    test('true если эффект есть', () => {
        const relics = [makeRelic({ effect: 'gold_bonus' })];
        expect(hasRelicEffect(relics, 'gold_bonus')).toBe(true);
    });

    test('false если нет', () => {
        const relics = [makeRelic({ effect: 'mass_bonus' })];
        expect(hasRelicEffect(relics, 'gold_bonus')).toBe(false);
    });
});

// ─── calcRelicCampRepairBonus ────────────────────────────────────────

describe('RelicSystem — calcRelicCampRepairBonus', () => {
    test('без реликвий = 0', () => {
        expect(calcRelicCampRepairBonus([])).toBe(0);
    });

    test('camp_repair_bonus возвращает значение', () => {
        const relics = [makeRelic({ effect: 'camp_repair_bonus', value: 1 })];
        expect(calcRelicCampRepairBonus(relics)).toBe(1);
    });
});
