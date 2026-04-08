import type { IEquipmentSlots, IHeroStats } from '../types/GameState';
import type { IRelic } from '../types/Relic';
import type { IHitAnimation } from '../types/Battle';
import type { IConsumable } from '../types/Consumable';
import type { IHeroLeagueConfig } from '../types/BalanceConfig';

/**
 * Вычисление боевых характеристик героя.
 * HP = масса. Сила = масса/3 + бонус оружия + бонус реликвий.
 * Броня = бонус щита + бонус реликвий. Удача = бонус аксессуара + бонус реликвий.
 */
export function calcHeroStats(
    mass: number,
    equipment: IEquipmentSlots,
    relics: IRelic[],
): IHeroStats {
    // Бонусы экипировки (сломанные предметы с durability=0 не дают бонусов)
    const weaponStr = (equipment.weapon?.currentDurability ?? 0) > 0 ? (equipment.weapon?.strengthBonus ?? 0) : 0;
    const shieldArmor = (equipment.armor?.currentDurability ?? 0) > 0 ? (equipment.armor?.armorBonus ?? 0) : 0;
    const accLuck = (equipment.accessory?.currentDurability ?? 0) > 0 ? (equipment.accessory?.luckBonus ?? 0) : 0;

    // Бонусы реликвий
    let relicStr = 0, relicArmor = 0, relicLuck = 0;
    for (const relic of relics) {
        if (relic.effect === 'strength_bonus') relicStr += relic.value;
        else if (relic.effect === 'armor_bonus') relicArmor += relic.value;
        else if (relic.effect === 'luck_bonus') relicLuck += relic.value;
    }

    return {
        hp: mass,
        strength: Math.floor(mass / 3) + weaponStr + relicStr,
        armor: shieldArmor + relicArmor,
        luck: accLuck + relicLuck,
    };
}

/** Урон = max(1, сила − броня) */
export function calcDamage(strength: number, armor: number): number {
    return Math.max(1, strength - armor);
}

/** TTK (Time-To-Kill) = HP / урон за удар */
export function calcTTK(hp: number, damagePerHit: number): number {
    return hp / Math.max(1, damagePerHit);
}

/** Базовый шанс победы (TTK-метод) */
export function calcBaseWinChance(ttkHero: number, ttkEnemy: number): number {
    return ttkEnemy / (ttkHero + ttkEnemy);
}

/** Ограничение значения в диапазоне [min, max] */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/** Шанс команды «Атака» */
export function calcAttackWinChance(
    baseChance: number, luck: number,
    minChance: number, maxChance: number, luckCoeff: number,
): number {
    return clamp(baseChance + luck * luckCoeff, minChance, maxChance);
}

/**
 * Шанс команды «Блок» (выравниватель для слабых).
 * block_power = baseBlockPower + shieldArmor × shieldArmorBlockCoeff
 * block_modifier = (0.5 − attackWinChance) × block_power
 * Итого: clamp(attackWinChance + block_modifier + luck × luckCoeff, min, max)
 */
export function calcBlockWinChance(
    attackWinChance: number,
    shieldArmor: number,
    luck: number,
    baseBlockPower: number,
    shieldArmorBlockCoeff: number,
    luckCoeff: number,
    minChance: number,
    maxChance: number,
): number {
    const blockPower = baseBlockPower + shieldArmor * shieldArmorBlockCoeff;
    const blockModifier = (0.5 - attackWinChance) * blockPower;
    return clamp(attackWinChance + blockModifier + luck * luckCoeff, minChance, maxChance);
}

/** Шанс команды «Фортуна» */
export function calcFortuneChance(
    baseChance: number, luck: number,
    luckCoeff: number, minChance: number, maxChance: number,
): number {
    return clamp(baseChance + luck * luckCoeff, minChance, maxChance);
}

/** Шанс команды «Отступление» */
export function calcRetreatChance(
    luck: number, retreatBase: number,
    luckCoeff: number, minChance: number, maxChance: number,
): number {
    return clamp(retreatBase + luck * luckCoeff, minChance, maxChance);
}

/** Шанс команды «Обход» */
export function calcBypassChance(
    luck: number, bypassBase: number,
    luckCoeff: number, minChance: number, maxChance: number,
): number {
    return clamp(bypassBase + luck * luckCoeff, minChance, maxChance);
}

/** Шанс команды «Полиморф» */
export function calcPolymorphChance(
    baseChance: number, luck: number,
    luckCoeff: number, minChance: number, maxChance: number,
): number {
    return clamp(baseChance + luck * luckCoeff, minChance, maxChance);
}

/**
 * Расчёт изменения рейтинга (Elo).
 * expected = 1 / (1 + 10^((enemyRating − playerRating) / 400))
 * change = round(K × (result − expected))
 * result: 1 = победа, 0 = поражение
 */
export function calcEloChange(
    playerRating: number,
    enemyRating: number,
    result: 0 | 1,
    K: number,
): number {
    const expected = 1 / (1 + Math.pow(10, (enemyRating - playerRating) / 400));
    return Math.round(K * (result - expected));
}

/** Применение эффекта расходника к характеристикам героя */
export function applyConsumableEffect(
    stats: IHeroStats,
    consumable: IConsumable | null,
    enemyStrength?: number,
): { modifiedStats: IHeroStats; modifiedEnemyStrength: number } {
    const modifiedStats = { ...stats };
    let modifiedEnemyStr = enemyStrength ?? 0;
    if (consumable) {
        if (consumable.effect === 'strength_bonus') modifiedStats.strength += consumable.value;
        else if (consumable.effect === 'armor_bonus') modifiedStats.armor += consumable.value;
        else if (consumable.effect === 'luck_bonus') modifiedStats.luck += consumable.value;
        else if (consumable.effect === 'enemy_strength_reduction') modifiedEnemyStr = Math.max(0, modifiedEnemyStr - consumable.value);
    }
    return { modifiedStats, modifiedEnemyStrength: modifiedEnemyStr };
}

/**
 * Генерация анимации ударов (2–3 удара победителя + 1–2 ответных).
 * Каждый удар = baseDamage × rand(0.7–1.3).
 * Удар с множителем ≥1.15 — «сильный», ≥1.25 — «критический».
 *
 * @param enemyFirst — если true, сначала генерируются удары проигравшего
 *   (инициатива врага при fallback после провала retreat/bypass/polymorph)
 */
export function generateHitAnimation(
    winner: 'hero' | 'enemy',
    heroDamage: number,
    enemyDamage: number,
    rng: () => number,
    enemyFirst: boolean = false,
): IHitAnimation[] {
    const hitCount = rng() < 0.5 ? 2 : 3;

    // Удары победителя по проигравшему
    const winnerHits: IHitAnimation[] = [];
    for (let i = 0; i < hitCount; i++) {
        const multiplier = 0.7 + rng() * 0.6; // 0.7–1.3
        const dmg = winner === 'hero' ? heroDamage : enemyDamage;
        const displayDmg = Math.max(1, Math.round(dmg * multiplier));
        winnerHits.push({
            attacker: winner,
            damage: displayDmg,
            isStrong: multiplier >= 1.15,
            isCritical: multiplier >= 1.25,
        });
    }

    // Ответные удары проигравшего (1–2)
    const responseCount = Math.max(1, hitCount - 1);
    const loserHits: IHitAnimation[] = [];
    for (let i = 0; i < responseCount; i++) {
        const multiplier = 0.7 + rng() * 0.6;
        const dmg = winner === 'hero' ? enemyDamage : heroDamage;
        const displayDmg = Math.max(1, Math.round(dmg * multiplier));
        loserHits.push({
            attacker: winner === 'hero' ? 'enemy' : 'hero',
            damage: displayDmg,
            isStrong: multiplier >= 1.15,
            isCritical: multiplier >= 1.25,
        });
    }

    // При enemyFirst — проигравший бьёт первым (инициатива врага при fallback)
    if (enemyFirst) {
        return [...loserHits, ...winnerHits];
    }
    return [...winnerHits, ...loserHits];
}

/**
 * Определяет текущую лигу героя по рейтингу из балансовой таблицы.
 * Возвращает конфиг лиги, в диапазон которой попадает рейтинг,
 * или последнюю лигу как fallback.
 */
export function getLeagueConfig(rating: number, leagues: IHeroLeagueConfig[]): IHeroLeagueConfig {
    if (leagues.length === 0) {
        return { name: 'Лига', minRating: 0, maxRating: 0 };
    }
    const matched = leagues.find(l => rating >= l.minRating && rating <= l.maxRating);
    return matched ?? leagues[leagues.length - 1];
}
