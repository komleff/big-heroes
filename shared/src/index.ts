// Публичный API shared-пакета
export type { EquipmentSlotId, CommandId, IEquipmentItem } from './types/Equipment';
export type { IHeroState, IHeroStats, IResources, IEquipmentSlots, IBeltSlot, IGameState, IArenaSession } from './types/GameState';
export type { IBalanceConfig, IStarterEquipmentConfigItem, IMobConfig, IConsumableConfig, IRelicConfig, IFormulaConfig, IHeroLeagueConfig, IPveConfig, IPveNodeWeights, IPveConstraints, IPveLootConfig, IPveCampConfig, IPveShopConfig, IEventConfig, IEventVariant, IEventEffect, IPvpConfig, IPvpSessionConfig, IPvpPointsThresholds } from './types/BalanceConfig';
export type { IBattleContext, IHitAnimation, BattleOutcome, IBattleResult } from './types/Battle';
export type { ConsumableType, IConsumable } from './types/Consumable';
export type { IRelic, RelicRarity } from './types/Relic';
export type { PveNodeType, IPveNode, IPveForkPath, IPveRoute, PveExpeditionStatus, IPveExpeditionState } from './types/PveNode';
// Формулы (FormulaEngine)
export { calcHeroStats, calcDamage, calcTTK, calcBaseWinChance, clamp,
    calcAttackWinChance, calcBlockWinChance, calcFortuneChance,
    calcRetreatChance, calcBypassChance, calcPolymorphChance,
    calcEloChange, generateHitAnimation,
    applyConsumableEffect, getLeagueConfig } from './formulas/FormulaEngine';

// Системы
export { resolveBattle } from './systems/BattleSystem';
export { generateRelicPool, selectRelic, configToRelic, calcRelicMassMultiplier, calcRelicGoldMultiplier, calcRelicShopDiscount, hasRelicEffect, calcRelicCampRepairBonus, MAX_RELICS } from './systems/RelicSystem';
export { generateRoute, createExpeditionState, advanceToNode, applyBattleResult, exitExpedition, generateForkPaths } from './systems/PveSystem';
export { generateLoot, generateShopInventory, calcShopRepairCost } from './systems/LootSystem';
export type { ILootDrop, ILootResult, IShopItem } from './systems/LootSystem';
export { resolveEventOutcome, getVariantProcChance } from './systems/EventSystem';
export type { IEventEffectResult } from './systems/EventSystem';
export { generateBots, calcPvpMassLoss } from './systems/PvpSystem';
export type { IPvpBot } from './systems/PvpSystem';

// Утилиты
export { createRng, randInt, randPick, shuffle, weightedPick } from './utils/Random';
