// Детерминированный генератор случайных чисел (mulberry32)

/** Создать PRNG из seed */
export function createRng(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Случайное целое в диапазоне [min, max] (включительно) */
export function randInt(rng: () => number, min: number, max: number): number {
    return Math.floor(rng() * (max - min + 1)) + min;
}

/** Случайный элемент из массива */
export function randPick<T>(rng: () => number, arr: readonly T[]): T {
    return arr[Math.floor(rng() * arr.length)];
}

/** Перемешивание Fisher-Yates (возвращает новый массив) */
export function shuffle<T>(rng: () => number, arr: readonly T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/** Взвешенный случайный выбор */
export function weightedPick<T>(rng: () => number, items: readonly T[], weights: readonly number[]): T {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let roll = rng() * totalWeight;
    for (let i = 0; i < items.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
}
