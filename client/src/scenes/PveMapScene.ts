import { Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { createPveBackground } from '../ui/GradientBackground';
import { GameState } from '../core/GameState';
import { EventBus, GameEvents } from '../core/EventBus';
import { SceneManager, TransitionType } from '../core/SceneManager';
import { THEME } from '../config/ThemeConfig';
import { Button } from '../ui/Button';
import { ResourceBar } from '../ui/ResourceBar';
import { addRelicWithUI } from '../utils/relicHelper';
import {
    advanceToNode, exitExpedition,
    generateRelicPool, configToRelic,
    generateLoot, generateShopInventory,
    generateForkPaths,
    createRng, randInt,
    resolveEventOutcome,
} from 'shared';
import type {
    IPveNode, PveNodeType, IPveExpeditionState,
    IBalanceConfig, IMobConfig, IPveForkPath,
} from 'shared';
import balanceConfig from '@config/balance.json';

/** Ширина и высота дизайна */
const W = THEME.layout.designWidth;
const H = THEME.layout.designHeight;

/** Отображение типа узла: иконка + название */
function getNodeDisplay(type: PveNodeType): { icon: string; name: string } {
    switch (type) {
        case 'sanctuary': return { icon: '\uD83C\uDFDB\uFE0F', name: 'Святилище' };
        case 'combat': return { icon: '\u2694\uFE0F', name: 'Бой' };
        case 'elite': return { icon: '\uD83D\uDC80', name: 'Элитный бой' };
        case 'shop': return { icon: '\uD83C\uDFEA', name: 'Магазин' };
        case 'camp': return { icon: '\uD83C\uDFD5\uFE0F', name: 'Лагерь' };
        case 'event': return { icon: '\u2753', name: 'Событие' };
        case 'chest': return { icon: '\uD83D\uDCE6', name: 'Сундук' };
        case 'ancient_chest': return { icon: '\u2728', name: 'Древний сундук' };
        case 'boss': return { icon: '\uD83D\uDC09', name: 'Босс' };
    }
}

/**
 * Сцена карты PvE-похода — навигационный хаб экспедиции.
 * Показывает текущий узел маршрута и позволяет перейти к нему.
 * Для боевых узлов переходит в preBattle, для остальных — в соответствующую сцену.
 */
export class PveMapScene extends BaseScene {
    private readonly gameState: GameState;
    private readonly eventBus: EventBus;
    private readonly sceneManager: SceneManager;

    constructor(gameState: GameState, eventBus: EventBus, sceneManager: SceneManager) {
        super();
        this.gameState = gameState;
        this.eventBus = eventBus;
        this.sceneManager = sceneManager;
    }

    onEnter(): void {
        const { gameState, sceneManager } = this;
        const expedition = gameState.expeditionState as IPveExpeditionState | null;

        // Если нет активной экспедиции — вернуться в хаб
        if (!expedition) {
            void sceneManager.goto('hub', { transition: TransitionType.FADE });
            return;
        }

        const currentNode = expedition.route.nodes[expedition.currentNodeIndex];
        const totalNodes = expedition.route.totalNodes;
        const display = getNodeDisplay(currentNode.type);

        // --- Фон (градиент PvE) ---
        this.addChild(createPveBackground(W, H));

        // --- Заголовок ---
        const heading = new Text({
            text: 'ПОХОД',
            style: new TextStyle({
                fontSize: THEME.font.sizes.heading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.black,
                fill: THEME.colors.text_primary,
            }),
        });
        heading.anchor.set(0.5, 0);
        heading.x = W / 2;
        heading.y = THEME.layout.spacing.topOffset;
        this.addChild(heading);

        // --- Подзаголовок: шаг похода ---
        // handleForkChoice обновляет текущий узел → все индексы посещаются последовательно.
        const displayStep = expedition.currentNodeIndex + 1;
        const subheading = new Text({
            text: `Шаг ${displayStep} / ${totalNodes}`,
            style: new TextStyle({
                fontSize: THEME.font.sizes.subheading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.text_secondary,
            }),
        });
        subheading.anchor.set(0.5, 0);
        subheading.x = W / 2;
        subheading.y = 100;
        this.addChild(subheading);

        // --- Ресурсы (базовые + набранные в походе) ---
        const totalMass = gameState.hero.mass + expedition.massGained;
        const totalGold = gameState.resources.gold + expedition.goldGained;
        const massBar = new ResourceBar({
            label: 'Масса',
            value: totalMass,
        });
        massBar.position.set(16, 140);
        this.addChild(massBar);

        const goldBar = new ResourceBar({
            label: 'Золото',
            value: totalGold,
        });
        goldBar.position.set(200, 140);
        this.addChild(goldBar);

        // --- Реликвии ---
        if (gameState.activeRelics.length > 0) {
            const relicsText = new Text({
                text: `Реликвии: ${gameState.activeRelics.map(r => r.name).join(', ')}`,
                style: new TextStyle({
                    fontSize: THEME.font.sizes.small,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.regular,
                    fill: THEME.colors.text_muted,
                    wordWrap: true,
                    wordWrapWidth: W - 32,
                }),
            });
            relicsText.position.set(16, 180);
            this.addChild(relicsText);
        }

        // --- Развилка: 1-3 варианта точки интереса ---
        let actionY = 220;

        // ensureForkPaths смотрит на ТЕКУЩИЙ узел:
        // - Фиксированный (boss/ancient_chest/sanctuary) → 1 вариант
        // - Обычный → 2-3 случайных варианта
        const forkPaths = this.ensureForkPaths(currentNode, expedition);

        const forkLabel = new Text({
            text: 'Выберите путь:',
            style: new TextStyle({
                fontSize: THEME.font.sizes.subheading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.text_secondary,
            }),
        });
        forkLabel.anchor.set(0.5, 0);
        forkLabel.x = W / 2;
        forkLabel.y = actionY;
        this.addChild(forkLabel);
        actionY += 40;

        // Реликвия «Все ??? раскрыты» снимает hidden с путей
        const hasRevealAll = gameState.activeRelics.some(r => r.effect === 'reveal_all');

        for (const path of forkPaths) {
            const pathDisplay = getNodeDisplay(path.nodeType);
            const isHidden = path.hidden && !hasRevealAll;
            const pathLabel = isHidden ? '???' : `${pathDisplay.icon} ${pathDisplay.name}`;
            const pathBtn = new Button({
                text: pathLabel,
                variant: 'secondary',
                onClick: () => {
                    this.handleForkChoice(path.nodeType, path.enemyId, path.eventId);
                },
            });
            pathBtn.position.set(39 + THEME.layout.buttonWidth / 2, actionY);
            this.addChild(pathBtn);
            actionY += 70;
        }

        // --- Кнопка «Выйти из похода» (скрыта на боссе) ---
        if (currentNode.type !== 'boss') {
            const exitBtn = new Button({
                text: 'ВЫЙТИ ИЗ ПОХОДА',
                variant: 'danger',
                onClick: () => {
                    // Завершить экспедицию с текущими наградами
                    const state = gameState.expeditionState as IPveExpeditionState;
                    const exitedState = exitExpedition(state);
                    gameState.updateExpeditionState(exitedState);
                    gameState.endExpedition();
                    this.eventBus.emit(GameEvents.PVE_EXPEDITION_END, exitedState);
                    void sceneManager.goto('hub', { transition: TransitionType.SLIDE_RIGHT });
                },
            });
            exitBtn.position.set(39 + THEME.layout.buttonWidth / 2, actionY);
            this.addChild(exitBtn);
        }
    }

    /**
     * Генерирует варианты для развилки на ТЕКУЩЕМ узле.
     * - Фиксированный (boss/ancient_chest/sanctuary) → 1 вариант (сам текущий тип)
     * - Обычный → 2-3 случайных варианта (без дублей одного типа на развилке)
     */
    private ensureForkPaths(node: IPveNode, expedition: IPveExpeditionState): IPveForkPath[] {
        // Фиксированные узлы — единственный вариант (сам текущий тип)
        const isFixed = node.type === 'boss' || node.type === 'ancient_chest' || node.type === 'sanctuary';
        if (isFixed) {
            return [{ nodeType: node.type, hidden: false, enemyId: node.enemyId, eventId: node.eventId }];
        }

        // Если развилка уже сгенерирована — вернуть её
        if (node.isFork && node.forkPaths && node.forkPaths.length > 0) {
            return node.forkPaths;
        }

        // Генерируем 2-3 случайных варианта
        const config = balanceConfig as unknown as IBalanceConfig;
        const rng = createRng(expedition.route.seed + expedition.currentNodeIndex);
        const pathCount = randInt(rng, config.pve.paths_per_fork_min, config.pve.paths_per_fork_max);
        const forkPaths = generateForkPaths(
            node, config.pve, config.enemies, config.events, pathCount, rng,
        );

        // Сохранить в route (детерминированность при перезагрузке)
        const updatedNodes = [...expedition.route.nodes];
        updatedNodes[node.index] = { ...node, isFork: true, forkPaths };
        const updatedRoute = { ...expedition.route, nodes: updatedNodes };
        this.gameState.updateExpeditionState({ ...expedition, route: updatedRoute });

        return forkPaths;
    }

    /**
     * Обработка выбора на развилке.
     * Записывает выбранный тип в nodes[currentIdx] и сразу входит через enterNode.
     * Для фиксированных (boss/ancient_chest/sanctuary) — тип уже записан, запись идемпотентна.
     */
    private handleForkChoice(nodeType: PveNodeType, enemyId?: string, eventId?: string): void {
        const expedition = this.gameState.expeditionState as IPveExpeditionState;
        const currentIdx = expedition.currentNodeIndex;

        // Записать выбранный тип в текущий узел
        const updatedNodes = [...expedition.route.nodes];
        updatedNodes[currentIdx] = {
            ...updatedNodes[currentIdx],
            type: nodeType,
            enemyId,
            eventId,
            isFork: false,
            forkPaths: undefined,
        };

        const updatedRoute = { ...expedition.route, nodes: updatedNodes };
        this.gameState.updateExpeditionState({ ...expedition, route: updatedRoute });

        // Сразу войти (без промежуточного экрана)
        this.enterNode(updatedNodes[currentIdx]);
    }

    /**
     * Вход в узел — определяет действие по типу узла.
     * Боевые узлы → preBattle, остальные → соответствующие сцены.
     */
    private enterNode(node: IPveNode): void {
        const { gameState, sceneManager, eventBus } = this;
        const config = balanceConfig as unknown as IBalanceConfig;

        // Продвигаем экспедицию к текущему узлу
        const expedition = gameState.expeditionState as IPveExpeditionState;

        // Защита: узлы, уже пройдённые (в visitedNodes), пропускаются
        // При retreat текущий узел УДАЛЯЕТСЯ из visitedNodes → можно retry (GDD)
        const alreadyVisited = expedition.visitedNodes.includes(node.index);
        if (alreadyVisited) {
            this.advanceToNextNode();
            return;
        }

        const advanced = advanceToNode(expedition, node.index);
        gameState.updateExpeditionState(advanced);

        eventBus.emit(GameEvents.PVE_NODE_ENTER, node);

        switch (node.type) {
            case 'combat':
            case 'elite': {
                const enemy = this.findEnemy(config, node.enemyId);
                if (!enemy) { this.advanceToNextNode(); return; }
                void sceneManager.goto('preBattle', {
                    transition: TransitionType.SLIDE_LEFT,
                    data: { enemy, isBoss: false },
                });
                break;
            }

            case 'boss': {
                const enemy = this.findEnemy(config, node.enemyId);
                if (!enemy) { this.advanceToNextNode(); return; }
                void sceneManager.goto('preBattle', {
                    transition: TransitionType.SLIDE_LEFT,
                    data: { enemy, isBoss: true },
                });
                break;
            }

            case 'sanctuary': {
                this.handleSanctuary(config);
                break;
            }

            case 'shop': {
                this.handleShop(config);
                break;
            }

            case 'camp': {
                this.handleCamp(config);
                break;
            }

            case 'event': {
                this.handleEvent(config, node);
                break;
            }

            case 'chest':
            case 'ancient_chest': {
                this.handleChest(config, node);
                break;
            }
        }
    }

    /**
     * Найти моба по id в конфиге.
     */
    private findEnemy(config: IBalanceConfig, enemyId?: string): IMobConfig | null {
        if (!enemyId) return null;
        return config.enemies.find(e => e.id === enemyId) ?? null;
    }

    // ───────────────────────────── Обработчики некомбатных узлов ─────────

    /**
     * Святилище — выбор реликвии из пула.
     */
    private handleSanctuary(config: IBalanceConfig): void {
        const activeRelics = [...this.gameState.activeRelics];
        const rng = createRng(Date.now());
        const pool = generateRelicPool(config.relics, activeRelics, 3, rng);

        void this.sceneManager.goto('sanctuary', {
            transition: TransitionType.SLIDE_LEFT,
            data: {
                relicPool: pool,
                onSelect: (index: number) => {
                    const relic = configToRelic(pool[index]);
                    addRelicWithUI(this, this.gameState, relic, () => {
                        this.advanceToNextNode();
                    });
                },
            },
        });
    }

    /**
     * Магазин — покупка предметов.
     */
    private handleShop(config: IBalanceConfig): void {
        const expedition = this.gameState.expeditionState as IPveExpeditionState;
        const rng = createRng(Date.now());

        // Скидка реликвии «Торговый талант»
        const discount = this.gameState.activeRelics.some(r => r.effect === 'shop_discount')
            ? (this.gameState.activeRelics.find(r => r.effect === 'shop_discount')?.value ?? 0)
            : 0;

        const shopItems = generateShopInventory(
            config.pve.shop,
            config.equipment.catalog,
            config.consumables,
            rng,
        );
        const discountedItems = shopItems.map(item => ({
            ...item,
            price: Math.round(item.price * (1 - discount)),
        }));

        // Магазин: только покупка. Ремонт — только в лагере (решение оператора).
        void this.sceneManager.goto('shop', {
            transition: TransitionType.SLIDE_LEFT,
            data: {
                shopItems: discountedItems,
                gold: this.gameState.resources.gold + expedition.goldGained,
                onBuy: (itemIndex: number): number => {
                    const item = discountedItems[itemIndex];
                    if (!item) return this.gameState.resources.gold + (this.gameState.expeditionState as IPveExpeditionState).goldGained;
                    const state = this.gameState.expeditionState as IPveExpeditionState;
                    const totalGold = this.gameState.resources.gold + state.goldGained;
                    if (totalGold < item.price) return totalGold;
                    const newGoldGained = state.goldGained - item.price;
                    this.gameState.updateExpeditionState({
                        ...state,
                        goldGained: newGoldGained,
                        itemsFound: [...state.itemsFound, item.itemId],
                    });
                    return this.gameState.resources.gold + newGoldGained;
                },
                onLeave: () => {
                    this.advanceToNextNode();
                },
            },
        });
    }

    /**
     * Лагерь — ремонт или тренировка.
     */
    private handleCamp(config: IBalanceConfig): void {
        void this.sceneManager.goto('camp', {
            transition: TransitionType.SLIDE_LEFT,
            data: {
                onRepair: (): string => {
                    // Ремонт прочности к первому повреждённому предмету (бесплатно)
                    const campRepairRelic = this.gameState.activeRelics.find(r => r.effect === 'camp_repair_bonus');
                    const repairBonus = config.pve.camp.repair_amount + (campRepairRelic?.value ?? 0);
                    const slots: Array<'weapon' | 'armor' | 'accessory'> = ['weapon', 'armor', 'accessory'];
                    for (const slot of slots) {
                        const item = this.gameState.equipment[slot];
                        if (item && item.currentDurability < item.maxDurability) {
                            const newDur = Math.min(item.currentDurability + repairBonus, item.maxDurability);
                            this.gameState.equipItem({ ...item, currentDurability: newDur });
                            return `${item.name}: прочность +${repairBonus}`;
                        }
                    }
                    return 'Всё снаряжение в порядке';
                },
                onTrain: (): string => {
                    // Тренировка — добавить массу
                    const expedition = this.gameState.expeditionState as IPveExpeditionState;
                    const rng = createRng(Date.now());
                    const massGain = randInt(rng, config.pve.camp.train_mass_min, config.pve.camp.train_mass_max);
                    const updated: IPveExpeditionState = { ...expedition, massGained: expedition.massGained + massGain };
                    this.gameState.updateExpeditionState(updated);
                    return `Масса +${massGain} кг`;
                },
                onContinue: () => {
                    this.advanceToNextNode();
                },
                trainMassMin: config.pve.camp.train_mass_min,
                trainMassMax: config.pve.camp.train_mass_max,
            },
        });
    }

    /**
     * Случайное событие — выбор варианта.
     */
    private handleEvent(config: IBalanceConfig, node: IPveNode): void {
        const eventConfig = config.events.find(e => e.id === node.eventId);
        if (!eventConfig) {
            this.advanceToNextNode();
            return;
        }

        const expedition = this.gameState.expeditionState as IPveExpeditionState;

        void this.sceneManager.goto('event', {
            transition: TransitionType.SLIDE_LEFT,
            data: {
                event: eventConfig,
                gold: this.gameState.resources.gold + expedition.goldGained,
                itemCount: expedition.itemsFound.length,
                onChoose: (variantIndex: number): string => {
                    const variant = eventConfig.variants[variantIndex];
                    let state = this.gameState.expeditionState as IPveExpeditionState;
                    const rng = createRng(Date.now());
                    const results: string[] = [];

                    // Проверка: вариант требует жертву предмета, а предметов нет
                    const requiresItem = variant.effects.some(e => e.type === 'lose_item');
                    if (requiresItem && state.itemsFound.length === 0) {
                        return 'Недостаточно предметов';
                    }

                    const isMerchantBuy = eventConfig.id === 'evt_merchant' && variant.id === 'buy';
                    // Резолв успеха через shared-функцию (ne5 + 03b)
                    const roll = isMerchantBuy ? -1 : rng(); // -1 < любой proc_chance → гарантия для торговца
                    const outcomeResults = resolveEventOutcome(variant, roll);

                    for (const { effect, success } of outcomeResults) {
                        switch (effect.type) {
                            case 'mass':
                                state = { ...state, massGained: state.massGained + effect.value };
                                results.push(`Масса ${effect.value > 0 ? '+' : ''}${effect.value} кг`);
                                break;
                            case 'gold':
                                state = { ...state, goldGained: state.goldGained + effect.value };
                                results.push(`Золото ${effect.value > 0 ? '+' : ''}${effect.value}`);
                                break;
                            case 'repair': {
                                const slots: Array<'weapon' | 'armor' | 'accessory'> = ['weapon', 'armor', 'accessory'];
                                for (const slot of slots) {
                                    const item = this.gameState.equipment[slot];
                                    if (item && item.currentDurability < item.maxDurability) {
                                        const newDur = Math.min(item.currentDurability + effect.value, item.maxDurability);
                                        this.gameState.equipItem({ ...item, currentDurability: newDur });
                                        results.push(`${item.name}: прочность +${effect.value}`);
                                        break;
                                    }
                                }
                                break;
                            }
                            case 'item': {
                                if (!success) { results.push('Неудача...'); break; }
                                if (isMerchantBuy) {
                                    const isTier2 = rng() < 0.2;
                                    if (isTier2) {
                                        const tier2Items = config.consumables.filter(c => c.tier === 2);
                                        if (tier2Items.length > 0) {
                                            const picked = tier2Items[Math.floor(rng() * tier2Items.length)];
                                            state = { ...state, itemsFound: [...state.itemsFound, picked.id] };
                                            results.push(`Получен предмет!`);
                                        }
                                    } else {
                                        const tier1Items = [
                                            ...config.equipment.catalog.filter(e => e.tier === 1),
                                            ...config.consumables.filter(c => c.tier === 1),
                                        ];
                                        if (tier1Items.length > 0) {
                                            const picked = tier1Items[Math.floor(rng() * tier1Items.length)];
                                            state = { ...state, itemsFound: [...state.itemsFound, picked.id] };
                                            results.push(`Получен предмет!`);
                                        }
                                    }
                                } else {
                                    const tier1Items = [
                                        ...config.equipment.catalog.filter(e => e.tier === 1),
                                        ...config.consumables.filter(c => c.tier === 1),
                                    ];
                                    if (tier1Items.length > 0) {
                                        const picked = tier1Items[Math.floor(rng() * tier1Items.length)];
                                        state = { ...state, itemsFound: [...state.itemsFound, picked.id] };
                                        results.push(`Получен предмет!`);
                                    }
                                }
                                break;
                            }
                            case 'loot_chest': {
                                if (success) {
                                    const loot = generateLoot('chest', config.pve.loot, config.equipment.catalog, config.consumables, state.pityCounter, rng);
                                    const ids = loot.drops.map(d => d.itemId);
                                    state = { ...state, itemsFound: [...state.itemsFound, ...ids], pityCounter: loot.newPityCounter };
                                    results.push(`Найден сундук! (+${ids.length} предм.)`);
                                } else {
                                    results.push('Неудача...');
                                }
                                break;
                            }
                            case 'lose_item': {
                                if (state.itemsFound.length > 0) {
                                    state = { ...state, itemsFound: state.itemsFound.slice(0, -1) };
                                    results.push('Потерян предмет');
                                }
                                break;
                            }
                        }
                    }
                    this.gameState.updateExpeditionState(state);
                    return results.length > 0 ? results.join('\n') : 'Ничего не произошло';
                },
                onContinue: () => {
                    this.advanceToNextNode();
                },
            },
        });
    }

    /**
     * Сундук / древний сундук — генерация лута.
     * Древний сундук: лут + выбор реликвии (1 из 2) по GDD.
     */
    private handleChest(config: IBalanceConfig, node: IPveNode): void {
        const expedition = this.gameState.expeditionState as IPveExpeditionState;
        const rng = createRng(Date.now());
        const lootResult = generateLoot(
            node.type,
            config.pve.loot,
            config.equipment.catalog,
            config.consumables,
            expedition.pityCounter,
            rng,
        );

        // Обновить pity-счётчик
        const updatedExpedition: IPveExpeditionState = { ...expedition, pityCounter: lootResult.newPityCounter };
        this.gameState.updateExpeditionState(updatedExpedition);

        const onTake = (drop: { itemId: string }) => {
            const state = this.gameState.expeditionState as IPveExpeditionState;
            this.gameState.updateExpeditionState({ ...state, itemsFound: [...state.itemsFound, drop.itemId] });
        };

        if (node.type === 'ancient_chest') {
            // Древний сундук: лут + реликвия (1 из 2)
            void this.sceneManager.goto('loot', {
                transition: TransitionType.SLIDE_LEFT,
                data: {
                    drops: lootResult.drops,
                    onTake,
                    onComplete: () => {
                        this.showRelicSelection(config, 2, 'ВЫБОР РЕЛИКВИИ');
                    },
                },
            });
        } else {
            // Обычный сундук: только лут
            void this.sceneManager.goto('loot', {
                transition: TransitionType.SLIDE_LEFT,
                data: {
                    drops: lootResult.drops,
                    onTake,
                    onComplete: () => {
                        this.advanceToNextNode();
                    },
                },
            });
        }
    }

    /**
     * Показать выбор реликвии из пула, после выбора — продвинуть.
     */
    private showRelicSelection(config: IBalanceConfig, count: number, title?: string): void {
        const activeRelics = [...this.gameState.activeRelics];
        const rng = createRng(Date.now());
        const pool = generateRelicPool(config.relics, activeRelics, count, rng);

        if (pool.length === 0) {
            this.advanceToNextNode();
            return;
        }

        void this.sceneManager.goto('sanctuary', {
            transition: TransitionType.SLIDE_LEFT,
            data: {
                relicPool: pool,
                title,
                onSelect: (index: number) => {
                    const relic = configToRelic(pool[index]);
                    addRelicWithUI(this, this.gameState, relic, () => {
                        this.advanceToNextNode();
                    });
                },
            },
        });
    }

    // ───────────────────────────── Навигация по маршруту ─────────────────

    /**
     * Продвинуться после завершения точки интереса.
     * enterNode установил currentNodeIndex на текущий узел через advanceToNode.
     * Здесь +1 чтобы перейти к следующей точке принятия решений.
     */
    private advanceToNextNode(): void {
        const expedition = this.gameState.expeditionState as IPveExpeditionState;
        const nextIndex = expedition.currentNodeIndex + 1;

        if (nextIndex >= expedition.route.totalNodes) {
            // Маршрут пройден — победа (некомбатный узел был последним перед боссом)
            const finalState: IPveExpeditionState = { ...expedition, status: 'victory' };
            this.gameState.updateExpeditionState(finalState);
            this.gameState.endExpedition();
            this.eventBus.emit(GameEvents.PVE_EXPEDITION_END, finalState);
            void this.sceneManager.goto('pveResult', {
                transition: TransitionType.FADE,
                data: {
                    status: 'victory',
                    massGained: finalState.massGained,
                    goldGained: finalState.goldGained,
                    itemsFound: finalState.itemsFound,
                    nodesVisited: finalState.visitedNodes.length,
                    totalNodes: finalState.route.totalNodes,
                    onContinue: () => {
                        void this.sceneManager.goto('hub', { transition: TransitionType.FADE });
                    },
                },
            });
            return;
        }

        const updated: IPveExpeditionState = { ...expedition, currentNodeIndex: nextIndex };
        this.gameState.updateExpeditionState(updated);
        void this.sceneManager.goto('pveMap', { transition: TransitionType.FADE });
    }

    onExit(): void {
        // Нет подписок на EventBus — отписка не требуется
    }
}
