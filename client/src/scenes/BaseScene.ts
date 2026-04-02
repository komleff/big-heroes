import { Container } from 'pixi.js';

/**
 * Базовый класс сцены — наследует Container.
 * Все сцены проекта наследуют от этого класса.
 */
export abstract class BaseScene extends Container {
    /** Вызывается SceneManager при входе в сцену */
    abstract onEnter(data?: unknown): void;

    /** Вызывается SceneManager при выходе из сцены */
    onExit(): void {
        // По умолчанию пустой — сцены переопределяют при необходимости
    }

    /** Вызывается при ресайзе viewport */
    onResize(_width: number, _height: number): void {
        // По умолчанию пустой
    }

    /** Корректная очистка при уничтожении сцены */
    override destroy(): void {
        super.destroy({ children: true });
    }
}
