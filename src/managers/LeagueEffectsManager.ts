// src/managers/LeagueEffectsManager.ts
// Менеджер визуальных эффектов для каждой лиги

import Phaser from 'phaser';
import { LeagueTier } from '../types/league';
import { getLeagueTierInfo } from '../types/leagueRewards';

/**
 * Менеджер эффектов лиг - создаёт уникальные визуальные эффекты для каждой лиги
 */
export class LeagueEffectsManager {
  private scene: Phaser.Scene;
  private particles: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private graphics: Phaser.GameObjects.Graphics[] = [];
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  /**
   * Создаёт эффекты для фона лиги
   */
  createLeagueBackgroundEffect(tier: LeagueTier, container: Phaser.GameObjects.Container): void {
    const info = getLeagueTierInfo(tier);
    
    switch (tier) {
      case 'meteorite':
        this.createMeteoriteEffect(container, info.particleColor);
        break;
      case 'comet':
        this.createCometEffect(container, info.particleColor);
        break;
      case 'planet':
        this.createPlanetEffect(container, info.particleColor);
        break;
      case 'star':
        this.createStarEffect(container, info.particleColor);
        break;
      case 'nebula':
        this.createNebulaEffect(container, info.particleColor);
        break;
      case 'core':
        this.createCoreEffect(container, info.particleColor);
        break;
    }
  }
  
  /**
   * Метеорит - падающие камни
   */
  private createMeteoriteEffect(container: Phaser.GameObjects.Container, color: number): void {
    const { width, height } = this.scene.cameras.main;
    
    // Создаём простые частицы (точки)
    for (let i = 0; i < 15; i++) {
      const particle = this.scene.add.circle(
        Math.random() * width,
        Math.random() * height,
        Math.random() * 2 + 1,
        color,
        0.3
      );
      particle.setDepth(1);
      
      // Медленное падение
      this.scene.tweens.add({
        targets: particle,
        y: height + 50,
        x: particle.x + (Math.random() - 0.5) * 100,
        alpha: 0,
        duration: 5000 + Math.random() * 3000,
        repeat: -1,
        delay: Math.random() * 3000,
        onRepeat: () => {
          particle.y = -50;
          particle.x = Math.random() * width;
          particle.alpha = 0.3;
        },
      });
    }
  }
  
  /**
   * Комета - быстрые полосы
   */
  private createCometEffect(container: Phaser.GameObjects.Container, color: number): void {
    const { width, height } = this.scene.cameras.main;
    
    for (let i = 0; i < 8; i++) {
      const trail = this.scene.add.graphics();
      trail.setDepth(1);
      trail.setAlpha(0);
      this.graphics.push(trail);
      
      const animateTrail = () => {
        trail.clear();
        const startX = -50;
        const startY = Math.random() * height;
        const endX = width + 50;
        const endY = startY + (Math.random() - 0.5) * 200;
        
        trail.lineStyle(3, color, 0.6);
        trail.lineBetween(startX, startY, startX + 100, startY + 30);
        
        this.scene.tweens.add({
          targets: trail,
          alpha: { from: 0, to: 0.8 },
          duration: 200,
          yoyo: true,
        });
        
        const target = { x: startX, y: startY };

        this.scene.tweens.add({
          targets: target,
          x: endX,
          y: endY,
          duration: 1500,
          ease: 'Power2',
          onUpdate: (tween) => {
            trail.clear();
            trail.lineStyle(3, color, 0.6 * (1 - tween.progress));
            trail.lineBetween(target.x, target.y, target.x - 100, target.y - 30);
          },
          onComplete: () => {
            this.scene.time.delayedCall(2000 + Math.random() * 3000, animateTrail);
          },
        });
      };
      
      this.scene.time.delayedCall(i * 500, animateTrail);
    }
  }
  
  /**
   * Планета - орбитальные кольца
   */
  private createPlanetEffect(container: Phaser.GameObjects.Container, color: number): void {
    const { width, height } = this.scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;
    
    for (let i = 0; i < 3; i++) {
      const orbit = this.scene.add.graphics();
      orbit.setDepth(1);
      orbit.setAlpha(0.15);
      this.graphics.push(orbit);
      
      const radius = 200 + i * 150;
      orbit.lineStyle(2, color, 0.3);
      orbit.strokeEllipse(centerX, centerY, radius, radius * 0.3);
      
      // Вращение
      this.scene.tweens.add({
        targets: orbit,
        angle: 360,
        duration: 20000 + i * 5000,
        repeat: -1,
        ease: 'Linear',
      });
      
      // Пульсация прозрачности
      this.scene.tweens.add({
        targets: orbit,
        alpha: { from: 0.1, to: 0.25 },
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
  
  /**
   * Звезда - сияющие лучи
   */
  private createStarEffect(container: Phaser.GameObjects.Container, color: number): void {
    const { width, height } = this.scene.cameras.main;
    
    // Мерцающие звёзды
    for (let i = 0; i < 30; i++) {
      const star = this.scene.add.circle(
        Math.random() * width,
        Math.random() * height,
        Math.random() * 3 + 1,
        color,
        0.8
      );
      star.setDepth(1);
      
      // Мерцание
      this.scene.tweens.add({
        targets: star,
        alpha: { from: 0.3, to: 1.0 },
        scale: { from: 0.5, to: 1.2 },
        duration: 1000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 2000,
      });
    }
    
    // Лучи света
    const rays = this.scene.add.graphics();
    rays.setDepth(1);
    rays.setAlpha(0.1);
    this.graphics.push(rays);
    
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x1 = width / 2;
      const y1 = height / 2;
      const x2 = x1 + Math.cos(angle) * 800;
      const y2 = y1 + Math.sin(angle) * 800;
      
      rays.lineStyle(2, color, 0.2);
      rays.lineBetween(x1, y1, x2, y2);
    }
    
    // Вращение лучей
    this.scene.tweens.add({
      targets: rays,
      angle: 360,
      duration: 40000,
      repeat: -1,
      ease: 'Linear',
    });
  }
  
  /**
   * Туманность - плывущие облака
   */
  private createNebulaEffect(container: Phaser.GameObjects.Container, color: number): void {
    const { width, height } = this.scene.cameras.main;
    
    // Создаём "облака" туманности
    for (let i = 0; i < 12; i++) {
      const cloud = this.scene.add.ellipse(
        Math.random() * width,
        Math.random() * height,
        100 + Math.random() * 150,
        60 + Math.random() * 100,
        color,
        0.08
      );
      cloud.setDepth(1);
      
      // Плавное движение
      const startX = cloud.x;
      const startY = cloud.y;
      
      this.scene.tweens.add({
        targets: cloud,
        x: startX + (Math.random() - 0.5) * 200,
        y: startY + (Math.random() - 0.5) * 150,
        scaleX: { from: 0.8, to: 1.2 },
        scaleY: { from: 1.2, to: 0.8 },
        alpha: { from: 0.05, to: 0.15 },
        duration: 8000 + Math.random() * 4000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 3000,
      });
    }
    
    // Энергетические вспышки
    const createFlash = () => {
      const flash = this.scene.add.circle(
        Math.random() * width,
        Math.random() * height,
        5,
        color,
        0.6
      );
      flash.setDepth(2);
      
      this.scene.tweens.add({
        targets: flash,
        scale: 3,
        alpha: 0,
        duration: 1500,
        ease: 'Power2',
        onComplete: () => flash.destroy(),
      });
      
      this.scene.time.delayedCall(2000 + Math.random() * 3000, createFlash);
    };
    
    createFlash();
  }
  
  /**
   * Ядро - пульсирующая энергия
   */
  private createCoreEffect(container: Phaser.GameObjects.Container, color: number): void {
    const { width, height } = this.scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Пульсирующие кольца энергии
    const createPulse = () => {
      const ring = this.scene.add.circle(centerX, centerY, 10, color, 0.6);
      ring.setDepth(1);
      ring.setStrokeStyle(3, color);
      
      this.scene.tweens.add({
        targets: ring,
        radius: 400,
        alpha: 0,
        duration: 2000,
        ease: 'Power2',
        onComplete: () => ring.destroy(),
      });
      
      this.scene.time.delayedCall(600, createPulse);
    };
    
    createPulse();
    
    // Энергетические молнии
    for (let i = 0; i < 6; i++) {
      const lightning = this.scene.add.graphics();
      lightning.setDepth(1);
      lightning.setAlpha(0);
      this.graphics.push(lightning);
      
      const animateLightning = () => {
        lightning.clear();
        lightning.lineStyle(2, color, 0.8);
        
        const startX = centerX;
        const startY = centerY;
        let x = startX;
        let y = startY;
        
        for (let j = 0; j < 5; j++) {
          const newX = x + (Math.random() - 0.5) * 100;
          const newY = y + (Math.random() - 0.5) * 100;
          lightning.lineBetween(x, y, newX, newY);
          x = newX;
          y = newY;
        }
        
        this.scene.tweens.add({
          targets: lightning,
          alpha: { from: 0, to: 0.6 },
          duration: 100,
          yoyo: true,
          onComplete: () => {
            this.scene.time.delayedCall(1000 + Math.random() * 2000, animateLightning);
          },
        });
      };
      
      this.scene.time.delayedCall(i * 300, animateLightning);
    }
  }
  
  /**
   * Очистка всех эффектов
   */
  destroy(): void {
    this.particles.forEach(p => p.stop());
    this.graphics.forEach(g => g.destroy());
    this.particles = [];
    this.graphics = [];
  }
}

