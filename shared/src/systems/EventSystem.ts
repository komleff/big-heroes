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
 * Значение clamp в [0, 1].
 */
export function getVariantProcChance(variant: IEventVariant): number {
    const raw = variant.proc_chance ?? 1.0;
    return Math.max(0, Math.min(1, raw));
}

/** Проверяет, является ли вариант жертвой (содержит lose_item) */
function isGuaranteedVariant(variant: IEventVariant): boolean {
    return variant.effects.some(e => e.type === 'lose_item');
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
    const guaranteed = isGuaranteedVariant(variant);
    const procChance = getVariantProcChance(variant);
    const rollSuccess = guaranteed || roll < procChance;

    return variant.effects.map(effect => {
        // lose_item всегда срабатывает
        if (effect.type === 'lose_item') {
            return { effect, success: true };
        }
        return { effect, success: rollSuccess };
    });
}
