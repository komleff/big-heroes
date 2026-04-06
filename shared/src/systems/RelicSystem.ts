import type { IRelicConfig } from '../types/BalanceConfig';
import type { IRelic, RelicRarity } from '../types/Relic';
import { shuffle } from '../utils/Random';

/** Максимум активных реликвий */
export const MAX_RELICS = 3;

/** Преобразовать конфиг реликвии в игровую реликвию */
export function configToRelic(config: IRelicConfig): IRelic {
    return {
        id: config.id,
        name: config.name,
        effect: config.effect,
        value: config.value,
        rarity: config.rarity as RelicRarity,
    };
}

/** Сгенерировать пул реликвий для выбора (исключая уже активные) */
export function generateRelicPool(
    allRelics: IRelicConfig[],
    activeRelics: IRelic[],
    count: number,
    rng: () => number,
): IRelicConfig[] {
    // Исключить уже имеющиеся реликвии
    const activeIds = new Set(activeRelics.map(r => r.id));
    const available = allRelics.filter(r => !activeIds.has(r.id));

    // Перемешать и взять count штук
    const shuffled = shuffle(rng, available);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Выбрать реликвию, вернуть обновлённый массив activeRelics */
export function selectRelic(
    activeRelics: IRelic[],
    newRelic: IRelic,
    replaceIndex?: number,
): IRelic[] {
    // Если есть место — просто добавить
    if (activeRelics.length < MAX_RELICS) {
        return [...activeRelics, newRelic];
    }

    // Если нужно заменить — заменить по индексу
    if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < activeRelics.length) {
        const result = [...activeRelics];
        result[replaceIndex] = newRelic;
        return result;
    }

    // Если лимит и нет индекса замены — вернуть без изменений
    return [...activeRelics];
}

/** Применить бонусы реликвий к массе (множитель) */
export function calcRelicMassMultiplier(activeRelics: IRelic[]): number {
    let multiplier = 1.0;
    for (const relic of activeRelics) {
        if (relic.effect === 'mass_bonus') {
            multiplier += relic.value;  // +0.2 = ×1.2
        }
        if (relic.effect === 'mass_on_win') {
            multiplier += relic.value;  // +0.15
        }
    }
    return multiplier;
}

/** Применить бонусы реликвий к золоту (множитель) */
export function calcRelicGoldMultiplier(activeRelics: IRelic[]): number {
    let multiplier = 1.0;
    for (const relic of activeRelics) {
        if (relic.effect === 'gold_bonus') {
            multiplier += relic.value;  // +0.3 = ×1.3
        }
    }
    return multiplier;
}

/** Получить скидку магазина от реликвий (0-1) */
export function calcRelicShopDiscount(activeRelics: IRelic[]): number {
    for (const relic of activeRelics) {
        if (relic.effect === 'shop_discount') {
            return relic.value;  // 0.3 = 30%
        }
    }
    return 0;
}

/** Проверить наличие реликвии с определённым эффектом */
export function hasRelicEffect(activeRelics: IRelic[], effect: string): boolean {
    return activeRelics.some(r => r.effect === effect);
}

/** Получить бонус ремонта лагеря от реликвий */
export function calcRelicCampRepairBonus(activeRelics: IRelic[]): number {
    for (const relic of activeRelics) {
        if (relic.effect === 'camp_repair_bonus') {
            return relic.value;  // +1
        }
    }
    return 0;
}
