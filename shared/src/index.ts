// Публичный API shared-пакета
export type { EquipmentSlotId, CommandId, IEquipmentItem } from './types/Equipment';
export type { IHeroState, IHeroStats, IResources, IEquipmentSlots, IBeltSlot, IGameState } from './types/GameState';
export type { IBalanceConfig, IStarterEquipmentConfigItem, IMobConfig, IConsumableConfig, IRelicConfig, IFormulaConfig } from './types/BalanceConfig';
export type { IBattleContext, IHitAnimation, BattleOutcome, IBattleResult } from './types/Battle';
export type { ConsumableType, IConsumable } from './types/Consumable';
export type { IRelic } from './types/Relic';
export type { MobType, IMob } from './types/Mob';

// Формулы (FormulaEngine)
export { calcHeroStats, calcDamage, calcTTK, calcBaseWinChance, clamp,
    calcAttackWinChance, calcBlockWinChance, calcFortuneChance,
    calcRetreatChance, calcBypassChance, calcPolymorphChance,
    calcEloChange, generateHitAnimation } from './formulas/FormulaEngine';

// Системы
export { resolveBattle } from './systems/BattleSystem';
