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
import { SanctuaryScene } from './scenes/SanctuaryScene';
import { LootScene } from './scenes/LootScene';
import { ShopScene } from './scenes/ShopScene';
import { CampScene } from './scenes/CampScene';
import { EventScene } from './scenes/EventScene';
import { PveResultScene } from './scenes/PveResultScene';
import hubBgNewUrl from './assets/hub-bg-new.jpg';

// Точка входа — инициализация PixiJS Application и игровых систем
async function main(): Promise<void> {
    const app = new Application();

    // Resolution = max(DPR, scaleFactor) — чтобы Text-текстуры рендерились
    // с достаточной детализацией даже на десктопах с DPR=1.
    // Container scale растягивает сцены из 390×844 → экран, и Text должен
    // иметь достаточно пикселей для этого масштаба.
    const dpr = window.devicePixelRatio || 1;
    const scaleFactor = Math.min(
        window.innerWidth / THEME.layout.designWidth,
        window.innerHeight / THEME.layout.designHeight,
    );
    // Ограничиваем resolution сверху, чтобы 4K-экраны не раздували canvas до десятков мегапикселей.
    const resolution = Math.min(2, Math.max(dpr, Math.ceil(scaleFactor)));

    await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: THEME.colors.bg_primary,
        resolution,
        autoDensity: true,
        resizeTo: window,
    });

    document.body.appendChild(app.canvas);

    // Дождаться загрузки шрифта Nunito
    await document.fonts.ready;

    // Прелоад ассетов
    await Assets.load({ alias: 'hub-bg-new', src: hubBgNewUrl });

    // Инициализация ядра
    const eventBus = new EventBus();
    const gameState = new GameState(balanceConfig as unknown as IBalanceConfig, eventBus);
    const sceneManager = new SceneManager(app, eventBus);

    // Регистрация сцен
    sceneManager.register('hub', () => new HubScene(gameState, eventBus, sceneManager));
    sceneManager.register('pveMap', () => new PveMapScene(gameState, eventBus, sceneManager));
    sceneManager.register('pvpLobby', () => new PvpLobbyScene(sceneManager));
    sceneManager.register('inventory', () => new InventoryScene(sceneManager));
    sceneManager.register('devPanel', () => new DevPanelScene(sceneManager));
    sceneManager.register('preBattle', () => new PreBattleScene(gameState, eventBus, sceneManager));
    sceneManager.register('battle', () => new BattleScene(gameState, eventBus, sceneManager));
    sceneManager.register('sanctuary', () => new SanctuaryScene());
    sceneManager.register('loot', () => new LootScene());
    sceneManager.register('shop', () => new ShopScene());
    sceneManager.register('camp', () => new CampScene());
    sceneManager.register('event', () => new EventScene());
    sceneManager.register('pveResult', () => new PveResultScene());

    // Стартовая сцена
    await sceneManager.goto('hub', { transition: TransitionType.FADE });

    // Обработка ресайза
    window.addEventListener('resize', () => {
        sceneManager.resize(app.screen.width, app.screen.height);
    });
}

main();
