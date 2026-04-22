// Типы для PvE-маршрута и экспедиции

// Тип узла на карте похода
export type PveNodeType = 'sanctuary' | 'combat' | 'elite' | 'shop' | 'camp' | 'event' | 'chest' | 'ancient_chest' | 'boss';

// Путь на развилке
export interface IPveForkPath {
    nodeType: PveNodeType;   // тип узла, к которому ведёт путь
    hidden: boolean;         // скрыт как "???"
    enemyId?: string;        // id моба (для combat/elite)
    eventId?: string;        // id события (для event)
}

// Узел маршрута
export interface IPveNode {
    index: number;           // позиция в маршруте (0-based)
    type: PveNodeType;       // тип узла
    enemyId?: string;        // id моба для combat/elite/boss
    eventId?: string;        // id события для event
    isFork: boolean;         // начало развилки
    forkPaths?: IPveForkPath[];  // пути развилки (2-3)
}

// Сгенерированный маршрут
export interface IPveRoute {
    seed: number;
    nodes: IPveNode[];
    totalNodes: number;
}

// Статус экспедиции
export type PveExpeditionStatus = 'active' | 'victory' | 'defeat' | 'exited';

// Состояние экспедиции (мутируется через чистые функции)
export interface IPveExpeditionState {
    route: IPveRoute;
    currentNodeIndex: number;
    status: PveExpeditionStatus;
    visitedNodes: number[];
    massGained: number;
    goldGained: number;
    itemsFound: string[];
    pityCounter: number;
    combatsInRow: number;
    // itemIds расходников, авто-размещённых на пояс во время экспедиции.
    // При defeat endExpedition откатывает их из belt — loot-loss инвариант
    // (GDD: при провале похода лишний лут теряется). Без этого поля combat-
    // расходник с пояса переживал defeat, обходя правило (GPT-5.4 CRITICAL).
    beltAdditions: string[];
}
