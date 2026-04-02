import { Ticker } from 'pixi.js';

// Функция плавности по умолчанию
function easeOutQuad(t: number): number {
    return t * (2 - t);
}

/**
 * Анимирует числовое свойство объекта
 * @param target — объект, свойство которого анимируем
 * @param property — имя свойства
 * @param from — начальное значение
 * @param to — конечное значение
 * @param durationMs — длительность в миллисекундах
 * @param ticker — PixiJS Ticker для обновлений
 * @param easing — функция плавности (по умолчанию easeOutQuad)
 * @returns Promise, который резолвится по завершении анимации
 */
export function tweenProperty(
    target: Record<string, number>,
    property: string,
    from: number,
    to: number,
    durationMs: number,
    ticker: Ticker,
    easing: (t: number) => number = easeOutQuad,
): Promise<void> {
    return new Promise<void>((resolve) => {
        // Guard: мгновенное завершение при нулевой длительности
        if (durationMs <= 0) {
            target[property] = to;
            resolve();
            return;
        }

        let elapsed = 0;
        target[property] = from;

        const update = (): void => {
            // PixiJS v8: ticker.deltaMS содержит прошедшее время в миллисекундах
            elapsed += ticker.deltaMS;
            const progress = Math.min(elapsed / durationMs, 1);
            const easedProgress = easing(progress);
            target[property] = from + (to - from) * easedProgress;

            if (progress >= 1) {
                target[property] = to;
                ticker.remove(update);
                resolve();
            }
        };

        ticker.add(update);
    });
}
