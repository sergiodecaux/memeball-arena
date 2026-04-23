# 🎮 GameScene Systems - Полная документация

Модульные системы для игровой сцены Soccer Caps.

**Версия:** 2.0  
**Дата:** 22 января 2026

---

## 📁 Структура

```
src/scenes/game/systems/
├── GameInput.ts       # Обработка ввода пользователя (~220 строк)
├── GameState.ts       # Управление состоянием игры (~260 строк)
├── GameResults.ts     # Обработка результатов матча (~230 строк)
├── GameUI.ts          # UI карточек способностей (~520 строк)
├── GamePvP.ts         # PvP синхронизация (~280 строк)
├── GameCamera.ts      # Управление камерой (~200 строк)
├── GameLifecycle.ts   # Жизненный цикл матча (~400 строк)
└── README.md          # Эта документация
```

**Всего извлечено:** ~2,110 строк в 7 систем

---

## 🎯 GameInput - Система ввода

### Назначение
Обрабатывает ввод пользователя: тапы, выбор юнитов, взаимодействие с UI.

### Использование

```typescript
import { GameInput, GameInputConfig } from './systems/GameInput';

const inputConfig: GameInputConfig = {
  scene: this,
  onCapSelected: (cap) => {
    console.log('Selected cap:', cap);
  },
  isAbilityActive: () => this.abilityManager.isTargeting(),
  getCurrentPlayer: () => this.matchDirector.getCurrentPlayer(),
  getMyOwner: () => this.isPvPMode ? this.mp.getMyPlayerIndex() : 1,
};

this.gameInput = new GameInput(inputConfig);
this.gameInput.setup();
```

### Методы

- `setup()` - Инициализация системы ввода
- `cleanup()` - Очистка обработчиков событий
- `getSelectedCap()` - Получение выбранного юнита
- `clearSelection()` - Сброс выбора юнита
- `setCardTooltipOpen(isOpen)` - Установка состояния тултипа
- `isAbilityInputLocked()` - Проверка блокировки ввода

---

## 💾 GameState - Управление состоянием

### Назначение
Управляет состоянием игры: позиции, сохранение, загрузка.

### Использование

```typescript
import { GameState, GameStateConfig } from './systems/GameState';

const stateConfig: GameStateConfig = {
  scene: this,
  fieldBounds: this.fieldBounds,
  startPositions: this.startPositions,
};

this.gameState = new GameState(stateConfig);
this.gameState.setFactions('magma', 'frost');
this.gameState.setMatchDuration(180);
```

### Методы

- `getState(...)` - Получение текущего состояния игры
- `saveMatchProgress(state)` - Сохранение прогресса в localStorage
- `loadMatchProgress()` - Загрузка сохранённого прогресса
- `resetPositions(caps, ball)` - Сброс позиций в стартовые
- `updatePlayerPositionsFromFormation(caps, formation)` - Обновление из формации
- `relativeToAbsolute(relX, relY)` - Конвертация координат
- `setFactions(player, opponent)` - Установка фракций
- `setMatchDuration(duration)` - Установка длительности матча

---

## 🏆 GameResults - Обработка результатов

### Назначение
Обрабатывает результаты матча: обновляет лигу, турниры, задачи.

### Использование

```typescript
import { GameResults, GameResultsConfig } from './systems/GameResults';

const resultsConfig: GameResultsConfig = {
  matchContext: 'league',
};

this.gameResults = new GameResults(resultsConfig);

// После завершения матча
await this.gameResults.processResult(matchResult);
```

### Методы

- `async processResult(result)` - Обработка результата матча
- `getContext()` - Получение контекста матча
- `setContext(context)` - Установка контекста
- `setTournamentData(id, seriesId, round)` - Установка данных турнира

---

## 🎨 GameUI - UI карточек

### Назначение
Управляет UI панелью карточек способностей, тултипами, кулдаунами.

### Использование

```typescript
import { GameUI, GameUIConfig } from './systems/GameUI';

const uiConfig: GameUIConfig = {
  scene: this,
  abilityManager: this.abilityManager,
  onCardTooltipStateChange: (isOpen) => {
    this.gameInput.setCardTooltipOpen(isOpen);
  },
};

this.gameUI = new GameUI(uiConfig);
this.gameUI.createCardPanel();
```

### Методы

- `createCardPanel()` - Создание панели карточек
- `updateCardPanelUI()` - Обновление UI панели
- `startCooldownTimer()` - Запуск таймера кулдауна
- `selectCardSlot(index, cardId, x, y)` - Выбор слота карты
- `isTooltipOpen()` - Проверка, открыт ли тултип
- `cleanup()` - Очистка

---

## 🌐 GamePvP - PvP синхронизация

### Назначение
Управляет PvP синхронизацией, обработкой событий PvP.

### Использование

```typescript
import { GamePvP, GamePvPConfig } from './systems/GamePvP';

const pvpConfig: GamePvPConfig = {
  scene: this,
  isHost: this.isHost,
  isPvPMode: this.isPvPMode,
  matchDuration: this.matchDuration,
  onMatchEnd: (data) => this.onMatchEnd(data),
  getMatchDirector: () => this.matchDirector,
};

this.gamePvP = new GamePvP(pvpConfig);
this.gamePvP.setup();

// Создание синхронизации
await this.gamePvP.createPvPSync({
  onShootExecuted: (data, isMyShoot) => { /* ... */ },
  onTurnChange: (data) => { /* ... */ },
  onGoalScored: (data) => { /* ... */ },
});
```

### Методы

- `setup()` - Настройка PvP
- `async createPvPSync(callbacks)` - Создание PvP синхронизации
- `getMyOwner()` - Получение индекса владельца
- `isHost()` - Проверка, является ли игрок хостом
- `getMyId()` - Получение ID игрока
- `sendShoot(data)` - Отправка события удара
- `sendGoal(data)` - Отправка события гола
- `cleanup()` - Очистка

---

## 📷 GameCamera - Управление камерой

### Назначение
Управляет камерой: позиционирование, эффекты, ресайз.

### Использование

```typescript
import { GameCamera, GameCameraConfig } from './systems/GameCamera';

const cameraConfig: GameCameraConfig = {
  scene: this,
  fieldBounds: this.fieldBounds,
};

this.gameCamera = new GameCamera(cameraConfig);
this.gameCamera.setup();

// Регистрация UI для ресайза
this.gameCamera.registerCardPanel(this.cardPanel);
this.gameCamera.registerHUD(this.gameHUD);
```

### Методы

- `setup()` - Инициализация камеры
- `centerOnField()` - Центрирование на поле
- `registerCardPanel(panel)` - Регистрация панели для ресайза
- `registerHUD(hud)` - Регистрация HUD для ресайза
- `follow(target, lerp)` - Следование за объектом
- `shake(duration, intensity)` - Эффект тряски
- `flash(duration, r, g, b)` - Эффект вспышки
- `fade(duration, r, g, b)` - Эффект затемнения
- `setZoom(zoom, duration)` - Зум камеры
- `panTo(x, y, duration)` - Панорамирование к точке
- `cleanup()` - Очистка

---

## 🔄 GameLifecycle - Жизненный цикл

### Назначение
Управляет жизненным циклом матча: интро, старт, пауза, результаты.

### Использование

```typescript
import { GameLifecycle, GameLifecycleConfig } from './systems/GameLifecycle';

const lifecycleConfig: GameLifecycleConfig = {
  scene: this,
  isCampaignMode: this.isCampaignMode,
  campaignLevelConfig: this.campaignLevelConfig,
  matchContext: this.matchContext,
  isAIEnabled: this.isAIEnabled,
  opponentName: this.opponentName,
  opponentAvatarId: this.opponentAvatarId,
  getState: () => this.getState(),
  onMatchStart: () => { /* ... */ },
  onMatchEnd: (result) => this.handleMatchEnd(result),
  onRestart: () => this.restartGame(),
  getMatchDirector: () => this.matchDirector,
  getShootingController: () => this.shootingController,
  getGameHUD: () => this.gameHUD,
  getCardPanel: () => this.cardPanel,
  getAbilityManager: () => this.abilityManager,
  getTutorialOverlay: () => this.tutorialOverlay,
  getCampaignDialogue: () => this.campaignDialogue,
};

this.gameLifecycle = new GameLifecycle(lifecycleConfig);
this.gameLifecycle.showMatchIntro();
```

### Методы

- `showMatchIntro()` - Показ интро матча
- `showPauseMenu()` - Показ меню паузы
- `showFormationMenu()` - Показ меню формации
- `showResultScreen(result)` - Показ экрана результатов
- `isResultScreenShown()` - Проверка, показан ли результат
- `cleanup()` - Очистка

---

## 🔄 Полная интеграция с GameScene

### Пример

```typescript
export class GameScene extends Phaser.Scene {
  // Системы
  private gameInput!: GameInput;
  private gameState!: GameState;
  private gameResults!: GameResults;
  private gameUI!: GameUI;
  private gamePvP!: GamePvP;
  private gameCamera!: GameCamera;
  private gameLifecycle!: GameLifecycle;
  
  create(data?: GameSceneData) {
    // ... инициализация поля, юнитов ...
    
    this.initializeSystems(data);
    
    // Запуск матча
    this.gameLifecycle.showMatchIntro();
  }
  
  private initializeSystems(data?: GameSceneData): void {
    // GameState
    this.gameState = new GameState({
      scene: this,
      fieldBounds: this.fieldBounds,
      startPositions: this.startPositions,
    });
    
    // GameInput
    this.gameInput = new GameInput({
      scene: this,
      onCapSelected: (cap) => this.onCapSelected(cap),
      isAbilityActive: () => this.abilityManager?.isTargeting() || false,
      getCurrentPlayer: () => this.matchDirector.getCurrentPlayer(),
      getMyOwner: () => this.gamePvP.getMyOwner(),
    });
    this.gameInput.setup();
    
    // GameResults
    this.gameResults = new GameResults({
      matchContext: data?.matchContext || 'casual',
    });
    
    // GameUI
    this.gameUI = new GameUI({
      scene: this,
      abilityManager: this.abilityManager,
      onCardTooltipStateChange: (isOpen) => {
        this.gameInput.setCardTooltipOpen(isOpen);
      },
    });
    this.gameUI.createCardPanel();
    
    // GamePvP
    this.gamePvP = new GamePvP({
      scene: this,
      isHost: this.isHost,
      isPvPMode: this.isPvPMode,
      matchDuration: this.matchDuration,
      onMatchEnd: (data) => this.onMatchEnd(data),
      getMatchDirector: () => this.matchDirector,
    });
    this.gamePvP.setup();
    
    // GameCamera
    this.gameCamera = new GameCamera({
      scene: this,
      fieldBounds: this.fieldBounds,
    });
    this.gameCamera.setup();
    this.gameCamera.registerCardPanel(this.gameUI.getCardPanel()!);
    this.gameCamera.registerHUD(this.gameHUD);
    
    // GameLifecycle
    this.gameLifecycle = new GameLifecycle({
      scene: this,
      isCampaignMode: this.isCampaignMode,
      campaignLevelConfig: this.campaignLevelConfig,
      matchContext: this.matchContext,
      isAIEnabled: this.isAIEnabled,
      opponentName: this.opponentName,
      opponentAvatarId: this.opponentAvatarId,
      getState: () => this.getState(),
      onMatchStart: () => this.onMatchStart(),
      onMatchEnd: (result) => this.handleMatchEnd(result),
      onRestart: () => this.restartGame(),
      getMatchDirector: () => this.matchDirector,
      getShootingController: () => this.shootingController,
      getGameHUD: () => this.gameHUD,
      getCardPanel: () => this.gameUI.getCardPanel(),
      getAbilityManager: () => this.abilityManager,
      getTutorialOverlay: () => this.tutorialOverlay,
      getCampaignDialogue: () => this.campaignDialogue,
    });
  }
  
  shutdown(): void {
    this.gameInput?.cleanup();
    this.gameUI?.cleanup();
    this.gamePvP?.cleanup();
    this.gameCamera?.cleanup();
    this.gameLifecycle?.cleanup();
    
    super.shutdown();
  }
}
```

---

## ✅ Преимущества модульной архитектуры

### 1. **Читаемость** ⭐⭐⭐⭐⭐
- Каждая система отвечает за одну задачу
- Легко найти нужную логику
- Понятная структура

### 2. **Поддержка** ⭐⭐⭐⭐⭐
- Изменения изолированы
- Меньше зависимостей
- Проще тестировать

### 3. **Переиспользование** ⭐⭐⭐⭐⭐
- Системы можно использовать в других сценах
- Универсальные интерфейсы
- Легко расширять

### 4. **Тестирование** ⭐⭐⭐⭐⭐
- Можно тестировать системы отдельно
- Моки и стабы легко создавать
- Изолированные unit-тесты

---

## 📊 Метрики

### До рефакторинга
- **GameScene.ts**: 2,309 строк
- **Методов**: 62
- **Все в одном файле**

### После рефакторинга
- **GameScene.ts**: ~300-400 строк (координатор)
- **Систем**: 7 модулей
- **Извлечено**: ~2,110 строк
- **Сокращение**: ~91% 🎉

---

## 🚀 Дальнейшее развитие

### Возможные улучшения

1. **Unit-тесты** для каждой системы
2. **E2E тесты** для интеграции
3. **Документация API** с примерами
4. **Диаграммы** архитектуры
5. **Видео-туториалы** по использованию

---

**Версия:** 2.0  
**Обновлено:** 22 января 2026  
**Автор:** AI Assistant  
**Проект:** Soccer Caps - Telegram Mini App
