import { Container, Graphics } from 'pixi.js';
import { THEME } from '../config/ThemeConfig';

interface DurabilityPipsOptions {
    max: number;        // maxDurability (например 3)
    current: number;    // currentDurability (например 2)
}

/**
 * Пипсы прочности: ●●○ (2/3), ●●● (3/3), ○○○ (0/3)
 * Маленькие горизонтальные прямоугольники (8×4), залитые зелёным (filled) или серым (empty).
 */
export class DurabilityPips extends Container {
    private maxPips: number;
    private currentPips: number;
    private readonly pipSize = 8;      // ширина пипса
    private readonly pipGap = 4;       // расстояние между пипсами

    constructor(options: DurabilityPipsOptions) {
        super();
        this.maxPips = options.max;
        this.currentPips = options.current;
        this.draw();
    }

    /** Обновляет количество заполненных пипсов (и опционально максимум) */
    update(current: number, max?: number): void {
        this.currentPips = current;
        if (max !== undefined) this.maxPips = max;
        this.draw();
    }

    /** Перерисовывает все пипсы */
    private draw(): void {
        this.removeChildren();
        for (let i = 0; i < this.maxPips; i++) {
            const pip = new Graphics();
            const x = i * (this.pipSize + this.pipGap);
            const filled = i < this.currentPips;
            pip.roundRect(x, 0, this.pipSize, this.pipSize / 2, 2)
                .fill(filled ? THEME.colors.accent_green : THEME.colors.text_muted);
            this.addChild(pip);
        }
    }
}
