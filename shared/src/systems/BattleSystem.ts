import type { IBattleContext, IBattleResult, BattleOutcome, IHitAnimation } from '../types/Battle';
import type { IFormulaConfig } from '../types/BalanceConfig';
import type { EquipmentSlotId } from '../types/Equipment';
import {
    calcDamage, calcTTK, calcBaseWinChance,
    calcAttackWinChance, calcBlockWinChance, calcFortuneChance,
    calcRetreatChance, calcBypassChance, calcPolymorphChance,
    generateHitAnimation,
    applyConsumableEffect,
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

    // 1. Применить расходник (через общую функцию FormulaEngine)
    const { modifiedStats, modifiedEnemyStrength: modifiedEnemyStr } =
        applyConsumableEffect(heroStats, consumable, enemy.strength);

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
            // Используем чистый бонус щита (без реликвий) для расчёта block_power
            const shieldArmor = context.shieldArmorBonus;
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
            if (rng() < winChance) {
                outcome = 'retreat';
            } else {
                // Провал отступления → обычный бой с инициативой врага
                const retreatFallback = calcAttackWinChance(baseChance, modifiedStats.luck, min, max, luckAttackCoeff);
                outcome = rng() < retreatFallback ? 'victory' : 'defeat';
            }
            break;
        case 'cmd_bypass':
            winChance = calcBypassChance(modifiedStats.luck, bypassBase, luckAbilityCoeff, min, max);
            if (rng() < winChance) {
                outcome = 'bypass';
            } else {
                // Провал обхода → обычный бой с инициативой врага
                const bypassFallback = calcAttackWinChance(baseChance, modifiedStats.luck, min, max, luckAttackCoeff);
                outcome = rng() < bypassFallback ? 'victory' : 'defeat';
            }
            break;
        case 'cmd_polymorph':
            winChance = calcPolymorphChance(baseChance, modifiedStats.luck, luckAbilityCoeff, min, max);
            if (rng() < winChance) {
                outcome = 'polymorph';
            } else {
                // Провал полиморфа → обычный бой с инициативой врага
                const polymorphFallback = calcAttackWinChance(baseChance, modifiedStats.luck, min, max, luckAttackCoeff);
                outcome = rng() < polymorphFallback ? 'victory' : 'defeat';
            }
            break;
        default:
            winChance = baseChance;
            outcome = 'defeat';
    }

    // 5. Анимация — для специальных исходов не генерируем удары
    let hits: IHitAnimation[];
    if (outcome === 'victory') {
        hits = generateHitAnimation('hero', heroDamage, enemyDamage, rng);
    } else if (outcome === 'defeat') {
        hits = generateHitAnimation('enemy', heroDamage, enemyDamage, rng);
    } else {
        // retreat, bypass, polymorph — без ударов
        hits = [];
    }

    // 6. Предмет для износа (привязан к команде)
    // cmd_attack → weapon, cmd_block → armor, остальные → accessory
    let durabilityTarget: EquipmentSlotId | null = null;
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
