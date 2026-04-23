# RewardSelectionOverlay - Quick Start

## 🚀 Быстрый старт

```typescript
import { RewardSelectionOverlay } from './RewardSelectionOverlay';

// В любой Phaser-сцене:
const overlay = new RewardSelectionOverlay(
  this,
  ['magma_ember_fang', 'cyborg_arc_striker', 'void_phantom'],
  (selectedUnitId: string) => {
    console.log('Selected:', selectedUnitId);
    playerData.grantUnitReward(selectedUnitId);
  }
);

overlay.show();
```

## 📚 Документация

- **Полная документация**: `docs/UI_REWARD_SELECTION_OVERLAY.md`
- **Примеры интеграции**: `docs/REWARD_SELECTION_INTEGRATION_EXAMPLE.md`

## 🎨 Особенности

- ✅ Современный киберспортивный дизайн
- ✅ Цвета фракций (Magma/Cyborg/Void/Insect)
- ✅ Hover-эффекты с масштабированием и свечением
- ✅ Плавные анимации появления/исчезновения
- ✅ Круглые аватары юнитов с вращающимся кольцом
- ✅ 4 бара статов (PWR, DEF, SPD, TEC)
- ✅ Haptic feedback и звуки
- ✅ EventBus интеграция

## 📦 Зависимости

- `UnitsRepository` — данные юнитов
- `EventBus` — события выбора
- `AudioManager` — звуки
- `Haptics` — вибрация

## 🔧 API

### Constructor
```typescript
new RewardSelectionOverlay(
  scene: Phaser.Scene,
  unitIds: string[],      // Массив из 3 ID
  onSelect: (id: string) => void
)
```

### Methods
- `show()` — показать окно
- `close()` — закрыть окно
- `destroy()` — уничтожить

## 🎯 Типичное использование

### В ProgressionScene (награды за уровень)
```typescript
private openUnitChoiceForReward(choices: string[]): void {
  const overlay = new RewardSelectionOverlay(this, choices, (id) => {
    playerData.grantUnitReward(id);
    this.updateContentForTab(this.currentTab);
  });
  overlay.show();
}
```

### В GameScene (после матча)
```typescript
private showMatchReward(choices: string[]): void {
  this.time.delayedCall(1000, () => {
    const overlay = new RewardSelectionOverlay(this, choices, (id) => {
      playerData.grantUnitReward(id);
      this.showResultScreen();
    });
    overlay.show();
  });
}
```

### С генерацией случайных юнитов
```typescript
import { getUnitsByFaction } from '../../data/UnitsCatalog';

const factionUnits = getUnitsByFaction('magma');
const shuffled = [...factionUnits].sort(() => Math.random() - 0.5);
const choices = shuffled.slice(0, 3).map(u => u.id);

const overlay = new RewardSelectionOverlay(this, choices, (id) => {
  playerData.grantUnitReward(id);
});
overlay.show();
```

## 🎨 Кастомизация

### Цвета фракций
Измените константу `FACTION_COLORS` в начале файла:
```typescript
const FACTION_COLORS: Record<FactionId, number> = {
  magma: 0xdc2626,   // Ваш цвет
  cyborg: 0x3b82f6,
  void: 0xa855f7,
  insect: 0x22c55e,
};
```

### Размеры карточек
В методе `createUnitCard()`:
```typescript
const width = 260;  // Ширина
const height = 480; // Высота
```

В методе `createUnitCards()`:
```typescript
const cardGap = 30; // Отступ между карточками
```

## 🐛 Troubleshooting

### Юнит не найден
```typescript
// Проверьте ID юнита
const unit = getUnitById('magma_ember_fang');
if (!unit) {
  console.error('Unit not found!');
}
```

### Текстура не загружена
Класс автоматически использует fallback (цветной круг + буква).

### Окно не появляется
Убедитесь, что вызвали `show()`:
```typescript
overlay.show(); // ← Не забудьте!
```

## 📝 События

### REWARD_UNIT_SELECTED
```typescript
import { EventBus, GameEvents } from '../../core/EventBus';

EventBus.on(GameEvents.REWARD_UNIT_SELECTED, (data: { unitId: string }) => {
  console.log('Selected:', data.unitId);
});
```

## ✅ Чек-лист

- [ ] Импортировать класс
- [ ] Подготовить 3 ID юнитов
- [ ] Реализовать callback
- [ ] Вызвать `show()`
- [ ] Протестировать hover
- [ ] Протестировать выбор

---

**Версия**: 1.0.0  
**Автор**: Galaxy League Team  
**Дата**: 2026-01-21
