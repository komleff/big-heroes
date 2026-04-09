// Система событий PvE: чистые функции резолва вариантов

import type { IEventVariant, IEventEffect } from '../types/BalanceConfig';

/** Результат резолва одного эффекта */
export interface IEventEffectResult {
    effect: IEventEffect;
    success: boolean;
}

/**
 * Определяет вероятность срабатывания варианта.
 * Приоритет: поле proc_chance > fallback 1.0.
 * Если вариант содержит lose_item — всегда гарантированно (жертва = 100%).
 */
export function getVariantProcChance(variant: IEventVariant): number {
    const hasLoseItem = variant.effects.some(e => e.type === 'lose_item');
    if (hasLoseItem) return 1.0;
    return variant.proc_chance ?? 1.0;
}

/**
 * Резолвит успех/неуспех варианта события.
 * Возвращает массив результатов для каждого эффекта.
 *
 * Правила:
 * - Если вариант содержит lose_item — все эффекты гарантированы (жертва = награда)
 * - Иначе используется proc_chance (из конфига или fallback 1.0)
 * - lose_item всегда срабатывает (проверка наличия предметов — на клиенте)
 */
export function resolveEventOutcome(
    variant: IEventVariant,
    roll: number,
): IEventEffectResult[] {
    const procChance = getVariantProcChance(variant);
    const rollSuccess = roll < procChance;

    return variant.effects.map(effect => {
        // lose_item всегда срабатывает
        if (effect.type === 'lose_item') {
            return { effect, success: true };
        }
        return { effect, success: rollSuccess };
    });
}
