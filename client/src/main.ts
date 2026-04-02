import { Application } from 'pixi.js';
import type { IBalanceConfig } from 'shared';
import balanceConfig from '@config/balance.json';
import { EventBus } from './core/EventBus';
import { GameState } from './core/GameState';
import { SceneManager, TransitionType } from './core/SceneManager';
import { HubScene } from './scenes/HubScene';
import { PveMapScene } from './scenes/PveMapScene';
import { PvpLobbyScene } from './scenes/PvpLobbyScene';
import { InventoryScene } from './scenes/InventoryScene';
import { DevPanelScene } from './scenes/DevPanelScene';

// Точка входа — инициализация PixiJS Application и игровых систем
async function main(): Promise<void> {
    const app = new Application();

    await app.init({
        width: 390,
        height: 844,
        backgroundColor: 0x1C2340,
        resizeTo: window,
    });

    document.body.appendChild(app.canvas);

    // Дождаться загрузки шрифта Nunito
    await document.fonts.ready;

    // Инициализация ядра
    const eventBus = new EventBus();
    const gameState = new GameState(balanceConfig as IBalanceConfig, eventBus);
    const sceneManager = new SceneManager(app, eventBus);

    // Регистрация сцен
    sceneManager.register('hub', () => new HubScene(gameState, eventBus, sceneManager));
    sceneManager.register('pveMap', () => new PveMapScene(sceneManager));
    sceneManager.register('pvpLobby', () => new PvpLobbyScene(sceneManager));
    sceneManager.register('inventory', () => new InventoryScene(sceneManager));
    sceneManager.register('devPanel', () => new DevPanelScene(sceneManager));

    // Стартовая сцена
    await sceneManager.goto('hub', { transition: TransitionType.FADE });

    // Обработка ресайза
    window.addEventListener('resize', () => {
        sceneManager.resize(app.screen.width, app.screen.height);
    });
}

main();
