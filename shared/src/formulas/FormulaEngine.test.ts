import {
    calcHeroStats,
    calcDamage,
    calcTTK,
    calcBaseWinChance,
    clamp,
    calcAttackWinChance,
    calcBlockWinChance,
    calcFortuneChance,
    calcRetreatChance,
    calcBypassChance,
    calcPolymorphChance,
    calcEloChange,
    generateHitAnimation,
    getLeagueConfig,
} from './FormulaEngine';
import type { IEquipmentSlots } from '../types/GameState';
import type { IRelic } from '../types/Relic';
import type { IEquipmentItem } from '../types/Equipment';

// ─── Хелперы для создания мок-объектов ─────────────────────────────────

/** Пустая экипировка (все слоты null) */
function emptyEquipment(): IEquipmentSlots {
    return { weapon: null, armor: null, accessory: null };
}

/** Создать предмет экипировки с заданными бонусами */
function makeItem(overrides: Partial<IEquipmentItem> & { slot: IEquipmentItem['slot'] }): IEquipmentItem {
    return {
        id: 'test_item',
        name: 'Test Item',
        tier: 1,
        strengthBonus: 0,
        armorBonus: 0,
        luckBonus: 0,
        commandId: null,
        maxDurability: 3,
        currentDurability: 3,
        basePrice: 10,
        ...overrides,
    };
}

/** Создать реликвию */
function makeRelic(effect: string, value: number): IRelic {
    return { id: `relic_${effect}`, name: `Relic ${effect}`, effect, value, rarity: 'common' as const };
}

/** Фиксированный RNG: возвращает значения из массива по порядку */
function fixedRng(values: number[]): () => number {
    let index = 0;
    return () => {
        const v = values[index % values.length];
        index++;
        return v;
    };
}

// ─── calcHeroStats ─────────────────────────────────────────────────────

describe('calcHeroStats', () => {
    test('герой mass=50, оружие (+3 str), щит (+3 arm), кольцо (+1 luck), без реликвий', () => {
        // Arrange
        const equipment: IEquipmentSlots = {
            weapon: makeItem({ slot: 'weapon', strengthBonus: 3 }),
            armor: makeItem({ slot: 'armor', armorBonus: 3 }),
            accessory: makeItem({ slot: 'accessory', luckBonus: 1 }),
        };
        const relics: IRelic[] = [];

        // Act
        const stats = calcHeroStats(50, equipment, relics);

        // Assert — mass/3 = 16.666 → floor = 16, +3 weapon = 19
        expect(stats.hp).toBe(50);
        expect(stats.strength).toBe(19);  // floor(50/3) + 3
        expect(stats.armor).toBe(3);
        expect(stats.luck).toBe(1);
    });

    test('с реликвией strength_bonus +2 → str увеличивается на 2', () => {
        // Arrange
        const equipment: IEquipmentSlots = {
            weapon: makeItem({ slot: 'weapon', strengthBonus: 3 }),
            armor: makeItem({ slot: 'armor', armorBonus: 3 }),
            accessory: makeItem({ slot: 'accessory', luckBonus: 1 }),
        };
        const relics: IRelic[] = [makeRelic('strength_bonus', 2)];

        // Act
        const stats = calcHeroStats(50, equipment, relics);

        // Assert
        expect(stats.strength).toBe(21);  // floor(50/3) + 3 + 2
        expect(stats.armor).toBe(3);
        expect(stats.luck).toBe(1);
    });

    test('без экипировки (все слоты null) → только базовые статы', () => {
        // Arrange
        const equipment = emptyEquipment();
        const relics: IRelic[] = [];

        // Act
        const stats = calcHeroStats(50, equipment, relics);

        // Assert
        expect(stats.hp).toBe(50);
        expect(stats.strength).toBe(Math.floor(50 / 3));  // 16
        expect(stats.armor).toBe(0);
        expect(stats.luck).toBe(0);
    });

    test('предмет с durability=0 не даёт бонусов', () => {
        // Arrange — все предметы со сломанной прочностью (currentDurability=0)
        const equipment: IEquipmentSlots = {
            weapon: makeItem({ slot: 'weapon', strengthBonus: 5, currentDurability: 0 }),
            armor: makeItem({ slot: 'armor', armorBonus: 4, currentDurability: 0 }),
            accessory: makeItem({ slot: 'accessory', luckBonus: 3, currentDurability: 0 }),
        };
        const relics: IRelic[] = [];

        // Act
        const stats = calcHeroStats(60, equipment, relics);

        // Assert — бонусы сломанных предметов не учитываются
        expect(stats.hp).toBe(60);
        expect(stats.strength).toBe(Math.floor(60 / 3));  // 20, без бонуса оружия
        expect(stats.armor).toBe(0);                       // без бонуса щита
        expect(stats.luck).toBe(0);                        // без бонуса аксессуара
    });

    test('предмет с durability>0 даёт бонусы, с durability=0 — нет (смешанный)', () => {
        // Arrange — оружие рабочее, щит сломан, аксессуар рабочий
        const equipment: IEquipmentSlots = {
            weapon: makeItem({ slot: 'weapon', strengthBonus: 3, currentDurability: 2 }),
            armor: makeItem({ slot: 'armor', armorBonus: 4, currentDurability: 0 }),
            accessory: makeItem({ slot: 'accessory', luckBonus: 2, currentDurability: 1 }),
        };
        const relics: IRelic[] = [];

        // Act
        const stats = calcHeroStats(30, equipment, relics);

        // Assert
        expect(stats.strength).toBe(Math.floor(30 / 3) + 3);  // 10 + 3 = 13
        expect(stats.armor).toBe(0);                            // щит сломан — 0
        expect(stats.luck).toBe(2);                             // аксессуар рабочий
    });

    test('несколько реликвий разных типов суммируются', () => {
        // Arrange
        const equipment = emptyEquipment();
        const relics: IRelic[] = [
            makeRelic('strength_bonus', 3),
            makeRelic('armor_bonus', 2),
            makeRelic('luck_bonus', 1),
            makeRelic('strength_bonus', 1),  // ещё одна реликвия силы
        ];

        // Act
        const stats = calcHeroStats(30, equipment, relics);

        // Assert
        expect(stats.strength).toBe(Math.floor(30 / 3) + 3 + 1);  // 10 + 4 = 14
        expect(stats.armor).toBe(2);
        expect(stats.luck).toBe(1);
    });
});

// ─── calcDamage ────────────────────────────────────────────────────────

describe('calcDamage', () => {
    test('str=20, armor=5 → 15', () => {
        expect(calcDamage(20, 5)).toBe(15);
    });

    test('str=5, armor=20 → 1 (минимальный урон)', () => {
        expect(calcDamage(5, 20)).toBe(1);
    });

    test('str=10, armor=0 → 10', () => {
        expect(calcDamage(10, 0)).toBe(10);
    });

    test('str=0, armor=0 → 1 (минимальный урон)', () => {
        expect(calcDamage(0, 0)).toBe(1);
    });
});

// ─── calcTTK ───────────────────────────────────────────────────────────

describe('calcTTK', () => {
    test('hp=50, dmg=10 → 5', () => {
        expect(calcTTK(50, 10)).toBe(5);
    });

    test('hp=50, dmg=0 → 50 (урон ограничен минимумом 1)', () => {
        expect(calcTTK(50, 0)).toBe(50);
    });

    test('hp=100, dmg=1 → 100', () => {
        expect(calcTTK(100, 1)).toBe(100);
    });
});

// ─── calcBaseWinChance ─────────────────────────────────────────────────

describe('calcBaseWinChance', () => {
    test('ttkHero=5, ttkEnemy=3 → 5/8 = 0.625 (герой живёт дольше → шанс выше)', () => {
        expect(calcBaseWinChance(5, 3)).toBe(0.625);
    });

    test('ttkHero=3, ttkEnemy=5 → 3/8 = 0.375 (герой быстро падает → шанс ниже)', () => {
        expect(calcBaseWinChance(3, 5)).toBe(0.375);
    });

    test('равные TTK → 0.5', () => {
        expect(calcBaseWinChance(5, 5)).toBe(0.5);
    });
});

// ─── clamp ─────────────────────────────────────────────────────────────

describe('clamp', () => {
    test('значение внутри диапазона → без изменений', () => {
        expect(clamp(0.5, 0.05, 0.95)).toBe(0.5);
    });

    test('значение ниже минимума → ограничено минимумом', () => {
        expect(clamp(0.01, 0.05, 0.95)).toBe(0.05);
    });

    test('значение выше максимума → ограничено максимумом', () => {
        expect(clamp(0.99, 0.05, 0.95)).toBe(0.95);
    });
});

// ─── calcAttackWinChance ───────────────────────────────────────────────

describe('calcAttackWinChance', () => {
    test('base=0.5, luck=0 → 0.5 (без изменений)', () => {
        expect(calcAttackWinChance(0.5, 0, 0.05, 0.95, 0.01)).toBe(0.5);
    });

    test('base=0.5, luck=10, coeff=0.01 → 0.6', () => {
        expect(calcAttackWinChance(0.5, 10, 0.05, 0.95, 0.01)).toBe(0.6);
    });

    test('base=0.01, luck=0 → ограничено минимумом 0.05', () => {
        expect(calcAttackWinChance(0.01, 0, 0.05, 0.95, 0.01)).toBe(0.05);
    });
});

// ─── calcBlockWinChance ────────────────────────────────────────────────

describe('calcBlockWinChance', () => {
    test('слабый герой (attackChance=0.3): блок значительно улучшает шанс', () => {
        // Arrange
        const attackChance = 0.3;
        const shieldArmor = 5;
        const luck = 0;
        const baseBlockPower = 0.5;
        const shieldArmorBlockCoeff = 0.05;
        const luckCoeff = 0.01;

        // Act
        const blockChance = calcBlockWinChance(
            attackChance, shieldArmor, luck,
            baseBlockPower, shieldArmorBlockCoeff, luckCoeff, 0.05, 0.95,
        );

        // Assert — блок должен значительно улучшить шанс слабого героя
        expect(blockChance).toBeGreaterThan(attackChance);
        // blockPower = 0.5 + 5*0.05 = 0.75
        // blockModifier = (0.5 - 0.3) * 0.75 = 0.15
        // result = 0.3 + 0.15 + 0 = 0.45
        expect(blockChance).toBeCloseTo(0.45, 5);
    });

    test('сильный герой (attackChance=0.7): блок не должен сильно менять шанс', () => {
        // Arrange
        const attackChance = 0.7;
        const shieldArmor = 5;
        const luck = 0;
        const baseBlockPower = 0.5;
        const shieldArmorBlockCoeff = 0.05;
        const luckCoeff = 0.01;

        // Act
        const blockChance = calcBlockWinChance(
            attackChance, shieldArmor, luck,
            baseBlockPower, shieldArmorBlockCoeff, luckCoeff, 0.05, 0.95,
        );

        // Assert — блок уменьшает шанс сильного героя (штраф за блок)
        // blockPower = 0.75, blockModifier = (0.5 - 0.7) * 0.75 = -0.15
        // result = 0.7 - 0.15 = 0.55
        expect(blockChance).toBeLessThan(attackChance);
        expect(blockChance).toBeCloseTo(0.55, 5);
    });

    test('без щита (shieldArmor=0): блок всё равно работает за счёт baseBlockPower', () => {
        // Arrange
        const attackChance = 0.3;
        const shieldArmor = 0;
        const luck = 0;
        const baseBlockPower = 0.5;
        const shieldArmorBlockCoeff = 0.05;
        const luckCoeff = 0.01;

        // Act
        const blockChance = calcBlockWinChance(
            attackChance, shieldArmor, luck,
            baseBlockPower, shieldArmorBlockCoeff, luckCoeff, 0.05, 0.95,
        );

        // Assert — blockPower = 0.5 + 0 = 0.5
        // blockModifier = (0.5 - 0.3) * 0.5 = 0.1
        // result = 0.3 + 0.1 = 0.4
        expect(blockChance).toBeGreaterThan(attackChance);
        expect(blockChance).toBeCloseTo(0.4, 5);
    });
});

// ─── calcFortuneChance ─────────────────────────────────────────────────

describe('calcFortuneChance', () => {
    test('базовый шанс + удача в пределах диапазона', () => {
        expect(calcFortuneChance(0.5, 5, 0.02, 0.05, 0.95)).toBeCloseTo(0.6, 5);
    });

    test('без удачи → базовый шанс', () => {
        expect(calcFortuneChance(0.5, 0, 0.02, 0.05, 0.95)).toBe(0.5);
    });

    test('высокая удача → ограничено максимумом', () => {
        expect(calcFortuneChance(0.9, 10, 0.02, 0.05, 0.95)).toBe(0.95);
    });
});

// ─── calcRetreatChance ─────────────────────────────────────────────────

describe('calcRetreatChance', () => {
    test('luck=0 → базовый шанс 0.70', () => {
        expect(calcRetreatChance(0, 0.70, 0.02, 0.05, 0.95)).toBe(0.70);
    });

    test('luck=10 → 0.70 + 10*0.02 = 0.90', () => {
        expect(calcRetreatChance(10, 0.70, 0.02, 0.05, 0.95)).toBeCloseTo(0.90, 5);
    });

    test('luck=15 → ограничено максимумом 0.95', () => {
        // 0.70 + 15*0.02 = 1.0 → clamped to 0.95
        expect(calcRetreatChance(15, 0.70, 0.02, 0.05, 0.95)).toBe(0.95);
    });
});

// ─── calcBypassChance ──────────────────────────────────────────────────

describe('calcBypassChance', () => {
    test('luck=0 → базовый шанс 0.60', () => {
        expect(calcBypassChance(0, 0.60, 0.02, 0.05, 0.95)).toBe(0.60);
    });

    test('luck=5 → 0.60 + 5*0.02 = 0.70', () => {
        expect(calcBypassChance(5, 0.60, 0.02, 0.05, 0.95)).toBeCloseTo(0.70, 5);
    });
});

// ─── calcPolymorphChance ───────────────────────────────────────────────

describe('calcPolymorphChance', () => {
    test('базовый шанс без удачи', () => {
        expect(calcPolymorphChance(0.4, 0, 0.02, 0.05, 0.95)).toBe(0.4);
    });

    test('удача увеличивает шанс', () => {
        expect(calcPolymorphChance(0.4, 10, 0.02, 0.05, 0.95)).toBeCloseTo(0.6, 5);
    });
});

// ─── calcEloChange ─────────────────────────────────────────────────────

describe('calcEloChange', () => {
    test('равные рейтинги (1000 vs 1000), победа → +16', () => {
        // Arrange: expected = 1/(1+10^0) = 0.5, change = round(32*(1-0.5)) = 16
        const change = calcEloChange(1000, 1000, 1, 32);

        // Assert
        expect(change).toBe(16);
    });

    test('равные рейтинги (1000 vs 1000), поражение → -16', () => {
        const change = calcEloChange(1000, 1000, 0, 32);
        expect(change).toBe(-16);
    });

    test('сильный побеждает слабого → малый прирост', () => {
        // Arrange: сильный (1400) побеждает слабого (1000)
        const change = calcEloChange(1400, 1000, 1, 32);

        // Assert — expected ≈ 0.91, change ≈ round(32*0.09) ≈ 3
        expect(change).toBeGreaterThan(0);
        expect(change).toBeLessThan(16);  // меньше чем при равных рейтингах
    });

    test('слабый побеждает сильного → большой прирост', () => {
        // Arrange: слабый (1000) побеждает сильного (1400)
        const change = calcEloChange(1000, 1400, 1, 32);

        // Assert — expected ≈ 0.09, change ≈ round(32*0.91) ≈ 29
        expect(change).toBeGreaterThan(16);  // больше чем при равных рейтингах
        expect(change).toBeLessThanOrEqual(32);
    });
});

// ─── generateHitAnimation ──────────────────────────────────────────────

describe('generateHitAnimation', () => {
    test('фиксированный rng → предсказуемый результат (2 удара победителя)', () => {
        // Arrange: первый rng() < 0.5 → 2 удара
        // rng значения: [0.3 (hitCount→2), 0.5 (mult=1.0), 0.8 (mult=1.18), 0.3 (mult=0.88)]
        const rng = fixedRng([0.3, 0.5, 0.8, 0.3]);

        // Act
        const hits = generateHitAnimation('hero', 10, 5, rng);

        // Assert — 2 удара героя + 1 ответный удар врага = 3 удара
        expect(hits).toHaveLength(3);
        expect(hits[0].attacker).toBe('hero');
        expect(hits[1].attacker).toBe('hero');
        expect(hits[2].attacker).toBe('enemy');
    });

    test('фиксированный rng → предсказуемый результат (3 удара победителя)', () => {
        // Arrange: первый rng() >= 0.5 → 3 удара
        // rng значения: [0.7 (hitCount→3), 0.5, 0.5, 0.5, 0.5, 0.5]
        const rng = fixedRng([0.7, 0.5, 0.5, 0.5, 0.5, 0.5]);

        // Act
        const hits = generateHitAnimation('hero', 10, 5, rng);

        // Assert — 3 удара героя + 2 ответных = 5 ударов
        expect(hits).toHaveLength(5);
        expect(hits[0].attacker).toBe('hero');
        expect(hits[1].attacker).toBe('hero');
        expect(hits[2].attacker).toBe('hero');
        expect(hits[3].attacker).toBe('enemy');
        expect(hits[4].attacker).toBe('enemy');
    });

    test('количество ударов: 2–3 (победитель) + 1–2 (проигравший)', () => {
        // Arrange — hitCount=2 → responseCount=max(1, 2-1)=1
        const rng2 = fixedRng([0.3, 0.5, 0.5, 0.5]);
        const hits2 = generateHitAnimation('hero', 10, 5, rng2);
        const heroHits2 = hits2.filter(h => h.attacker === 'hero');
        const enemyHits2 = hits2.filter(h => h.attacker === 'enemy');

        expect(heroHits2.length).toBe(2);
        expect(enemyHits2.length).toBe(1);

        // Arrange — hitCount=3 → responseCount=max(1, 3-1)=2
        const rng3 = fixedRng([0.7, 0.5, 0.5, 0.5, 0.5, 0.5]);
        const hits3 = generateHitAnimation('enemy', 10, 5, rng3);
        const heroHits3 = hits3.filter(h => h.attacker === 'hero');
        const enemyHits3 = hits3.filter(h => h.attacker === 'enemy');

        expect(enemyHits3.length).toBe(3);  // победитель — enemy
        expect(heroHits3.length).toBe(2);   // проигравший — hero
    });

    test('все damage >= 1', () => {
        // Arrange — очень маленький урон, множитель 0.7 (минимальный)
        const rng = fixedRng([0.3, 0.0, 0.0, 0.0]);

        // Act
        const hits = generateHitAnimation('hero', 1, 1, rng);

        // Assert
        for (const hit of hits) {
            expect(hit.damage).toBeGreaterThanOrEqual(1);
        }
    });

    test('победитель enemy → удары распределены корректно', () => {
        // Arrange
        const rng = fixedRng([0.3, 0.5, 0.5, 0.5]);

        // Act
        const hits = generateHitAnimation('enemy', 10, 20, rng);

        // Assert — победитель enemy бьёт по герою
        expect(hits[0].attacker).toBe('enemy');
        expect(hits[1].attacker).toBe('enemy');
        // Ответный удар героя
        expect(hits[2].attacker).toBe('hero');
    });

    test('isStrong и isCritical определяются множителем', () => {
        // Arrange: multiplier = 0.7 + rng*0.6
        // rng=0.75 → mult=0.7+0.45=1.15 → isStrong=true, isCritical=false
        // rng=0.92 → mult=0.7+0.552=1.252 → isStrong=true, isCritical=true
        // rng=0.0  → mult=0.7 → isStrong=false, isCritical=false
        const rng = fixedRng([0.3, 0.75, 0.92, 0.0]);

        // Act
        const hits = generateHitAnimation('hero', 10, 5, rng);

        // Assert
        expect(hits[0].isStrong).toBe(true);    // mult = 1.15
        expect(hits[0].isCritical).toBe(false);
        expect(hits[1].isStrong).toBe(true);     // mult = 1.252
        expect(hits[1].isCritical).toBe(true);
        expect(hits[2].isStrong).toBe(false);    // mult = 0.7
        expect(hits[2].isCritical).toBe(false);
    });

    test('урон вычисляется как round(baseDamage * multiplier)', () => {
        // Arrange: rng=0.5 → multiplier=0.7+0.3=1.0
        const rng = fixedRng([0.3, 0.5, 0.5, 0.5]);

        // Act
        const hits = generateHitAnimation('hero', 10, 5, rng);

        // Assert — heroDamage=10, mult=1.0 → round(10*1.0)=10
        expect(hits[0].damage).toBe(10);
        expect(hits[1].damage).toBe(10);
        // Ответный удар: enemyDamage=5, mult=1.0 → round(5*1.0)=5
        expect(hits[2].damage).toBe(5);
    });
});

// ─── getLeagueConfig ────────────────────────────────────────────────
describe('getLeagueConfig', () => {
    const leagues = [
        { name: 'Бронза', minRating: 0, maxRating: 499 },
        { name: 'Серебро', minRating: 500, maxRating: 999 },
        { name: 'Золото', minRating: 1000, maxRating: 1500 },
    ];

    it('возвращает лигу, в диапазон которой попадает рейтинг', () => {
        expect(getLeagueConfig(250, leagues).name).toBe('Бронза');
        expect(getLeagueConfig(500, leagues).name).toBe('Серебро');
        expect(getLeagueConfig(1200, leagues).name).toBe('Золото');
    });

    it('возвращает последнюю лигу как fallback при превышении максимума', () => {
        expect(getLeagueConfig(9999, leagues).name).toBe('Золото');
    });

    it('возвращает дефолт при пустом массиве лиг', () => {
        const result = getLeagueConfig(100, []);
        expect(result.name).toBe('Лига');
        expect(result.minRating).toBe(0);
        expect(result.maxRating).toBe(0);
    });

    it('корректно обрабатывает граничные значения (minRating / maxRating)', () => {
        expect(getLeagueConfig(0, leagues).name).toBe('Бронза');
        expect(getLeagueConfig(499, leagues).name).toBe('Бронза');
        expect(getLeagueConfig(1500, leagues).name).toBe('Золото');
    });

    it('возвращает первую лигу при отрицательном рейтинге', () => {
        expect(getLeagueConfig(-1, leagues).name).toBe('Бронза');
        expect(getLeagueConfig(-100, leagues).name).toBe('Бронза');
    });
});
