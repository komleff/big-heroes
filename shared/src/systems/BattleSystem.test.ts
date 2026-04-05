import { resolveBattle } from './BattleSystem';
import type { IBattleContext } from '../types/Battle';
import type { IFormulaConfig, IMobConfig } from '../types/BalanceConfig';
import type { IHeroStats } from '../types/GameState';
import type { IConsumable } from '../types/Consumable';

// ─── Хелперы ──────────────────────────────────────────────────────────

/** Конфигурация формул из balance.json */
const formulaConfig: IFormulaConfig = {
    baseBlockPower: 0.3,
    shieldArmorBlockCoeff: 0.05,
    luckAttackCoeff: 0.01,
    luckAbilityCoeff: 0.02,
    retreatBase: 0.70,
    bypassBase: 0.60,
    eloK: 32,
    winChanceMin: 0.05,
    winChanceMax: 0.95,
};

/** Фиксированный RNG: возвращает значения из массива по порядку */
function fixedRng(values: number[]): () => number {
    let i = 0;
    return () => values[i++] ?? 0;
}

/** Базовые статы героя для тестов */
const heroStats: IHeroStats = { hp: 50, strength: 20, armor: 3, luck: 1 };

/** Враг для тестов (Слизень) */
const enemy: IMobConfig = {
    id: 'slime', name: 'Слизень', type: 'combat',
    mass: 35, strength: 12, armor: 0,
    massReward: 6, goldReward: 20,
};

/** Создать контекст боя с минимальными значениями по умолчанию */
function makeContext(overrides: Partial<IBattleContext>): IBattleContext {
    return {
        mode: 'pve',
        heroStats: { ...heroStats },
        enemy: { ...enemy },
        command: 'cmd_attack',
        consumable: null,
        rng: fixedRng([0]),
        shieldArmorBonus: 3,  // чистый бонус щита (без реликвий)
        ...overrides,
    };
}

// ─── cmd_attack ───────────────────────────────────────────────────────

describe('resolveBattle — cmd_attack', () => {
    test('победа: rng=0 (всегда < winChance) → outcome=victory, massReward > 0', () => {
        // Arrange — rng=0 всегда меньше любого шанса > 0
        const ctx = makeContext({
            command: 'cmd_attack',
            rng: fixedRng([0, 0.3, 0.5, 0.5, 0.5, 0.5, 0.5]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.outcome).toBe('victory');
        expect(result.massReward).toBeGreaterThan(0);
        expect(result.massReward).toBe(enemy.massReward);
    });

    test('поражение: rng=1 (всегда > winChance) → outcome=defeat, massReward=0', () => {
        // Arrange — rng=1 всегда больше максимального шанса 0.95
        const ctx = makeContext({
            command: 'cmd_attack',
            rng: fixedRng([1, 0.3, 0.5, 0.5, 0.5, 0.5, 0.5]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.outcome).toBe('defeat');
        expect(result.massReward).toBe(0);
    });
});

// ─── cmd_block ────────────────────────────────────────────────────────

describe('resolveBattle — cmd_block', () => {
    test('победа: rng=0 → outcome=victory', () => {
        // Arrange
        const ctx = makeContext({
            command: 'cmd_block',
            rng: fixedRng([0, 0.3, 0.5, 0.5, 0.5, 0.5, 0.5]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.outcome).toBe('victory');
    });
});

// ─── cmd_retreat ──────────────────────────────────────────────────────

describe('resolveBattle — cmd_retreat', () => {
    test('успех: rng=0 → outcome=retreat, hits=[], massReward=0', () => {
        // Arrange — rng=0 < retreatChance (≈0.72)
        const ctx = makeContext({
            command: 'cmd_retreat',
            rng: fixedRng([0]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.outcome).toBe('retreat');
        expect(result.hits).toEqual([]);
        expect(result.massReward).toBe(0);
    });

    test('провал retreat → fallback-бой: rng для fallback тоже провален → defeat', () => {
        // Arrange
        // rng[0]=1 > retreatChance (≈0.72) → провал retreat
        // rng[1]=1 > attackChance → провал fallback → defeat
        // Остальные rng для generateHitAnimation
        const ctx = makeContext({
            command: 'cmd_retreat',
            rng: fixedRng([1, 1, 0.3, 0.5, 0.5, 0.5, 0.5, 0.5]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert — провал retreat + провал fallback → defeat с ударами
        expect(result.outcome).toBe('defeat');
        expect(result.hits.length).toBeGreaterThanOrEqual(2);
    });

    test('провал retreat → fallback-бой: rng для fallback успешен → victory', () => {
        // Arrange
        // rng[0]=1 > retreatChance → провал retreat
        // rng[1]=0 < attackChance → fallback победа
        // Остальные rng для generateHitAnimation
        const ctx = makeContext({
            command: 'cmd_retreat',
            rng: fixedRng([1, 0, 0.3, 0.5, 0.5, 0.5, 0.5, 0.5]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert — провал retreat, но победа в fallback-бою
        expect(result.outcome).toBe('victory');
        expect(result.hits.length).toBeGreaterThanOrEqual(2);
        expect(result.massReward).toBe(enemy.massReward);
    });
});

// ─── cmd_bypass ───────────────────────────────────────────────────────

describe('resolveBattle — cmd_bypass', () => {
    test('успех: rng=0 → outcome=bypass, hits=[]', () => {
        // Arrange
        const ctx = makeContext({
            command: 'cmd_bypass',
            rng: fixedRng([0]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.outcome).toBe('bypass');
        expect(result.hits).toEqual([]);
    });

    test('провал bypass → fallback-бой: rng для fallback успешен → victory', () => {
        // Arrange
        // rng[0]=1 > bypassChance (≈0.62) → провал bypass
        // rng[1]=0 < attackChance → fallback победа
        const ctx = makeContext({
            command: 'cmd_bypass',
            rng: fixedRng([1, 0, 0.3, 0.5, 0.5, 0.5, 0.5, 0.5]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.outcome).toBe('victory');
        expect(result.hits.length).toBeGreaterThanOrEqual(2);
    });
});

// ─── cmd_polymorph ────────────────────────────────────────────────────

describe('resolveBattle — cmd_polymorph', () => {
    test('успех: rng=0 → outcome=polymorph, hits=[]', () => {
        // Arrange
        const ctx = makeContext({
            command: 'cmd_polymorph',
            rng: fixedRng([0]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.outcome).toBe('polymorph');
        expect(result.hits).toEqual([]);
    });

    test('провал polymorph → fallback-бой: rng для fallback успешен → victory', () => {
        // Arrange
        // rng[0]=1 > polymorphChance → провал polymorph
        // rng[1]=0 < attackChance → fallback победа
        const ctx = makeContext({
            command: 'cmd_polymorph',
            rng: fixedRng([1, 0, 0.3, 0.5, 0.5, 0.5, 0.5, 0.5]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.outcome).toBe('victory');
        expect(result.hits.length).toBeGreaterThanOrEqual(2);
    });
});

// ─── durabilityTarget ─────────────────────────────────────────────────

describe('resolveBattle — durabilityTarget', () => {
    test('cmd_attack → durabilityTarget = weapon', () => {
        // Arrange
        const ctx = makeContext({ command: 'cmd_attack', rng: fixedRng([0, 0.3, 0.5, 0.5, 0.5, 0.5]) });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.durabilityTarget).toBe('weapon');
    });

    test('cmd_block → durabilityTarget = armor', () => {
        // Arrange
        const ctx = makeContext({ command: 'cmd_block', rng: fixedRng([0, 0.3, 0.5, 0.5, 0.5, 0.5]) });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.durabilityTarget).toBe('armor');
    });

    test('cmd_fortune → durabilityTarget = accessory', () => {
        // Arrange
        const ctx = makeContext({ command: 'cmd_fortune', rng: fixedRng([0, 0.3, 0.5, 0.5, 0.5, 0.5]) });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.durabilityTarget).toBe('accessory');
    });
});

// ─── consumable ───────────────────────────────────────────────────────

describe('resolveBattle — consumable', () => {
    test('strength_bonus consumable изменяет winChance (расходник применяется)', () => {
        // Arrange — бой без расходника
        const ctxBase = makeContext({
            command: 'cmd_attack',
            consumable: null,
            rng: fixedRng([0, 0.3, 0.5, 0.5, 0.5, 0.5]),
        });
        const resultBase = resolveBattle(ctxBase, formulaConfig);

        // Arrange — бой с расходником strength_bonus +10
        const consumable: IConsumable = {
            id: 'potion_str', name: 'Зелье силы', type: 'combat',
            tier: 1, effect: 'strength_bonus', value: 10,
        };
        const ctxBoosted = makeContext({
            command: 'cmd_attack',
            consumable,
            rng: fixedRng([0, 0.3, 0.5, 0.5, 0.5, 0.5]),
        });
        const resultBoosted = resolveBattle(ctxBoosted, formulaConfig);

        // Assert — winChance меняется при применении расходника
        expect(resultBoosted.winChance).not.toBe(resultBase.winChance);
    });

    test('consumable null → базовые статы, результат корректен', () => {
        // Arrange
        const ctx = makeContext({
            command: 'cmd_attack',
            consumable: null,
            rng: fixedRng([0, 0.3, 0.5, 0.5, 0.5, 0.5]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert — бой завершается без ошибок
        expect(result.outcome).toBe('victory');
        expect(result.winChance).toBeGreaterThan(0);
    });
});

// ─── rewards ──────────────────────────────────────────────────────────

describe('resolveBattle — rewards', () => {
    test('victory → massReward = enemy.massReward, goldReward = enemy.goldReward', () => {
        // Arrange
        const ctx = makeContext({
            command: 'cmd_attack',
            rng: fixedRng([0, 0.3, 0.5, 0.5, 0.5, 0.5]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.outcome).toBe('victory');
        expect(result.massReward).toBe(enemy.massReward);
        expect(result.goldReward).toBe(enemy.goldReward);
    });

    test('defeat → massReward = 0, goldReward = 0', () => {
        // Arrange
        const ctx = makeContext({
            command: 'cmd_attack',
            rng: fixedRng([1, 0.3, 0.5, 0.5, 0.5, 0.5]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.outcome).toBe('defeat');
        expect(result.massReward).toBe(0);
        expect(result.goldReward).toBe(0);
    });
});

// ─── hits count ───────────────────────────────────────────────────────

describe('resolveBattle — hits count', () => {
    test('victory/defeat → hits.length >= 2', () => {
        // Arrange — победа
        const ctxVictory = makeContext({
            command: 'cmd_attack',
            rng: fixedRng([0, 0.3, 0.5, 0.5, 0.5, 0.5]),
        });
        const resultVictory = resolveBattle(ctxVictory, formulaConfig);

        // Assert
        expect(resultVictory.outcome).toBe('victory');
        expect(resultVictory.hits.length).toBeGreaterThanOrEqual(2);

        // Arrange — поражение
        const ctxDefeat = makeContext({
            command: 'cmd_attack',
            rng: fixedRng([1, 0.3, 0.5, 0.5, 0.5, 0.5]),
        });
        const resultDefeat = resolveBattle(ctxDefeat, formulaConfig);

        // Assert
        expect(resultDefeat.outcome).toBe('defeat');
        expect(resultDefeat.hits.length).toBeGreaterThanOrEqual(2);
    });

    test('retreat → hits.length = 0', () => {
        // Arrange
        const ctx = makeContext({
            command: 'cmd_retreat',
            rng: fixedRng([0]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.outcome).toBe('retreat');
        expect(result.hits).toHaveLength(0);
    });

    test('bypass → hits.length = 0', () => {
        // Arrange
        const ctx = makeContext({
            command: 'cmd_bypass',
            rng: fixedRng([0]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.outcome).toBe('bypass');
        expect(result.hits).toHaveLength(0);
    });

    test('polymorph → hits.length = 0', () => {
        // Arrange
        const ctx = makeContext({
            command: 'cmd_polymorph',
            rng: fixedRng([0]),
        });

        // Act
        const result = resolveBattle(ctx, formulaConfig);

        // Assert
        expect(result.outcome).toBe('polymorph');
        expect(result.hits).toHaveLength(0);
    });
});
