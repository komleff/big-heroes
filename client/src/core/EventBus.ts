// Тип слушателя
type Listener<T = unknown> = (data: T) => void;

/**
 * Типизированная шина событий (pub/sub).
 * Без зависимости от PixiJS EventEmitter — собственная реализация.
 */
export class EventBus {
    private listeners = new Map<string, Set<Listener>>();

    /** Подписка на событие */
    on<T = unknown>(event: string, listener: Listener<T>): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener as Listener);
    }

    /** Отписка от события */
    off<T = unknown>(event: string, listener: Listener<T>): void {
        this.listeners.get(event)?.delete(listener as Listener);
    }

    /** Вызов события */
    emit<T = unknown>(event: string, data: T): void {
        this.listeners.get(event)?.forEach(listener => listener(data));
    }

    /** Удаление всех слушателей для события (или всех событий) */
    clear(event?: string): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

// Имена событий для Sprint 1
export const GameEvents = {
    STATE_RESOURCES_CHANGED: 'state:resources:changed',
    STATE_HERO_CHANGED: 'state:hero:changed',
    STATE_EQUIPMENT_CHANGED: 'state:equipment:changed',
    SCENE_TRANSITION_START: 'scene:transition:start',
    SCENE_TRANSITION_END: 'scene:transition:end',
} as const;
