import type { IHeroStats } from './GameState';
import type { CommandId, EquipmentSlotId } from './Equipment';
import type { IMobConfig } from './BalanceConfig';
import type { IConsumable } from './Consumable';

// Контекст боя
export interface IBattleContext {
    mode: 'pve' | 'pvp';
    heroStats: IHeroStats;
    heroMass: number;
    enemy: IMobConfig;
    command: CommandId;
    consumable: IConsumable | null;
    rng: () => number;          // для детерминированных тестов
    shieldArmorBonus: number;   // чистый бонус щита (без реликвий), для расчёта блока
}

// Один удар в анимации
export interface IHitAnimation {
    attacker: 'hero' | 'enemy';
    damage: number;             // отображаемое число урона
    isStrong: boolean;          // усиленный удар (×1.15+)
    isCritical: boolean;        // критический (×1.25+)
}

// Результат боя
export type BattleOutcome = 'victory' | 'defeat' | 'retreat' | 'bypass' | 'polymorph';

// Полный результат
export interface IBattleResult {
    outcome: BattleOutcome;
    winChance: number;          // шанс команды (для отображения)
    hits: IHitAnimation[];      // анимация ударов (2–3 штуки)
    durabilityTarget: EquipmentSlotId | null;  // слот экипировки для износа
    massReward: number;         // +кг при победе (0 при поражении)
    goldReward: number;
}
