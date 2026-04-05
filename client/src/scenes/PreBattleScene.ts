import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import type {
    IMobConfig, IBalanceConfig, IFormulaConfig, IConsumableConfig,
    IBattleContext, CommandId,
    IEquipmentSlots, IEquipmentItem,
} from 'shared';
import {
    calcHeroStats, calcDamage, calcTTK, calcBaseWinChance,
    calcAttackWinChance, calcBlockWinChance, calcFortuneChance,
    calcRetreatChance, calcBypassChance, calcPolymorphChance,
    resolveBattle,
} from 'shared';
import balanceConfig from '@config/balance.json';
import { BaseScene } from './BaseScene';
import { SceneManager, TransitionType } from '../core/SceneManager';
import { GameState } from '../core/GameState';
import { EventBus } from '../core/EventBus';
import { Button } from '../ui/Button';
import { DurabilityPips } from '../ui/DurabilityPips';
import { THEME } from '../config/ThemeConfig';

// Конфиг формул из balance.json
const formulaConfig: IFormulaConfig = (balanceConfig as unknown as IBalanceConfig).formulas;

/** Ширина дизайна */
const W = THEME.layout.designWidth; // 390

/** Описание одной кнопки команды */
interface CommandDef {
    id: CommandId;
    icon: string;
    label: string;
    slot: 'weapon' | 'armor' | 'accessory';
    calcChance: (
        baseChance: number,
        attackChance: number,
        shieldArmor: number,
        luck: number,
    ) => number;
}

/** Все 6 команд */
const COMMANDS: CommandDef[] = [
    {
        id: 'cmd_attack', icon: '\u2694', label: 'Атака', slot: 'weapon',
        calcChance: (base, _atk, _sa, luck) =>
            calcAttackWinChance(base, luck, formulaConfig.winChanceMin, formulaConfig.winChanceMax, formulaConfig.luckAttackCoeff),
    },
    {
        id: 'cmd_block', icon: '\uD83D\uDEE1', label: 'Блок', slot: 'armor',
        calcChance: (_base, atk, sa, luck) =>
            calcBlockWinChance(atk, sa, luck, formulaConfig.baseBlockPower, formulaConfig.shieldArmorBlockCoeff, formulaConfig.luckAttackCoeff, formulaConfig.winChanceMin, formulaConfig.winChanceMax),
    },
    {
        id: 'cmd_fortune', icon: '\uD83C\uDF40', label: 'Фортуна', slot: 'accessory',
        calcChance: (base, _atk, _sa, luck) =>
            calcFortuneChance(base, luck, formulaConfig.luckAbilityCoeff, formulaConfig.winChanceMin, formulaConfig.winChanceMax),
    },
    {
        id: 'cmd_retreat', icon: '\uD83C\uDFC3', label: 'Отступление', slot: 'accessory',
        calcChance: (_base, _atk, _sa, luck) =>
            calcRetreatChance(luck, formulaConfig.retreatBase, formulaConfig.luckAbilityCoeff, formulaConfig.winChanceMin, formulaConfig.winChanceMax),
    },
    {
        id: 'cmd_bypass', icon: '\uD83D\uDCA8', label: 'Обход', slot: 'accessory',
        calcChance: (_base, _atk, _sa, luck) =>
            calcBypassChance(luck, formulaConfig.bypassBase, formulaConfig.luckAbilityCoeff, formulaConfig.winChanceMin, formulaConfig.winChanceMax),
    },
    {
        id: 'cmd_polymorph', icon: '\uD83D\uDD2E', label: 'Полиморф', slot: 'accessory',
        calcChance: (base, _atk, _sa, luck) =>
            calcPolymorphChance(base, luck, formulaConfig.luckAbilityCoeff, formulaConfig.winChanceMin, formulaConfig.winChanceMax),
    },
];

/**
 * Сцена предбоя — выбор команды, расходника, обзор матчапа.
 * Бизнес-логика делегирована FormulaEngine / BattleSystem.
 */
export class PreBattleScene extends BaseScene {
    private readonly gameState: GameState;
    private readonly eventBus: EventBus;
    private readonly sceneManager: SceneManager;

    /** Текущий враг (задаётся в onEnter) */
    private enemy!: IMobConfig;

    /** Индекс выбранного слота пояса (-1 = не выбран) */
    private selectedBeltIndex = -1;
    /** Выбранная команда (null = не выбрана) */
    private selectedCommand: CommandId | null = null;

    /** Контейнеры слотов пояса для подсветки */
    private beltSlotContainers: Container[] = [];
    /** Контейнеры кнопок команд для подсветки */
    private commandContainers: Container[] = [];

    /** Кнопка «В БОЙ!» */
    private goButton!: Button;

    constructor(gameState: GameState, eventBus: EventBus, sceneManager: SceneManager) {
        super();
        this.gameState = gameState;
        this.eventBus = eventBus;
        this.sceneManager = sceneManager;
    }

    onEnter(data?: unknown): void {
        const enterData = data as { enemy: IMobConfig } | undefined;
        if (!enterData?.enemy) throw new Error('PreBattleScene: data.enemy обязателен');
        this.enemy = enterData.enemy;

        // Сброс выбора
        this.selectedBeltIndex = -1;
        this.selectedCommand = null;
        this.beltSlotContainers = [];
        this.commandContainers = [];

        // Фон
        const bg = new Graphics();
        bg.rect(0, 0, W, THEME.layout.designHeight);
        bg.fill(THEME.colors.bg_primary);
        this.addChild(bg);

        // --- Заголовок ---
        this.buildHeading();

        // --- Matchup ---
        this.buildMatchup();

        // --- Секция «Расходник с пояса» ---
        this.buildBeltSection();

        // --- 6 кнопок команд (3x2) ---
        this.buildCommandGrid();

        // --- Подсказка ---
        this.buildHint();

        // --- Кнопка «В БОЙ!» ---
        this.buildGoButton();
    }

    // ───────────────────────────── Заголовок ─────────────────────────────

    private buildHeading(): void {
        const heading = new Text({
            text: 'ПРЕДБОЙ',
            style: new TextStyle({
                fontSize: 40,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.black,
                fill: THEME.colors.text_primary,
            }),
        });
        heading.anchor.set(0.5, 0);
        heading.x = W / 2;
        heading.y = 48;
        this.addChild(heading);
    }

    // ───────────────────────────── Matchup ───────────────────────────────

    private buildMatchup(): void {
        const equipment = this.gameState.equipment;
        const relics = [...this.gameState.activeRelics];
        const heroStats = calcHeroStats(
            this.gameState.hero.mass,
            equipment as IEquipmentSlots,
            relics,
        );

        const matchupY = 100;

        // --- Герой (слева) ---
        const heroBlock = this.buildFighterBlock(
            'BigHero',
            `${this.gameState.hero.mass} кг`,
            heroStats.strength,
            heroStats.armor,
            heroStats.luck,
            THEME.colors.accent_cyan,
        );
        heroBlock.x = 14;
        heroBlock.y = matchupY;
        this.addChild(heroBlock);

        // --- VS ---
        const vsText = new Text({
            text: 'VS',
            style: new TextStyle({
                fontSize: 20,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.accent_pink,
            }),
        });
        vsText.anchor.set(0.5);
        vsText.x = W / 2;
        vsText.y = matchupY + 65;
        this.addChild(vsText);

        // --- Враг (справа) ---
        const enemyBlock = this.buildFighterBlock(
            this.enemy.name,
            `${this.enemy.mass} кг`,
            this.enemy.strength,
            this.enemy.armor,
            0,
            THEME.colors.accent_red,
        );
        // Правый блок: W - 14 - ширина блока (~160)
        enemyBlock.x = W - 14 - 160;
        enemyBlock.y = matchupY;
        this.addChild(enemyBlock);
    }

    /** Карточка бойца (аватар, имя, масса, характеристики) */
    private buildFighterBlock(
        name: string,
        massText: string,
        strength: number,
        armor: number,
        luck: number,
        borderColor: number,
    ): Container {
        const block = new Container();
        const blockW = 160;

        // Фон карточки
        const cardBg = new Graphics();
        cardBg.roundRect(0, 0, blockW, 160, 14);
        cardBg.fill(THEME.colors.bg_secondary);
        block.addChild(cardBg);

        // Аватар 64x64
        const avatarBg = new Graphics();
        avatarBg.roundRect((blockW - 64) / 2, 10, 64, 64, 14);
        avatarBg.fill(THEME.colors.bg_secondary);
        avatarBg.stroke({ color: borderColor, width: 2 });
        block.addChild(avatarBg);

        // Имя
        const nameLabel = new Text({
            text: name,
            style: new TextStyle({
                fontSize: 11,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_secondary,
            }),
        });
        nameLabel.anchor.set(0.5, 0);
        nameLabel.x = blockW / 2;
        nameLabel.y = 80;
        block.addChild(nameLabel);

        // Масса
        const massLabel = new Text({
            text: massText,
            style: new TextStyle({
                fontSize: 22,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.accent_cyan,
            }),
        });
        massLabel.anchor.set(0.5, 0);
        massLabel.x = blockW / 2;
        massLabel.y = 95;
        block.addChild(massLabel);

        // Статы
        const statsLabel = new Text({
            text: `Сила: ${strength}\nБроня: ${armor}\nУдача: ${luck}`,
            style: new TextStyle({
                fontSize: 10,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
                lineHeight: 15,
            }),
        });
        statsLabel.anchor.set(0.5, 0);
        statsLabel.x = blockW / 2;
        statsLabel.y = 122;
        block.addChild(statsLabel);

        return block;
    }

    // ──────────────────────── Секция «Расходник с пояса» ─────────────────

    private buildBeltSection(): void {
        // Заголовок секции
        const sectionLabel = new Text({
            text: 'РАСХОДНИК С ПОЯСА',
            style: new TextStyle({
                fontSize: 9,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.medium,
                fill: THEME.colors.text_muted,
                letterSpacing: 0.7,
            }),
        });
        sectionLabel.x = 14;
        sectionLabel.y = 270;
        this.addChild(sectionLabel);

        const belt = this.gameState.belt;
        const slotW = 60;
        const slotH = 46;
        const gap = 8;
        const startX = 14;
        const startY = 286;

        for (let i = 0; i < 2; i++) {
            const slot = belt[i];
            const container = new Container();
            container.x = startX + i * (slotW + gap);
            container.y = startY;
            container.eventMode = 'static';
            container.cursor = 'pointer';

            // Фон слота
            const slotBg = new Graphics();
            slotBg.roundRect(0, 0, slotW, slotH, 10);
            slotBg.fill({ color: 0x000000, alpha: 0.3 });
            container.addChild(slotBg);

            if (slot) {
                // Название расходника
                const slotName = new Text({
                    text: slot.name,
                    style: new TextStyle({
                        fontSize: 8,
                        fontFamily: THEME.font.family,
                        fontWeight: THEME.font.weights.regular,
                        fill: THEME.colors.text_secondary,
                        wordWrap: true,
                        wordWrapWidth: slotW - 4,
                        align: 'center',
                    }),
                });
                slotName.anchor.set(0.5, 0.5);
                slotName.x = slotW / 2;
                slotName.y = slotH / 2;
                container.addChild(slotName);
            } else {
                // Пустой слот — прочерк
                const dash = new Text({
                    text: '\u2014',
                    style: new TextStyle({
                        fontSize: 16,
                        fontFamily: THEME.font.family,
                        fill: THEME.colors.text_muted,
                    }),
                });
                dash.anchor.set(0.5, 0.5);
                dash.x = slotW / 2;
                dash.y = slotH / 2;
                container.addChild(dash);
            }

            // Обработчик тапа
            const beltIndex = i;
            container.on('pointerdown', () => {
                this.onBeltSlotTap(beltIndex);
            });

            this.addChild(container);
            this.beltSlotContainers.push(container);
        }
    }

    /** Обработка тапа по слоту пояса */
    private onBeltSlotTap(index: number): void {
        const belt = this.gameState.belt;
        if (!belt[index]) return; // пустой слот — ничего не делаем

        // Повторный тап — снять выделение
        if (this.selectedBeltIndex === index) {
            this.selectedBeltIndex = -1;
        } else {
            this.selectedBeltIndex = index;
        }
        this.updateBeltHighlight();
    }

    /** Обновление подсветки слотов пояса */
    private updateBeltHighlight(): void {
        const slotW = 60;
        const slotH = 46;

        for (let i = 0; i < this.beltSlotContainers.length; i++) {
            const container = this.beltSlotContainers[i];
            // Удалить старую обводку (последний Graphics, если это обводка)
            const existingBorder = container.getChildByLabel('border');
            if (existingBorder) container.removeChild(existingBorder);

            if (i === this.selectedBeltIndex) {
                const border = new Graphics();
                border.roundRect(0, 0, slotW, slotH, 10);
                border.stroke({ color: THEME.colors.accent_green, width: 2 });
                border.label = 'border';
                container.addChild(border);
            }
        }
    }

    // ──────────────────────── 6 кнопок команд (3x2) ─────────────────────

    private buildCommandGrid(): void {
        const equipment = this.gameState.equipment;
        const relics = [...this.gameState.activeRelics];
        const heroStats = calcHeroStats(
            this.gameState.hero.mass,
            equipment as IEquipmentSlots,
            relics,
        );

        // Рассчитываем базовый шанс и шанс атаки (нужны для блока)
        const heroDamage = calcDamage(heroStats.strength, this.enemy.armor);
        const enemyDamage = calcDamage(this.enemy.strength, heroStats.armor);
        const heroTTK = calcTTK(heroStats.hp, enemyDamage);
        const enemyTTK = calcTTK(this.enemy.mass, heroDamage);
        const baseChance = calcBaseWinChance(heroTTK, enemyTTK);
        const attackChance = calcAttackWinChance(
            baseChance, heroStats.luck,
            formulaConfig.winChanceMin, formulaConfig.winChanceMax, formulaConfig.luckAttackCoeff,
        );

        const gridX = 14;
        const gridY = 380;
        const cols = 3;
        const gap = 6;
        const btnW = Math.floor((W - 28 - (cols - 1) * gap) / cols); // ~116
        const btnH = 100;

        for (let i = 0; i < COMMANDS.length; i++) {
            const cmd = COMMANDS[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = gridX + col * (btnW + gap);
            const y = gridY + row * (btnH + gap);

            // Шанс победы для этой команды
            const chance = cmd.calcChance(baseChance, attackChance, heroStats.armor, heroStats.luck);
            const pct = Math.round(chance * 100);

            // Предмет привязанный к слоту
            const item: IEquipmentItem | null = (equipment as IEquipmentSlots)[cmd.slot];
            const durability = item?.currentDurability ?? 0;
            const maxDurability = item?.maxDurability ?? 0;
            const isBroken = durability === 0;

            const container = new Container();
            container.x = x;
            container.y = y;
            container.eventMode = isBroken ? 'none' : 'static';
            container.cursor = isBroken ? 'default' : 'pointer';

            // Фон кнопки
            const btnBg = new Graphics();
            btnBg.roundRect(0, 0, btnW, btnH, 14);
            if (isBroken) {
                btnBg.fill({ color: THEME.colors.text_muted, alpha: 0.2 });
            } else {
                btnBg.fill({ color: 0x000000, alpha: 0.3 });
            }
            container.addChild(btnBg);

            // Иконка-эмодзи
            const iconText = new Text({
                text: isBroken ? '\uD83D\uDD12' : cmd.icon,
                style: new TextStyle({
                    fontSize: 20,
                    fontFamily: THEME.font.family,
                }),
            });
            iconText.anchor.set(0.5, 0);
            iconText.x = btnW / 2;
            iconText.y = 6;
            container.addChild(iconText);

            // Название команды
            const nameText = new Text({
                text: cmd.label,
                style: new TextStyle({
                    fontSize: 12,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.bold,
                    fill: isBroken ? THEME.colors.text_muted : THEME.colors.text_primary,
                }),
            });
            nameText.anchor.set(0.5, 0);
            nameText.x = btnW / 2;
            nameText.y = 30;
            container.addChild(nameText);

            // Шанс победы XX%
            const chanceColor = this.getChanceColor(pct);
            const chanceText = new Text({
                text: `${pct}%`,
                style: new TextStyle({
                    fontSize: 13,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.bold,
                    fill: isBroken ? THEME.colors.text_muted : chanceColor,
                }),
            });
            chanceText.anchor.set(0.5, 0);
            chanceText.x = btnW / 2;
            chanceText.y = 45;
            container.addChild(chanceText);

            // Пипсы прочности
            if (maxDurability > 0) {
                const pips = new DurabilityPips({ max: maxDurability, current: durability });
                // Центрируем пипсы по X
                const pipsWidth = maxDurability * 8 + (maxDurability - 1) * 4;
                pips.x = (btnW - pipsWidth) / 2;
                pips.y = 63;
                container.addChild(pips);
            }

            // Имя предмета
            const itemName = item?.name ?? '\u2014';
            const itemLabel = new Text({
                text: itemName,
                style: new TextStyle({
                    fontSize: 8,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.regular,
                    fill: THEME.colors.text_muted,
                }),
            });
            itemLabel.anchor.set(0.5, 0);
            itemLabel.x = btnW / 2;
            itemLabel.y = 74;
            container.addChild(itemLabel);

            // Обработчик тапа
            if (!isBroken) {
                container.on('pointerdown', () => {
                    this.onCommandTap(cmd.id);
                });
            }

            this.addChild(container);
            this.commandContainers.push(container);
        }
    }

    /** Цвет шанса по значению */
    private getChanceColor(pct: number): number {
        if (pct >= 60) return THEME.colors.accent_green;
        if (pct >= 40) return THEME.colors.accent_yellow;
        return THEME.colors.accent_red;
    }

    /** Обработка тапа по кнопке команды */
    private onCommandTap(commandId: CommandId): void {
        this.selectedCommand = commandId;
        this.updateCommandHighlight();
        this.updateGoButton();
    }

    /** Обновление подсветки кнопок команд */
    private updateCommandHighlight(): void {
        const cols = 3;
        const gap = 6;
        const btnW = Math.floor((W - 28 - (cols - 1) * gap) / cols);
        const btnH = 100;

        for (let i = 0; i < COMMANDS.length; i++) {
            const cmd = COMMANDS[i];
            const container = this.commandContainers[i];

            // Удалить старую обводку
            const existingBorder = container.getChildByLabel('sel-border');
            if (existingBorder) container.removeChild(existingBorder);
            const existingSelBg = container.getChildByLabel('sel-bg');
            if (existingSelBg) container.removeChild(existingSelBg);

            if (cmd.id === this.selectedCommand) {
                // Зелёный полупрозрачный фон
                const selBg = new Graphics();
                selBg.roundRect(0, 0, btnW, btnH, 14);
                selBg.fill({ color: THEME.colors.accent_green, alpha: 0.12 });
                selBg.label = 'sel-bg';
                container.addChildAt(selBg, 1); // за текстом, перед фоном

                // Зелёная обводка
                const border = new Graphics();
                border.roundRect(0, 0, btnW, btnH, 14);
                border.stroke({ color: THEME.colors.accent_green, width: 2 });
                border.label = 'sel-border';
                container.addChild(border);
            }
        }
    }

    // ───────────────────────────── Подсказка ─────────────────────────────

    private buildHint(): void {
        const hintY = 680;
        const hintPadX = 14;
        const hintW = W - hintPadX * 2;

        const hintContainer = new Container();
        hintContainer.x = hintPadX;
        hintContainer.y = hintY;

        // Фон подсказки
        const hintBg = new Graphics();
        hintBg.roundRect(0, 0, hintW, 32, 10);
        hintBg.fill({ color: 0x000000, alpha: 0.25 });
        hintContainer.addChild(hintBg);

        // Левая полоска (accent_cyan)
        const leftBar = new Graphics();
        leftBar.roundRect(0, 0, 3, 32, 2);
        leftBar.fill(THEME.colors.accent_cyan);
        hintContainer.addChild(leftBar);

        // Текст подсказки
        const hintText = new Text({
            text: 'Слабый\u2192Атака. Сильный\u2192Блок. Не уверен\u2192Отступ.',
            style: new TextStyle({
                fontSize: 10,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
                wordWrap: true,
                wordWrapWidth: hintW - 20,
            }),
        });
        hintText.x = 10;
        hintText.y = 6;
        hintContainer.addChild(hintText);

        this.addChild(hintContainer);
    }

    // ───────────────────────────── Кнопка «В БОЙ!» ──────────────────────

    private buildGoButton(): void {
        this.goButton = new Button({
            text: 'В БОЙ!',
            variant: 'primary',
            width: THEME.layout.buttonWidth,
            height: THEME.layout.buttonHeight.primary,
            onClick: () => this.onGoToBattle(),
        });
        // Центрируем кнопку (pivot.x уже = w/2 в Button)
        this.goButton.x = W / 2;
        this.goButton.y = 730;

        // Изначально деактивирована (команда не выбрана)
        this.goButton.alpha = 0.3;
        this.goButton.eventMode = 'none';

        this.addChild(this.goButton);
    }

    /** Обновление состояния кнопки «В БОЙ!» */
    private updateGoButton(): void {
        if (this.selectedCommand) {
            this.goButton.alpha = 1;
            this.goButton.eventMode = 'static';
        } else {
            this.goButton.alpha = 0.3;
            this.goButton.eventMode = 'none';
        }
    }

    // ───────────────────────────── В БОЙ! ───────────────────────────────

    /** Сбор контекста и переход в бой */
    private onGoToBattle(): void {
        if (!this.selectedCommand) return;

        const equipment = this.gameState.equipment as IEquipmentSlots;
        const relics = [...this.gameState.activeRelics];
        const heroStats = calcHeroStats(this.gameState.hero.mass, equipment, relics);

        // Расходник из пояса (или null)
        // IBattleContext ожидает IConsumableConfig, но пояс хранит IConsumable (без basePrice).
        // BattleSystem использует только effect/value — приведение безопасно.
        let consumable: IConsumableConfig | null = null;
        if (this.selectedBeltIndex >= 0) {
            const beltItem = this.gameState.belt[this.selectedBeltIndex];
            consumable = beltItem ? { ...beltItem, basePrice: 0 } as IConsumableConfig : null;
        }

        // Собираем IBattleContext
        const context: IBattleContext = {
            mode: 'pve',
            heroStats,
            heroMass: this.gameState.hero.mass,
            enemy: this.enemy,
            command: this.selectedCommand,
            consumable,
            rng: Math.random,
        };

        // Разрешение боя
        const battleResult = resolveBattle(context, formulaConfig);

        // Переход к сцене боя
        void this.sceneManager.goto('battle', {
            transition: TransitionType.FADE,
            data: { result: battleResult, enemy: this.enemy },
        });
    }
}
