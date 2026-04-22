import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { GameState } from '../core/GameState';
import { SceneManager, TransitionType } from '../core/SceneManager';
import { Button } from '../ui/Button';
import { THEME } from '../config/ThemeConfig';
import type { IMobConfig, IBalanceConfig, IEquipmentSlots, IRelic, IArenaSession, ArenaSessionEndReason } from 'shared';
import { generateBots, calcHeroStats, shouldEndSession } from 'shared';
import balanceConfig from '@config/balance.json';

/** Ширина дизайна */
const W = THEME.layout.designWidth;

/**
 * PvP Lobby — выбор противника для арены.
 * Показывает arenaRelic (если есть), 3 AI-бота, кнопку «Сразиться».
 */
export class PvpLobbyScene extends BaseScene {
    private readonly sceneManager: SceneManager;
    private readonly gameState: GameState;

    constructor(sceneManager: SceneManager, gameState: GameState) {
        super();
        this.sceneManager = sceneManager;
        this.gameState = gameState;
    }

    onEnter(): void {
        // Фон на весь экран
        const bg = new Graphics();
        bg.rect(0, 0, W, THEME.layout.designHeight);
        bg.fill(THEME.colors.bg_primary);
        this.addChild(bg);

        const config = balanceConfig as unknown as IBalanceConfig;
        const session = this.gameState.arenaSession as IArenaSession | null;

        // Предварительная проверка — сессия могла быть завершена ранее
        // (например, shouldEndSession.ended=true уже на входе из-за износа экипировки).
        // В этом случае сразу блокируем выбор боя и показываем оверлей.
        const preCheck = session
            ? shouldEndSession(
                this.gameState.hero, this.gameState.equipment as IEquipmentSlots,
                session, config.pvp.session,
            )
            : { ended: false, reason: null as ArenaSessionEndReason };

        // Заголовок: «Бой N / max» при активной сессии, иначе «АРЕНА»
        const headingText = session && !preCheck.ended
            ? `Бой ${session.battlesPlayed + 1} / ${config.pvp.session.max_battles}`
            : 'АРЕНА';
        const heading = new Text({
            text: headingText,
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

        let nextY = 74;

        // Индикаторы сессии — только при активной несущей сессии.
        // preCheck.ended: если уже завершена — не показываем pill'ы, сразу оверлей.
        if (session && !preCheck.ended) {
            this.buildSessionPills(session, nextY);
            nextY += 44;
        }

        nextY += 16;

        // --- Параметры героя ---
        const equipment = this.gameState.equipment as IEquipmentSlots;
        const relics = [...this.gameState.activeRelics] as IRelic[];
        const arenaRel = this.gameState.arenaRelic;
        if (arenaRel) relics.push(arenaRel as IRelic);
        const heroStats = calcHeroStats(this.gameState.hero.mass, equipment, relics);
        const heroInfo = new Text({
            text: `Ваш герой:  Масса ${this.gameState.hero.mass} кг  |  Сила ${heroStats.strength}  |  Броня ${heroStats.armor}  |  Удача ${heroStats.luck}  |  Рейтинг ${this.gameState.hero.rating}`,
            style: new TextStyle({
                fontSize: 11,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.accent_cyan,
                wordWrap: true,
                wordWrapWidth: W - 32,
            }),
        });
        heroInfo.position.set(16, nextY);
        this.addChild(heroInfo);
        nextY += 36;

        // --- Arena Relic карточка ---
        const arenaRelic = this.gameState.arenaRelic;
        if (arenaRelic) {
            const relicCard = new Container();
            relicCard.position.set(16, nextY);

            const relicBg = new Graphics();
            relicBg.roundRect(0, 0, W - 32, 50, 10).fill(THEME.colors.accent_green);
            relicCard.addChild(relicBg);

            const relicText = new Text({
                text: `🏆 ${arenaRelic.name} — активна`,
                style: new TextStyle({
                    fontSize: 14,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.bold,
                    fill: THEME.colors.text_primary,
                }),
            });
            relicText.position.set(12, 16);
            relicCard.addChild(relicText);

            this.addChild(relicCard);
            nextY += 64;
        } else {
            const noRelicText = new Text({
                text: 'Нет арена-реликвии',
                style: new TextStyle({
                    fontSize: 13,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.regular,
                    fill: THEME.colors.text_muted,
                }),
            });
            noRelicText.anchor.set(0.5, 0);
            noRelicText.x = W / 2;
            noRelicText.y = nextY;
            this.addChild(noRelicText);
            nextY += 30;
        }

        // --- Подзаголовок: противники ---
        const subheading = new Text({
            text: 'Выберите противника:',
            style: new TextStyle({
                fontSize: THEME.font.sizes.subheading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.text_secondary,
            }),
        });
        subheading.anchor.set(0.5, 0);
        subheading.x = W / 2;
        subheading.y = nextY;
        this.addChild(subheading);
        nextY += 36;

        // --- AI-боты из shared (config уже объявлен выше) ---
        const bots = generateBots(this.gameState.hero.mass, this.gameState.hero.rating, config.pvp);

        // При завершённой сессии карточки ботов блокируются (interactive=off, затемнение).
        const battlesDisabled = preCheck.ended;

        for (let i = 0; i < bots.length; i++) {
            const bot = bots[i];
            const card = new Container();
            card.position.set(16, nextY);
            card.eventMode = battlesDisabled ? 'none' : 'static';
            card.cursor = battlesDisabled ? 'default' : 'pointer';
            card.alpha = battlesDisabled ? 0.4 : 1;

            const cardBg = new Graphics();
            cardBg.roundRect(0, 0, W - 32, 80, 12).fill(THEME.colors.bg_secondary);
            card.addChild(cardBg);

            // Имя бота
            const nameText = new Text({
                text: bot.name,
                style: new TextStyle({
                    fontSize: 16,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.bold,
                    fill: THEME.colors.text_primary,
                }),
            });
            nameText.position.set(12, 10);
            card.addChild(nameText);

            // Статы бота
            const statsText = new Text({
                text: `Масса: ${bot.mass} кг  |  Сила: ${bot.strength}  |  Броня: ${bot.armor}`,
                style: new TextStyle({
                    fontSize: 12,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.regular,
                    fill: THEME.colors.text_muted,
                }),
            });
            statsText.position.set(12, 34);
            card.addChild(statsText);

            // Рейтинг бота
            const ratingText = new Text({
                text: `Рейтинг: ${bot.rating}`,
                style: new TextStyle({
                    fontSize: 12,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.regular,
                    fill: THEME.colors.accent_cyan,
                }),
            });
            ratingText.position.set(12, 54);
            card.addChild(ratingText);

            // Обработчик тапа: начать PvP-бой
            card.on('pointerdown', () => {
                // Формируем mob config для BattleScene
                const pvpMob: IMobConfig = {
                    id: `pvp_bot_${i}`,
                    name: bot.name,
                    type: 'combat',
                    mass: bot.mass,
                    strength: bot.strength,
                    armor: bot.armor,
                    massReward: 0,   // PvP: масса не даётся за победу
                    goldReward: 0,
                };
                void this.sceneManager.goto('preBattle', {
                    transition: TransitionType.FADE,
                    data: {
                        enemy: pvpMob,
                        isPvp: true,
                        pvpOpponentRating: bot.rating,
                    },
                });
            });

            this.addChild(card);
            nextY += 92;
        }

        // --- Нижние кнопки ---
        // Активная сессия → только «Завершить сессию» → оверлей с кнопкой «В Хаб» + clearArenaSession.
        //   Прямой выход в Hub без завершения сессии намеренно не предусмотрен (серия должна быть закрыта явно).
        // Нет сессии → «← Назад в Хаб» (обычный back-переход, сессии нет).
        // preCheck.ended → кнопок нет, только оверлей «Сессия завершена» (рисуется ниже).
        let btnY = nextY + 16;
        if (session && !preCheck.ended) {
            const endSessionBtn = new Button({
                text: 'ЗАВЕРШИТЬ СЕССИЮ',
                variant: 'danger',
                onClick: () => {
                    // Ручное завершение: shouldEndSession(manualEndRequested=true) → 'manual'.
                    // Результат фиксирует причину; очистка сессии и переход в Hub — в оверлее.
                    const manualCheck = shouldEndSession(
                        this.gameState.hero, this.gameState.equipment as IEquipmentSlots,
                        session, config.pvp.session, true,
                    );
                    this.showSessionEndedOverlay(manualCheck.reason);
                },
            });
            endSessionBtn.x = W / 2;
            endSessionBtn.y = btnY;
            this.addChild(endSessionBtn);
        } else if (!session) {
            const backBtn = new Button({
                text: '← НАЗАД В ХАБ',
                variant: 'danger',
                onClick: () => {
                    void this.sceneManager.back({ transition: TransitionType.SLIDE_RIGHT });
                },
            });
            backBtn.x = W / 2;
            backBtn.y = btnY;
            this.addChild(backBtn);
        }

        // Если сессия уже завершена (preCheck.ended=true) — показываем оверлей поверх.
        // Оверлей блокирует взаимодействие и предлагает только «В Хаб».
        if (session && preCheck.ended) {
            this.showSessionEndedOverlay(preCheck.reason);
        }
    }

    /**
     * Информационные pill'ы: потеря массы за сессию и дельта рейтинга (с знаком).
     * Рисуем вручную: два бейджа с цветным фоном.
     */
    private buildSessionPills(session: IArenaSession, y: number): void {
        const pillHeight = 28;
        const gap = 8;
        const padX = 10;

        // Потеря массы
        const massText = new Text({
            text: `Масса: −${session.totalMassLost} кг`,
            style: new TextStyle({
                fontSize: 12,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
            }),
        });

        // Дельта рейтинга (знак)
        const ratingSign = session.totalRatingDelta >= 0 ? '+' : '';
        const ratingText = new Text({
            text: `Рейтинг: ${ratingSign}${session.totalRatingDelta}`,
            style: new TextStyle({
                fontSize: 12,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
            }),
        });

        const massPillW = massText.width + padX * 2;
        const ratingPillW = ratingText.width + padX * 2;
        const totalW = massPillW + gap + ratingPillW;
        let x = (W - totalW) / 2;

        const massBg = new Graphics();
        massBg.roundRect(x, y, massPillW, pillHeight, 14)
            .fill(THEME.colors.accent_red);
        this.addChild(massBg);
        massText.anchor.set(0, 0.5);
        massText.position.set(x + padX, y + pillHeight / 2);
        this.addChild(massText);

        x += massPillW + gap;

        const ratingBgColor = session.totalRatingDelta >= 0
            ? THEME.colors.accent_green
            : THEME.colors.accent_red;
        const ratingBg = new Graphics();
        ratingBg.roundRect(x, y, ratingPillW, pillHeight, 14).fill(ratingBgColor);
        this.addChild(ratingBg);
        ratingText.anchor.set(0, 0.5);
        ratingText.position.set(x + padX, y + pillHeight / 2);
        this.addChild(ratingText);
    }

    /**
     * Оверлей «Сессия завершена» — блокирует лобби, показывает причину
     * и единственную кнопку «В Хаб» (очистка сессии).
     */
    private showSessionEndedOverlay(reason: ArenaSessionEndReason): void {
        const H = THEME.layout.designHeight;

        const overlay = new Container();
        const dim = new Graphics();
        dim.rect(0, 0, W, H).fill({ color: 0x000000 });
        dim.alpha = 0.85;
        dim.eventMode = 'static';
        overlay.addChild(dim);

        const title = new Text({
            text: 'СЕССИЯ ЗАВЕРШЕНА',
            style: new TextStyle({
                fontSize: 24,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.black,
                fill: THEME.colors.text_primary,
            }),
        });
        title.anchor.set(0.5);
        title.position.set(W / 2, H / 2 - 60);
        overlay.addChild(title);

        const reasonText = new Text({
            text: `Причина: ${this.formatEndReason(reason)}`,
            style: new TextStyle({
                fontSize: 14,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.text_muted,
                wordWrap: true,
                wordWrapWidth: W - 48,
                align: 'center',
            }),
        });
        reasonText.anchor.set(0.5);
        reasonText.position.set(W / 2, H / 2 - 10);
        overlay.addChild(reasonText);

        const homeBtn = new Button({
            text: 'В ХАБ',
            variant: 'primary',
            onClick: () => {
                // Сессия завершается (manual / ended=true / maxBattles) — атомарный end:
                // clearArenaSession + consumeArenaRelic. Без этого ручной end без боя
                // оставлял реликвию → эксплойт бесконечной реликвии.
                this.gameState.endArenaSession();
                void this.sceneManager.goto('hub', { transition: TransitionType.FADE });
            },
        });
        homeBtn.position.set(W / 2, H / 2 + 60);
        overlay.addChild(homeBtn);

        this.addChild(overlay);
    }

    /** Человекочитаемая причина завершения сессии. */
    private formatEndReason(reason: ArenaSessionEndReason): string {
        switch (reason) {
            case 'mass': return 'масса ниже порога';
            case 'durability': return 'экипировка изношена';
            case 'maxBattles': return 'лимит боёв достигнут';
            case 'manual': return 'завершение вручную';
            default: return 'причина не указана';
        }
    }
}
