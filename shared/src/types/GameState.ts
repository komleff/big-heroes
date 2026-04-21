import type { IEquipmentItem } from './Equipment';
import type { IConsumable } from './Consumable';
import type { IRelic } from './Relic';

// Базовое состояние героя (сохраняемое)
export interface IHeroState {
    mass: number;          // масса в кг (= HP в бою)
    rating: number;        // Elo-рейтинг
    massCap: number;       // потолок массы для текущей главы
}

// Вычисляемые боевые характеристики (через FormulaEngine)
export interface IHeroStats {
    hp: number;            // = mass
    strength: number;      // = mass/3 + weapon bonus + relic bonus
    armor: number;         // = shield bonus + relic bonus
    luck: number;          // = accessory bonus + relic bonus
}

// Ресурсы игрока
export interface IResources {
    gold: number;
}

// Слоты экипировки
export interface IEquipmentSlots {
    weapon: IEquipmentItem | null;
    armor: IEquipmentItem | null;
    accessory: IEquipmentItem | null;
}

// Слот пояса (2 слота)
export type IBeltSlot = IConsumable | null;

// Состояние активной сессии PvP-арены (серия боёв до истощения)
// Поле arenaSession в IGameState — опциональное, чтобы не ломать ранее сохранённые save-файлы
export interface IArenaSession {
    active: boolean;           // true — пока сессия не завершена
    battlesPlayed: number;     // всего проведено боёв в текущей сессии
    startMass: number;         // snapshot массы героя на старте сессии
    startRating: number;       // snapshot рейтинга на старте сессии
    totalMassLost: number;     // суммарная потеря массы за сессию (положительное число)
    totalRatingDelta: number;  // знаковая дельта рейтинга за сессию (сумма calcEloChange)
}

// Полное состояние игры
export interface IGameState {
    hero: IHeroState;
    resources: IResources;
    equipment: IEquipmentSlots;
    belt: [IBeltSlot, IBeltSlot];
    backpack: Array<IEquipmentItem | IConsumable | null>;  // max 4
    stash: IEquipmentItem[];
    activeRelics: IRelic[];
    // Опциональное — отсутствие поля валидно для save-файлов, созданных до Sprint 6
    arenaSession?: IArenaSession;
}
