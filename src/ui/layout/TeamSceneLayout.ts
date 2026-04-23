// src/ui/layout/TeamSceneLayout.ts
// Единый источник правды для размеров и позиций в TeamScene

import Phaser from 'phaser';
import { tgApp } from '../../utils/TelegramWebApp';

/**
 * Конфигурация макета TeamScene
 * Все размеры, отступы и параметры верстки в одном месте
 */
export const TEAM_LAYOUT = {
  // ========== HEADER (Шапка) ==========
  HEADER: {
    baseHeight: 110,                    // Базовая высота шапки
    minTopPadding: 20,                  // Минимальный отступ сверху
    titleFontSize: 20,                   // Размер шрифта заголовка "MY TEAM"
    titleOffsetY: 40,                   // Смещение заголовка от верха (до учета safe area)
    masteryBadge: {
      width: 120,                       // Ширина бейджа мастерства
      height: 24,                       // Высота бейджа
      offsetX: -60,                     // Смещение по X от центра (влево)
      offsetY: 28,                      // Смещение по Y от заголовка (вниз)
      fontSize: 11,                     // Размер шрифта уровня
      iconFontSize: 14,                 // Размер иконки ранга
      progressBar: {
        width: 50,                      // Ширина прогресс-бара
        height: 6,                      // Высота прогресс-бара
        offsetX: 58,                    // Смещение от начала бейджа
      },
      xpFontSize: 8,                    // Размер шрифта XP
    },
    currency: {
      offsetX: -24,                     // Смещение валюты от правого края
      offsetY1: 35,                      // Смещение первой валюты от заголовка
      offsetY2: 55,                      // Смещение второй валюты от заголовка
      fontSize: 14,                      // Размер шрифта валюты
      iconSize: 16,                      // Размер иконки валюты
    },
  },

  // ========== ACTIVE SQUAD (Активный отряд) ==========
  ACTIVE_SQUAD: {
    titleFontSize: 13,                  // Размер шрифта заголовка "ACTIVE SQUAD"
    slotsLabelFontSize: 11,              // Размер шрифта "X/5 SLOTS"
    titleOffsetY: 26,                   // Отступ после заголовка
    slotHeight: 100,                    // Высота одного слота
    slotPadding: 12,                    // Отступ от краев экрана
    slotGap: 8,                         // Расстояние между слотами
    slotBorderRadius: 14,               // Скругление углов слота
    slotBorderWidth: 2,                 // Толщина обводки
    slotScaleThreshold: 60,              // Минимальная ширина слота до масштабирования
    slotScaleFactor: 0.85,              // Коэффициент масштабирования при малой ширине
    
    // Иконка юнита в слоте
    unitIcon: {
      size: 38,                          // Размер иконки юнита
      offsetY: -14,                      // Смещение по Y (вверх от центра)
      glowRadius: 22,                    // Радиус свечения
      circleRadius: 18,                  // Радиус круга-подложки
      circleStrokeWidth: 2,              // Толщина обводки круга
    },
    
    // Класс юнита
    classIcon: {
      fontSize: 12,                      // Размер шрифта иконки класса
      offsetY: 10,                       // Смещение по Y от центра
    },
    
    // Сила юнита
    power: {
      fontSize: 10,                      // Размер шрифта силы
      offsetY: 28,                       // Смещение по Y от центра
      color: 0xfacc15,                   // Цвет силы (желтый)
    },
    
    // Заблокированный слот
    locked: {
      lockIconSize: 24,                  // Размер иконки замка
      lockIconOffsetY: -12,              // Смещение иконки замка
      levelFontSize: 10,                 // Размер шрифта уровня разблокировки
      levelOffsetY: 16,                  // Смещение текста уровня
    },
    
    // Выбранный слот (режим замены)
    selected: {
      indicatorFontSize: 8,               // Размер шрифта индикатора "ЗАМЕНА"
      indicatorOffsetY: -12,             // Смещение индикатора от верха слота
      pulseDistance: 2,                  // Расстояние пульсации индикатора
      pulseDuration: 600,                // Длительность пульсации (мс)
    },
  },

  // ========== RESERVES (Резервы) ==========
  RESERVES: {
    titleFontSize: 13,                   // Размер шрифта заголовка "РЕЗЕРВЫ"
    titleOffsetY: 24,                    // Отступ после заголовка
    cols: 3,                             // Количество колонок в сетке
    cardSize: 110,                       // Размер карточки (квадрат)
    cardGap: 12,                         // Расстояние между карточками
    cardPadding: 16,                     // Отступ от краев экрана
    cardBorderRadius: 12,                // Скругление углов карточки
    cardBorderWidth: 2,                 // Толщина обводки карточки
    
    // Иконка юнита в карточке
    unitIcon: {
      sizeRatio: 0.55,                   // Отношение размера иконки к размеру карточки
      offsetY: -8,                       // Смещение по Y (вверх от центра)
    },
    
    // Название юнита
    unitName: {
      fontSize: 11,                       // Размер шрифта названия
      maxLength: 10,                     // Максимальная длина без обрезки
      offsetY: -24,                      // Смещение от нижнего края карточки
      ellipsis: '...',                   // Символ обрезки
    },
    
    // Иконка класса
    classIcon: {
      fontSize: 14,                      // Размер шрифта иконки класса
      offsetY: -10,                      // Смещение от нижнего края карточки
    },
    
    // Бейдж использования (x2, x3 и т.д.)
    usageBadge: {
      size: 22,                          // Размер бейджа
      offsetX: 4,                        // Смещение от правого края
      offsetY: -4,                       // Смещение от верхнего края
      fontSize: 11,                      // Размер шрифта счетчика
    },
    
    // Подсветка при режиме замены
    highlight: {
      strokeWidth: 3,                    // Толщина обводки подсветки
      alpha: { min: 0.4, max: 0.8 },     // Диапазон прозрачности при пульсации
      pulseDuration: 800,                // Длительность пульсации (мс)
    },
  },

  // ========== OVERLAY (Модальное окно выбора юнита) ==========
  OVERLAY: {
    // Размеры карточки
    card: {
      maxWidth: 380,                     // Максимальная ширина карточки
      widthMargin: 60,                   // Отступ от краев экрана
      maxHeight: 500,                    // Максимальная высота карточки
      heightMargin: 200,                 // Отступ от краев экрана
      borderRadius: 20,                  // Скругление углов карточки
      borderWidth: 3,                    // Толщина обводки
      innerPadding: 6,                      // Внутренний отступ для внутренней обводки
    },
    
    // Заголовок (название юнита)
    title: {
      fontSize: 18,                     // Размер шрифта (используется TYPOGRAPHY.sizes.lg)
      offsetY: 30,                       // Смещение от верха карточки
      letterSpacing: 2,                  // Межбуквенное расстояние
      wordWrapWidth: 40,                 // Отступ для переноса текста
    },
    
    // Бейдж фракции
    factionBadge: {
      width: 120,                        // Ширина бейджа
      height: 20,                        // Высота бейджа
      offsetY: 55,                       // Смещение от верха карточки
      borderRadius: 10,                   // Скругление углов
      fontSize: 10,                      // Размер шрифта
      borderWidth: 2,                    // Толщина обводки
    },
    
    // Изображение юнита
    unitImage: {
      offsetY: 150,                      // Смещение от верха карточки
      circleSize: 130,                   // Размер круга-подложки
      imageSizeRatio: 1.3,               // Отношение размера изображения к кругу (для pop-out)
      circleStrokeWidth: 4,              // Толщина обводки круга
      outerGlowWidth: 8,                 // Толщина внешнего свечения
      outerGlowRadius: 16,               // Радиус внешнего свечения
      pulseScale: { min: 0.95, max: 1.05 }, // Диапазон масштаба при пульсации
      pulseDuration: 1500,               // Длительность пульсации (мс)
    },
    
    // Статистика (SPD, PWR, DEF)
    stats: {
      offsetY: 235,                      // Смещение от верха карточки
      barWidth: 120,                     // Отступ ширины баров от края карточки
      barHeight: 10,                     // Высота прогресс-бара
      barSpacing: 28,                    // Расстояние между барами
      labelFontSize: 10,                 // Размер шрифта лейбла
      labelOffsetX: -10,                 // Смещение лейбла от начала бара
      valueFontSize: 12,                 // Размер шрифта значения
      valueOffsetX: 10,                  // Смещение значения от конца бара
      barBorderRadius: 5,                // Скругление углов бара
      animationDelay: 100,               // Задержка анимации между барами (мс)
    },
    
    // Класс юнита
    class: {
      offsetY: 320,                      // Смещение от верха карточки
      fontSize: 12,                      // Размер шрифта (используется TYPOGRAPHY.sizes.sm)
    },
    
    // Описание
    description: {
      offsetY: 345,                      // Смещение от верха карточки
      fontSize: 11,                      // Размер шрифта
      wordWrapWidth: 60,                 // Отступ для переноса текста
    },
    
    // Индикатор (1/3, 2/3, 3/3)
    indicator: {
      offsetY: -120,                     // Смещение от низа карточки (отрицательное)
      width: 60,                         // Ширина индикатора
      height: 24,                        // Высота индикатора
      borderRadius: 12,                   // Скругление углов
      fontSize: 12,                      // Размер шрифта (используется TYPOGRAPHY.sizes.sm)
      borderWidth: 2,                    // Толщина обводки
    },
    
    // Кнопка выбора
    selectButton: {
      offsetY: -60,                      // Смещение от низа экрана (отрицательное)
      width: 240,                         // Ширина кнопки
      height: 50,                        // Высота кнопки
      borderRadius: 25,                   // Скругление углов
      fontSize: 18,                      // Размер шрифта (используется TYPOGRAPHY.sizes.lg)
      letterSpacing: 3,                   // Межбуквенное расстояние
      borderWidth: 3,                    // Толщина обводки
      glowWidth: 8,                      // Толщина свечения
      glowOffset: 4,                     // Смещение свечения
      pulseScale: { min: 0.98, max: 1.02 }, // Диапазон масштаба при пульсации
      pulseDuration: 1000,               // Длительность пульсации (мс)
    },
    
    // Кнопки навигации (влево/вправо)
    navigation: {
      buttonX: 180,                      // Расстояние от центра карточки
      buttonRadius: 32,                  // Радиус кнопки
      buttonStrokeWidth: 3,              // Толщина обводки
      buttonGlowWidth: 6,                // Толщина свечения
      buttonGlowRadius: 38,              // Радиус свечения
      arrowFontSize: 28,                  // Размер шрифта стрелки
      hoverScale: 1.15,                   // Масштаб при наведении
    },
    
    // Кнопка закрытия
    closeButton: {
      size: 50,                          // Размер кнопки
      offsetX: -40,                      // Смещение по X от центра
      offsetY: -40,                      // Смещение по Y от центра (отрицательное)
      fontSize: 28,                      // Размер шрифта иконки X
      borderWidth: 2,                    // Толщина обводки
    },
  },

  // ========== COLORS (Цвета) ==========
  COLORS: {
    // Фоны
    background: {
      main: 0x060a18,                    // Основной фон
      card: 0x0a0f1a,                    // Фон карточек
      header: 0x020617,                  // Фон шапки
      overlay: 0x0a0a15,                 // Фон оверлея
      overlayDark: 0x000000,             // Темный фон оверлея (затемнение)
      overlayDarkAlpha: 0.85,            // Прозрачность темного фона
    },
    
    // Обводки
    border: {
      default: 0x1f2937,                 // Обычная обводка
      light: 0x334155,                   // Светлая обводка
      accent: 0xffffff,                  // Акцентная обводка
      header: 0x334155,                  // Обводка шапки
    },
    
    // Состояния
    state: {
      active: 0xffffff,                  // Активное состояние
      inactive: 0x64748b,                // Неактивное состояние
      selected: 0x22c55e,                 // Выбранное состояние (зеленый)
      locked: 0x334155,                   // Заблокированное состояние
      disabled: 0x475569,                // Отключенное состояние
    },
    
    // Текст
    text: {
      primary: 0xffffff,                 // Основной текст
      secondary: 0x94a3b8,               // Вторичный текст
      tertiary: 0x64748b,                // Третичный текст
      accent: 0x22c55e,                  // Акцентный текст
      warning: 0xfacc15,                 // Предупреждающий текст (желтый)
    },
    
    // Альфа-каналы
    alpha: {
      solid: 1.0,                        // Непрозрачный
      high: 0.98,                        // Почти непрозрачный
      medium: 0.9,                       // Средняя прозрачность
      low: 0.5,                          // Низкая прозрачность
      veryLow: 0.3,                      // Очень низкая прозрачность
    },
  },
} as const;

/**
 * Интерфейс для позиции в сетке
 */
export interface GridPosition {
  x: number;
  y: number;
  row: number;
  col: number;
}

/**
 * Интерфейс для Safe Area
 */
export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
  visibleHeight: number;
}

/**
 * Рассчитывает позиции элементов в сетке
 * 
 * @param totalItems - Общее количество элементов
 * @param cols - Количество колонок
 * @param containerWidth - Ширина контейнера
 * @param itemAspectRatio - Соотношение сторон элемента (width / height), по умолчанию 1 (квадрат)
 * @param padding - Отступ от краев контейнера
 * @param gap - Расстояние между элементами
 * @returns Массив позиций {x, y, row, col}
 */
export function calculateGridPositions(
  totalItems: number,
  cols: number,
  containerWidth: number,
  itemAspectRatio: number = 1,
  padding: number = 0,
  gap: number = 0
): GridPosition[] {
  const positions: GridPosition[] = [];
  
  // Рассчитываем размер элемента
  const availableWidth = containerWidth - padding * 2;
  const itemWidth = (availableWidth - gap * (cols - 1)) / cols;
  const itemHeight = itemWidth / itemAspectRatio;
  
  // Рассчитываем позиции
  for (let i = 0; i < totalItems; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    const x = padding + col * (itemWidth + gap) + itemWidth / 2;
    const y = row * (itemHeight + gap) + itemHeight / 2;
    
    positions.push({ x, y, row, col });
  }
  
  return positions;
}

/**
 * Подгоняет размер шрифта текста, чтобы он влез в максимальную ширину
 * 
 * @param textObject - Объект текста Phaser
 * @param maxWidth - Максимальная ширина
 * @param minFontSize - Минимальный размер шрифта (по умолчанию 8)
 * @returns Итоговый размер шрифта
 */
export function fitText(
  textObject: Phaser.GameObjects.Text,
  maxWidth: number,
  minFontSize: number = 8
): number {
  const currentFontSize = parseInt(textObject.style.fontSize as string || '12');
  let fontSize = currentFontSize;
  
  // Уменьшаем размер шрифта, пока текст не влезет
  while (textObject.width > maxWidth && fontSize > minFontSize) {
    fontSize--;
    textObject.setFontSize(`${fontSize}px`);
  }
  
  return fontSize;
}

/**
 * Масштабирует изображение, сохраняя пропорции, чтобы оно вписалось в квадрат
 * 
 * @param imageObject - Объект изображения Phaser
 * @param maxSize - Максимальный размер (ширина и высота)
 * @param preserveAspectRatio - Сохранять ли пропорции (по умолчанию true)
 * @returns Итоговые размеры {width, height}
 */
export function fitImage(
  imageObject: Phaser.GameObjects.Image,
  maxSize: number,
  preserveAspectRatio: boolean = true
): { width: number; height: number } {
  if (!preserveAspectRatio) {
    imageObject.setDisplaySize(maxSize, maxSize);
    return { width: maxSize, height: maxSize };
  }
  
  const texture = imageObject.texture;
  const frame = texture.get();
  const originalWidth = frame.width;
  const originalHeight = frame.height;
  
  // Рассчитываем масштаб, чтобы изображение вписалось в квадрат
  const scaleX = maxSize / originalWidth;
  const scaleY = maxSize / originalHeight;
  const scale = Math.min(scaleX, scaleY);
  
  const width = originalWidth * scale;
  const height = originalHeight * scale;
  
  imageObject.setDisplaySize(width, height);
  
  return { width, height };
}

/**
 * Получает Safe Area с учетом insets Telegram Web App
 * 
 * @param scene - Сцена Phaser
 * @returns Объект SafeArea с координатами и размерами
 */
export function getSafeArea(scene: Phaser.Scene): SafeArea {
  const { width, height } = scene.cameras.main;
  const topInset = tgApp.getTopInset();
  const bottomInset = tgApp.getBottomInset();
  
  return {
    top: topInset,
    bottom: bottomInset,
    left: 0,
    right: 0,
    width: width,
    height: height,
    visibleHeight: height - topInset - bottomInset,
  };
}

/**
 * Рассчитывает высоту шапки с учетом Safe Area
 * 
 * @param safeArea - Объект SafeArea
 * @returns Высота шапки
 */
export function calculateHeaderHeight(safeArea: SafeArea): number {
  const minTopPadding = TEAM_LAYOUT.HEADER.minTopPadding;
  const baseHeight = TEAM_LAYOUT.HEADER.baseHeight;
  const topPadding = Math.max(safeArea.top, minTopPadding);
  
  return baseHeight + topPadding;
}

/**
 * Рассчитывает позицию заголовка в шапке с учетом Safe Area
 * 
 * @param safeArea - Объект SafeArea
 * @returns Y-координата заголовка
 */
export function calculateTitleY(safeArea: SafeArea): number {
  const minTopPadding = TEAM_LAYOUT.HEADER.minTopPadding;
  const titleOffsetY = TEAM_LAYOUT.HEADER.titleOffsetY;
  const topPadding = Math.max(safeArea.top, minTopPadding);
  
  return Math.max(titleOffsetY + safeArea.top, titleOffsetY + minTopPadding);
}

/**
 * Рассчитывает видимую высоту контента с учетом шапки и Safe Area
 * 
 * @param scene - Сцена Phaser
 * @param headerHeight - Высота шапки
 * @returns Видимая высота контента
 */
export function calculateVisibleContentHeight(
  scene: Phaser.Scene,
  headerHeight: number
): number {
  const safeArea = getSafeArea(scene);
  const bottomMargin = 20; // Отступ снизу
  
  return safeArea.height - headerHeight - bottomMargin - safeArea.bottom;
}
