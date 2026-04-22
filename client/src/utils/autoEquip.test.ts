import { autoPlaceConsumableOnBelt } from './autoEquip';
import type { GameState } from '../core/GameState';
import type { IBeltSlot, IConsumable, IConsumableConfig } from 'shared';

// Минимальный fake GameState: интересующее поведение затрагивает только
// belt и setBelt. Приводим к GameState через unknown — это test-фикстура,
// не production wrapper.
function makeGameState(belt: [IBeltSlot, IBeltSlot] = [null, null]): GameState {
    const state = {
        belt,
        setBelt(idx: number, value: IConsumable): void {
            state.belt[idx as 0 | 1] = value;
        },
    };
    return state as unknown as GameState;
}

const combatCfg: IConsumableConfig = {
    id: 'str_pot_t1',
    name: 'Настойка силы',
    type: 'combat',
    tier: 1,
    effect: 'strength_bonus',
    value: 8,
    basePrice: 30,
};

const scoutCfg: IConsumableConfig = {
    id: 'compass_t2',
    name: 'Компас',
    type: 'scout',
    tier: 2,
    effect: 'safe_path',
    value: 1,
    basePrice: 60,
};

const hikingCfg: IConsumableConfig = {
    id: 'picnic_t1',
    name: 'Провиант',
    type: 'hiking',
    tier: 1,
    effect: 'mass_bonus',
    value: 5,
    basePrice: 35,
};

describe('autoPlaceConsumableOnBelt', () => {
    test('combat consumable: свободный belt-slot → кладём на пояс (placed=true)', () => {
        const gs = makeGameState([null, null]);
        const placed = autoPlaceConsumableOnBelt(gs, 'str_pot_t1', [combatCfg]);
        expect(placed).toBe(true);
        expect(gs.belt[0]).not.toBeNull();
        expect(gs.belt[0]?.id).toBe('str_pot_t1');
    });

    test('combat consumable: полный belt → placed=false, пояс не меняется', () => {
        const existing = { id: 'arm_pot_t1', name: 'x', type: 'combat', tier: 1, effect: 'armor_bonus', value: 1 } as IConsumable;
        const gs = makeGameState([existing, existing]);
        const placed = autoPlaceConsumableOnBelt(gs, 'str_pot_t1', [combatCfg]);
        expect(placed).toBe(false);
        expect(gs.belt[0]).toBe(existing);
        expect(gs.belt[1]).toBe(existing);
    });

    test('dolt-ebh: scout (non-combat) → placed=false, не кладём на пояс', () => {
        const gs = makeGameState([null, null]);
        const placed = autoPlaceConsumableOnBelt(gs, 'compass_t2', [scoutCfg]);
        expect(placed).toBe(false);
        expect(gs.belt[0]).toBeNull();
        expect(gs.belt[1]).toBeNull();
    });

    test('dolt-ebh: hiking (non-combat) → placed=false, не кладём на пояс', () => {
        const gs = makeGameState([null, null]);
        const placed = autoPlaceConsumableOnBelt(gs, 'picnic_t1', [hikingCfg]);
        expect(placed).toBe(false);
        expect(gs.belt[0]).toBeNull();
        expect(gs.belt[1]).toBeNull();
    });

    test('unknown itemId (equipment id) → placed=false без сторонних эффектов', () => {
        const gs = makeGameState([null, null]);
        const placed = autoPlaceConsumableOnBelt(gs, 'sword_t1', [combatCfg, scoutCfg]);
        expect(placed).toBe(false);
        expect(gs.belt[0]).toBeNull();
    });

    test('смешанный catalog: combat и non-combat с одинаковой id-коллизией — используется cfg, найденный по id', () => {
        // Защита от регрессии: если catalog содержит оба типа, find возвращает первый.
        // Проверяем, что fix проверяет type именно у cfg из catalog, а не хардкод.
        const gs = makeGameState([null, null]);
        const placed = autoPlaceConsumableOnBelt(gs, 'compass_t2', [scoutCfg, combatCfg]);
        expect(placed).toBe(false);
        expect(gs.belt[0]).toBeNull();
    });
});
