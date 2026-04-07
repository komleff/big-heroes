import { Application, Container, Graphics } from 'pixi.js';
import { BaseScene } from '../scenes/BaseScene';
import { EventBus, GameEvents } from './EventBus';
import { tweenProperty } from '../utils/Tween';
import { THEME } from '../config/ThemeConfig';

/** Типы переходов между сценами */
export enum TransitionType {
    NONE = 'none',
    FADE = 'fade',
    SLIDE_LEFT = 'slide_left',
    SLIDE_RIGHT = 'slide_right',
    MODAL = 'modal',
}

/** Опции перехода */
interface GotoOptions {
    transition?: TransitionType;
    data?: unknown;
}

/** Запись в стеке истории */
interface HistoryEntry {
    name: string;
    data?: unknown;
}

/**
 * Менеджер сцен — управляет жизненным циклом, переходами и viewport-масштабированием.
 * Сцены работают в координатах designWidth x designHeight (390x844).
 * sceneContainer масштабируется целиком под реальный размер экрана.
 */
export class SceneManager {
    private app: Application;
    private eventBus: EventBus;
    private sceneContainer: Container;
    private factories = new Map<string, () => BaseScene>();
    private currentScene: BaseScene | null = null;
    private currentSceneName: string | null = null;
    private history: HistoryEntry[] = [];
    private transitioning = false;

    // Для MODAL — сохраняем нижнюю сцену и overlay
    private modalOverlay: Graphics | null = null;
    private modalUnderScene: BaseScene | null = null;

    constructor(app: Application, eventBus: EventBus) {
        this.app = app;
        this.eventBus = eventBus;

        // Контейнер для сцен с viewport-масштабированием
        this.sceneContainer = new Container();
        this.app.stage.addChild(this.sceneContainer);

        // Начальный масштаб
        this.resize(this.app.screen.width, this.app.screen.height);
    }

    /** Регистрация фабрики сцены по имени */
    register(name: string, factory: () => BaseScene): void {
        this.factories.set(name, factory);
    }

    /** Переход к сцене */
    async goto(name: string, options: GotoOptions = {}): Promise<void> {
        // Блокируем повторный вызов во время перехода
        if (this.transitioning) return;

        const factory = this.factories.get(name);
        if (!factory) throw new Error(`Сцена "${name}" не зарегистрирована`);

        this.transitioning = true;
        const transition = options.transition ?? TransitionType.NONE;
        const { designWidth } = THEME.layout;
        const transitionMs = THEME.animation.transitionMs;

        this.eventBus.emit(GameEvents.SCENE_TRANSITION_START, {
            from: this.currentSceneName,
            to: name,
        });

        // Сохраняем текущую сцену в историю
        if (this.currentSceneName) {
            this.history.push({ name: this.currentSceneName, data: undefined });
        }

        const oldScene = this.currentScene;
        const newScene = factory();

        if (transition === TransitionType.MODAL) {
            // --- MODAL: старая сцена остаётся, поверх — overlay + новая ---
            this.modalUnderScene = oldScene;

            // Полупрозрачный overlay (fill непрозрачный, alpha контейнера анимируется)
            this.modalOverlay = new Graphics();
            this.modalOverlay.rect(0, 0, THEME.layout.designWidth, THEME.layout.designHeight);
            this.modalOverlay.fill({ color: THEME.colors.bg_overlay });
            this.modalOverlay.alpha = 0;
            this.modalOverlay.eventMode = 'static';
            this.modalOverlay.cursor = 'pointer';
            this.modalOverlay.on('pointerdown', () => {
                void this.back({ transition: TransitionType.MODAL });
            });
            this.sceneContainer.addChild(this.modalOverlay);

            // Новая сцена поверх overlay
            this.sceneContainer.addChild(newScene);
            newScene.onEnter(options.data);
            newScene.alpha = 0;
            newScene.scale.set(THEME.animation.sceneEnterScale);

            // Параллельная анимация появления
            await Promise.all([
                tweenProperty(
                    this.modalOverlay as unknown as Record<string, number>,
                    'alpha', 0, 0.5, transitionMs, this.app.ticker,
                ),
                tweenProperty(
                    newScene as unknown as Record<string, number>,
                    'alpha', 0, 1, transitionMs, this.app.ticker,
                ),
                tweenProperty(
                    newScene.scale as unknown as Record<string, number>,
                    'x', THEME.animation.sceneEnterScale, 1, transitionMs, this.app.ticker,
                ),
                tweenProperty(
                    newScene.scale as unknown as Record<string, number>,
                    'y', THEME.animation.sceneEnterScale, 1, transitionMs, this.app.ticker,
                ),
            ]);
        } else {
            // --- Обычные переходы: NONE, FADE, SLIDE ---
            this.sceneContainer.addChild(newScene);
            newScene.onEnter(options.data);

            if (transition === TransitionType.NONE) {
                // Мгновенная замена
                if (oldScene) {
                    oldScene.onExit();
                    this.sceneContainer.removeChild(oldScene);
                    oldScene.destroy();
                }
            } else if (transition === TransitionType.FADE) {
                // Crossfade
                newScene.alpha = 0;
                const fadePromises: Promise<void>[] = [
                    tweenProperty(
                        newScene as unknown as Record<string, number>,
                        'alpha', 0, 1, transitionMs, this.app.ticker,
                    ),
                ];
                if (oldScene) {
                    fadePromises.push(
                        tweenProperty(
                            oldScene as unknown as Record<string, number>,
                            'alpha', 1, 0, transitionMs, this.app.ticker,
                        ),
                    );
                }
                await Promise.all(fadePromises);
                if (oldScene) {
                    oldScene.onExit();
                    this.sceneContainer.removeChild(oldScene);
                    oldScene.destroy();
                }
            } else if (transition === TransitionType.SLIDE_LEFT) {
                // Сдвиг влево — новая сцена въезжает справа
                newScene.x = designWidth;
                const slidePromises: Promise<void>[] = [
                    tweenProperty(
                        newScene as unknown as Record<string, number>,
                        'x', designWidth, 0, transitionMs, this.app.ticker,
                    ),
                ];
                if (oldScene) {
                    slidePromises.push(
                        tweenProperty(
                            oldScene as unknown as Record<string, number>,
                            'x', 0, -designWidth, transitionMs, this.app.ticker,
                        ),
                    );
                }
                await Promise.all(slidePromises);
                if (oldScene) {
                    oldScene.onExit();
                    this.sceneContainer.removeChild(oldScene);
                    oldScene.destroy();
                }
            } else if (transition === TransitionType.SLIDE_RIGHT) {
                // Сдвиг вправо — новая сцена въезжает слева
                newScene.x = -designWidth;
                const slidePromises: Promise<void>[] = [
                    tweenProperty(
                        newScene as unknown as Record<string, number>,
                        'x', -designWidth, 0, transitionMs, this.app.ticker,
                    ),
                ];
                if (oldScene) {
                    slidePromises.push(
                        tweenProperty(
                            oldScene as unknown as Record<string, number>,
                            'x', 0, designWidth, transitionMs, this.app.ticker,
                        ),
                    );
                }
                await Promise.all(slidePromises);
                if (oldScene) {
                    oldScene.onExit();
                    this.sceneContainer.removeChild(oldScene);
                    oldScene.destroy();
                }
            }
        }

        this.currentScene = newScene;
        this.currentSceneName = name;
        this.transitioning = false;

        this.eventBus.emit(GameEvents.SCENE_TRANSITION_END, { sceneName: name });
    }

    /** Возврат к предыдущей сцене */
    async back(options: GotoOptions = {}): Promise<void> {
        if (this.transitioning) return;

        const transition = options.transition ?? TransitionType.SLIDE_RIGHT;
        const transitionMs = THEME.animation.transitionMs;

        // --- Закрытие модалки ---
        if (transition === TransitionType.MODAL && this.modalOverlay && this.modalUnderScene) {
            this.transitioning = true;
            const modalScene = this.currentScene;
            const fromName = this.currentSceneName;
            const toName = this.history[this.history.length - 1]?.name ?? null;

            this.eventBus.emit(GameEvents.SCENE_TRANSITION_START, { from: fromName, to: toName });

            // Анимация исчезновения overlay и модальной сцены
            await Promise.all([
                tweenProperty(
                    this.modalOverlay as unknown as Record<string, number>,
                    'alpha', 0.5, 0, transitionMs, this.app.ticker,
                ),
                modalScene
                    ? tweenProperty(
                        modalScene as unknown as Record<string, number>,
                        'alpha', 1, 0, transitionMs, this.app.ticker,
                    )
                    : Promise.resolve(),
            ]);

            // Очистка модальной сцены
            if (modalScene) {
                modalScene.onExit();
                this.sceneContainer.removeChild(modalScene);
                modalScene.destroy();
            }

            // Очистка overlay
            this.sceneContainer.removeChild(this.modalOverlay);
            this.modalOverlay.destroy();
            this.modalOverlay = null;

            // Восстанавливаем нижнюю сцену как текущую
            this.currentScene = this.modalUnderScene;
            this.modalUnderScene = null;

            // Имя сцены из истории
            const prev = this.history.pop();
            this.currentSceneName = prev?.name ?? null;

            this.transitioning = false;

            this.eventBus.emit(GameEvents.SCENE_TRANSITION_END, { sceneName: this.currentSceneName });
            return;
        }

        // --- Обычный back — переход к предыдущей сцене из стека ---
        const prev = this.history.pop();
        if (!prev) return;

        await this.goto(prev.name, { transition, data: prev.data });
        // goto() добавляет текущую сцену в историю, убираем дубликат
        this.history.pop();
    }

    /**
     * Viewport-масштабирование: canvas = реальный размер окна (resizeTo: window),
     * сцены масштабируются container scale. Текст рендерится в нативном разрешении
     * (resolution = DPR), поэтому container scale НЕ вызывает размытие —
     * PixiJS перерисовывает Text-текстуры в реальных пикселях.
     */
    resize(width?: number, height?: number): void {
        const w = width ?? this.app.screen.width;
        const h = height ?? this.app.screen.height;
        const { designWidth, designHeight } = THEME.layout;
        const scaleFactor = Math.min(w / designWidth, h / designHeight);
        this.sceneContainer.scale.set(scaleFactor);
        this.sceneContainer.position.set(
            (w - designWidth * scaleFactor) / 2,
            (h - designHeight * scaleFactor) / 2,
        );

        this.currentScene?.onResize(w, h);
    }

    /** Текущее имя активной сцены */
    get activeSceneName(): string | null {
        return this.currentSceneName;
    }
}
