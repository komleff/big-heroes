import { createRng, randInt, randPick, shuffle, weightedPick } from './Random';

// ─── createRng: детерминизм ───────────────────────────────────────────

describe('createRng', () => {
    it('одинаковый seed → одинаковая последовательность (10 значений)', () => {
        // Arrange
        const rngA = createRng(42);
        const rngB = createRng(42);

        // Act
        const seqA = Array.from({ length: 10 }, () => rngA());
        const seqB = Array.from({ length: 10 }, () => rngB());

        // Assert
        expect(seqA).toEqual(seqB);
    });

    it('разные seed → разные последовательности', () => {
        // Arrange
        const rngA = createRng(1);
        const rngB = createRng(2);

        // Act
        const seqA = Array.from({ length: 10 }, () => rngA());
        const seqB = Array.from({ length: 10 }, () => rngB());

        // Assert
        expect(seqA).not.toEqual(seqB);
    });

    it('значения всегда в диапазоне [0, 1)', () => {
        // Arrange
        const rng = createRng(12345);

        // Act
        const values = Array.from({ length: 10000 }, () => rng());

        // Assert
        for (const v of values) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
});

// ─── randInt ──────────────────────────────────────────────────────────

describe('randInt', () => {
    it('результат в [min, max] включительно за 1000 итераций', () => {
        // Arrange
        const rng = createRng(999);
        const min = 3;
        const max = 7;

        // Act
        const values = Array.from({ length: 1000 }, () => randInt(rng, min, max));

        // Assert
        for (const v of values) {
            expect(v).toBeGreaterThanOrEqual(min);
            expect(v).toBeLessThanOrEqual(max);
            expect(Number.isInteger(v)).toBe(true);
        }
        // Проверяем, что оба конца диапазона достижимы
        expect(values).toContain(min);
        expect(values).toContain(max);
    });
});

// ─── randPick ─────────────────────────────────────────────────────────

describe('randPick', () => {
    it('возвращает элемент из массива', () => {
        // Arrange
        const rng = createRng(77);
        const items = ['a', 'b', 'c', 'd'];

        // Act
        const results = Array.from({ length: 100 }, () => randPick(rng, items));

        // Assert
        for (const r of results) {
            expect(items).toContain(r);
        }
    });
});

// ─── shuffle ──────────────────────────────────────────────────────────

describe('shuffle', () => {
    it('сохраняет все элементы и не мутирует оригинал', () => {
        // Arrange
        const rng = createRng(55);
        const original = [1, 2, 3, 4, 5];
        const originalCopy = [...original];

        // Act
        const shuffled = shuffle(rng, original);

        // Assert — оригинал не изменён
        expect(original).toEqual(originalCopy);
        // Assert — все элементы сохранены
        expect(shuffled.sort()).toEqual(originalCopy.sort());
        // Assert — длина совпадает
        expect(shuffled.length).toBe(original.length);
    });
});

// ─── weightedPick ─────────────────────────────────────────────────────

describe('weightedPick', () => {
    it('при весах [0, 0, 1] всегда возвращает третий элемент', () => {
        // Arrange
        const rng = createRng(123);
        const items = ['a', 'b', 'c'];
        const weights = [0, 0, 1];

        // Act
        const results = Array.from({ length: 100 }, () => weightedPick(rng, items, weights));

        // Assert
        for (const r of results) {
            expect(r).toBe('c');
        }
    });

    it('при весах [1, 1] распределение ~50/50 (допуск ±5%)', () => {
        // Arrange
        const rng = createRng(456);
        const items = ['a', 'b'];
        const weights = [1, 1];
        const iterations = 10000;

        // Act
        let countA = 0;
        for (let i = 0; i < iterations; i++) {
            if (weightedPick(rng, items, weights) === 'a') countA++;
        }
        const ratioA = countA / iterations;

        // Assert — допуск ±5%
        expect(ratioA).toBeGreaterThan(0.45);
        expect(ratioA).toBeLessThan(0.55);
    });
});
