import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { THEME } from '../config/ThemeConfig';
import { Button } from '../ui/Button';
import { createPveBackground } from '../ui/GradientBackground';

/** Реликвия для extraction */
interface RelicForExtraction {
    id: string;
    name: string;
    effect: string;
    value: number;
    rarity: string;
}

/** Данные, передаваемые в onEnter */
interface PveResultSceneData {
    status: 'victory' | 'defeat' | 'exited';
    massGained: number;
    goldGained: number;
    itemsFound: string[];
    nodesVisited: number;
    totalNodes: number;
    onContinue: () => void;
    relicsForExtraction?: RelicForExtraction[];     // Реликвии для сохранения (только при victory)
    bossRelicPool?: RelicForExtraction[];            // Пул реликвий босса: выбор 1 из 3 (GDD)
    onSelectBossRelic?: (relic: RelicForExtraction) => void; // Выбор реликвии босса
    onGetActiveRelics?: () => RelicForExtraction[];  // Получить актуальный список реликвий
    onSaveRelic?: (relic: RelicForExtraction) => void; // Сохранить реликвию для арены
}

/** Ширина дизайна */
const W = THEME.layout.designWidth;

/**
 * PveResultScene — экран итогов экспедиции.
 * При победе показывает extraction: «Сохрани реликвию для арены» (GDD 13).
 */
export class PveResultScene extends BaseScene {
    private sceneData!: PveResultSceneData;
    private bossRelicChosen = false;
    private extractionShown = false;

    constructor() {
        super();
    }

    onEnter(data?: unknown): void {
        this.sceneData = data as PveResultSceneData;
        this.extractionShown = false;
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

        // --- Панель статистики y=160 ---
        const panelW = 358;
        const panelH = 200;
        const panelX = (W - panelW) / 2;
        const panelY = 160;

        const panel = new Graphics();
        panel.roundRect(panelX, panelY, panelW, panelH, 14).fill(THEME.colors.bg_secondary);
        this.addChild(panel);

        const lineX = panelX + 20;
        const lineStartY = panelY + 24;
        const lineSpacing = 36;

        this.addStatLine(`Узлов пройдено: ${data.nodesVisited} / ${data.totalNodes}`, THEME.colors.text_primary, lineX, lineStartY);
        this.addStatLine(`Масса набрана: +${data.massGained} кг`, THEME.colors.accent_cyan, lineX, lineStartY + lineSpacing);
        this.addStatLine(`Золото: +${data.goldGained}`, THEME.colors.accent_yellow, lineX, lineStartY + lineSpacing * 2);
        this.addStatLine(`Предметов найдено: ${data.itemsFound.length}`, THEME.colors.text_primary, lineX, lineStartY + lineSpacing * 3);

        // --- Шаг 1: Boss relic — выбор 1 из 3 (GDD: гарантированная награда босса) ---
        if (data.status === 'victory' && data.bossRelicPool && data.bossRelicPool.length > 0 && !this.bossRelicChosen) {
            this.buildBossRelicSection(data.bossRelicPool, panelY + panelH + 20);
        // --- Шаг 2: Extraction — сохранить реликвию для арены ---
        } else if (data.status === 'victory' && data.relicsForExtraction && data.relicsForExtraction.length > 0 && !this.extractionShown) {
            this.buildExtractionSection(data.relicsForExtraction, panelY + panelH + 20);
        } else {
            // Кнопка «В ХАБ»
            const hubBtn = new Button({
                text: 'В ХАБ',
                variant: 'primary',
                onClick: () => data.onContinue(),
            });
            hubBtn.position.set(W / 2, panelY + panelH + 40);
            this.addChild(hubBtn);
        }
    }

    // ─── Boss relic: выбор 1 из 3 (GDD: гарантированная награда босса) ──

    private buildBossRelicSection(relics: RelicForExtraction[], startY: number): void {
        const title = new Text({
            text: 'Награда босса: выберите реликвию',
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

        let cardY = startY + 36;
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
                text: `${relic.name} — ${relic.effect}`,
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
                this.sceneData.onSelectBossRelic?.(relic);
                this.bossRelicChosen = true;
                // Перечитать актуальный список реликвий для extraction (после addRelic)
                if (this.sceneData.onGetActiveRelics) {
                    this.sceneData.relicsForExtraction = this.sceneData.onGetActiveRelics();
                }
                this.buildLayout(); // Перестроить — перейти к extraction или кнопке
            });

            this.addChild(card);
            cardY += 60;
        }
    }

    // ─── Extraction: сохранить реликвию для арены ──────────────

    private buildExtractionSection(relics: RelicForExtraction[], startY: number): void {
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
        let cardY = startY + 36;
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
                text: `${relic.name} — ${relic.effect}`,
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
                this.extractionShown = true;
                this.buildLayout(); // Перестроить — показать кнопку «В ХАБ»
            });

            this.addChild(card);
            cardY += 60;
        }

        // Кнопка «Пропустить»
        const skipBtn = new Button({
            text: 'Пропустить',
            variant: 'danger',
            onClick: () => {
                this.extractionShown = true;
                this.buildLayout();
            },
        });
        skipBtn.position.set(W / 2, cardY + 10);
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
