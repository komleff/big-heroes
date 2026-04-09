// Система PvP: генерация ботов и расчёт потерь

import type { IPvpConfig } from '../types/BalanceConfig';

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
