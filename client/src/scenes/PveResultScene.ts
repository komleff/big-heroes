import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { THEME } from '../config/ThemeConfig';
import { Button } from '../ui/Button';
import { createPveBackground } from '../ui/GradientBackground';
import type { IRelic } from 'shared';

/** Данные, передаваемые в onEnter */
interface PveResultSceneData {
    status: 'victory' | 'defeat' | 'exited';
    massGained: number;
    goldGained: number;
    itemsFound: string[];
    nodesVisited: number;
    totalNodes: number;
    onContinue: () => void;
    // Новый единый flow (Sprint 4):
    bossRelic?: IRelic;                   // 1 случайная реликвия босса (уже добавлена)
    bossLootItems?: string[];             // 2 random items от босса (u1z)
    extractionPool?: IRelic[];            // Все реликвии для выбора arena relic
    onSaveRelic?: (relic: IRelic) => void; // Сохранить реликвию для арены
    // Legacy (для обратной совместимости до полной миграции):
    relicsForExtraction?: IRelic[];
    bossRelicPool?: IRelic[];
    onSelectBossRelic?: (relic: IRelic) => void;
    onGetActiveRelics?: () => IRelic[];
}

/** Ширина дизайна */
const W = THEME.layout.designWidth;

/** Человекочитаемое описание эффекта реликвии */
function getEffectDescription(effect: string, value: number): string {
    switch (effect) {
        case 'strength_bonus': return `+${value} к силе`;
        case 'armor_bonus': return `+${value} к броне`;
        case 'luck_bonus': return `+${value} к удаче`;
        case 'gold_bonus': return `+${Math.round(value * 100)}% Gold`;
        case 'mass_bonus': return `+${Math.round(value * 100)}% массы`;
        case 'extra_loot': return `+${value} предмет из сундуков`;
        case 'mass_on_win': return `+${Math.round(value * 100)}% массы за победу`;
        case 'first_strike': return `+${Math.round(value * 100)}% урона первого удара`;
        case 'thorns': return `${Math.round(value * 100)}% отражённого урона`;
        case 'enemy_strength_reduction': return `−${Math.round(value * 100)}% силы врага`;
        case 'boss_armor': return `+${value} брони vs босс`;
        case 'reveal_all': return 'Все «???» раскрыты';
        case 'safe_retreat': return 'Отступление всегда 100%';
        case 'safe_bypass': return 'Обход всегда 100%';
        case 'extra_backpack': return `+${value} слота рюкзака`;
        case 'no_durability': return 'Нет износа снаряжения';
        case 'camp_repair_bonus': return `+${value} к ремонту в лагере`;
        case 'shop_discount': return `−${Math.round(value * 100)}% в магазине`;
        case 'polymorph_bonus': return `+${Math.round(value * 100)}% полиморфа`;
        default: return effect;
    }
}

/**
 * PveResultScene — экран итогов экспедиции.
 * При победе:
 * 1. Показывает статистику похода
 * 2. Boss loot: 2 random items (u1z) — информационно
 * 3. Единый extraction: выбор одной реликвии для арены из всех собранных
 */
export class PveResultScene extends BaseScene {
    private sceneData!: PveResultSceneData;
    private extractionDone = false;

    constructor() {
        super();
    }

    onEnter(data?: unknown): void {
        this.sceneData = data as PveResultSceneData;
        this.extractionDone = false;
        this.buildLayout();
    }

    // ─── Построение лэйаута ─────────────────────────────────────

    private buildLayout(): void {
        this.removeChildren();
        const data = this.sceneData;
        const H = THEME.layout.designHeight;

        // --- Фон (градиент PvE) ---
        this.addChild(createPveBackground(W, H));

        // --- Баннер статуса y=48 ---
        const bannerCfg = this.getBannerConfig(data.status);
        const bannerText = new Text({
            text: bannerCfg.text,
            style: new TextStyle({
                fontSize: bannerCfg.fontSize,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: bannerCfg.color,
                dropShadow: bannerCfg.shadow
                    ? { distance: 2, alpha: 0.5 }
                    : undefined,
            }),
        });
        bannerText.anchor.set(0.5, 0);
        bannerText.position.set(W / 2, 48);
        this.addChild(bannerText);

        // --- Подзаголовок y=110 ---
        const subheading = new Text({
            text: 'Итоги похода',
            style: new TextStyle({
                fontSize: THEME.font.sizes.subheading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: THEME.colors.text_muted,
            }),
        });
        subheading.anchor.set(0.5, 0);
        subheading.position.set(W / 2, 110);
        this.addChild(subheading);

        // --- Панель статистики y=150 ---
        const panelW = 358;
        const panelH = 160;
        const panelX = (W - panelW) / 2;
        const panelY = 150;

        const panel = new Graphics();
        panel.roundRect(panelX, panelY, panelW, panelH, 14).fill(THEME.colors.bg_secondary);
        this.addChild(panel);

        const lineX = panelX + 20;
        const lineStartY = panelY + 20;
        const lineSpacing = 32;

        this.addStatLine(`Узлов пройдено: ${data.nodesVisited} / ${data.totalNodes}`, THEME.colors.text_primary, lineX, lineStartY);
        this.addStatLine(`Масса набрана: +${data.massGained} кг`, THEME.colors.accent_cyan, lineX, lineStartY + lineSpacing);
        this.addStatLine(`Золото: +${data.goldGained}`, THEME.colors.accent_yellow, lineX, lineStartY + lineSpacing * 2);
        this.addStatLine(`Предметов найдено: ${data.itemsFound.length}`, THEME.colors.text_primary, lineX, lineStartY + lineSpacing * 3);

        let nextY = panelY + panelH + 16;

        // --- Boss loot items (u1z): информационная секция ---
        if (data.status === 'victory' && data.bossLootItems && data.bossLootItems.length > 0) {
            nextY = this.buildBossLootSection(data.bossLootItems, nextY);
        }

        // --- Boss relic: информационная карточка ---
        if (data.status === 'victory' && data.bossRelic) {
            nextY = this.buildBossRelicInfo(data.bossRelic, nextY);
        }

        // --- Extraction: выбор arena relic ---
        if (data.status === 'victory' && data.extractionPool && data.extractionPool.length > 0 && !this.extractionDone) {
            this.buildExtractionSection(data.extractionPool, nextY);
        } else {
            // Кнопка «В ХАБ»
            const hubBtn = new Button({
                text: 'В ХАБ',
                variant: 'primary',
                onClick: () => data.onContinue(),
            });
            hubBtn.position.set(W / 2, nextY + 16);
            this.addChild(hubBtn);
        }
    }

    // ─── Boss loot items (u1z) ──────────────────────────────────

    private buildBossLootSection(items: string[], startY: number): number {
        const title = new Text({
            text: `Добыча босса: ${items.length} предм.`,
            style: new TextStyle({
                fontSize: 14,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.accent_yellow,
            }),
        });
        title.anchor.set(0.5, 0);
        title.position.set(W / 2, startY);
        this.addChild(title);

        return startY + 28;
    }

    // ─── Boss relic info ────────────────────────────────────────

    private buildBossRelicInfo(relic: IRelic, startY: number): number {
        const card = new Container();
        card.position.set(16, startY);

        const cardBg = new Graphics();
        cardBg.roundRect(0, 0, W - 32, 50, 10).fill(THEME.colors.accent_green);
        card.addChild(cardBg);

        const icon = new Text({
            text: '🏆',
            style: new TextStyle({ fontSize: 16, fontFamily: THEME.font.family }),
        });
        icon.position.set(10, 14);
        card.addChild(icon);

        const relicText = new Text({
            text: `${relic.name} — ${getEffectDescription(relic.effect, relic.value)}`,
            style: new TextStyle({
                fontSize: 13,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.text_primary,
            }),
        });
        relicText.position.set(34, 16);
        card.addChild(relicText);

        this.addChild(card);
        return startY + 62;
    }

    // ─── Extraction: единый экран выбора arena relic ─────────────

    private buildExtractionSection(relics: IRelic[], startY: number): void {
        // Заголовок
        const title = new Text({
            text: 'Сохранить реликвию для арены?',
            style: new TextStyle({
                fontSize: THEME.font.sizes.subheading,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.bold,
                fill: THEME.colors.accent_yellow,
            }),
        });
        title.anchor.set(0.5, 0);
        title.position.set(W / 2, startY);
        this.addChild(title);

        // Карточки реликвий
        let cardY = startY + 32;
        for (let i = 0; i < relics.length; i++) {
            const relic = relics[i];
            const card = new Container();
            card.position.set(16, cardY);
            card.eventMode = 'static';
            card.cursor = 'pointer';

            const cardBg = new Graphics();
            cardBg.roundRect(0, 0, W - 32, 50, 10).fill(THEME.colors.bg_secondary);
            card.addChild(cardBg);

            const relicText = new Text({
                text: `${relic.name} — ${getEffectDescription(relic.effect, relic.value)}`,
                style: new TextStyle({
                    fontSize: THEME.font.sizes.small,
                    fontFamily: THEME.font.family,
                    fontWeight: THEME.font.weights.regular,
                    fill: THEME.colors.text_primary,
                }),
            });
            relicText.position.set(12, 14);
            card.addChild(relicText);

            card.on('pointerdown', () => {
                this.sceneData.onSaveRelic?.(relic);
                this.extractionDone = true;
                this.buildLayout();
            });

            this.addChild(card);
            cardY += 58;
        }

        // Кнопка «Пропустить»
        const skipBtn = new Button({
            text: 'Пропустить',
            variant: 'danger',
            onClick: () => {
                this.extractionDone = true;
                this.buildLayout();
            },
        });
        skipBtn.position.set(W / 2, cardY + 8);
        this.addChild(skipBtn);
    }

    // ─── Хелперы ────────────────────────────────────────────────

    private addStatLine(content: string, color: number, x: number, y: number): void {
        const line = new Text({
            text: content,
            style: new TextStyle({
                fontSize: 16,
                fontFamily: THEME.font.family,
                fontWeight: THEME.font.weights.regular,
                fill: color,
            }),
        });
        line.position.set(x, y);
        this.addChild(line);
    }

    private getBannerConfig(status: 'victory' | 'defeat' | 'exited'): {
        text: string; color: number; fontSize: number; shadow: boolean;
    } {
        switch (status) {
            case 'victory':
                return { text: 'ПОБЕДА!', color: THEME.colors.accent_yellow, fontSize: 32, shadow: true };
            case 'defeat':
                return { text: 'ПОРАЖЕНИЕ', color: THEME.colors.accent_red, fontSize: 32, shadow: true };
            case 'exited':
                return { text: 'ПОХОД ЗАВЕРШЁН', color: THEME.colors.text_secondary, fontSize: 28, shadow: false };
        }
    }
}
