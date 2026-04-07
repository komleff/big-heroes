import { generateRoute, generateForkPaths, createExpeditionState, advanceToNode, applyBattleResult, exitExpedition } from './PveSystem';
import type { IPveConfig, IMobConfig, IEventConfig } from '../types/BalanceConfig';
import type { IBattleResult } from '../types/Battle';
import type { IRelic } from '../types/Relic';
import type { IPveNode, IPveRoute } from '../types/PveNode';
import { createRng } from '../utils/Random';

// ─── Хелперы ──────────────────────────────────────────────────────────

/** Конфигурация PvE из balance.json */
const pveConfig: IPveConfig = {
    total_nodes_min: 8,
    total_nodes_max: 10,
    fork_count_min: 3,
    fork_count_max: 4,
    paths_per_fork_min: 2,
    paths_per_fork_max: 3,
    hidden_path_chance: 0.3,
    ancient_chest_node_min: 5,
    ancient_chest_node_max: 6,
    node_weights: { combat: 0.40, elite: 0.12, shop: 0.12, camp: 0.12, event: 0.08, chest: 0.16 },
    constraints: { max_combats_in_row: 2, max_shops: 1, min_camps_before_boss: 1 },
    camp: { repair_amount: 1, train_mass_min: 3, train_mass_max: 5 },
    shop: { item_count_min: 3, item_count_max: 4, price_multiplier: 1.0, repair_price_multiplier: 1.75 },
    loot: { combat_loot_chance: 0.20, elite_loot_guaranteed: true, elite_relic_chance: 0.40, boss_loot_count: 2, chest_loot_count_min: 1, chest_loot_count_max: 2, pity_counter: 5, equipment_drop_chance: 0.5 },
};

/** Враги из balance.json */
const enemies: IMobConfig[] = [
    { id: 'mob_slime', name: 'Слизень', type: 'combat', mass: 35, strength: 12, armor: 0, massReward: 6, goldReward: 10 },
    { id: 'mob_goblin', name: 'Гоблин', type: 'combat', mass: 50, strength: 17, armor: 1, massReward: 7, goldReward: 10 },
    { id: 'mob_wolf', name: 'Волк', type: 'combat', mass: 45, strength: 18, armor: 0, massReward: 7, goldReward: 10 },
    { id: 'mob_skeleton', name: 'Скелет', type: 'combat', mass: 55, strength: 16, armor: 3, massReward: 8, goldReward: 10 },
    { id: 'elite_ogre', name: 'Огр', type: 'elite', mass: 90, strength: 25, armor: 5, massReward: 12, goldReward: 20 },
    { id: 'elite_mage', name: 'Маг', type: 'elite', mass: 60, strength: 28, armor: 1, massReward: 15, goldReward: 20 },
    { id: 'boss_dragon', name: 'Дракон', type: 'boss', mass: 150, strength: 40, armor: 8, massReward: 25, goldReward: 30 },
];

/** События из balance.json */
const events: IEventConfig[] = [
    { id: 'evt_trader', name: 'Странник', description: 'Бродячий торговец', variants: [] },
    { id: 'evt_trap', name: 'Ловушка', description: 'Вы заметили ловушку', variants: [] },
    { id: 'evt_altar', name: 'Алтарь', description: 'Древний алтарь', variants: [] },
    { id: 'evt_fountain', name: 'Источник', description: 'Чистый источник', variants: [] },
    { id: 'evt_riddle', name: 'Загадка', description: 'Каменная плита', variants: [] },
    { id: 'evt_merchant', name: 'Торговец', description: 'Странствующий торговец', variants: [] },
];

/** Генерирует маршрут с заданным seed */
function makeRoute(seed: number = 42): IPveRoute {
    return generateRoute(pveConfig, enemies, events, createRng(seed));
}

/** Создаёт результат боя для тестов */
function makeBattleResult(overrides: Partial<IBattleResult> = {}): IBattleResult {
    return {
        outcome: 'victory',
        winChance: 0.6,
        hits: [],
        durabilityTarget: 'weapon',
        massReward: 6,
        goldReward: 10,
        enemyInitiative: false,
        ...overrides,
    };
}

// ─── generateRoute — базовая структура ───────────────────────────────

describe('generateRoute — базовая структура', () => {
    test('первый узел всегда sanctuary', () => {
        // Arrange & Act
        const route = makeRoute(1);

        // Assert
        expect(route.nodes[0].type).toBe('sanctuary');
        expect(route.nodes[0].index).toBe(0);
    });

    test('последний узел всегда boss с enemyId', () => {
        // Arrange & Act
        const route = makeRoute(2);

        // Assert
        const lastNode = route.nodes[route.totalNodes - 1];
        expect(lastNode.type).toBe('boss');
        expect(lastNode.enemyId).toBeDefined();
    });

    test('ancient_chest на позиции 4 или 5', () => {
        // Arrange & Act — несколько seed'ов
        for (let seed = 1; seed <= 20; seed++) {
            const route = makeRoute(seed);

            // Assert
            const ancientNodes = route.nodes.filter(n => n.type === 'ancient_chest');
            expect(ancientNodes.length).toBe(1);
            const pos = ancientNodes[0].index;
            expect(pos).toBeGreaterThanOrEqual(pveConfig.ancient_chest_node_min - 1);
            expect(pos).toBeLessThanOrEqual(pveConfig.ancient_chest_node_max - 1);
        }
    });

    test('детерминизм: одинаковый seed = одинаковый маршрут', () => {
        // Arrange & Act
        const route1 = makeRoute(777);
        const route2 = makeRoute(777);

        // Assert
        expect(route1.totalNodes).toBe(route2.totalNodes);
        expect(route1.nodes.length).toBe(route2.nodes.length);
        for (let i = 0; i < route1.nodes.length; i++) {
            expect(route1.nodes[i].type).toBe(route2.nodes[i].type);
            expect(route1.nodes[i].enemyId).toBe(route2.nodes[i].enemyId);
            expect(route1.nodes[i].eventId).toBe(route2.nodes[i].eventId);
            expect(route1.nodes[i].isFork).toBe(route2.nodes[i].isFork);
        }
    });

    test('totalNodes в пределах [min, max]', () => {
        // Arrange & Act
        for (let seed = 1; seed <= 30; seed++) {
            const route = makeRoute(seed);

            // Assert
            expect(route.totalNodes).toBeGreaterThanOrEqual(pveConfig.total_nodes_min);
            expect(route.totalNodes).toBeLessThanOrEqual(pveConfig.total_nodes_max);
            expect(route.nodes.length).toBe(route.totalNodes);
        }
    });
});

// ─── generateRoute — назначение id ──────────────────────────────────

describe('generateRoute — назначение id', () => {
    test('все combat/elite узлы имеют enemyId', () => {
        // Arrange & Act
        for (let seed = 1; seed <= 20; seed++) {
            const route = makeRoute(seed);

            // Assert
            for (const node of route.nodes) {
                if (node.type === 'combat' || node.type === 'elite') {
                    expect(node.enemyId).toBeDefined();
                }
            }
        }
    });

    test('все event узлы имеют eventId', () => {
        // Arrange & Act
        for (let seed = 1; seed <= 20; seed++) {
            const route = makeRoute(seed);

            // Assert
            for (const node of route.nodes) {
                if (node.type === 'event') {
                    expect(node.eventId).toBeDefined();
                }
            }
        }
    });
});

// ─── generateRoute — ограничения ────────────────────────────────────

describe('generateRoute — ограничения', () => {
    test('не более 2 боёв подряд', () => {
        // Arrange & Act
        for (let seed = 1; seed <= 50; seed++) {
            const route = makeRoute(seed);

            // Assert
            let combatsInRow = 0;
            for (const node of route.nodes) {
                if (node.type === 'combat' || node.type === 'elite') {
                    combatsInRow++;
                } else {
                    combatsInRow = 0;
                }
                expect(combatsInRow).toBeLessThanOrEqual(pveConfig.constraints.max_combats_in_row);
            }
        }
    });

    test('не более 1 магазина', () => {
        // Arrange & Act
        for (let seed = 1; seed <= 50; seed++) {
            const route = makeRoute(seed);

            // Assert
            const shopCount = route.nodes.filter(n => n.type === 'shop').length;
            expect(shopCount).toBeLessThanOrEqual(pveConfig.constraints.max_shops);
        }
    });

    test('минимум 1 лагерь до босса', () => {
        // Arrange & Act
        for (let seed = 1; seed <= 50; seed++) {
            const route = makeRoute(seed);

            // Assert — считаем лагеря до последнего узла (босс)
            const campsBeforeBoss = route.nodes
                .slice(0, route.totalNodes - 1)
                .filter(n => n.type === 'camp').length;
            expect(campsBeforeBoss).toBeGreaterThanOrEqual(pveConfig.constraints.min_camps_before_boss);
        }
    });
});

// ─── generateRoute — развилки ────────────────────────────────────────

describe('generateRoute — развилки', () => {
    test('есть развилки (isFork=true на некоторых узлах)', () => {
        // Arrange & Act — проверяем несколько seed'ов
        let foundFork = false;
        for (let seed = 1; seed <= 20; seed++) {
            const route = makeRoute(seed);
            const forks = route.nodes.filter(n => n.isFork);
            if (forks.length > 0) {
                foundFork = true;
                // Развилки имеют forkPaths
                for (const fork of forks) {
                    expect(fork.forkPaths).toBeDefined();
                    expect(fork.forkPaths!.length).toBeGreaterThanOrEqual(pveConfig.paths_per_fork_min);
                    expect(fork.forkPaths!.length).toBeLessThanOrEqual(pveConfig.paths_per_fork_max);
                }
            }
        }

        // Assert — хотя бы один seed должен дать развилки
        expect(foundFork).toBe(true);
    });
});

// ─── createExpeditionState ───────────────────────────────────────────

describe('createExpeditionState', () => {
    test('начальное состояние корректно', () => {
        // Arrange
        const route = makeRoute(42);

        // Act
        const state = createExpeditionState(route);

        // Assert
        expect(state.route).toBe(route);
        expect(state.currentNodeIndex).toBe(0);
        expect(state.status).toBe('active');
        expect(state.visitedNodes).toEqual([]);
        expect(state.massGained).toBe(0);
        expect(state.goldGained).toBe(0);
        expect(state.itemsFound).toEqual([]);
        expect(state.pityCounter).toBe(0);
        expect(state.combatsInRow).toBe(0);
    });
});

// ─── advanceToNode ──────────────────────────────────────────────────

describe('advanceToNode', () => {
    test('обновляет currentNodeIndex и visitedNodes', () => {
        // Arrange
        const route = makeRoute(42);
        const state = createExpeditionState(route);

        // Act
        const newState = advanceToNode(state, 1);

        // Assert
        expect(newState.currentNodeIndex).toBe(1);
        expect(newState.visitedNodes).toEqual([1]);
    });

    test('считает combatsInRow для боевых узлов', () => {
        // Arrange — создаём маршрут и находим combat-узлы
        const route = makeRoute(42);
        const state = createExpeditionState(route);

        // Находим первый combat/elite узел
        const combatNode = route.nodes.find(n => n.type === 'combat' || n.type === 'elite');
        expect(combatNode).toBeDefined();

        // Act
        const newState = advanceToNode(state, combatNode!.index);

        // Assert
        expect(newState.combatsInRow).toBe(1);
    });

    test('сбрасывает combatsInRow для небоевых узлов', () => {
        // Arrange
        const route = makeRoute(42);
        let state = createExpeditionState(route);

        // Находим combat-узел, затем небоевой
        const combatNode = route.nodes.find(n => n.type === 'combat' || n.type === 'elite');
        const nonCombatNode = route.nodes.find(n =>
            n.type !== 'combat' && n.type !== 'elite' && n.type !== 'boss' && n.index > 0,
        );

        expect(combatNode).toBeDefined();
        expect(nonCombatNode).toBeDefined();

        // Act — сначала идём на combat, потом на небоевой
        state = advanceToNode(state, combatNode!.index);
        expect(state.combatsInRow).toBe(1);

        state = advanceToNode(state, nonCombatNode!.index);

        // Assert
        expect(state.combatsInRow).toBe(0);
    });
});

// ─── applyBattleResult ──────────────────────────────────────────────

describe('applyBattleResult', () => {
    test('victory добавляет массу и золото', () => {
        // Arrange
        const route = makeRoute(42);
        const state = createExpeditionState(route);
        const result = makeBattleResult({ outcome: 'victory', massReward: 6, goldReward: 10 });

        // Act
        const newState = applyBattleResult(state, result, []);

        // Assert
        expect(newState.massGained).toBe(6);
        expect(newState.goldGained).toBe(10);
        // pityCounter управляется generateLoot, не applyBattleResult
        expect(newState.pityCounter).toBe(0);
    });

    test('victory с реликвиями применяет бонусы', () => {
        // Arrange
        const route = makeRoute(42);
        const state = createExpeditionState(route);
        const result = makeBattleResult({ outcome: 'victory', massReward: 10, goldReward: 20 });
        const relics: IRelic[] = [
            { id: 'relic_mass_bonus', name: 'Тяжёлая поступь', effect: 'mass_bonus', value: 0.2, rarity: 'uncommon' },
            { id: 'relic_gold_bonus', name: 'Жадный кошель', effect: 'gold_bonus', value: 0.3, rarity: 'common' },
        ];

        // Act
        const newState = applyBattleResult(state, result, relics);

        // Assert — масса: 10 * 1.2 = 12, золото: 20 * 1.3 = 26
        expect(newState.massGained).toBe(12);
        expect(newState.goldGained).toBe(26);
    });

    test('defeat устанавливает status=defeat', () => {
        // Arrange
        const route = makeRoute(42);
        const state = createExpeditionState(route);
        const result = makeBattleResult({ outcome: 'defeat', massReward: 0, goldReward: 0 });

        // Act
        const newState = applyBattleResult(state, result, []);

        // Assert
        expect(newState.status).toBe('defeat');
        expect(newState.massGained).toBe(0);
    });

    test('polymorph даёт золото без массы', () => {
        // Arrange
        const route = makeRoute(42);
        const state = createExpeditionState(route);
        const result = makeBattleResult({ outcome: 'polymorph', massReward: 6, goldReward: 10 });

        // Act
        const newState = applyBattleResult(state, result, []);

        // Assert
        expect(newState.massGained).toBe(0);
        expect(newState.goldGained).toBe(10);
    });
});

// ─── exitExpedition ──────────────────────────────────────────────────

describe('exitExpedition', () => {
    test('устанавливает status=exited', () => {
        // Arrange
        const route = makeRoute(42);
        const state = createExpeditionState(route);

        // Act
        const newState = exitExpedition(state);

        // Assert
        expect(newState.status).toBe('exited');
    });
});

// ─── generateForkPaths ──────────────────────────────────────────────

describe('generateForkPaths', () => {
    /** Создаёт узел-заглушку для тестов */
    function makeTargetNode(overrides: Partial<IPveNode> = {}): IPveNode {
        return { index: 3, type: 'combat', enemyId: 'mob_slime', eventId: undefined, isFork: false, ...overrides };
    }

    test('возвращает pathCount путей', () => {
        // Arrange
        const target = makeTargetNode();

        // Act — pathCount=1
        const result1 = generateForkPaths(target, pveConfig, enemies, events, 1, createRng(42));
        // Act — pathCount=3
        const result3 = generateForkPaths(target, pveConfig, enemies, events, 3, createRng(42));

        // Assert
        expect(result1.length).toBe(1);
        expect(result3.length).toBe(3);
    });

    test('первый путь совпадает с типом целевого узла', () => {
        // Arrange — combat-узел с enemyId
        const target = makeTargetNode({ type: 'combat', enemyId: 'mob_goblin' });

        // Act
        const paths = generateForkPaths(target, pveConfig, enemies, events, 2, createRng(99));

        // Assert
        expect(paths[0].nodeType).toBe('combat');
        expect(paths[0].enemyId).toBe('mob_goblin');
        expect(paths[0].hidden).toBe(false);
    });

    test('первый путь event содержит eventId', () => {
        // Arrange — event-узел с eventId
        const target = makeTargetNode({ type: 'event', enemyId: undefined, eventId: 'evt_trap' });

        // Act
        const paths = generateForkPaths(target, pveConfig, enemies, events, 2, createRng(55));

        // Assert
        expect(paths[0].nodeType).toBe('event');
        expect(paths[0].eventId).toBe('evt_trap');
        expect(paths[0].hidden).toBe(false);
    });

    test('pathCount=1 возвращает только основной путь', () => {
        // Arrange
        const target = makeTargetNode();

        // Act
        const paths = generateForkPaths(target, pveConfig, enemies, events, 1, createRng(10));

        // Assert
        expect(paths.length).toBe(1);
        expect(paths[0].nodeType).toBe(target.type);
    });

    test('пустой enemies: combat без enemyId', () => {
        // Arrange — пустой массив врагов, combat-узел без enemyId
        const target = makeTargetNode({ type: 'combat', enemyId: undefined });

        // Act — не должна падать
        const paths = generateForkPaths(target, pveConfig, [], events, 3, createRng(42));

        // Assert
        expect(paths.length).toBe(3);
        expect(paths[0].nodeType).toBe('combat');
    });

    test('пустой events: event без eventId', () => {
        // Arrange — пустой массив событий, event-узел без eventId
        const target = makeTargetNode({ type: 'event', enemyId: undefined, eventId: undefined });

        // Act — не должна падать
        const paths = generateForkPaths(target, pveConfig, enemies, [], 3, createRng(42));

        // Assert
        expect(paths.length).toBe(3);
        expect(paths[0].nodeType).toBe('event');
    });

    test('детерминированный результат при одинаковом seed', () => {
        // Arrange
        const target = makeTargetNode();

        // Act — два вызова с одинаковым seed
        const paths1 = generateForkPaths(target, pveConfig, enemies, events, 3, createRng(42));
        const paths2 = generateForkPaths(target, pveConfig, enemies, events, 3, createRng(42));

        // Assert — глубокое сравнение
        expect(paths1).toEqual(paths2);
    });
});
