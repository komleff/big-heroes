// Система PvP: генерация ботов, расчёт потерь и управление сессией арены

import type { IPvpConfig, IPvpSessionConfig, IPvpPointsThresholds } from '../types/BalanceConfig';
import type { IHeroState, IEquipmentSlots, IArenaSession } from '../types/GameState';

/** AI-противник для PvP */
export interface IPvpBot {
    name: string;
    mass: number;
    strength: number;
    armor: number;
    rating: number;
}

/**
 * Генерирует AI-ботов для PvP лобби.
 * Масса масштабируется от героя через множители конфига.
 * Сила = floor(mass/3), броня = индекс бота (упрощение для MVP).
 */
export function generateBots(
    heroMass: number,
    heroRating: number,
    config: IPvpConfig,
): IPvpBot[] {
    const safeMass = Math.max(1, heroMass);
    const safeRating = Math.max(0, heroRating);
    const count = Math.max(1, config.bot_count);
    const bots: IPvpBot[] = [];

    const namesLen = config.bot_names.length || 1;
    for (let i = 0; i < count; i++) {
        const mult = config.bot_mass_multipliers[i] ?? 1.0;
        const botMass = Math.round(safeMass * mult);
        bots.push({
            name: config.bot_names.length > 0 ? config.bot_names[i % namesLen] : `Бот ${i + 1}`,
            mass: Math.max(1, botMass),
            strength: Math.max(1, Math.floor(botMass / 3)),
            armor: i,
            rating: Math.max(0, Math.round(safeRating + (i - Math.floor(count / 2)) * config.bot_rating_spread)),
        });
    }
    return bots;
}

/** Рассчитать потерю массы при поражении в PvP */
export function calcPvpMassLoss(currentMass: number, lossRate: number): number {
    return Math.floor(Math.max(0, currentMass) * Math.max(0, Math.min(1, lossRate)));
}

// ─── Сессия PvP-арены ────────────────────────────────────────────────
//
// Серия боёв до истощения: массы, прочности, лимита боёв или ручного
// завершения. Все функции чистые — state неизменяемый, входные аргументы
// не мутируются.

/** Причина завершения сессии */
export type ArenaSessionEndReason = 'mass' | 'durability' | 'maxBattles' | 'manual' | null;

/** Результат проверки shouldEndSession */
export interface IArenaSessionEndCheck {
    ended: boolean;
    reason: ArenaSessionEndReason;
}

/**
 * Стартует новую PvP-сессию. Делает snapshot массы и рейтинга героя на
 * момент входа в арену, чтобы в конце сессии можно было показать дельту.
 * Не проверяет условия завершения — это задача shouldEndSession.
 */
export function startSession(hero: IHeroState, _config: IPvpSessionConfig): IArenaSession {
    // config принимаем для форвард-совместимости: возможно, позже появятся
    // зависящие от конфига начальные значения (например, бонус стартовых очков)
    void _config;
    return {
        active: true,
        battlesPlayed: 0,
        startMass: hero.mass,
        startRating: hero.rating,
        totalMassLost: 0,
        totalRatingDelta: 0,
    };
}

/**
 * Проверяет, нужно ли завершить сессию. Порядок приоритетов:
 * 1) явный ручной запрос (manualEndRequested=true);
 * 2) неактивная сессия (active=false) — расцениваем как уже завершённую;
 * 3) масса героя ниже min_mass_threshold;
 * 4) суммарная прочность экипировки ниже critical_durability_percent;
 * 5) достигнут лимит max_battles.
 *
 * Порядок важен: массу/прочность считаем жёстче лимита боёв, т.к. они
 * отражают актуальное состояние героя, а лимит — лишь cap серии.
 */
export function shouldEndSession(
    hero: IHeroState,
    equipment: IEquipmentSlots,
    session: IArenaSession,
    config: IPvpSessionConfig,
    manualEndRequested: boolean = false,
): IArenaSessionEndCheck {
    // Приоритет 1: явный ручной запрос
    if (manualEndRequested) {
        return { ended: true, reason: 'manual' };
    }

    // Приоритет 2: сессия уже неактивна — считаем завершённой как manual
    // (alternative: отдельный reason, но 'manual' наиболее нейтральный,
    //  если причина не была зафиксирована ранее)
    if (!session.active) {
        return { ended: true, reason: 'manual' };
    }

    // Приоритет 3: масса ниже порога
    if (hero.mass < config.min_mass_threshold) {
        return { ended: true, reason: 'mass' };
    }

    // Приоритет 4: прочность экипировки ниже критической доли
    // Считаем суммарное отношение current/max по всем экипированным слотам.
    // Если экипировки нет вообще (все null) — проверка пропускается.
    let totalCurrent = 0;
    let totalMax = 0;
    for (const slot of [equipment.weapon, equipment.armor, equipment.accessory]) {
        if (slot !== null) {
            totalCurrent += slot.currentDurability;
            totalMax += slot.maxDurability;
        }
    }
    if (totalMax > 0) {
        const ratio = totalCurrent / totalMax;
        if (ratio < config.critical_durability_percent) {
            return { ended: true, reason: 'durability' };
        }
    }

    // Приоритет 5: лимит боёв
    if (session.battlesPlayed >= config.max_battles) {
        return { ended: true, reason: 'maxBattles' };
    }

    return { ended: false, reason: null };
}

/**
 * Применяет результат одного боя к сессии: инкремент battlesPlayed,
 * накопление потери массы и дельты рейтинга.
 *
 * @param massDelta отрицательное число при потере массы (defeat), 0 при
 *   победе. Масса в PvP сейчас теряется только при defeat (см. GDD).
 *   totalMassLost накапливается как положительное число.
 * @param ratingDelta знаковая дельта рейтинга от calcEloChange (+ при
 *   победе, − при поражении).
 */
export function applyBattleToSession(
    session: IArenaSession,
    massDelta: number,
    ratingDelta: number,
): IArenaSession {
    const massLostIncrement = massDelta < 0 ? -massDelta : 0;
    return {
        ...session,
        battlesPlayed: session.battlesPlayed + 1,
        totalMassLost: session.totalMassLost + massLostIncrement,
        totalRatingDelta: session.totalRatingDelta + ratingDelta,
    };
}

/**
 * Расчёт очков арены за победу по знаковой дельте Elo.
 * - eloDelta ≤ small  → 1 очко (мелкая победа или отрицательная дельта)
 * - small < delta ≤ medium → 2 очка
 * - delta > medium → 3 очка
 *
 * Нестрогое сравнение на границах сохраняет стабильное поведение при
 * целых значениях порогов. Функция вызывается только на victory, но
 * отрицательная дельта защищается через ветку ≤ small (1 очко), чтобы
 * случайный вызов на defeat не дал исключение/NaN.
 */
export function calcArenaPoints(eloDelta: number, thresholds: IPvpPointsThresholds): 1 | 2 | 3 {
    if (eloDelta <= thresholds.small) return 1;
    if (eloDelta <= thresholds.medium) return 2;
    return 3;
}
