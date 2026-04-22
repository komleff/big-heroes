import { GameState } from './GameState';
import { EventBus } from './EventBus';
import balanceConfig from '../../../config/balance.json';
import type { IBalanceConfig, IPveRoute, IConsumable } from 'shared';

function makeGameState(): GameState {
    const bus = new EventBus();
    return new GameState(balanceConfig as unknown as IBalanceConfig, bus);
}

function makeRoute(): IPveRoute {
    return {
        seed: 42,
        chapter: 1,
        nodes: [
            { id: 'n0', type: 'combat', position: 0, connections: [1] },
            { id: 'n1', type: 'exit', position: 1, connections: [] },
        ],
    } as unknown as IPveRoute;
}

function mkConsumable(id: string): IConsumable {
    return { id, name: id, type: 'combat', tier: 1, effect: 'strength_bonus', value: 8 } as IConsumable;
}

describe('GameState.endExpedition — loot-loss rollback для beltAdditions', () => {
    test('defeat + beltAdditions [0] — slot 0 очищается', () => {
        const gs = makeGameState();
        gs.startExpedition(makeRoute());
        gs.setBelt(0, mkConsumable('str_pot_t1'));
        gs.appendBeltAddition(0);
        const expDefeat = { ...(gs.expeditionState as IPveExpeditionState), status: 'defeat' as const };
        gs.updateExpeditionState(expDefeat);

        gs.endExpedition();
        expect(gs.belt[0]).toBeNull();
    });

    test('defeat + beltAdditions [0,1] — оба slot очищаются', () => {
        const gs = makeGameState();
        gs.startExpedition(makeRoute());
        gs.setBelt(0, mkConsumable('str_pot_t1'));
        gs.setBelt(1, mkConsumable('arm_pot_t1'));
        gs.appendBeltAddition(0);
        gs.appendBeltAddition(1);
        gs.updateExpeditionState({ ...(gs.expeditionState as IPveExpeditionState), status: 'defeat' as const });

        gs.endExpedition();
        expect(gs.belt[0]).toBeNull();
        expect(gs.belt[1]).toBeNull();
    });

    test('adversarial F-2: старый расходник БЕЗ beltAdditions сохраняется при defeat', () => {
        const gs = makeGameState();
        gs.setBelt(0, mkConsumable('str_pot_t1')); // pre-expedition предмет
        gs.startExpedition(makeRoute());
        gs.setBelt(1, mkConsumable('str_pot_t1')); // новый auto-placed (тот же id)
        gs.appendBeltAddition(1); // трекаем только slot 1
        gs.updateExpeditionState({ ...(gs.expeditionState as IPveExpeditionState), status: 'defeat' as const });

        gs.endExpedition();
        // Старый расходник в slot 0 сохранился, новый в slot 1 удалён
        expect(gs.belt[0]).not.toBeNull();
        expect(gs.belt[0]?.id).toBe('str_pot_t1');
        expect(gs.belt[1]).toBeNull();
    });

    test('consume до defeat — beltAdditions очищается, старый сохраняется', () => {
        const gs = makeGameState();
        gs.setBelt(0, mkConsumable('str_pot_t1')); // pre-expedition
        gs.startExpedition(makeRoute());
        gs.setBelt(1, mkConsumable('str_pot_t1')); // auto-placed
        gs.appendBeltAddition(1);
        gs.useConsumable(1); // игрок использовал новый в бою
        expect((gs.expeditionState as IPveExpeditionState).beltAdditions).toEqual([]);

        gs.updateExpeditionState({ ...(gs.expeditionState as IPveExpeditionState), status: 'defeat' as const });
        gs.endExpedition();
        // Старый slot 0 сохранён, slot 1 пуст (уже был после consume)
        expect(gs.belt[0]?.id).toBe('str_pot_t1');
        expect(gs.belt[1]).toBeNull();
    });

    test('victory — beltAdditions не откатываются, расходники сохраняются', () => {
        const gs = makeGameState();
        gs.startExpedition(makeRoute());
        gs.setBelt(0, mkConsumable('str_pot_t1'));
        gs.appendBeltAddition(0);
        gs.updateExpeditionState({ ...(gs.expeditionState as IPveExpeditionState), status: 'victory' as const });

        gs.endExpedition();
        expect(gs.belt[0]?.id).toBe('str_pot_t1');
    });

    test('appendBeltAddition без активной экспедиции — no-op (safe)', () => {
        const gs = makeGameState();
        expect(() => gs.appendBeltAddition(0)).not.toThrow();
        expect(gs.expeditionState).toBeNull();
    });

    test('appendBeltAddition дубликат slot — игнорируется', () => {
        const gs = makeGameState();
        gs.startExpedition(makeRoute());
        gs.appendBeltAddition(0);
        gs.appendBeltAddition(0);
        expect((gs.expeditionState as IPveExpeditionState).beltAdditions).toEqual([0]);
    });
});

type IPveExpeditionState = import('shared').IPveExpeditionState;
