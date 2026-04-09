import { resolveEventOutcome, getVariantProcChance } from './EventSystem';
import type { IEventVariant } from '../types/BalanceConfig';

describe('EventSystem', () => {
    describe('getVariantProcChance', () => {
        it('возвращает proc_chance из конфига', () => {
            const variant: IEventVariant = {
                id: 'solve', label: 'Разгадать', description: '70%',
                proc_chance: 0.7,
                effects: [{ type: 'loot_chest', value: 1 }],
            };
            expect(getVariantProcChance(variant)).toBe(0.7);
        });

        it('fallback 1.0 при отсутствии proc_chance', () => {
            const variant: IEventVariant = {
                id: 'pray', label: 'Помолиться', description: '+20 кг',
                effects: [{ type: 'mass', value: 20 }],
            };
            expect(getVariantProcChance(variant)).toBe(1.0);
        });

        it('clamp: proc_chance > 1 → 1.0', () => {
            const variant: IEventVariant = {
                id: 'broken', label: 'Broken', description: '',
                proc_chance: 70,
                effects: [{ type: 'item', value: 1 }],
            };
            expect(getVariantProcChance(variant)).toBe(1.0);
        });

        it('clamp: proc_chance < 0 → 0', () => {
            const variant: IEventVariant = {
                id: 'broken', label: 'Broken', description: '',
                proc_chance: -0.5,
                effects: [{ type: 'item', value: 1 }],
            };
            expect(getVariantProcChance(variant)).toBe(0);
        });
    });

    describe('resolveEventOutcome', () => {
        it('lose_item + loot_chest: оба гарантированы при жертве (любой roll)', () => {
            const variant: IEventVariant = {
                id: 'sacrifice', label: 'Пожертвовать', description: '',
                effects: [
                    { type: 'lose_item', value: 1 },
                    { type: 'loot_chest', value: 1 },
                ],
            };
            // Даже при roll=0.99 (провальный для любого proc_chance < 1.0)
            const results = resolveEventOutcome(variant, 0.99);
            expect(results).toHaveLength(2);
            expect(results[0]).toEqual({ effect: { type: 'lose_item', value: 1 }, success: true });
            expect(results[1]).toEqual({ effect: { type: 'loot_chest', value: 1 }, success: true });
        });

        it('loot_chest без lose_item: подчиняется proc_chance (успех)', () => {
            const variant: IEventVariant = {
                id: 'solve', label: 'Разгадать', description: '',
                proc_chance: 0.7,
                effects: [{ type: 'loot_chest', value: 1 }],
            };
            const results = resolveEventOutcome(variant, 0.5); // 0.5 < 0.7 = успех
            expect(results[0].success).toBe(true);
        });

        it('loot_chest без lose_item: proc_chance провал', () => {
            const variant: IEventVariant = {
                id: 'solve', label: 'Разгадать', description: '',
                proc_chance: 0.7,
                effects: [{ type: 'loot_chest', value: 1 }],
            };
            const results = resolveEventOutcome(variant, 0.8); // 0.8 >= 0.7 = провал
            expect(results[0].success).toBe(false);
        });

        it('вариант без proc_chance: fallback 1.0, всегда успех', () => {
            const variant: IEventVariant = {
                id: 'drink', label: 'Выпить', description: '',
                effects: [{ type: 'mass', value: 10 }],
            };
            const results = resolveEventOutcome(variant, 0.99);
            expect(results[0].success).toBe(true);
        });

        it('lose_item гарантирует все эффекты даже при roll=1.0', () => {
            const variant: IEventVariant = {
                id: 'sacrifice', label: 'Пожертвовать', description: '',
                effects: [
                    { type: 'lose_item', value: 1 },
                    { type: 'loot_chest', value: 1 },
                ],
            };
            const results = resolveEventOutcome(variant, 1.0);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);
        });

        it('lose_item всегда success даже при провале roll', () => {
            const variant: IEventVariant = {
                id: 'trade', label: 'Обменять', description: '',
                effects: [
                    { type: 'lose_item', value: 1 },
                    { type: 'mass', value: 30 },
                ],
            };
            const results = resolveEventOutcome(variant, 0.99);
            expect(results[0].success).toBe(true);  // lose_item
            expect(results[1].success).toBe(true);   // mass тоже, т.к. lose_item → guarantee
        });
    });
});
