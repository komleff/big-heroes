import { Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { GameState } from '../core/GameState';
import { EventBus, GameEvents } from '../core/EventBus';
import { SceneManager, TransitionType } from '../core/SceneManager';
import { THEME } from '../config/ThemeConfig';
import { Button } from '../ui/Button';
import { tweenProperty } from '../utils/Tween';
import type { IBattleResult, IHitAnimation, BattleOutcome, IMobConfig, IPveExpeditionState, IBalanceConfig, IRelic } from 'shared';
import { applyBattleResult, advanceToNode, generateRelicPool, configToRelic, generateLoot, createRng } from 'shared';
import balanceConfig from '@config/balance.json';

/** Данные, передаваемые в onEnter */
interface BattleSceneData {
    result: IBattleResult;
    enemy: IMobConfig;
}

/**
 * Простой HP-бар на Graphics (два цвета: зелёный/красный).
 * ProgressBar не поддерживает fillColor, поэтому рисуем вручную.
 */
class HpBar extends Container {
    private readonly track: Graphics;
    private readonly fill: Graphics;
    private readonly valueLabel: Text;
    private readonly barWidth: number;
    private readonly barHeight = 16;
    private readonly fillColor: number;
    private current: number;
    private max: number;

    constructor(width: number, max: number, current: number, fillColor: number) {
        super();
        this.barWidth = width;
        this.max = max;
        this.current = current;
        this.fillColor = fillColor;

        const r = THEME.layout.borderRadius.progressBar;

        // Фоновый трек
        this.track = new Graphics();
        this.track.roundRect(0, 0, this.barWidth, this.barHeight, r).fill(THEME.colors.progress_track);
        this.addChild(this.track);

        // Заливка
        this.fill = new Graphics();
        this.addChild(this.fill);

        // Текст по центру
        this.valueLabel = new Text({
            text: `${this.current} / ${this.max}`,
            style: new TextStyle({
                fontSize: THEME.font.sizes.progressText,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
            }),
        });
        this.valueLabel.anchor.set(0.5);
        this.valueLabel.x = this.barWidth / 2;
        this.valueLabel.y = this.barHeight / 2;
        this.addChild(this.valueLabel);

        this.drawFill();
    }

    /** Обновить текущее значение */
    update(current: number, max?: number): void {
        this.current = Math.max(0, current);
        if (max !== undefined) this.max = max;
        this.drawFill();
        this.valueLabel.text = `${this.current} / ${this.max}`;
    }

    private drawFill(): void {
        const r = THEME.layout.borderRadius.progressBar;
        const ratio = this.max > 0 ? Math.min(Math.max(this.current / this.max, 0), 1) : 0;
        const fillWidth = this.barWidth * ratio;

        this.fill.clear();
        if (fillWidth > 0) {
            this.fill.roundRect(0, 0, fillWidth, this.barHeight, r).fill(this.fillColor);
        }
    }
}

// ─── Утилиты ─────────────────────────────────────────────────────────

/** Промис-обёртка для задержки */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * BattleScene — сцена автобоя.
 * Воспроизводит уже рассчитанный результат (IBattleResult) анимацией.
 */
export class BattleScene extends BaseScene {
    private readonly gameState: GameState;
    private readonly eventBus: EventBus;
    private readonly sceneManager: SceneManager;

    // Ссылки на элементы для анимации
    private heroAvatar!: Container;
    private enemyAvatar!: Container;
    private heroHpBar!: HpBar;
    private enemyHpBar!: HpBar;
    private logContainer!: Container;
    private logText!: Text;
    private logLines: string[] = [];

    // Текущие HP (анимируемые)
    private heroCurrentHp = 0;
    private heroMaxHp = 0;
    private enemyCurrentHp = 0;
    private enemyMaxHp = 0;

    // Данные боя
    private battleData!: BattleSceneData;

    constructor(gameState: GameState, eventBus: EventBus, sceneManager: SceneManager) {
        super();
        this.gameState = gameState;
        this.eventBus = eventBus;
        this.sceneManager = sceneManager;
    }

    onEnter(data?: unknown): void {
        this.battleData = data as BattleSceneData;
        const { result, enemy } = this.battleData;

        // Рассчитываем начальные HP: масса = HP
        this.heroMaxHp = this.gameState.hero.mass;
        this.heroCurrentHp = this.heroMaxHp;
        this.enemyMaxHp = enemy.mass;
        this.enemyCurrentHp = this.enemyMaxHp;

        this.buildLayout(result, enemy);

        // Запускаем анимацию боя
        void this.playBattle(result);
    }

    // ─── Построение лэйаута ─────────────────────────────────────

    private buildLayout(result: IBattleResult, enemy: IMobConfig): void {
        const W = THEME.layout.designWidth;
        const H = THEME.layout.designHeight;

        // --- Фон ---
        const bg = new Graphics();
        bg.rect(0, 0, W, H).fill(THEME.colors.bg_primary);
        this.addChild(bg);

        // --- Заголовок y=48 ---
        const heading = new Text({
            text: 'БОЙ',
            style: new TextStyle({
                fontSize: THEME.font.sizes.heading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
            }),
        });
        heading.anchor.set(0.5, 0);
        heading.position.set(W / 2, 48);
        this.addChild(heading);

        // Шанс победы — мелкий текст под заголовком
        const chanceText = new Text({
            text: `Шанс: ${Math.round(result.winChance * 100)}%`,
            style: new TextStyle({
                fontSize: THEME.font.sizes.small,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
            }),
        });
        chanceText.anchor.set(0.5, 0);
        chanceText.position.set(W / 2, 92);
        this.addChild(chanceText);

        // --- Аватары y=120 ---
        this.heroAvatar = this.buildAvatar(
            this.gameState.hero.mass.toString() + ' кг',
            'Герой',
            THEME.colors.accent_cyan,
        );
        this.heroAvatar.position.set(75, 120);
        this.addChild(this.heroAvatar);

        this.enemyAvatar = this.buildAvatar(
            enemy.mass.toString() + ' кг',
            enemy.name,
            THEME.colors.accent_red,
        );
        this.enemyAvatar.position.set(235, 120);
        this.addChild(this.enemyAvatar);

        // --- HP-бары y=340 ---
        // Герой HP (зелёный)
        this.heroHpBar = new HpBar(100, this.heroMaxHp, this.heroCurrentHp, THEME.colors.accent_green);
        this.heroHpBar.position.set(25, 340);
        this.addChild(this.heroHpBar);

        // Враг HP (красный)
        this.enemyHpBar = new HpBar(100, this.enemyMaxHp, this.enemyCurrentHp, THEME.colors.accent_red);
        this.enemyHpBar.position.set(265, 340);
        this.addChild(this.enemyHpBar);

        // --- Лог боя y=400 ---
        this.logContainer = new Container();
        this.logContainer.position.set(16, 400);
        this.addChild(this.logContainer);

        const logBg = new Graphics();
        logBg.roundRect(0, 0, W - 32, 290, 12).fill({ color: 0x000000, alpha: 0.3 });
        this.logContainer.addChild(logBg);

        this.logText = new Text({
            text: '',
            style: new TextStyle({
                fontSize: 10,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_primary,
                wordWrap: true,
                wordWrapWidth: W - 32 - 20,
            }),
        });
        this.logText.position.set(10, 8);
        this.logContainer.addChild(this.logText);
    }

    /**
     * Строит аватар-карточку (80×100, с обводкой, именем и массой).
     */
    private buildAvatar(massLabel: string, name: string, borderColor: number): Container {
        const container = new Container();
        const w = 80;
        const h = 100;
        const r = 16;

        // Обводка
        const border = new Graphics();
        border.roundRect(-2, -2, w + 4, h + 4, r).fill(borderColor);
        container.addChild(border);

        // Фон
        const bg = new Graphics();
        bg.roundRect(0, 0, w, h, r).fill(THEME.colors.bg_secondary);
        container.addChild(bg);

        // Имя (над аватаром)
        const nameText = new Text({
            text: name,
            style: new TextStyle({
                fontSize: 11,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
            }),
        });
        nameText.anchor.set(0.5, 0);
        nameText.position.set(w / 2, h + 8);
        container.addChild(nameText);

        // Масса
        const massText = new Text({
            text: massLabel,
            style: new TextStyle({
                fontSize: 18,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.accent_cyan,
            }),
        });
        massText.anchor.set(0.5, 0.5);
        massText.position.set(w / 2, h / 2);
        container.addChild(massText);

        return container;
    }

    // ─── Анимация боя ───────────────────────────────────────────

    /**
     * Последовательно воспроизводит удары и результат боя.
     */
    private async playBattle(result: IBattleResult): Promise<void> {
        const ticker = this.getTicker();

        // Стартовая задержка
        await delay(300);

        // Воспроизведение ударов
        for (let i = 0; i < result.hits.length; i++) {
            const hit = result.hits[i];
            await this.playHit(hit, ticker);

            // Задержка между ударами (кроме последнего)
            if (i < result.hits.length - 1) {
                await delay(600);
            }
        }

        // Задержка перед финалом
        await delay(500);

        // Финальный результат
        await this.showOutcome(result, ticker);
    }

    /**
     * Анимация одного удара.
     */
    private async playHit(hit: IHitAnimation, ticker: Ticker): Promise<void> {
        const isHeroAttacker = hit.attacker === 'hero';
        const targetAvatar = isHeroAttacker ? this.enemyAvatar : this.heroAvatar;

        // 1. Тряска аватара цели
        await this.shakeAvatar(targetAvatar, ticker);

        // 2. Всплывающий урон
        void this.showDamagePopup(hit, targetAvatar, ticker);

        // 3. Обновить HP
        if (isHeroAttacker) {
            this.enemyCurrentHp = Math.max(0, this.enemyCurrentHp - hit.damage);
            this.enemyHpBar.update(this.enemyCurrentHp);
        } else {
            this.heroCurrentHp = Math.max(0, this.heroCurrentHp - hit.damage);
            this.heroHpBar.update(this.heroCurrentHp);
        }

        // 4. Запись в лог
        const attackerName = isHeroAttacker ? 'Герой' : 'Враг';
        let logEntry = `${attackerName}: −${hit.damage}`;
        if (hit.isCritical) logEntry += ' МОЩНЫЙ!';
        else if (hit.isStrong) logEntry += ' (усил.)';
        this.addLogLine(logEntry);

        // Эмит события удара
        this.eventBus.emit(GameEvents.BATTLE_ANIMATION_HIT, hit);
    }

    /**
     * Тряска аватара (±shakeOffset px, shakeMs × shakeCount).
     */
    private async shakeAvatar(avatar: Container, ticker: Ticker): Promise<void> {
        const offset = THEME.animation.shakeOffset;
        const ms = THEME.animation.shakeMs;
        const count = THEME.animation.shakeCount;
        const origX = avatar.x;

        for (let i = 0; i < count; i++) {
            // Вправо
            await tweenProperty(
                avatar as unknown as Record<string, number>,
                'x', origX, origX + offset, ms / 2, ticker,
            );
            // Влево
            await tweenProperty(
                avatar as unknown as Record<string, number>,
                'x', origX + offset, origX - offset, ms, ticker,
            );
            // Обратно
            await tweenProperty(
                avatar as unknown as Record<string, number>,
                'x', origX - offset, origX, ms / 2, ticker,
            );
        }
    }

    /**
     * Всплывающее число урона над целью.
     */
    private async showDamagePopup(hit: IHitAnimation, targetAvatar: Container, ticker: Ticker): Promise<void> {
        // Определяем стиль в зависимости от типа удара
        let color: number;
        let fontSize: number;
        let prefix = '';

        if (hit.isCritical) {
            color = THEME.colors.accent_red;
            fontSize = 24;
            prefix = 'МОЩНЫЙ! ';
        } else if (hit.isStrong) {
            color = THEME.colors.accent_yellow;
            fontSize = 18;
        } else {
            color = THEME.colors.text_primary;
            fontSize = 16;
        }

        const popup = new Text({
            text: `${prefix}-${hit.damage}`,
            style: new TextStyle({
                fontSize,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: color,
                dropShadow: {
                    distance: 1,
                    alpha: 0.5,
                },
            }),
        });
        popup.anchor.set(0.5);
        popup.position.set(targetAvatar.x + 40, targetAvatar.y - 10);
        this.addChild(popup);

        // Анимация: подъём вверх + исчезновение
        const startY = popup.y;
        await Promise.all([
            tweenProperty(
                popup as unknown as Record<string, number>,
                'y', startY, startY - 40, 800, ticker,
            ),
            tweenProperty(
                popup as unknown as Record<string, number>,
                'alpha', 1, 0, 800, ticker,
            ),
        ]);

        // Удалить после анимации
        this.removeChild(popup);
        popup.destroy();
    }

    /**
     * Показ результата боя (исход, награды, кнопка «Продолжить»).
     */
    private async showOutcome(result: IBattleResult, ticker: Ticker): Promise<void> {
        const W = THEME.layout.designWidth;
        const H = THEME.layout.designHeight;

        // --- Анимация проигравшего / победителя ---
        if (result.outcome === 'defeat') {
            // Герой «падает»
            await Promise.all([
                tweenProperty(
                    this.heroAvatar.scale as unknown as Record<string, number>,
                    'y', 1, 0.6, 400, ticker,
                ),
                tweenProperty(
                    this.heroAvatar as unknown as Record<string, number>,
                    'y', this.heroAvatar.y, this.heroAvatar.y + 20, 400, ticker,
                ),
                tweenProperty(
                    this.heroAvatar as unknown as Record<string, number>,
                    'alpha', 1, 0.4, 400, ticker,
                ),
            ]);
        } else if (result.outcome === 'victory') {
            // Враг «падает»
            await Promise.all([
                tweenProperty(
                    this.enemyAvatar.scale as unknown as Record<string, number>,
                    'y', 1, 0.6, 400, ticker,
                ),
                tweenProperty(
                    this.enemyAvatar as unknown as Record<string, number>,
                    'y', this.enemyAvatar.y, this.enemyAvatar.y + 20, 400, ticker,
                ),
                tweenProperty(
                    this.enemyAvatar as unknown as Record<string, number>,
                    'alpha', 1, 0.4, 400, ticker,
                ),
            ]);

            // Герой — glow (обводка жёлтая)
            const glow = new Graphics();
            glow.roundRect(-3, -3, 86, 106, 16).stroke({ color: THEME.colors.accent_yellow, width: 3 });
            this.heroAvatar.addChild(glow);
        }

        // --- Overlay ---
        const overlay = new Graphics();
        overlay.rect(0, 0, W, H).fill({ color: 0x000000 });
        overlay.alpha = 0;
        this.addChild(overlay);

        await tweenProperty(
            overlay as unknown as Record<string, number>,
            'alpha', 0, 0.6, 500, ticker,
        );

        // --- Баннер результата ---
        const bannerContainer = new Container();
        bannerContainer.position.set(W / 2, H / 2 - 60);
        this.addChild(bannerContainer);

        const bannerConfig = this.getBannerConfig(result.outcome);

        const bannerText = new Text({
            text: bannerConfig.text,
            style: new TextStyle({
                fontSize: bannerConfig.fontSize,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: bannerConfig.color,
                dropShadow: bannerConfig.shadow
                    ? { distance: 2, alpha: 0.5 }
                    : undefined,
            }),
        });
        bannerText.anchor.set(0.5);
        bannerContainer.addChild(bannerText);

        // Bounce-анимация для победы (scale 0→1 по обеим осям одновременно)
        if (result.outcome === 'victory') {
            bannerContainer.scale.set(0);
            await Promise.all([
                tweenProperty(
                    bannerContainer.scale as unknown as Record<string, number>,
                    'x', 0, 1, THEME.animation.bounceMs, ticker,
                ),
                tweenProperty(
                    bannerContainer.scale as unknown as Record<string, number>,
                    'y', 0, 1, THEME.animation.bounceMs, ticker,
                ),
            ]);
        }

        // --- Награды (если victory) ---
        let rewardOffset = 40;
        if (result.outcome === 'victory') {
            if (result.massReward > 0) {
                const massReward = new Text({
                    text: `+${result.massReward} кг массы`,
                    style: new TextStyle({
                        fontSize: THEME.font.sizes.subheading,
                        fontFamily: THEME.font.family,
                        fontWeight: THEME.font.weights.bold,
                        fill: THEME.colors.accent_cyan,
                    }),
                });
                massReward.anchor.set(0.5);
                massReward.position.set(0, rewardOffset);
                bannerContainer.addChild(massReward);
                rewardOffset += 30;
            }

            if (result.goldReward > 0) {
                const goldReward = new Text({
                    text: `+${result.goldReward} Gold`,
                    style: new TextStyle({
                        fontSize: THEME.font.sizes.subheading,
                        fontFamily: THEME.font.family,
                        fontWeight: THEME.font.weights.bold,
                        fill: THEME.colors.accent_yellow,
                    }),
                });
                goldReward.anchor.set(0.5);
                goldReward.position.set(0, rewardOffset);
                bannerContainer.addChild(goldReward);
                rewardOffset += 30;
            }
        }

        // --- Кнопка «Продолжить» y=720 ---
        const continueBtn = new Button({
            text: 'Продолжить',
            variant: 'primary',
            width: 280,
            height: 56,
            onClick: () => this.onContinue(),
        });
        continueBtn.position.set(W / 2, 720);
        continueBtn.alpha = 0;
        this.addChild(continueBtn);

        // Fade-in кнопки
        await tweenProperty(
            continueBtn as unknown as Record<string, number>,
            'alpha', 0, 1, THEME.animation.fadeMs, ticker,
        );
    }

    /**
     * Конфигурация баннера исхода.
     */
    private getBannerConfig(outcome: BattleOutcome): {
        text: string;
        color: number;
        fontSize: number;
        shadow: boolean;
    } {
        switch (outcome) {
            case 'victory':
                return { text: 'ПОБЕДА!', color: THEME.colors.accent_yellow, fontSize: 32, shadow: true };
            case 'defeat':
                return { text: 'ПОРАЖЕНИЕ', color: THEME.colors.accent_red, fontSize: 32, shadow: true };
            case 'retreat':
                return { text: 'ОТСТУПЛЕНИЕ', color: THEME.colors.text_secondary, fontSize: 28, shadow: false };
            case 'bypass':
                return { text: 'ОБХОД!', color: THEME.colors.accent_green, fontSize: 28, shadow: false };
            case 'polymorph':
                return { text: 'ПОЛИМОРФ!', color: THEME.colors.accent_magenta, fontSize: 28, shadow: false };
        }
    }

    /**
     * Обработка нажатия «Продолжить» — применить результаты к GameState.
     */
    private onContinue(): void {
        const { result } = this.battleData;

        if (this.gameState.expeditionState) {
            // В экспедиции: обновить состояние экспедиции
            let newState = applyBattleResult(
                this.gameState.expeditionState as IPveExpeditionState,
                result,
                [...this.gameState.activeRelics],
            );
            this.gameState.updateExpeditionState(newState);

            // Износ экипировки
            if (result.durabilityTarget) {
                this.gameState.wearItem(result.durabilityTarget);
            }

            this.eventBus.emit(GameEvents.BATTLE_RESULT, result);

            if (newState.status === 'defeat') {
                // Поражение → итоги экспедиции
                this.gameState.endExpedition();
                void this.sceneManager.goto('pveResult', {
                    transition: TransitionType.FADE,
                    data: {
                        status: 'defeat',
                        massGained: newState.massGained,
                        goldGained: newState.goldGained,
                        itemsFound: newState.itemsFound,
                        nodesVisited: newState.visitedNodes.length,
                        totalNodes: newState.route.totalNodes,
                        onContinue: () => {
                            void this.sceneManager.goto('hub', { transition: TransitionType.FADE });
                        },
                    },
                });
            } else if (result.outcome === 'retreat') {
                // Отступление — найти ближайший перекрёсток (fork) перед текущим узлом (GDD: назад на перекрёсток)
                let retreatIndex = newState.currentNodeIndex; // по умолчанию остаёмся (можно повторить бой)
                for (let i = newState.currentNodeIndex - 1; i >= 0; i--) {
                    if (newState.route.nodes[i].isFork) {
                        retreatIndex = i;
                        break;
                    }
                }
                const retreated = advanceToNode(newState, retreatIndex);
                this.gameState.updateExpeditionState(retreated);
                void this.sceneManager.goto('pveMap', { transition: TransitionType.FADE });
            } else {
                // Победа/bypass/polymorph → генерация лута + продвижение
                const currentNode = newState.route.nodes[newState.currentNodeIndex];
                const config = balanceConfig as unknown as IBalanceConfig;

                if (result.outcome === 'victory') {
                    const rng = createRng(Date.now());

                    // Генерация лута для ВСЕХ боевых узлов (combat/elite/boss)
                    const loot = generateLoot(
                        currentNode.type, config.pve.loot,
                        config.equipment.catalog, config.consumables,
                        newState.pityCounter, rng,
                    );
                    if (loot.drops.length > 0) {
                        const items = loot.drops.map(d => d.itemId);
                        newState = {
                            ...newState,
                            itemsFound: [...newState.itemsFound, ...items],
                            pityCounter: loot.newPityCounter,
                        };
                        this.gameState.updateExpeditionState(newState);
                    }

                    // Элита: шанс реликвии (elite_relic_chance)
                    if (currentNode.type === 'elite') {
                        if (rng() < config.pve.loot.elite_relic_chance) {
                            const pool = generateRelicPool(config.relics, [...this.gameState.activeRelics], 1, rng);
                            if (pool.length > 0) {
                                this.gameState.addRelic(configToRelic(pool[0]));
                            }
                        }
                    }

                    // Босс: гарантированная реликвия (сохраняется для extraction)
                    if (currentNode.type === 'boss') {
                        const relicPool = generateRelicPool(config.relics, [...this.gameState.activeRelics], 1, rng);
                        if (relicPool.length > 0) {
                            this.gameState.addRelic(configToRelic(relicPool[0]));
                        }
                    }
                }

                const nextIndex = newState.currentNodeIndex + 1;
                if (nextIndex >= newState.route.totalNodes) {
                    // Маршрут пройден — победа
                    const finalState: IPveExpeditionState = { ...newState, status: 'victory' as const };
                    this.gameState.updateExpeditionState(finalState);
                    // НЕ вызываем endExpedition сразу — PveResultScene покажет extraction экран
                    const relicsForExtraction = [...this.gameState.activeRelics];
                    void this.sceneManager.goto('pveResult', {
                        transition: TransitionType.FADE,
                        data: {
                            status: 'victory',
                            massGained: finalState.massGained,
                            goldGained: finalState.goldGained,
                            itemsFound: finalState.itemsFound,
                            nodesVisited: finalState.visitedNodes.length,
                            totalNodes: finalState.route.totalNodes,
                            relicsForExtraction,
                            onSaveRelic: (relic: IRelic) => {
                                this.gameState.saveArenaRelic(relic);
                            },
                            onContinue: () => {
                                this.gameState.endExpedition();
                                void this.sceneManager.goto('hub', { transition: TransitionType.FADE });
                            },
                        },
                    });
                } else {
                    // Продвигаем к следующему узлу
                    const advanced = advanceToNode(newState, nextIndex);
                    this.gameState.updateExpeditionState(advanced);
                    void this.sceneManager.goto('pveMap', { transition: TransitionType.FADE });
                }
            }
        } else {
            // Вне экспедиции: старое поведение
            if (result.outcome === 'victory') {
                this.gameState.setMass(this.gameState.hero.mass + result.massReward);
                this.gameState.setGold(this.gameState.resources.gold + result.goldReward);
            }

            // Износ экипировки
            if (result.durabilityTarget) {
                this.gameState.wearItem(result.durabilityTarget);
            }

            // Эмит события результата боя
            this.eventBus.emit(GameEvents.BATTLE_RESULT, result);

            // Переход в хаб
            void this.sceneManager.goto('hub', { transition: TransitionType.FADE });
        }
    }

    /**
     * Добавить строку в лог боя.
     */
    private addLogLine(line: string): void {
        this.logLines.push(line);
        // Ограничиваем видимые строки (≤ 20)
        if (this.logLines.length > 20) {
            this.logLines.shift();
        }
        this.logText.text = this.logLines.join('\n');
    }

    /**
     * Получить Ticker из приложения.
     * BaseScene — это Container; ищем ticker через parent stage → app.
     * Если не найден — создаём системный.
     */
    private getTicker(): Ticker {
        // PixiJS v8: Ticker.shared — глобальный системный тикер
        return Ticker.shared;
    }

    onExit(): void {
        // Очистка не требует отписки — сцена уничтожается целиком
    }
}
