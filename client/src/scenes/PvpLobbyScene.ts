import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { GameState } from '../core/GameState';
import { EventBus } from '../core/EventBus';
import { SceneManager, TransitionType } from '../core/SceneManager';
import { Button } from '../ui/Button';
import { THEME } from '../config/ThemeConfig';
import type { IMobConfig, IBalanceConfig, IPvpBot } from 'shared';
import { generateBots } from 'shared';
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
    private readonly eventBus: EventBus;

    constructor(sceneManager: SceneManager, gameState: GameState, eventBus: EventBus) {
        super();
        this.sceneManager = sceneManager;
        this.gameState = gameState;
        this.eventBus = eventBus;
    }

    onEnter(): void {
        // Фон на весь экран
        const bg = new Graphics();
        bg.rect(0, 0, W, THEME.layout.designHeight);
        bg.fill(THEME.colors.bg_primary);
        this.addChild(bg);

        // Заголовок
        const heading = new Text({
            text: 'АРЕНА',
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

        let nextY = 100;

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

        // --- AI-боты из shared ---
        const config = balanceConfig as unknown as IBalanceConfig;
        const bots = generateBots(this.gameState.hero.mass, this.gameState.hero.rating, config.pvp);

        for (let i = 0; i < bots.length; i++) {
            const bot = bots[i];
            const card = new Container();
            card.position.set(16, nextY);
            card.eventMode = 'static';
            card.cursor = 'pointer';

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

        // --- Кнопка «Назад в хаб» ---
        const backBtn = new Button({
            text: '← НАЗАД В ХАБ',
            variant: 'danger',
            onClick: () => {
                void this.sceneManager.back({ transition: TransitionType.SLIDE_RIGHT });
            },
        });
        backBtn.x = W / 2;
        backBtn.y = nextY + 16;
        this.addChild(backBtn);
    }
}
