import type { IBattleContext, IBattleResult, BattleOutcome } from '../types/Battle';
import type { IFormulaConfig } from '../types/BalanceConfig';
import {
    calcDamage, calcTTK, calcBaseWinChance,
    calcAttackWinChance, calcBlockWinChance, calcFortuneChance,
    calcRetreatChance, calcBypassChance, calcPolymorphChance,
    generateHitAnimation,
} from '../formulas/FormulaEngine';

/**
 * Разрешение боя. Чистая функция — без side-effects.
 *
 * Логика:
 * 1. Применить эффект расходника к героStats (если есть)
 * 2. Рассчитать урон и TTK для обеих сторон
 * 3. Рассчитать шанс победы для выбранной команды
 * 4. rng() < winChance → победа, иначе поражение
 * 5. Особые исходы: retreat → BattleOutcome 'retreat', bypass → 'bypass', polymorph → 'polymorph'
 * 6. Сгенерировать анимацию ударов
 * 7. Определить предмет для износа (durabilityTarget)
 *
 * @returns IBattleResult
 */
export function resolveBattle(
    context: IBattleContext,
    formulaConfig: IFormulaConfig,
): IBattleResult {
    const { heroStats, enemy, command, consumable, rng } = context;

    // 1. Применить расходник (модифицируем копию stats)
    let modifiedStats = { ...heroStats };
    let modifiedEnemyStr = enemy.strength;
    if (consumable) {
        // Расходники по эффекту
        if (consumable.effect === 'strength_bonus') modifiedStats.strength += consumable.value;
        else if (consumable.effect === 'armor_bonus') modifiedStats.armor += consumable.value;
        else if (consumable.effect === 'luck_bonus') modifiedStats.luck += consumable.value;
        else if (consumable.effect === 'enemy_strength_reduction') modifiedEnemyStr = Math.max(0, modifiedEnemyStr - consumable.value);
    }

    // 2. Урон и TTK
    const heroDamage = calcDamage(modifiedStats.strength, enemy.armor);
    const enemyDamage = calcDamage(modifiedEnemyStr, modifiedStats.armor);
    const heroTTK = calcTTK(modifiedStats.hp, enemyDamage);
    const enemyTTK = calcTTK(enemy.mass, heroDamage);  // HP врага = масса

    // 3. Базовый шанс
    const baseChance = calcBaseWinChance(heroTTK, enemyTTK);
    const { winChanceMin: min, winChanceMax: max, luckAttackCoeff,
            luckAbilityCoeff, baseBlockPower, shieldArmorBlockCoeff,
            retreatBase, bypassBase } = formulaConfig;

    // 4. Шанс по команде
    let winChance: number;
    let outcome: BattleOutcome;

    switch (command) {
        case 'cmd_attack':
            winChance = calcAttackWinChance(baseChance, modifiedStats.luck, min, max, luckAttackCoeff);
            outcome = rng() < winChance ? 'victory' : 'defeat';
            break;
        case 'cmd_block': {
            const attackChance = calcAttackWinChance(baseChance, modifiedStats.luck, min, max, luckAttackCoeff);
            const shieldArmor = modifiedStats.armor;
            winChance = calcBlockWinChance(attackChance, shieldArmor, modifiedStats.luck, baseBlockPower, shieldArmorBlockCoeff, luckAttackCoeff, min, max);
            outcome = rng() < winChance ? 'victory' : 'defeat';
            break;
        }
        case 'cmd_fortune':
            winChance = calcFortuneChance(baseChance, modifiedStats.luck, luckAbilityCoeff, min, max);
            outcome = rng() < winChance ? 'victory' : 'defeat';
            break;
        case 'cmd_retreat':
            winChance = calcRetreatChance(modifiedStats.luck, retreatBase, luckAbilityCoeff, min, max);
            outcome = rng() < winChance ? 'retreat' : 'defeat';
            break;
        case 'cmd_bypass':
            winChance = calcBypassChance(modifiedStats.luck, bypassBase, luckAbilityCoeff, min, max);
            outcome = rng() < winChance ? 'bypass' : 'defeat';
            break;
        case 'cmd_polymorph':
            winChance = calcPolymorphChance(baseChance, modifiedStats.luck, luckAbilityCoeff, min, max);
            outcome = rng() < winChance ? 'polymorph' : 'defeat';
            break;
        default:
            winChance = baseChance;
            outcome = 'defeat';
    }

    // 5. Анимация
    const winner = (outcome === 'defeat') ? 'enemy' : 'hero';
    const hits = generateHitAnimation(winner, heroDamage, enemyDamage, rng);

    // 6. Предмет для износа (привязан к команде)
    // cmd_attack → weapon, cmd_block → armor, остальные → accessory
    let durabilityTarget: string | null = null;
    if (command === 'cmd_attack') durabilityTarget = 'weapon';
    else if (command === 'cmd_block') durabilityTarget = 'armor';
    else durabilityTarget = 'accessory';

    // 7. Награды
    let massReward = 0;
    let goldReward = 0;
    if (outcome === 'victory') {
        massReward = enemy.massReward;
        goldReward = enemy.goldReward;
    }
    // retreat/bypass/polymorph: нет награды, но и нет потери

    return {
        outcome,
        winChance,
        hits,
        durabilityTarget,
        massReward,
        goldReward,
    };
}
