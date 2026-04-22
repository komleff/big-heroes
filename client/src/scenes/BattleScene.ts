import { Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js';
import { createPveBackground } from '../ui/GradientBackground';
import { BaseScene } from './BaseScene';
import { GameState } from '../core/GameState';
import { EventBus, GameEvents } from '../core/EventBus';
import { SceneManager, TransitionType } from '../core/SceneManager';
import { THEME } from '../config/ThemeConfig';
import { Button } from '../ui/Button';
import { tweenProperty } from '../utils/Tween';
import { addRelicWithUI } from '../utils/relicHelper';
import { autoEquipIfBetter, autoPlaceConsumableOnBelt } from '../utils/autoEquip';
import type { IBattleResult, IHitAnimation, BattleOutcome, IMobConfig, IPveExpeditionState, IBalanceConfig, IRelic, IArenaSession, IEquipmentSlots } from 'shared';
import { applyBattleResult, advanceToNode, generateRelicPool, configToRelic, generateLoot, createRng, calcEloChange, calcPvpMassLoss, applyBattleToSession, shouldEndSession, calcArenaPoints, startSession } from 'shared';
import { ProgressBar } from '../ui/ProgressBar';
import balanceConfig from '@config/balance.json';

/** Данные, передаваемые в onEnter */
interface BattleSceneData {
    result: IBattleResult;
    enemy: IMobConfig;
    isPvp?: boolean;                // PvP-бой (арена)
    pvpOpponentRating?: number;     // Рейтинг противника для Elo
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

        // Рассчитываем начальные HP: масса = HP (base + набранная в походе)
        const expeditionMass = (this.gameState.expeditionState as IPveExpeditionState | null)?.massGained ?? 0;
        this.heroMaxHp = this.gameState.hero.mass + expeditionMass;
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

        // --- Фон (градиент PvE) ---
        this.addChild(createPveBackground(W, H));

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
            this.heroMaxHp.toString() + ' кг',
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

        // dolt-1em: для PvP terminal (victory/defeat) в АКТИВНОЙ сессии пропускаем
        // legacy banner с кнопкой «Продолжить». onContinue откроет информативный
        // overlay (showPvpDefeatOverlay / showPvpVictoryOverlay / showSessionSummaryOverlay)
        // на том же затемнении. Fallback single-PvP (без сессии) оставляет banner
        // с rewards — иначе победа уходила бы silent в Hub без фидбека (external
        // review Mode C F-3).
        // Guard также убирает added overlay перед onContinue, чтобы не копилось
        // два затемнения (alpha 0.6 + 0.85 createDimOverlay) — F-4.
        const isPvpTerminalInSession = this.battleData.isPvp
            && (result.outcome === 'victory' || result.outcome === 'defeat')
            && this.gameState.arenaSession?.active === true;
        if (isPvpTerminalInSession) {
            this.removeChild(overlay);
            overlay.destroy();
            this.onContinue();
            return;
        }

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
     * Затемняющий фон-оверлей на весь экран.
     * Блокирует клики по нижележащим элементам сцены.
     */
    private createDimOverlay(): Container {
        const W = THEME.layout.designWidth;
        const H = THEME.layout.designHeight;
        const overlay = new Container();
        const dimBg = new Graphics();
        dimBg.rect(0, 0, W, H);
        dimBg.fill({ color: 0x000000 });
        dimBg.alpha = 0.85;
        dimBg.eventMode = 'static';
        overlay.addChild(dimBg);
        return overlay;
    }

    /** Оверлей победы в PvP: «+N очков арены» и кнопка «Продолжить» в lobby */
    private showPvpVictoryOverlay(points: 1 | 2 | 3, onContinue: () => void): void {
        const W = THEME.layout.designWidth;
        const H = THEME.layout.designHeight;

        const overlay = this.createDimOverlay();

        const title = new Text({
            text: 'ПОБЕДА!',
            style: new TextStyle({
                fontSize: 36,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.black,
                fill: THEME.colors.accent_yellow,
            }),
        });
        title.anchor.set(0.5);
        title.position.set(W / 2, H / 2 - 80);
        overlay.addChild(title);

        const pointsText = new Text({
            text: `+${points} ${points === 1 ? 'очко' : 'очка'} арены`,
            style: new TextStyle({
                fontSize: 22,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.accent_cyan,
            }),
        });
        pointsText.anchor.set(0.5);
        pointsText.position.set(W / 2, H / 2 - 20);
        overlay.addChild(pointsText);

        const continueBtn = new Button({
            text: 'ПРОДОЛЖИТЬ',
            variant: 'primary',
            onClick: onContinue,
        });
        continueBtn.position.set(W / 2, H / 2 + 60);
        overlay.addChild(continueBtn);

        this.addChild(overlay);
    }

    /**
     * Оверлей завершения PvP-сессии (session-summary).
     * Показывает итоги серии: битв / масса / рейтинг + причину, кнопка «В Хаб».
     */
    private showSessionSummaryOverlay(
        session: IArenaSession, reason: string | null, lastWinPoints: 1 | 2 | 3 | null,
    ): void {
        const W = THEME.layout.designWidth;
        const H = THEME.layout.designHeight;

        const overlay = this.createDimOverlay();

        const title = new Text({
            text: 'СЕССИЯ АРЕНЫ ЗАВЕРШЕНА',
            style: new TextStyle({
                fontSize: 20,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.black,
                fill: THEME.colors.text_primary,
            }),
        });
        title.anchor.set(0.5);
        title.position.set(W / 2, H / 2 - 130);
        overlay.addChild(title);

        const reasonText = new Text({
            text: this.formatEndReason(reason),
            style: new TextStyle({
                fontSize: 13,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
                wordWrap: true,
                wordWrapWidth: W - 48,
                align: 'center',
            }),
        });
        reasonText.anchor.set(0.5, 0);
        reasonText.position.set(W / 2, H / 2 - 100);
        overlay.addChild(reasonText);

        const ratingSign = session.totalRatingDelta >= 0 ? '+' : '';
        const stats: string[] = [
            `Проведено боёв: ${session.battlesPlayed}`,
            `Потеряно массы: ${session.totalMassLost} кг`,
            `Рейтинг: ${ratingSign}${session.totalRatingDelta}`,
        ];
        if (lastWinPoints) {
            stats.push(`Очки за последний бой: +${lastWinPoints}`);
        }
        const statsText = new Text({
            text: stats.join('\n'),
            style: new TextStyle({
                fontSize: 16,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.text_primary,
                align: 'center',
            }),
        });
        statsText.anchor.set(0.5);
        statsText.position.set(W / 2, H / 2);
        overlay.addChild(statsText);

        const homeBtn = new Button({
            text: 'В ХАБ',
            variant: 'primary',
            onClick: () => {
                // Сессия завершается: чистим session + consume реликвии атомарно.
                this.gameState.endArenaSession();
                void this.sceneManager.goto('hub', { transition: TransitionType.FADE });
            },
        });
        homeBtn.position.set(W / 2, H / 2 + 100);
        overlay.addChild(homeBtn);

        this.addChild(overlay);
    }

    /**
     * Оверлей поражения PvP (T8 big-heroes-91e).
     * Улучшенная визуализация: иконка массы, крупный «−N кг», «было X → стало Y»,
     * прогресс-бар до min_mass_threshold. Если сессия завершилась (endSession=...) —
     * вместо перехода в lobby открывает session-summary. Иначе — возврат в lobby
     * (или Hub, если сессия отсутствует — fallback-ветка).
     *
     * @param sessionEnded переданная сессия (если завершена), иначе null.
     */
    private showPvpDefeatOverlay(
        massLoss: number, massBefore: number, consumedRelicName: string | null,
        sessionEnded: IArenaSession | null, endReason: string | null,
        minMassThreshold: number,
    ): void {
        const W = THEME.layout.designWidth;
        const H = THEME.layout.designHeight;

        const overlay = this.createDimOverlay();

        // Заголовок «ПОРАЖЕНИЕ»
        const title = new Text({
            text: 'ПОРАЖЕНИЕ',
            style: new TextStyle({
                fontSize: 32,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.black,
                fill: THEME.colors.accent_red,
            }),
        });
        title.anchor.set(0.5);
        title.position.set(W / 2, 150);
        overlay.addChild(title);

        // Иконка массы (эмодзи) + крупный «−N кг» красный
        const massIcon = new Text({
            text: '⚖️', // ⚖️
            style: new TextStyle({
                fontSize: 40,
                fontFamily: THEME.font.family,
            }),
        });
        massIcon.anchor.set(0.5);
        massIcon.position.set(W / 2 - 80, 230);
        overlay.addChild(massIcon);

        const massLossText = new Text({
            text: `−${massLoss} кг`,
            style: new TextStyle({
                fontSize: 36,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.black,
                fill: THEME.colors.accent_red,
            }),
        });
        massLossText.anchor.set(0, 0.5);
        massLossText.position.set(W / 2 - 50, 230);
        overlay.addChild(massLossText);

        // «было X → стало Y»
        const massAfter = Math.max(0, massBefore - massLoss);
        const beforeAfterText = new Text({
            text: `было ${massBefore} → стало ${massAfter}`,
            style: new TextStyle({
                fontSize: 16,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.text_secondary,
            }),
        });
        beforeAfterText.anchor.set(0.5);
        beforeAfterText.position.set(W / 2, 290);
        overlay.addChild(beforeAfterText);

        // Мини-прогресс-бар до min_mass_threshold (сколько ещё можно терять)
        // Когда массы ≤ threshold — бар пустой/почти пустой: ясно, что сессия на грани.
        const barLabel = new Text({
            text: `До выхода из арены (порог ${minMassThreshold} кг)`,
            style: new TextStyle({
                fontSize: 11,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
            }),
        });
        barLabel.anchor.set(0.5, 0);
        barLabel.position.set(W / 2, 330);
        overlay.addChild(barLabel);

        // Прогресс-бар показывает ЗАПАС массы над порогом — сколько ещё можно проиграть
        // до вылета из арены. max = сколько массы было над порогом в начале этого боя,
        // current = сколько осталось над порогом после боя. При massAfter ≤ threshold бар = 0.
        // Monotonically decreasing по ходу серии (если сессия проходит через один defeat за один вызов).
        const massReserveMax = Math.max(1, massBefore - minMassThreshold);
        const massReserveCurrent = Math.min(massReserveMax, Math.max(0, massAfter - minMassThreshold));
        const progress = new ProgressBar({
            width: W - 80,
            max: massReserveMax,
            current: massReserveCurrent,
        });
        progress.position.set(40, 350);
        overlay.addChild(progress);

        // Доп-строка «реликвия потеряна», если применимо
        let lineY = 390;
        if (consumedRelicName) {
            const relicLostText = new Text({
                text: `Реликвия «${consumedRelicName}» потеряна`,
                style: new TextStyle({
                    fontSize: 13,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.regular,
                    fill: THEME.colors.text_muted,
                    wordWrap: true,
                    wordWrapWidth: W - 48,
                    align: 'center',
                }),
            });
            relicLostText.anchor.set(0.5, 0);
            relicLostText.position.set(W / 2, lineY);
            overlay.addChild(relicLostText);
            lineY += 24;
        }

        // Кнопки: если сессия завершилась — только «В Хаб» (c очисткой сессии и показом summary)
        // Иначе — «Продолжить» (в lobby для следующего боя) и «В Хаб» (ручной выход, очистка сессии).
        if (sessionEnded) {
            // Показать причину завершения сразу под блоком
            const endReasonText = new Text({
                text: `Сессия завершена: ${this.formatEndReason(endReason)}`,
                style: new TextStyle({
                    fontSize: 13,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.bold,
                    fill: THEME.colors.accent_yellow,
                    wordWrap: true,
                    wordWrapWidth: W - 48,
                    align: 'center',
                }),
            });
            endReasonText.anchor.set(0.5, 0);
            endReasonText.position.set(W / 2, lineY + 10);
            overlay.addChild(endReasonText);

            const homeBtn = new Button({
                text: 'В ХАБ',
                variant: 'primary',
                onClick: () => {
                    // Сессия завершена (ended=true в вызове выше) — атомарный end.
                    this.gameState.endArenaSession();
                    void this.sceneManager.goto('hub', { transition: TransitionType.FADE });
                },
            });
            homeBtn.position.set(W / 2, H - 120);
            overlay.addChild(homeBtn);
        } else {
            // Сессия продолжается — «Продолжить» возвращает в lobby.
            // В fallback-ветке (без активной сессии) кнопка «Продолжить» отсутствует:
            // вместо неё сразу «В Хаб».
            const hasActiveSession = this.gameState.arenaSession?.active === true;
            if (hasActiveSession) {
                const continueBtn = new Button({
                    text: 'ПРОДОЛЖИТЬ',
                    variant: 'primary',
                    onClick: () => {
                        void this.sceneManager.goto('pvpLobby', { transition: TransitionType.FADE });
                    },
                });
                continueBtn.position.set(W / 2, H - 180);
                overlay.addChild(continueBtn);

                const endBtn = new Button({
                    text: 'В ХАБ',
                    variant: 'danger',
                    onClick: () => {
                        // Manual-exit из defeat-overlay в продолжающейся серии —
                        // игрок досрочно заканчивает серию. Инвариант «сессия end → реликвия потрачена».
                        this.gameState.endArenaSession();
                        void this.sceneManager.goto('hub', { transition: TransitionType.FADE });
                    },
                });
                endBtn.position.set(W / 2, H - 110);
                overlay.addChild(endBtn);
            } else {
                const homeBtn = new Button({
                    text: 'В ХАБ',
                    variant: 'primary',
                    onClick: () => {
                        void this.sceneManager.goto('hub', { transition: TransitionType.FADE });
                    },
                });
                homeBtn.position.set(W / 2, H - 120);
                overlay.addChild(homeBtn);
            }
        }

        this.addChild(overlay);
    }

    /** Человекочитаемая причина завершения сессии. */
    private formatEndReason(reason: string | null): string {
        switch (reason) {
            case 'mass': return 'масса ниже порога';
            case 'durability': return 'экипировка изношена';
            case 'maxBattles': return 'лимит боёв достигнут';
            case 'manual': return 'завершение вручную';
            default: return 'причина не указана';
        }
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
                this.eventBus.emit(GameEvents.PVE_EXPEDITION_END, newState);
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
                // Отступление — остаёмся на текущем узле (GDD: путь к врагу остаётся открытым).
                // Удаляем узел из visitedNodes → enterNode не пропустит его.
                // Очищаем forkPaths → ensureForkPaths сгенерирует новую развилку.
                const currentIdx = newState.currentNodeIndex;
                const filteredVisited = newState.visitedNodes.filter(idx => idx !== currentIdx);
                const updatedNodes = [...newState.route.nodes];
                updatedNodes[currentIdx] = {
                    ...updatedNodes[currentIdx],
                    isFork: false,
                    forkPaths: undefined,
                };
                const retreatState: IPveExpeditionState = {
                    ...newState,
                    visitedNodes: filteredVisited,
                    route: { ...newState.route, nodes: updatedNodes },
                };
                this.gameState.updateExpeditionState(retreatState);
                void this.sceneManager.goto('pveMap', { transition: TransitionType.FADE });
            } else {
                // Победа/bypass/polymorph → генерация лута + продвижение
                const currentNode = newState.route.nodes[newState.currentNodeIndex];
                const config = balanceConfig as unknown as IBalanceConfig;

                if (result.outcome === 'victory' || result.outcome === 'polymorph' || result.outcome === 'bypass') {
                    const rng = createRng(Date.now());

                    // Генерация лута (GDD: bypass = без лута, только продвижение)
                    if (result.outcome !== 'bypass' && currentNode.type !== 'boss') {
                        const loot = generateLoot(
                            currentNode.type, config.pve.loot,
                            config.equipment.catalog, config.consumables,
                            newState.pityCounter, rng,
                        );
                        if (loot.drops.length > 0) {
                            const items = loot.drops.map(d => d.itemId);
                            // e0o: сначала пробуем на пояс, fallback в рюкзак
                            const backpackIds: string[] = [];
                            for (const id of items) {
                                const placed = autoPlaceConsumableOnBelt(this.gameState, id, config.consumables);
                                if (!placed) backpackIds.push(id);
                            }
                            newState = {
                                ...newState,
                                itemsFound: [...newState.itemsFound, ...backpackIds],
                                pityCounter: loot.newPityCounter,
                            };
                            this.gameState.updateExpeditionState(newState);
                            // Авто-экипировать лут, оставшийся в рюкзаке
                            for (const id of backpackIds) {
                                autoEquipIfBetter(this.gameState, id, config.equipment.catalog);
                            }
                        }
                    }

                    // Босс: реликвия добавляется через addRelicWithUI ниже (с выбором замены при лимите)

                    // Переход к PveResultScene (победа босса) или PveMapScene (обычный бой)
                    const goToResult = (bossRelic?: IRelic, bossLootItems?: string[]): void => {
                        // Читаем актуальное состояние (может быть обновлено boss loot)
                        const currentExpState = this.gameState.expeditionState as IPveExpeditionState;
                        const finalState: IPveExpeditionState = { ...currentExpState, status: 'victory' as const };
                        this.gameState.updateExpeditionState(finalState);
                        this.eventBus.emit(GameEvents.PVE_EXPEDITION_END, finalState);
                        // extractionPool = все активные реликвии (включая boss relic, если добавлена)
                        const extractionPool = [...this.gameState.activeRelics] as IRelic[];
                        void this.sceneManager.goto('pveResult', {
                            transition: TransitionType.FADE,
                            data: {
                                status: 'victory',
                                massGained: finalState.massGained,
                                goldGained: finalState.goldGained,
                                itemsFound: finalState.itemsFound,
                                nodesVisited: finalState.visitedNodes.length,
                                totalNodes: finalState.route.totalNodes,
                                bossRelic,
                                bossLootItems,
                                extractionPool,
                                onSaveRelic: (relic: IRelic) => {
                                    this.gameState.saveArenaRelic(relic);
                                },
                                onContinue: () => {
                                    this.gameState.endExpedition();
                                    void this.sceneManager.goto('hub', { transition: TransitionType.FADE });
                                },
                                onGoArena: () => {
                                    this.gameState.endExpedition();
                                    // Инициализация арена-сессии перед входом в лобби из PveResult (второй путь входа),
                                    // иначе BattleScene уходит в fallback single-battle. Параллельно с HubScene-логикой.
                                    if (!this.gameState.arenaSession) {
                                        const session = startSession(this.gameState.hero, config.pvp.session);
                                        this.gameState.setArenaSession(session);
                                    }
                                    void this.sceneManager.goto('pvpLobby', { transition: TransitionType.FADE });
                                },
                            },
                        });
                    };

                    // Навигация после боя
                    const proceedAfterBattle = (): void => {
                        const nextIndex = newState.currentNodeIndex + 1;
                        if (nextIndex >= newState.route.totalNodes) {
                            // Маршрут пройден — boss victory
                            const currentNode2 = newState.route.nodes[newState.currentNodeIndex];
                            if (currentNode2.type === 'boss') {
                                // Boss: 1 random relic + 2 random items (u1z)
                                const bossRng = createRng(Date.now() + 1);
                                const bossRelicPool = generateRelicPool(config.relics, [...this.gameState.activeRelics], 1, bossRng);
                                // Boss loot: 2 random items (GDD: boss_loot_count)
                                const bossLoot = generateLoot('boss', config.pve.loot, config.equipment.catalog, config.consumables, newState.pityCounter, bossRng);
                                const bossLootItems = bossLoot.drops.slice(0, config.pve.loot.boss_loot_count).map(d => d.itemId);
                                // e0o: сначала пробуем на пояс, fallback в рюкзак
                                const bossBackpackIds: string[] = [];
                                for (const id of bossLootItems) {
                                    const placed = autoPlaceConsumableOnBelt(this.gameState, id, config.consumables);
                                    if (!placed) bossBackpackIds.push(id);
                                }
                                // Обновить itemsFound и pityCounter с boss loot (только то, что в рюкзаке)
                                const updatedState = {
                                    ...newState,
                                    itemsFound: [...newState.itemsFound, ...bossBackpackIds],
                                    pityCounter: bossLoot.newPityCounter,
                                };
                                this.gameState.updateExpeditionState(updatedState);
                                // Авто-экипировать boss loot (расходники на поясе уже размещены)
                                for (const id of bossBackpackIds) {
                                    autoEquipIfBetter(this.gameState, id, config.equipment.catalog);
                                }

                                if (bossRelicPool.length > 0) {
                                    const bossRelic = configToRelic(bossRelicPool[0]);
                                    // Добавляем boss relic через UI (с выбором замены если лимит)
                                    addRelicWithUI(this, this.gameState, bossRelic, () => {
                                        // Проверяем, добавил ли игрок реликвию (мог отказаться)
                                        const wasAdded = this.gameState.activeRelics.some(r => r.id === bossRelic.id);
                                        goToResult(wasAdded ? bossRelic : undefined, bossLootItems);
                                    });
                                    return;
                                }
                                goToResult(undefined, bossLootItems);
                            } else {
                                goToResult();
                            }
                        } else {
                            const updated: IPveExpeditionState = { ...newState, currentNodeIndex: nextIndex };
                            this.gameState.updateExpeditionState(updated);
                            void this.sceneManager.goto('pveMap', { transition: TransitionType.FADE });
                        }
                    };

                    // Элита: шанс реликвии (только при victory, не polymorph)
                    if (result.outcome === 'victory' && currentNode.type === 'elite') {
                        if (rng() < config.pve.loot.elite_relic_chance) {
                            const pool = generateRelicPool(config.relics, [...this.gameState.activeRelics], 1, rng);
                            if (pool.length > 0) {
                                const eliteRelic = configToRelic(pool[0]);
                                addRelicWithUI(this, this.gameState, eliteRelic, proceedAfterBattle);
                                return; // Ждём выбора игрока
                            }
                        }
                    }

                    proceedAfterBattle();
                }
            }
        } else if (this.battleData.isPvp) {
            // PvP-бой: обновить рейтинг по GDD
            const config = balanceConfig as unknown as IBalanceConfig;
            const opponentRating = this.battleData.pvpOpponentRating ?? this.gameState.hero.rating;

            // GDD: victory → +Elo, defeat → −Elo, retreat/bypass/polymorph → 0 Elo
            let eloChange = 0;
            if (result.outcome === 'victory' || result.outcome === 'defeat') {
                const eloResult: 0 | 1 = result.outcome === 'victory' ? 1 : 0;
                eloChange = calcEloChange(
                    this.gameState.hero.rating, opponentRating, eloResult, config.formulas.eloK,
                );
                this.gameState.setRating(this.gameState.hero.rating + eloChange);
            }
            // retreat/bypass/polymorph → 0 Elo change (GDD: бой не засчитан / 0 рейтинга)

            // Сохраняем имя реликвии ДО потребления (показываем в overlay только когда фактически consumed).
            const arenaRelicName = this.gameState.arenaRelic?.name ?? null;

            // Снимки масса/рейтинг ДО применения потерь — для defeat-оверлея «было → стало»
            const massBefore = this.gameState.hero.mass;

            // GDD: при поражении в PvP −N% массы. Только defeat!
            let massLoss = 0;
            if (result.outcome === 'defeat') {
                massLoss = calcPvpMassLoss(this.gameState.hero.mass, config.pvp.mass_loss_on_defeat);
                this.gameState.setMass(this.gameState.hero.mass - massLoss);
            }

            // Износ экипировки
            if (result.durabilityTarget) {
                this.gameState.wearItem(result.durabilityTarget);
            }

            // arenaRelic потребляется только когда серия реально завершается:
            // для активной сессии — при endCheck.ended, для fallback — на каждом terminal-исходе.
            // Consume перенесён внутрь веток ниже.

            this.eventBus.emit(GameEvents.BATTLE_RESULT, result);

            // ─── Сессия арены ──────────────────────────────────────────
            // Засчитываем бой в сессию только при заверш. исходах (victory/defeat).
            // retreat/bypass/polymorph не инкрементируют battlesPlayed (0 Elo, 0 масса).
            const session = this.gameState.arenaSession as IArenaSession | null;
            const isTerminal = result.outcome === 'victory' || result.outcome === 'defeat';
            if (session?.active && isTerminal) {
                // massDelta < 0 при defeat (потеря), 0 при victory
                const massDelta = result.outcome === 'defeat' ? -massLoss : 0;
                const updatedSession = applyBattleToSession(session, massDelta, eloChange);
                this.gameState.setArenaSession(updatedSession);

                // Проверяем завершение сессии после боя
                const endCheck = shouldEndSession(
                    this.gameState.hero, this.gameState.equipment as IEquipmentSlots,
                    updatedSession, config.pvp.session,
                );

                // Реликвия потребляется атомарно через endArenaSession в обработчиках
                // кнопок В ХАБ (summary / defeat-ended). Здесь только вычисляем имя для overlay.
                const consumedRelicName = endCheck.ended ? arenaRelicName : null;

                if (result.outcome === 'victory') {
                    // Очки арены за победу
                    const points = calcArenaPoints(eloChange, config.pvp.session.points_thresholds);
                    if (endCheck.ended) {
                        // Сессия завершена победой → сводка → Hub
                        this.showSessionSummaryOverlay(updatedSession, endCheck.reason, points);
                    } else {
                        // Серия продолжается → показать краткий victory-итог и вернуть в lobby
                        this.showPvpVictoryOverlay(points, () => {
                            void this.sceneManager.goto('pvpLobby', { transition: TransitionType.FADE });
                        });
                    }
                } else {
                    // Поражение.
                    if (endCheck.ended) {
                        // Сессия завершена поражением → полная сводка серии (битв, масса, рейтинг, причина).
                        // null очков: последний бой — поражение, очки начисляются только за victory.
                        this.showSessionSummaryOverlay(updatedSession, endCheck.reason, null);
                    } else {
                        // Серия продолжается → defeat-overlay с деталями последнего боя и возвратом в lobby.
                        // consumedRelicName=null: реликвия ещё активна, «потеряна» не показываем.
                        this.showPvpDefeatOverlay(
                            massLoss, massBefore, consumedRelicName,
                            null, null,
                            config.pvp.session.min_mass_threshold,
                        );
                    }
                }
                return;
            }

            // ─── Fallback: сессии нет (старый flow) ────────────────────
            // Совместимость со смоук-тестами и прямым вызовом PvP вне хаба.
            // Для одиночного PvP-боя реликвия потребляется на terminal-исходе (victory/defeat).
            if (isTerminal) {
                this.gameState.consumeArenaRelic();
            }
            if (result.outcome === 'defeat') {
                this.showPvpDefeatOverlay(
                    massLoss, massBefore, arenaRelicName, null, null,
                    config.pvp.session.min_mass_threshold,
                );
            } else {
                void this.sceneManager.goto('hub', { transition: TransitionType.FADE });
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
