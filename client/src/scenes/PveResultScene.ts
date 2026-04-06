import { Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { THEME } from '../config/ThemeConfig';
import { Button } from '../ui/Button';

/** Данные, передаваемые в onEnter */
interface PveResultSceneData {
    status: 'victory' | 'defeat' | 'exited';
    massGained: number;
    goldGained: number;
    itemsFound: string[];
    nodesVisited: number;
    totalNodes: number;
    onContinue: () => void;
}

/**
 * PveResultScene — экран итогов экспедиции.
 * Показывает статус похода, статистику и кнопку возврата в хаб.
 */
export class PveResultScene extends BaseScene {
    constructor() {
        super();
    }

    onEnter(data?: unknown): void {
        const d = data as PveResultSceneData;
        this.buildLayout(d);
    }

    // ─── Построение лэйаута ─────────────────────────────────────

    private buildLayout(data: PveResultSceneData): void {
        const W = THEME.layout.designWidth;
        const H = THEME.layout.designHeight;

        // --- Фон ---
        const bg = new Graphics();
        bg.rect(0, 0, W, H).fill(THEME.colors.bg_primary);
        this.addChild(bg);

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

        // --- Панель статистики y=160, 358×260 ---
        const panelW = 358;
        const panelH = 260;
        const panelX = (W - panelW) / 2;
        const panelY = 160;

        const panel = new Graphics();
        panel.roundRect(panelX, panelY, panelW, panelH, 14).fill(THEME.colors.bg_secondary);
        this.addChild(panel);

        // Строки статистики внутри панели
        const lineX = panelX + 20;
        const lineStartY = panelY + 30;
        const lineSpacing = 40;

        // Узлов пройдено
        this.addStatLine(
            `Узлов пройдено: ${data.nodesVisited} / ${data.totalNodes}`,
            THEME.colors.text_primary,
            lineX,
            lineStartY,
        );

        // Масса набрана
        this.addStatLine(
            `Масса набрана: +${data.massGained} кг`,
            THEME.colors.accent_cyan,
            lineX,
            lineStartY + lineSpacing,
        );

        // Золото
        this.addStatLine(
            `Золото: +${data.goldGained}`,
            THEME.colors.accent_yellow,
            lineX,
            lineStartY + lineSpacing * 2,
        );

        // Предметов найдено
        this.addStatLine(
            `Предметов найдено: ${data.itemsFound.length}`,
            THEME.colors.text_primary,
            lineX,
            lineStartY + lineSpacing * 3,
        );

        // --- Кнопка «В ХАБ» y=500 ---
        const hubBtn = new Button({
            text: 'В ХАБ',
            variant: 'primary',
            onClick: () => data.onContinue(),
        });
        hubBtn.position.set(W / 2, 500);
        this.addChild(hubBtn);
    }

    /**
     * Добавляет строку статистики на сцену.
     */
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

    /**
     * Конфигурация баннера по статусу экспедиции.
     */
    private getBannerConfig(status: 'victory' | 'defeat' | 'exited'): {
        text: string;
        color: number;
        fontSize: number;
        shadow: boolean;
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
