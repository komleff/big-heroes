import { Graphics, FillGradient } from 'pixi.js';
import { THEME } from '../config/ThemeConfig';

/**
 * Создать градиентный фон для PvE-сцен.
 * Вертикальный градиент: top → mid (35%) → bottom.
 */
export function createPveBackground(width: number, height: number): Graphics {
    const bg = new Graphics();
    const gradient = new FillGradient(0, 0, 0, height);
    gradient.addColorStop(0, THEME.colors.gradient_pve_top);
    gradient.addColorStop(0.35, THEME.colors.gradient_pve_mid);
    gradient.addColorStop(1, THEME.colors.gradient_pve_bottom);
    bg.rect(0, 0, width, height).fill(gradient);
    return bg;
}
