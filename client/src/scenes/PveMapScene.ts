import { Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { GameState } from '../core/GameState';
import { EventBus, GameEvents } from '../core/EventBus';
import { SceneManager, TransitionType } from '../core/SceneManager';
import { THEME } from '../config/ThemeConfig';
import { Button } from '../ui/Button';
import { ResourceBar } from '../ui/ResourceBar';
import {
    advanceToNode, exitExpedition,
    generateRelicPool, configToRelic,
    generateLoot, generateShopInventory, calcShopRepairCost,
    createRng, randInt,
} from 'shared';
import type {
    IPveNode, PveNodeType, IPveExpeditionState,
    IBalanceConfig, IMobConfig,
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

        // --- Фон ---
        const bg = new Graphics();
        bg.rect(0, 0, W, H).fill(THEME.colors.bg_primary);
        this.addChild(bg);

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

        // --- Подзаголовок: текущий узел ---
        const subheading = new Text({
            text: `Узел ${currentNode.index + 1} / ${totalNodes} \u2014 ${display.name}`,
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

        // --- Ресурсы экспедиции ---
        const massBar = new ResourceBar({
            label: 'Масса',
            value: expedition.massGained,
        });
        massBar.position.set(16, 140);
        this.addChild(massBar);

        const goldBar = new ResourceBar({
            label: 'Gold',
            value: expedition.goldGained,
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

        // --- Иконка узла (большая) ---
        const nodeIcon = new Text({
            text: display.icon,
            style: new TextStyle({
                fontSize: 64,
                fontFamily: THEME.font.family,
            }),
        });
        nodeIcon.anchor.set(0.5, 0);
        nodeIcon.x = W / 2;
        nodeIcon.y = 220;
        this.addChild(nodeIcon);

        // --- Название узла ---
        const nodeName = new Text({
            text: display.name,
            style: new TextStyle({
                fontSize: THEME.font.sizes.subheading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
            }),
        });
        nodeName.anchor.set(0.5, 0);
        nodeName.x = W / 2;
        nodeName.y = 300;
        this.addChild(nodeName);

        // --- Развилка: кнопки выбора пути ---
        let actionY = 360;

        if (currentNode.isFork && currentNode.forkPaths && currentNode.forkPaths.length > 0) {
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

            for (const path of currentNode.forkPaths) {
                const pathDisplay = getNodeDisplay(path.nodeType);
                const pathLabel = path.hidden ? '???' : `${pathDisplay.icon} ${pathDisplay.name}`;
                const pathBtn = new Button({
                    text: pathLabel,
                    variant: 'secondary',
                    onClick: () => {
                        // Выбор пути: обновить следующий узел и продвинуться
                        this.handleForkChoice(path.nodeType, path.enemyId, path.eventId);
                    },
                });
                pathBtn.position.set(39 + THEME.layout.buttonWidth / 2, actionY);
                this.addChild(pathBtn);
                actionY += 70;
            }
        } else {
            // Нет развилки — кнопка входа в узел
            const isCombatNode = currentNode.type === 'combat' || currentNode.type === 'elite' || currentNode.type === 'boss';
            const enterLabel = isCombatNode ? 'ВСТУПИТЬ В БОЙ' : 'ВОЙТИ';
            const enterVariant = isCombatNode ? 'primary' : 'secondary';

            const enterBtn = new Button({
                text: enterLabel,
                variant: enterVariant,
                onClick: () => {
                    this.enterNode(currentNode);
                },
            });
            enterBtn.position.set(39 + THEME.layout.buttonWidth / 2, actionY);
            this.addChild(enterBtn);
            actionY += 80;
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
     * Обработка выбора пути на развилке.
     * Обновляет тип СЛЕДУЮЩЕГО узла по выбранному пути и продвигает к нему.
     */
    private handleForkChoice(nodeType: PveNodeType, enemyId?: string, eventId?: string): void {
        const expedition = this.gameState.expeditionState as IPveExpeditionState;
        const nextIndex = expedition.currentNodeIndex + 1;

        if (nextIndex >= expedition.route.totalNodes) return;

        // Обновить тип следующего узла по выбранному пути
        const updatedNodes = [...expedition.route.nodes];
        updatedNodes[nextIndex] = {
            ...updatedNodes[nextIndex],
            type: nodeType,
            enemyId,
            eventId,
            isFork: false,
            forkPaths: undefined,
        };

        const updatedRoute = { ...expedition.route, nodes: updatedNodes };
        const updatedState: IPveExpeditionState = { ...expedition, route: updatedRoute };
        this.gameState.updateExpeditionState(updatedState);

        // Продвинуться к выбранному узлу
        const advanced = advanceToNode(updatedState, nextIndex);
        this.gameState.updateExpeditionState(advanced);

        // Перезагрузить карту для нового узла
        void this.sceneManager.goto('pveMap', { transition: TransitionType.FADE });
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
                    this.gameState.addRelic(relic);
                    this.advanceToNextNode();
                },
            },
        });
    }

    /**
     * Магазин — покупка предметов и ремонт.
     */
    private handleShop(config: IBalanceConfig): void {
        const expedition = this.gameState.expeditionState as IPveExpeditionState;
        const rng = createRng(Date.now());
        const shopItems = generateShopInventory(
            config.pve.shop,
            config.equipment.catalog,
            config.consumables,
            rng,
        );
        const repairCost = calcShopRepairCost(50, config.pve.shop);

        void this.sceneManager.goto('shop', {
            transition: TransitionType.SLIDE_LEFT,
            data: {
                shopItems,
                gold: this.gameState.resources.gold + expedition.goldGained,
                repairCost,
                onBuy: (_itemIndex: number) => {
                    // Покупка предмета — будет реализована в следующем спринте
                },
                onRepair: () => {
                    // Ремонт снаряжения — будет реализован в следующем спринте
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
                onRepair: () => {
                    // Ремонт +1 прочность — будет реализован в следующем спринте
                    this.advanceToNextNode();
                },
                onTrain: () => {
                    // Тренировка — добавить массу
                    const expedition = this.gameState.expeditionState as IPveExpeditionState;
                    const rng = createRng(Date.now());
                    const massGain = randInt(rng, config.pve.camp.train_mass_min, config.pve.camp.train_mass_max);
                    const updated: IPveExpeditionState = { ...expedition, massGained: expedition.massGained + massGain };
                    this.gameState.updateExpeditionState(updated);
                    this.advanceToNextNode();
                },
                onLeave: () => {
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
                onChoose: (variantIndex: number) => {
                    // Применить эффекты варианта
                    const variant = eventConfig.variants[variantIndex];
                    let state = this.gameState.expeditionState as IPveExpeditionState;
                    for (const effect of variant.effects) {
                        if (effect.type === 'mass') {
                            state = { ...state, massGained: state.massGained + effect.value };
                        } else if (effect.type === 'gold') {
                            state = { ...state, goldGained: state.goldGained + effect.value };
                        }
                    }
                    this.gameState.updateExpeditionState(state);
                    this.advanceToNextNode();
                },
            },
        });
    }

    /**
     * Сундук / древний сундук — генерация лута.
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

        void this.sceneManager.goto('loot', {
            transition: TransitionType.SLIDE_LEFT,
            data: {
                drops: lootResult.drops,
                onComplete: () => {
                    this.advanceToNextNode();
                },
            },
        });
    }

    // ───────────────────────────── Навигация по маршруту ─────────────────

    /**
     * Продвинуться к следующему узлу маршрута.
     * Если узлы закончились — завершить экспедицию с победой через PveResultScene.
     */
    private advanceToNextNode(): void {
        const expedition = this.gameState.expeditionState as IPveExpeditionState;
        const nextIndex = expedition.currentNodeIndex + 1;

        if (nextIndex >= expedition.route.totalNodes) {
            // Маршрут пройден — победа
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

        // Продвигаем к следующему узлу
        const advanced = advanceToNode(expedition, nextIndex);
        this.gameState.updateExpeditionState(advanced);

        // Переход к свежей сцене карты
        void this.sceneManager.goto('pveMap', { transition: TransitionType.FADE });
    }

    onExit(): void {
        // Нет подписок на EventBus — отписка не требуется
    }
}
