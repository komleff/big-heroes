import type { IHeroStats } from './GameState';
import type { CommandId } from './Equipment';
import type { IConsumableConfig, IMobConfig } from './BalanceConfig';

// Контекст боя
export interface IBattleContext {
    mode: 'pve' | 'pvp';
    heroStats: IHeroStats;
    heroMass: number;
    enemy: IMobConfig;
    command: CommandId;
    consumable: IConsumableConfig | null;
    rng: () => number;          // для детерминированных тестов
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
    durabilityTarget: string | null;  // id предмета для износа (-1)
    massReward: number;         // +кг при победе (0 при поражении)
    goldReward: number;
}
