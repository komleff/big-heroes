import { generateBots, calcPvpMassLoss } from './PvpSystem';
import type { IPvpConfig } from '../types/BalanceConfig';

const defaultConfig: IPvpConfig = {
    mass_loss_on_defeat: 0.1,
    bot_count: 3,
    bot_mass_multipliers: [0.8, 1.0, 1.2],
    bot_rating_spread: 50,
    bot_names: ['Теневой рыцарь', 'Буря клинков', 'Каменный страж'],
};

describe('PvpSystem', () => {
    describe('generateBots', () => {
        it('генерирует корректное количество ботов', () => {
            const bots = generateBots(50, 1000, defaultConfig);
            expect(bots).toHaveLength(3);
        });

        it('масса ботов масштабируется от героя', () => {
            const bots = generateBots(100, 1000, defaultConfig);
            expect(bots[0].mass).toBe(80);   // 100 * 0.8
            expect(bots[1].mass).toBe(100);  // 100 * 1.0
            expect(bots[2].mass).toBe(120);  // 100 * 1.2
        });

        it('рейтинг ботов распределён вокруг героя', () => {
            const bots = generateBots(50, 1000, defaultConfig);
            expect(bots[0].rating).toBe(950);  // 1000 + (0-1)*50
            expect(bots[1].rating).toBe(1000); // 1000 + (1-1)*50
            expect(bots[2].rating).toBe(1050); // 1000 + (2-1)*50
        });

        it('имена берутся из конфига', () => {
            const bots = generateBots(50, 1000, defaultConfig);
            expect(bots[0].name).toBe('Теневой рыцарь');
            expect(bots[1].name).toBe('Буря клинков');
            expect(bots[2].name).toBe('Каменный страж');
        });

        it('edge-case: heroMass=0 → минимум 1', () => {
            const bots = generateBots(0, 1000, defaultConfig);
            for (const bot of bots) {
                expect(bot.mass).toBeGreaterThanOrEqual(1);
                expect(bot.strength).toBeGreaterThanOrEqual(1);
            }
        });

        it('edge-case: heroRating < 0 → не уходит ниже 0', () => {
            const bots = generateBots(50, 0, defaultConfig);
            for (const bot of bots) {
                expect(bot.rating).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('calcPvpMassLoss', () => {
        it('10% от 100 = 10', () => {
            expect(calcPvpMassLoss(100, 0.1)).toBe(10);
        });

        it('10% от 55 = 5 (floor)', () => {
            expect(calcPvpMassLoss(55, 0.1)).toBe(5);
        });

        it('edge-case: mass=0', () => {
            expect(calcPvpMassLoss(0, 0.1)).toBe(0);
        });

        it('edge-case: lossRate=0', () => {
            expect(calcPvpMassLoss(100, 0)).toBe(0);
        });

        it('edge-case: lossRate > 1 → clamped', () => {
            expect(calcPvpMassLoss(100, 1.5)).toBe(100);
        });
    });
});
