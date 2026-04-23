# 🛒 Shop System - Руководство разработчика

Модульная система магазина для Soccer Caps.

---

## 📁 Структура

```
src/scenes/shop/
├── types.ts                    # Общие типы и интерфейсы
├── tabs/                       # Вкладки магазина
│   ├── ShopTabRenderer.ts     # Базовый класс
│   ├── CardsTab.ts            # Бустеры и сундуки
│   ├── TeamsTab.ts            # Фракции (TODO)
│   ├── UnitsTab.ts            # Юниты (TODO)
│   ├── BallsTab.ts            # Мячи (TODO)
│   ├── AvatarsTab.ts          # Аватары (TODO)
│   └── KeysTab.ts             # Ключи турниров (TODO)
├── animations/                 # Анимации
│   ├── BoosterAnimation.ts    # Открытие бустеров
│   └── ChestAnimation.ts      # Открытие сундуков
└── components/                 # Компоненты
    └── ShopScrollManager.ts   # Управление скроллингом
```

---

## 🚀 Быстрый старт

### 1. Создание новой вкладки

```typescript
// src/scenes/shop/tabs/MyTab.ts
import { ShopTabRenderer, TabRenderContext } from './ShopTabRenderer';
import { Card } from '../types';

export class MyTab extends ShopTabRenderer {
  constructor(context: TabRenderContext) {
    super(context);
  }
  
  render(): Card[] {
    this.cleanup(); // Очистка предыдущего контента
    
    let y = this.topInset + 200;
    
    // Добавляем секцию
    y = this.addSection(y, '🎮 МОЯ ВКЛАДКА', this.colors.primary);
    
    // Создаём контент
    const card = this.createMyCard(y);
    this.contentContainer.add(card);
    this.cards.push({ container: card, y, height: 150 });
    
    return this.cards;
  }
  
  private createMyCard(y: number): Phaser.GameObjects.Container {
    // Ваша логика создания карточки
    return this.scene.add.container(0, y);
  }
}
```

### 2. Использование в ShopScene

```typescript
import { MyTab } from './shop/tabs/MyTab';
import { ShopScrollManager } from './shop/components/ShopScrollManager';

export class ShopScene extends Phaser.Scene {
  private scrollManager!: ShopScrollManager;
  private currentTab!: ShopTabRenderer;
  
  create() {
    // Инициализация скролла
    this.scrollManager = new ShopScrollManager(this, this.contentContainer);
    this.scrollManager.setup();
    
    // Создание вкладки
    this.currentTab = new MyTab({
      scene: this,
      contentContainer: this.contentContainer,
      topInset: this.topInset,
      bottomInset: this.bottomInset,
      onCardAdded: (card) => {
        // Обработка добавления карточки
      },
      onPurchase: () => {
        this.updateCurrency();
      },
    });
    
    // Рендеринг
    const cards = this.currentTab.render();
    this.scrollManager.setCards(cards);
  }
  
  shutdown() {
    this.scrollManager.cleanup();
    this.currentTab.cleanup();
  }
}
```

### 3. Использование анимаций

```typescript
import { BoosterAnimation, BoosterAnimationConfig } from './shop/animations/BoosterAnimation';
import { CardDefinition } from '../../data/CardsCatalog';

// Открытие бустера
const cards: CardDefinition[] = [...]; // Полученные карты
const config: BoosterAnimationConfig = {
  cards,
  factionId: 'magma', // Опционально
  onComplete: () => {
    console.log('Анимация завершена');
    animation.close();
  },
  getBoosterTextureKey: (config) => {
    return `booster_${config.type}`;
  },
};

const animation = new BoosterAnimation(this, config);
animation.start();
```

---

## 🎨 Базовый класс ShopTabRenderer

### Доступные методы:

#### `addSection(y: number, text: string, color: number): number`
Добавляет заголовок секции.

```typescript
y = this.addSection(y, '🎁 БУСТЕРЫ', 0x3b82f6);
```

#### `createButton(x, y, text, onClick, options?)`
Создаёт стандартную кнопку.

```typescript
const button = this.createButton(100, 200, 'Купить', () => {
  console.log('Clicked!');
}, {
  width: 150,
  color: 0x10b981,
  disabled: false,
});
```

#### `canAfford(coins?, crystals?): boolean`
Проверяет возможность покупки.

```typescript
if (this.canAfford(100, 0)) {
  // Можно купить за 100 монет
}
```

#### `formatNum(n: number): string`
Форматирует числа (1000 → 1K, 1000000 → 1M).

```typescript
const formatted = this.formatNum(1500); // "1.5K"
```

#### `getPlayerData()`
Получает данные игрока.

```typescript
const data = this.getPlayerData();
console.log(data.coins, data.crystals);
```

---

## 📦 Компонент ShopScrollManager

### Методы:

```typescript
const scrollManager = new ShopScrollManager(scene, container);

// Настройка
scrollManager.setup();

// Установка карточек
scrollManager.setCards([
  { container: card1, y: 0, height: 100 },
  { container: card2, y: 120, height: 150 },
]);

// Обновление позиций
scrollManager.updateCardPositions();

// Сброс
scrollManager.reset();

// Очистка
scrollManager.cleanup();
```

---

## 🎬 Анимации

### BoosterAnimation

**5 фаз анимации:**
1. **Phase 0**: Вход пакета (0.0-0.5s)
2. **Phase 1**: Зарядка (0.5-1.5s)
3. **Phase 2**: Разрыв фольги (1.5-2.2s)
4. **Phase 3**: Рулетка (2.2-3.5s)
5. **Phase 4**: Открытие карт (3.5-5.0s)

**Tap-to-skip**: Пользователь может пропустить анимацию касанием.

### ChestAnimation

**3 фазы анимации:**
1. **Phase 0**: Вход сундука
2. **Phase 1**: Зарядка
3. **Phase 2**: Открытие + показ наград

**Tap-to-skip**: Также поддерживается.

---

## 🔧 Настройка и кастомизация

### Изменение стилей кнопок

Переопределите метод `createButton` в своей вкладке:

```typescript
protected createButton(x, y, text, onClick, options?) {
  const button = super.createButton(x, y, text, onClick, options);
  // Дополнительные настройки
  return button;
}
```

### Добавление собственных секций

```typescript
private createCustomSection(y: number): number {
  const container = this.scene.add.container(0, y);
  // Ваш контент
  this.contentContainer.add(container);
  return y + 100;
}
```

---

## 📊 Типы данных

### Card

```typescript
interface Card {
  container: Phaser.GameObjects.Container;
  y: number;
  height: number;
}
```

### TabRenderContext

```typescript
interface TabRenderContext {
  scene: Phaser.Scene;
  contentContainer: Phaser.GameObjects.Container;
  topInset: number;
  bottomInset: number;
  onCardAdded?: (card: Card) => void;
  onPurchase?: () => void;
}
```

---

## ✅ Best Practices

### 1. **Всегда вызывайте cleanup()**
```typescript
shutdown() {
  this.currentTab.cleanup();
  this.scrollManager.cleanup();
}
```

### 2. **Используйте базовые методы**
Не дублируйте код - используйте методы из `ShopTabRenderer`.

### 3. **Следите за памятью**
Удаляйте неиспользуемые объекты через `.destroy()`.

### 4. **Тестируйте на разных разрешениях**
Проверяйте работу на разных размерах экрана.

---

## 🐛 Отладка

### Логирование скролла

```typescript
console.log('Scroll Y:', scrollManager.getScrollY());
console.log('Drag Distance:', scrollManager.getDragDistance());
```

### Проверка видимости карточек

```typescript
this.cards.forEach(card => {
  console.log(`Card at ${card.y}: ${card.container.visible}`);
});
```

---

## 📚 Дополнительные ресурсы

- [Phaser 3 Documentation](https://photonstorm.github.io/phaser3-docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [REFACTORING_REPORT.md](../../../REFACTORING_REPORT.md) - Отчёт о рефакторинге

---

## 🤝 Вклад в проект

При добавлении новой вкладки:
1. Создайте класс, наследующий `ShopTabRenderer`
2. Реализуйте метод `render()`
3. Добавьте очистку в `cleanup()`
4. Обновите эту документацию
5. Добавьте тесты (TODO)

---

**Версия:** 1.0  
**Обновлено:** 22 января 2026
