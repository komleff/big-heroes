// Система PvE-похода: генерация маршрута и управление состоянием экспедиции

import type { IPveConfig, IMobConfig, IEventConfig } from '../types/BalanceConfig';
import type { IPveNode, IPveRoute, IPveExpeditionState, PveNodeType, IPveForkPath } from '../types/PveNode';
import type { IBattleResult } from '../types/Battle';
import type { IRelic } from '../types/Relic';
import { randInt, randPick, weightedPick, shuffle } from '../utils/Random';

// ─── Генерация маршрута ──────────────────────────────────────────────

/** Генерирует маршрут PvE-похода */
export function generateRoute(
    config: IPveConfig,
    enemies: IMobConfig[],
    events: IEventConfig[],
    rng: () => number,
    seed: number = 0,
): IPveRoute {
    const totalNodes = randInt(rng, config.total_nodes_min, config.total_nodes_max);

    // Инициализируем массив узлов
    const nodes: (IPveNode | null)[] = new Array(totalNodes).fill(null);

    // Якорные узлы
    nodes[0] = makeNode(0, 'sanctuary');

    const ancientPos = randInt(rng, config.ancient_chest_node_min - 1, config.ancient_chest_node_max - 1);
    nodes[ancientPos] = makeNode(ancientPos, 'ancient_chest');

    const bossEnemy = enemies.find(e => e.type === 'boss');
    nodes[totalNodes - 1] = makeNode(totalNodes - 1, 'boss', bossEnemy?.id);

    // Якорные позиции (нельзя использовать для развилок и замен)
    const anchorPositions = new Set([0, ancientPos, totalNodes - 1]);

    // Определяем позиции развилок
    const availableForForks = [];
    for (let i = 1; i < totalNodes; i++) {
        if (!anchorPositions.has(i)) {
            availableForForks.push(i);
        }
    }
    const forkCount = randInt(rng, config.fork_count_min, config.fork_count_max);
    const shuffledAvailable = shuffle(rng, availableForForks);
    const forkPositions = new Set(shuffledAvailable.slice(0, Math.min(forkCount, shuffledAvailable.length)));

    // Заполняем пустые узлы взвешенным случайным выбором
    const nodeTypes: PveNodeType[] = ['combat', 'elite', 'shop', 'camp', 'event', 'chest'];
    const nodeWeights = [
        config.node_weights.combat,
        config.node_weights.elite,
        config.node_weights.shop,
        config.node_weights.camp,
        config.node_weights.event,
        config.node_weights.chest,
    ];

    const combatEnemies = enemies.filter(e => e.type === 'combat');
    const eliteEnemies = enemies.filter(e => e.type === 'elite');

    for (let i = 0; i < totalNodes; i++) {
        if (nodes[i] !== null) continue;

        const type = weightedPick(rng, nodeTypes, nodeWeights);
        let enemyId: string | undefined;
        let eventId: string | undefined;

        if (type === 'combat' && combatEnemies.length > 0) {
            enemyId = randPick(rng, combatEnemies).id;
        } else if (type === 'elite' && eliteEnemies.length > 0) {
            enemyId = randPick(rng, eliteEnemies).id;
        } else if (type === 'event' && events.length > 0) {
            eventId = randPick(rng, events).id;
        }

        nodes[i] = makeNode(i, type, enemyId, eventId);
    }

    // Постобработка: ограничения (ДО развилок, чтобы forkPaths отражали финальные типы)
    const finalNodes = nodes as IPveNode[];
    applyConstraints(finalNodes, config, anchorPositions, combatEnemies, eliteEnemies, events, rng);

    // Настраиваем развилки ПОСЛЕ ограничений — forkPaths отражают финальные типы узлов.
    // Делегируем в generateForkPaths: единственный источник правды для дедупликации
    // non-combat типов и вспомогательных полей (enemyId / eventId / hidden).
    for (const forkPos of forkPositions) {
        const forkNodeIndex = forkPos - 1;
        // Пропускаем если предыдущий узел — якорь
        if (anchorPositions.has(forkNodeIndex)) continue;

        const forkNode = finalNodes[forkNodeIndex];
        const targetNode = finalNodes[forkPos];

        const pathCount = randInt(rng, config.paths_per_fork_min, config.paths_per_fork_max);
        const paths = generateForkPaths(targetNode, config, enemies, events, pathCount, rng);

        forkNode.isFork = true;
        forkNode.forkPaths = paths;
    }

    return {
        seed,
        nodes: finalNodes,
        totalNodes,
    };
}

// ─── Управление экспедицией ──────────────────────────────────────────

/** Создаёт начальное состояние экспедиции */
export function createExpeditionState(route: IPveRoute): IPveExpeditionState {
    return {
        route,
        currentNodeIndex: 0,
        status: 'active',
        visitedNodes: [],
        massGained: 0,
        goldGained: 0,
        itemsFound: [],
        pityCounter: 0,
        combatsInRow: 0,
        beltAdditions: [],
    };
}

/** Продвигает экспедицию к указанному узлу */
export function advanceToNode(state: IPveExpeditionState, nodeIndex: number): IPveExpeditionState {
    const node = state.route.nodes[nodeIndex];
    const isCombatNode = node.type === 'combat' || node.type === 'elite' || node.type === 'boss';

    return {
        ...state,
        currentNodeIndex: nodeIndex,
        visitedNodes: [...state.visitedNodes, nodeIndex],
        combatsInRow: isCombatNode ? state.combatsInRow + 1 : 0,
    };
}

/** Применяет результат боя к состоянию экспедиции */
export function applyBattleResult(
    state: IPveExpeditionState,
    result: IBattleResult,
    activeRelics: IRelic[],
): IPveExpeditionState {
    if (result.outcome === 'defeat') {
        return { ...state, status: 'defeat' };
    }

    if (result.outcome === 'victory') {
        // Бонусы реликвий к массе
        let massMultiplier = 1;
        for (const relic of activeRelics) {
            if (relic.effect === 'mass_bonus') massMultiplier += relic.value;
            if (relic.effect === 'mass_on_win') massMultiplier += relic.value;
        }

        // Бонус реликвий к золоту
        let goldMultiplier = 1;
        for (const relic of activeRelics) {
            if (relic.effect === 'gold_bonus') goldMultiplier += relic.value;
        }

        const massReward = Math.round(result.massReward * massMultiplier);
        const goldReward = Math.round(result.goldReward * goldMultiplier);

        return {
            ...state,
            massGained: state.massGained + massReward,
            goldGained: state.goldGained + goldReward,
            // pityCounter управляется generateLoot, не здесь
        };
    }

    // retreat, bypass — просто продолжаем
    if (result.outcome === 'retreat' || result.outcome === 'bypass') {
        return { ...state };
    }

    // polymorph — золото без массы (по GDD)
    if (result.outcome === 'polymorph') {
        let goldMultiplier = 1;
        for (const relic of activeRelics) {
            if (relic.effect === 'gold_bonus') goldMultiplier += relic.value;
        }
        const goldReward = Math.round(result.goldReward * goldMultiplier);

        return {
            ...state,
            goldGained: state.goldGained + goldReward,
        };
    }

    return { ...state };
}

/**
 * Генерирует альтернативные пути для узла, у которого нет развилки.
 * Основной путь — тип целевого узла, остальные — случайные по весам.
 */
export function generateForkPaths(
    targetNode: IPveNode,
    config: IPveConfig,
    enemies: IMobConfig[],
    events: IEventConfig[],
    pathCount: number,
    rng: () => number,
): IPveForkPath[] {
    const nodeTypes: PveNodeType[] = ['combat', 'elite', 'shop', 'camp', 'event', 'chest'];
    const nodeWeights = [
        config.node_weights.combat, config.node_weights.elite,
        config.node_weights.shop, config.node_weights.camp,
        config.node_weights.event, config.node_weights.chest,
    ];
    const combatEnemies = enemies.filter(e => e.type === 'combat');
    const eliteEnemies = enemies.filter(e => e.type === 'elite');

    // Основной путь — тип целевого узла
    const mainPath: IPveForkPath = {
        nodeType: targetNode.type,
        hidden: false,
        enemyId: targetNode.enemyId,
        eventId: targetNode.eventId,
    };
    const paths: IPveForkPath[] = [mainPath];

    // Альтернативные пути (без дублей одинаковых типов на одной развилке,
    // кроме combat/elite — они допускают повторы с разными врагами)
    const usedTypes = new Set<PveNodeType>([mainPath.nodeType]);
    const combatTypes = new Set<PveNodeType>(['combat', 'elite']);

    for (let p = 1; p < pathCount; p++) {
        let altType: PveNodeType;
        let attempts = 0;
        do {
            altType = weightedPick(rng, nodeTypes, nodeWeights);
            attempts++;
        } while (usedTypes.has(altType) && !combatTypes.has(altType) && attempts < 20);

        usedTypes.add(altType);

        let altEnemyId: string | undefined;
        let altEventId: string | undefined;

        if (altType === 'combat' && combatEnemies.length > 0) {
            altEnemyId = randPick(rng, combatEnemies).id;
        } else if (altType === 'elite' && eliteEnemies.length > 0) {
            altEnemyId = randPick(rng, eliteEnemies).id;
        } else if (altType === 'event' && events.length > 0) {
            altEventId = randPick(rng, events).id;
        }

        const hidden = rng() < config.hidden_path_chance;
        paths.push({ nodeType: altType, hidden, enemyId: altEnemyId, eventId: altEventId });
    }

    return paths;
}

/** Завершает экспедицию (выход) */
export function exitExpedition(state: IPveExpeditionState): IPveExpeditionState {
    return { ...state, status: 'exited' };
}

// ─── Вспомогательные функции ─────────────────────────────────────────

/** Создаёт узел маршрута */
function makeNode(index: number, type: PveNodeType, enemyId?: string, eventId?: string): IPveNode {
    return { index, type, enemyId, eventId, isFork: false };
}

/** Применяет ограничения к маршруту (постобработка) */
function applyConstraints(
    nodes: IPveNode[],
    config: IPveConfig,
    anchorPositions: Set<number>,
    combatEnemies: IMobConfig[],
    eliteEnemies: IMobConfig[],
    events: IEventConfig[],
    rng: () => number,
): void {
    const replacementTypes: PveNodeType[] = ['camp', 'event', 'chest'];

    // Ограничение: не более max_combats_in_row боёв подряд
    const maxCombats = config.constraints.max_combats_in_row;
    let combatsInRow = 0;
    for (let i = 0; i < nodes.length; i++) {
        const t = nodes[i].type;
        if (t === 'combat' || t === 'elite') {
            combatsInRow++;
            if (combatsInRow > maxCombats && !anchorPositions.has(i)) {
                const newType = randPick(rng, replacementTypes);
                replaceNodeType(nodes[i], newType, events, rng);
                combatsInRow = 0;
            }
        } else {
            combatsInRow = 0;
        }
    }

    // Ограничение: не более max_shops магазинов
    const maxShops = config.constraints.max_shops;
    let shopCount = 0;
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].type === 'shop') {
            shopCount++;
            if (shopCount > maxShops && !anchorPositions.has(i)) {
                const nonShopTypes: PveNodeType[] = ['camp', 'event', 'chest'];
                const newType = randPick(rng, nonShopTypes);
                replaceNodeType(nodes[i], newType, events, rng);
            }
        }
    }

    // Ограничение: минимум min_camps_before_boss лагерей до босса
    const minCamps = config.constraints.min_camps_before_boss;
    let campCount = 0;
    for (let i = 0; i < nodes.length - 1; i++) {
        if (nodes[i].type === 'camp') campCount++;
    }

    while (campCount < minCamps) {
        // Находим случайный неякорный узел для замены на camp
        const replaceableIndices: number[] = [];
        for (let i = 1; i < nodes.length - 1; i++) {
            if (!anchorPositions.has(i) && nodes[i].type !== 'camp') {
                replaceableIndices.push(i);
            }
        }
        if (replaceableIndices.length === 0) break;
        const idx = randPick(rng, replaceableIndices);
        replaceNodeType(nodes[idx], 'camp', events, rng);
        campCount++;
    }
}

/** Заменяет тип узла и обновляет связанные поля */
function replaceNodeType(
    node: IPveNode,
    newType: PveNodeType,
    events: IEventConfig[],
    rng: () => number,
): void {
    node.type = newType;
    node.enemyId = undefined;
    node.eventId = undefined;

    if (newType === 'event' && events.length > 0) {
        node.eventId = randPick(rng, events).id;
    }
}
