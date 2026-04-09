import { Container } from 'pixi.js';
import { GameState } from '../core/GameState';
import { RelicReplaceOverlay } from '../ui/RelicReplaceOverlay';
import type { IRelic } from 'shared';

/**
 * Добавить реликвию с UI выбора замены при переполнении.
 * Если слоты свободны — добавляет сразу и вызывает onDone.
 * Если лимит — показывает оверлей с выбором замены.
 *
 * @param parent — контейнер (сцена), к которому прикрепить overlay
 * @param gameState — состояние игры
 * @param newRelic — новая реликвия
 * @param onDone — вызывается после добавления или пропуска
 */
export function addRelicWithUI(
    parent: Container,
    gameState: GameState,
    newRelic: IRelic,
    onDone: () => void,
): void {
    if (!gameState.isRelicsFull()) {
        gameState.addRelic(newRelic);
        onDone();
        return;
    }

    // Лимит достигнут — показать оверлей
    const overlay = new RelicReplaceOverlay(
        [...gameState.activeRelics],
        newRelic,
        (replaceIndex: number) => {
            gameState.addRelic(newRelic, replaceIndex);
            parent.removeChild(overlay);
            overlay.destroy({ children: true });
            onDone();
        },
        () => {
            // Игрок отказался — не добавляем реликвию
            parent.removeChild(overlay);
            overlay.destroy({ children: true });
            onDone();
        },
    );
    parent.addChild(overlay);
}
