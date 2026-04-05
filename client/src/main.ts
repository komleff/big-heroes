import { Application, Assets } from 'pixi.js';
import type { IBalanceConfig } from 'shared';
import balanceConfig from '@config/balance.json';
import { THEME } from './config/ThemeConfig';
import { EventBus } from './core/EventBus';
import { GameState } from './core/GameState';
import { SceneManager, TransitionType } from './core/SceneManager';
import { HubScene } from './scenes/HubScene';
import { PveMapScene } from './scenes/PveMapScene';
import { PvpLobbyScene } from './scenes/PvpLobbyScene';
import { InventoryScene } from './scenes/InventoryScene';
import { DevPanelScene } from './scenes/DevPanelScene';
import { PreBattleScene } from './scenes/PreBattleScene';
import { BattleScene } from './scenes/BattleScene';
import hubBgUrl from './assets/hub-bg.png';

// Точка входа — инициализация PixiJS Application и игровых систем
async function main(): Promise<void> {
    const app = new Application();

    await app.init({
        width: THEME.layout.designWidth,
        height: THEME.layout.designHeight,
        backgroundColor: THEME.colors.bg_primary,
        resizeTo: window,
    });

    document.body.appendChild(app.canvas);

    // Дождаться загрузки шрифта Nunito
    await document.fonts.ready;

    // Прелоад ассетов (фон хаба)
    await Assets.load(hubBgUrl);

    // Инициализация ядра
    const eventBus = new EventBus();
    const gameState = new GameState(balanceConfig as unknown as IBalanceConfig, eventBus);
    const sceneManager = new SceneManager(app, eventBus);

    // Регистрация сцен
    sceneManager.register('hub', () => new HubScene(gameState, eventBus, sceneManager));
    sceneManager.register('pveMap', () => new PveMapScene(sceneManager));
    sceneManager.register('pvpLobby', () => new PvpLobbyScene(sceneManager));
    sceneManager.register('inventory', () => new InventoryScene(sceneManager));
    sceneManager.register('devPanel', () => new DevPanelScene(sceneManager));
    sceneManager.register('preBattle', () => new PreBattleScene(gameState, eventBus, sceneManager));
    sceneManager.register('battle', () => new BattleScene(gameState, eventBus, sceneManager));

    // Стартовая сцена
    await sceneManager.goto('hub', { transition: TransitionType.FADE });

    // Обработка ресайза
    window.addEventListener('resize', () => {
        sceneManager.resize(app.screen.width, app.screen.height);
    });
}

main();
