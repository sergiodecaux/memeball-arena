// src/ui/Icons.ts

import Phaser from 'phaser';

/**
 * Векторные иконки для премиального UI
 */
export class Icons {
  
  /**
   * Иконка Play (треугольник)
   */
  static drawPlay(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    const points = [
      { x: x - size * 0.4, y: y - size * 0.5 },
      { x: x + size * 0.6, y: y },
      { x: x - size * 0.4, y: y + size * 0.5 },
    ];
    
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    g.lineTo(points[1].x, points[1].y);
    g.lineTo(points[2].x, points[2].y);
    g.closePath();
    g.fillPath();
    
    return g;
  }

  /**
   * Иконка магазина (сумка)
   */
  static drawShop(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.lineStyle(size * 0.15, color, 1);
    
    // Ручка
    g.beginPath();
    g.arc(x, y - size * 0.2, size * 0.35, Math.PI, 0, false);
    g.strokePath();
    
    // Сумка
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - size * 0.5, y - size * 0.1, size, size * 0.8, size * 0.15);
    
    return g;
  }

  /**
   * Иконка улучшений (стрелка вверх)
   */
  static drawUpgrade(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    // Стрелка
    g.beginPath();
    g.moveTo(x, y - size * 0.5);
    g.lineTo(x + size * 0.4, y);
    g.lineTo(x + size * 0.15, y);
    g.lineTo(x + size * 0.15, y + size * 0.5);
    g.lineTo(x - size * 0.15, y + size * 0.5);
    g.lineTo(x - size * 0.15, y);
    g.lineTo(x - size * 0.4, y);
    g.closePath();
    g.fillPath();
    
    return g;
  }

  /**
   * Иконка тактики (расстановка фишек)
   */
  static drawTactics(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    // Три фишки в формации
    const s = size * 0.28;
    
    // Верхняя фишка (атакующая)
    g.fillCircle(x, y - size * 0.35, s);
    
    // Нижние две фишки (защитники)
    g.fillCircle(x - size * 0.38, y + size * 0.28, s);
    g.fillCircle(x + size * 0.38, y + size * 0.28, s);
    
    // Соединительные линии (тактические связи)
    g.lineStyle(size * 0.07, color, 0.4);
    g.lineBetween(x, y - size * 0.35 + s, x - size * 0.38, y + size * 0.28 - s);
    g.lineBetween(x, y - size * 0.35 + s, x + size * 0.38, y + size * 0.28 - s);
    g.lineBetween(x - size * 0.38 + s, y + size * 0.28, x + size * 0.38 - s, y + size * 0.28);
    
    return g;
  }

  /**
   * Иконка настроек (шестерёнка)
   */
  static drawSettings(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    // Внешняя шестерёнка
    const teeth = 8;
    const outerR = size * 0.5;
    const innerR = size * 0.35;
    const toothDepth = size * 0.12;
    
    g.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const angle = (i * Math.PI) / teeth - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : outerR - toothDepth;
      g.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
    g.closePath();
    g.fillPath();
    
    // Внутренний круг (вырез)
    g.fillStyle(0x000000, 1);
    g.fillCircle(x, y, innerR * 0.5);
    
    return g;
  }

  /**
   * Иконка профиля (человек)
   */
  static drawProfile(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    // Голова
    g.fillCircle(x, y - size * 0.25, size * 0.25);
    
    // Тело
    g.beginPath();
    g.arc(x, y + size * 0.55, size * 0.4, Math.PI, 0, false);
    g.fillPath();
    
    return g;
  }

  /**
   * Иконка трофея
   */
  static drawTrophy(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    // Кубок
    g.beginPath();
    g.moveTo(x - size * 0.4, y - size * 0.5);
    g.lineTo(x - size * 0.3, y + size * 0.1);
    g.lineTo(x + size * 0.3, y + size * 0.1);
    g.lineTo(x + size * 0.4, y - size * 0.5);
    g.closePath();
    g.fillPath();
    
    // Ножка
    g.fillRect(x - size * 0.08, y + size * 0.1, size * 0.16, size * 0.2);
    
    // Основание
    g.fillRoundedRect(x - size * 0.25, y + size * 0.3, size * 0.5, size * 0.15, 3);
    
    // Ручки
    g.lineStyle(size * 0.08, color, 1);
    g.beginPath();
    g.arc(x - size * 0.45, y - size * 0.15, size * 0.15, -Math.PI * 0.5, Math.PI * 0.5, false);
    g.strokePath();
    g.beginPath();
    g.arc(x + size * 0.45, y - size * 0.15, size * 0.15, Math.PI * 0.5, -Math.PI * 0.5, false);
    g.strokePath();
    
    return g;
  }

  /**
   * Иконка звезды
   */
  static drawStar(scene: Phaser.Scene, x: number, y: number, size: number, color: number, filled: boolean = true): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? size * 0.5 : size * 0.25;
      const angle = (i * Math.PI / 5) - Math.PI / 2;
      points.push({
        x: x + Math.cos(angle) * r,
        y: y + Math.sin(angle) * r,
      });
    }
    
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.closePath();
    
    if (filled) {
      g.fillStyle(color, 1);
      g.fillPath();
    } else {
      g.lineStyle(2, color, 1);
      g.strokePath();
    }
    
    return g;
  }

  /**
   * Иконка монеты
   */
  static drawCoin(scene: Phaser.Scene, x: number, y: number, size: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    
    // Внешний круг
    g.fillStyle(0xffd700, 1);
    g.fillCircle(x, y, size * 0.5);
    
    // Обводка
    g.lineStyle(size * 0.08, 0xb8860b, 1);
    g.strokeCircle(x, y, size * 0.5);
    
    // Внутренний символ
    g.fillStyle(0xb8860b, 1);
    g.fillCircle(x, y, size * 0.2);
    
    // Блик
    g.fillStyle(0xffffff, 0.4);
    g.fillEllipse(x - size * 0.15, y - size * 0.15, size * 0.2, size * 0.15);
    
    return g;
  }

  /**
   * Иконка молнии
   */
  static drawLightning(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    g.beginPath();
    g.moveTo(x + size * 0.1, y - size * 0.5);
    g.lineTo(x - size * 0.25, y + size * 0.05);
    g.lineTo(x + size * 0.05, y + size * 0.05);
    g.lineTo(x - size * 0.1, y + size * 0.5);
    g.lineTo(x + size * 0.25, y - size * 0.05);
    g.lineTo(x - size * 0.05, y - size * 0.05);
    g.closePath();
    g.fillPath();
    
    return g;
  }

  /**
   * Иконка щита
   */
  static drawShield(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    g.beginPath();
    g.moveTo(x, y - size * 0.5);
    g.lineTo(x + size * 0.45, y - size * 0.3);
    g.lineTo(x + size * 0.45, y + size * 0.1);
    g.lineTo(x, y + size * 0.5);
    g.lineTo(x - size * 0.45, y + size * 0.1);
    g.lineTo(x - size * 0.45, y - size * 0.3);
    g.closePath();
    g.fillPath();
    
    // Блик
    g.fillStyle(0xffffff, 0.2);
    g.fillEllipse(x - size * 0.1, y - size * 0.15, size * 0.15, size * 0.25);
    
    return g;
  }

  /**
   * Иконка огня
   */
  static drawFire(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    // Основное пламя
    g.beginPath();
    g.moveTo(x, y - size * 0.5);
    g.lineTo(x + size * 0.35, y);
    g.lineTo(x + size * 0.25, y + size * 0.3);
    g.lineTo(x + size * 0.1, y + size * 0.5);
    g.lineTo(x - size * 0.1, y + size * 0.5);
    g.lineTo(x - size * 0.25, y + size * 0.3);
    g.lineTo(x - size * 0.35, y);
    g.closePath();
    g.fillPath();
    
    // Внутреннее пламя
    g.fillStyle(0xffff00, 0.6);
    g.fillEllipse(x, y + size * 0.15, size * 0.2, size * 0.3);
    
    return g;
  }

  /**
   * Иконка мишени
   */
  static drawTarget(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.lineStyle(size * 0.1, color, 1);
    
    g.strokeCircle(x, y, size * 0.45);
    g.strokeCircle(x, y, size * 0.28);
    
    g.fillStyle(color, 1);
    g.fillCircle(x, y, size * 0.12);
    
    return g;
  }

  /**
   * Иконка короны
   */
  static drawCrown(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    g.beginPath();
    g.moveTo(x - size * 0.5, y + size * 0.3);
    g.lineTo(x - size * 0.5, y - size * 0.1);
    g.lineTo(x - size * 0.25, y + size * 0.15);
    g.lineTo(x, y - size * 0.4);
    g.lineTo(x + size * 0.25, y + size * 0.15);
    g.lineTo(x + size * 0.5, y - size * 0.1);
    g.lineTo(x + size * 0.5, y + size * 0.3);
    g.closePath();
    g.fillPath();
    
    // Драгоценности
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(x - size * 0.25, y + size * 0.05, size * 0.08);
    g.fillCircle(x, y - size * 0.15, size * 0.08);
    g.fillCircle(x + size * 0.25, y + size * 0.05, size * 0.08);
    
    return g;
  }

  /**
   * Иконка сердца
   */
  static drawHeart(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    // Два круга сверху
    g.fillCircle(x - size * 0.2, y - size * 0.15, size * 0.28);
    g.fillCircle(x + size * 0.2, y - size * 0.15, size * 0.28);
    
    // Треугольник снизу
    g.beginPath();
    g.moveTo(x - size * 0.47, y - size * 0.05);
    g.lineTo(x, y + size * 0.5);
    g.lineTo(x + size * 0.47, y - size * 0.05);
    g.closePath();
    g.fillPath();
    
    return g;
  }

  /**
   * Иконка геймпада
   */
  static drawGamepad(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    // Основа
    g.fillRoundedRect(x - size * 0.5, y - size * 0.25, size, size * 0.5, size * 0.15);
    
    // Кнопки
    g.fillStyle(0x000000, 0.4);
    g.fillCircle(x - size * 0.25, y, size * 0.1);
    g.fillCircle(x + size * 0.25, y, size * 0.1);
    
    // D-pad
    g.fillRect(x - size * 0.35, y - size * 0.05, size * 0.15, size * 0.1);
    g.fillRect(x - size * 0.3, y - size * 0.12, size * 0.05, size * 0.24);
    
    return g;
  }

  /**
   * Иконка замка
   */
  static drawLock(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    
    // Дужка
    g.lineStyle(size * 0.12, color, 1);
    g.beginPath();
    g.arc(x, y - size * 0.15, size * 0.25, Math.PI, 0, false);
    g.strokePath();
    
    // Тело
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - size * 0.35, y, size * 0.7, size * 0.5, size * 0.08);
    
    // Скважина
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(x, y + size * 0.15, size * 0.08);
    g.fillRect(x - size * 0.03, y + size * 0.15, size * 0.06, size * 0.2);
    
    return g;
  }

  /**
   * Иконка галочки
   */
  static drawCheck(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.lineStyle(size * 0.2, color, 1);
    
    g.beginPath();
    g.moveTo(x - size * 0.35, y);
    g.lineTo(x - size * 0.1, y + size * 0.3);
    g.lineTo(x + size * 0.4, y - size * 0.3);
    g.strokePath();
    
    return g;
  }

  /**
   * Иконка стрелки назад
   */
  static drawBack(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.lineStyle(size * 0.15, color, 1);
    
    g.beginPath();
    g.moveTo(x + size * 0.2, y - size * 0.3);
    g.lineTo(x - size * 0.2, y);
    g.lineTo(x + size * 0.2, y + size * 0.3);
    g.strokePath();
    
    g.beginPath();
    g.moveTo(x - size * 0.2, y);
    g.lineTo(x + size * 0.4, y);
    g.strokePath();
    
    return g;
  }

  /**
   * Иконка робота/AI
   */
  static drawRobot(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    // Голова
    g.fillRoundedRect(x - size * 0.35, y - size * 0.4, size * 0.7, size * 0.55, size * 0.1);
    
    // Антенна
    g.fillRect(x - size * 0.03, y - size * 0.55, size * 0.06, size * 0.15);
    g.fillCircle(x, y - size * 0.55, size * 0.08);
    
    // Глаза
    g.fillStyle(0x000000, 0.6);
    g.fillCircle(x - size * 0.15, y - size * 0.2, size * 0.1);
    g.fillCircle(x + size * 0.15, y - size * 0.2, size * 0.1);
    
    // Зрачки
    g.fillStyle(0x00ffff, 1);
    g.fillCircle(x - size * 0.15, y - size * 0.2, size * 0.05);
    g.fillCircle(x + size * 0.15, y - size * 0.2, size * 0.05);
    
    // Рот
    g.fillStyle(0x000000, 0.4);
    g.fillRect(x - size * 0.2, y + size * 0.0, size * 0.4, size * 0.08);
    
    // Тело
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - size * 0.3, y + size * 0.2, size * 0.6, size * 0.35, size * 0.08);
    
    return g;
  }

  /**
   * Иконка двух игроков
   */
  static drawPlayers(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    
    // Левый игрок
    g.fillCircle(x - size * 0.25, y - size * 0.25, size * 0.18);
    g.beginPath();
    g.arc(x - size * 0.25, y + size * 0.35, size * 0.28, Math.PI, 0, false);
    g.fillPath();
    
    // Правый игрок
    g.fillCircle(x + size * 0.25, y - size * 0.25, size * 0.18);
    g.beginPath();
    g.arc(x + size * 0.25, y + size * 0.35, size * 0.28, Math.PI, 0, false);
    g.fillPath();
    
    return g;
  }
}