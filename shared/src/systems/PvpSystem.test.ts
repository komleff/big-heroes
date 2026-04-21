import { generateBots, calcPvpMassLoss, startSession, shouldEndSession, applyBattleToSession, calcArenaPoints } from './PvpSystem';
import type { IPvpConfig, IPvpSessionConfig } from '../types/BalanceConfig';
import type { IHeroState, IEquipmentSlots, IArenaSession } from '../types/GameState';
import type { IEquipmentItem } from '../types/Equipment';

const defaultConfig: IPvpConfig = {
    mass_loss_on_defeat: 0.1,
    bot_count: 3,
    bot_mass_multipliers: [0.8, 1.0, 1.2],
    bot_rating_spread: 50,
    bot_names: ['Теневой рыцарь', 'Буря клинков', 'Каменный страж'],
    session: {
        min_mass_threshold: 30,
        critical_durability_percent: 0.25,
        max_battles: 10,
        points_thresholds: { small: 10, medium: 25 },
    },
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
            const bots = generateBots(50, -50, defaultConfig);
            for (const bot of bots) {
                expect(bot.rating).toBeGreaterThanOrEqual(0);
            }
        });

        it('edge-case: пустой bot_names → fallback', () => {
            const cfg = { ...defaultConfig, bot_names: [] };
            const bots = generateBots(50, 1000, cfg);
            expect(bots[0].name).toBe('Бот 1');
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

    // ─── Сессия PvP-арены ────────────────────────────────────────────────

    const sessionConfig: IPvpSessionConfig = defaultConfig.session;

    /** Хелпер: создаёт state героя с заданной массой/рейтингом */
    function makeHero(mass: number = 100, rating: number = 1000): IHeroState {
        return { mass, rating, massCap: 125 };
    }

    /** Хелпер: создаёт предмет экипировки с заданной прочностью */
    function makeEquipment(
        slot: 'weapon' | 'armor' | 'accessory',
        currentDurability: number,
        maxDurability: number = 10,
    ): IEquipmentItem {
        return {
            id: `${slot}_test`,
            name: 'Тестовый предмет',
            slot,
            tier: 1,
            strengthBonus: 0,
            armorBonus: 0,
            luckBonus: 0,
            commandId: null,
            maxDurability,
            currentDurability,
            basePrice: 50,
        };
    }

    /** Хелпер: полный комплект экипировки с заданной долей прочности */
    function makeEquipmentSlots(durabilityRatio: number): IEquipmentSlots {
        const maxDur = 10;
        const curDur = Math.round(maxDur * durabilityRatio);
        return {
            weapon: makeEquipment('weapon', curDur, maxDur),
            armor: makeEquipment('armor', curDur, maxDur),
            accessory: makeEquipment('accessory', curDur, maxDur),
        };
    }

    /** Хелпер: активная сессия по умолчанию */
    function makeActiveSession(overrides: Partial<IArenaSession> = {}): IArenaSession {
        return {
            active: true,
            battlesPlayed: 0,
            startMass: 100,
            startRating: 1000,
            totalMassLost: 0,
            totalRatingDelta: 0,
            ...overrides,
        };
    }

    describe('startSession', () => {
        it('возвращает snapshot массы/рейтинга героя и нулевые счётчики', () => {
            // Arrange
            const hero = makeHero(120, 1250);

            // Act
            const session = startSession(hero, sessionConfig);

            // Assert
            expect(session.active).toBe(true);
            expect(session.battlesPlayed).toBe(0);
            expect(session.startMass).toBe(120);
            expect(session.startRating).toBe(1250);
            expect(session.totalMassLost).toBe(0);
            expect(session.totalRatingDelta).toBe(0);
        });

        it('новая сессия всегда active=true независимо от config', () => {
            // Arrange — герой с массой у самого порога
            const hero = makeHero(sessionConfig.min_mass_threshold, 1000);

            // Act
            const session = startSession(hero, sessionConfig);

            // Assert — startSession не проверяет условия завершения, это задача shouldEndSession
            expect(session.active).toBe(true);
        });
    });

    describe('shouldEndSession', () => {
        const fullEquipment = makeEquipmentSlots(1.0);

        it('ok path: активная сессия, всё в норме → { ended: false, reason: null }', () => {
            // Arrange
            const hero = makeHero(100, 1000);
            const session = makeActiveSession({ battlesPlayed: 3 });

            // Act
            const result = shouldEndSession(hero, fullEquipment, session, sessionConfig);

            // Assert
            expect(result.ended).toBe(false);
            expect(result.reason).toBeNull();
        });

        it('reason: mass — масса ниже порога', () => {
            // Arrange — масса опустилась ниже min_mass_threshold
            const hero = makeHero(sessionConfig.min_mass_threshold - 1, 1000);
            const session = makeActiveSession({ battlesPlayed: 2 });

            // Act
            const result = shouldEndSession(hero, fullEquipment, session, sessionConfig);

            // Assert
            expect(result.ended).toBe(true);
            expect(result.reason).toBe('mass');
        });

        it('reason: durability — суммарная прочность экипировки ниже critical_durability_percent', () => {
            // Arrange — экипировка у 10% от максимума при пороге 25%
            const hero = makeHero(100, 1000);
            const session = makeActiveSession();
            const brokenEquipment = makeEquipmentSlots(0.1);

            // Act
            const result = shouldEndSession(hero, brokenEquipment, session, sessionConfig);

            // Assert
            expect(result.ended).toBe(true);
            expect(result.reason).toBe('durability');
        });

        it('reason: maxBattles — достигнут лимит боёв', () => {
            // Arrange
            const hero = makeHero(100, 1000);
            const session = makeActiveSession({ battlesPlayed: sessionConfig.max_battles });

            // Act
            const result = shouldEndSession(hero, fullEquipment, session, sessionConfig);

            // Assert
            expect(result.ended).toBe(true);
            expect(result.reason).toBe('maxBattles');
        });

        it('reason: manual — флаг ручного завершения', () => {
            // Arrange
            const hero = makeHero(100, 1000);
            const session = makeActiveSession({ battlesPlayed: 1 });

            // Act — manualEndRequested = true при здоровой сессии
            const result = shouldEndSession(hero, fullEquipment, session, sessionConfig, true);

            // Assert
            expect(result.ended).toBe(true);
            expect(result.reason).toBe('manual');
        });

        it('неактивная сессия (active=false) → ended: true, reason: manual', () => {
            // Arrange — сессия уже была закрыта ранее
            const hero = makeHero(100, 1000);
            const session = makeActiveSession({ active: false });

            // Act
            const result = shouldEndSession(hero, fullEquipment, session, sessionConfig);

            // Assert — неактивная сессия считается уже завершённой; reason=manual
            // как наиболее нейтральный (не mass/durability/maxBattles)
            expect(result.ended).toBe(true);
            expect(result.reason).toBe('manual');
        });

        it('durability: отсутствие экипировки не ломает расчёт', () => {
            // Arrange — все слоты null (нет экипировки → суммарный max=0)
            const hero = makeHero(100, 1000);
            const session = makeActiveSession();
            const empty: IEquipmentSlots = { weapon: null, armor: null, accessory: null };

            // Act
            const result = shouldEndSession(hero, empty, session, sessionConfig);

            // Assert — без экипировки durability-проверка не срабатывает
            expect(result.ended).toBe(false);
            expect(result.reason).toBeNull();
        });

        it('приоритет: mass раньше maxBattles', () => {
            // Arrange — одновременно и масса ниже, и лимит боёв достигнут
            const hero = makeHero(sessionConfig.min_mass_threshold - 1, 1000);
            const session = makeActiveSession({ battlesPlayed: sessionConfig.max_battles });

            // Act
            const result = shouldEndSession(hero, fullEquipment, session, sessionConfig);

            // Assert — mass имеет приоритет (жёстче по смыслу)
            expect(result.ended).toBe(true);
            expect(result.reason).toBe('mass');
        });
    });

    describe('applyBattleToSession', () => {
        it('инкрементирует battlesPlayed, ratingDelta положительный (victory)', () => {
            // Arrange
            const session = makeActiveSession();

            // Act — победа: массу не теряли (massDelta=0), рейтинг +12
            const next = applyBattleToSession(session, 0, 12);

            // Assert
            expect(next.battlesPlayed).toBe(1);
            expect(next.totalMassLost).toBe(0);
            expect(next.totalRatingDelta).toBe(12);
            // неизменяемость
            expect(next).not.toBe(session);
            expect(session.battlesPlayed).toBe(0);
        });

        it('defeat: накапливает потерю массы (massDelta<0) и отрицательную ratingDelta', () => {
            // Arrange
            const session = makeActiveSession();

            // Act — поражение: потеряли 10 кг, рейтинг −15
            const next = applyBattleToSession(session, -10, -15);

            // Assert — totalMassLost хранится как положительное число
            expect(next.battlesPlayed).toBe(1);
            expect(next.totalMassLost).toBe(10);
            expect(next.totalRatingDelta).toBe(-15);
        });

        it('аккумулирует несколько боёв подряд', () => {
            // Arrange
            let session = makeActiveSession();

            // Act — 3 боя: победа, поражение, победа
            session = applyBattleToSession(session, 0, 10);
            session = applyBattleToSession(session, -8, -12);
            session = applyBattleToSession(session, 0, 8);

            // Assert
            expect(session.battlesPlayed).toBe(3);
            expect(session.totalMassLost).toBe(8);      // только defeat добавил
            expect(session.totalRatingDelta).toBe(6);   // 10 − 12 + 8
        });
    });

    describe('calcArenaPoints', () => {
        const thresholds = { small: 10, medium: 25 };

        it('eloDelta = 0 → 1 очко', () => {
            expect(calcArenaPoints(0, thresholds)).toBe(1);
        });

        it('eloDelta ровно на пороге small (10) → 1 очко (нестрогое ≤)', () => {
            expect(calcArenaPoints(10, thresholds)).toBe(1);
        });

        it('eloDelta = small + 1 (11) → 2 очка', () => {
            expect(calcArenaPoints(11, thresholds)).toBe(2);
        });

        it('eloDelta ровно на пороге medium (25) → 2 очка', () => {
            expect(calcArenaPoints(25, thresholds)).toBe(2);
        });

        it('eloDelta = medium + 1 (26) → 3 очка', () => {
            expect(calcArenaPoints(26, thresholds)).toBe(3);
        });

        it('eloDelta = большое значение (100) → 3 очка', () => {
            expect(calcArenaPoints(100, thresholds)).toBe(3);
        });

        it('отрицательный eloDelta → 1 очко (защита от defeat-вызова)', () => {
            // calcArenaPoints вызывается только на victory, но защищаемся на будущее
            expect(calcArenaPoints(-15, thresholds)).toBe(1);
        });
    });
});
