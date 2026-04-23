// src/scenes/shop/components/ShopScrollManager.ts
// Управление скроллингом для магазина

import Phaser from 'phaser';
import { Card, ScrollState } from '../types';

export class ShopScrollManager {
  private scene: Phaser.Scene;
  private contentContainer: Phaser.GameObjects.Container;
  private cards: Card[] = [];
  private state: ScrollState;
  
  private visibleAreaTop = 0;
  private visibleAreaBottom = 0;
  
  constructor(scene: Phaser.Scene, contentContainer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.contentContainer = contentContainer;
    
    this.state = {
      scrollY: 0,
      maxScrollY: 0,
      isDragging: false,
      dragDistance: 0,
      scrollVelocity: 0,
      lastPointerY: 0,
      pointerStartY: 0,
    };
  }
  
  setup(): void {
    this.scene.input.on('pointerdown', this.onPointerDown, this);
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
  }
  
  cleanup(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
  }
  
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.y < 200 || pointer.y > this.scene.cameras.main.height - 100) {
      return;
    }
    
    this.state.isDragging = true;
    this.state.lastPointerY = pointer.y;
    this.state.pointerStartY = pointer.y;
    this.state.dragDistance = 0;
    this.state.scrollVelocity = 0;
  }
  
  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.state.isDragging) return;
    
    const delta = pointer.y - this.state.lastPointerY;
    this.state.scrollVelocity = delta;
    this.state.dragDistance += Math.abs(delta);
    this.state.scrollY -= delta;
    this.state.scrollY = Phaser.Math.Clamp(this.state.scrollY, 0, this.state.maxScrollY);
    
    this.updateCardPositions();
    this.state.lastPointerY = pointer.y;
  }
  
  private onPointerUp(): void {
    if (!this.state.isDragging) return;
    
    this.state.isDragging = false;
    
    // Инерция
    if (Math.abs(this.state.scrollVelocity) > 2) {
      const duration = Math.min(600, Math.abs(this.state.scrollVelocity) * 30);
      const targetScroll = this.state.scrollY - this.state.scrollVelocity * 10;
      const clampedTarget = Phaser.Math.Clamp(targetScroll, 0, this.state.maxScrollY);
      
      this.scene.tweens.add({
        targets: this.state,
        scrollY: clampedTarget,
        duration: duration,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          this.updateCardPositions();
        },
      });
    }
  }
  
  setCards(cards: Card[]): void {
    this.cards = cards;
    this.calculateMaxScroll();
    this.updateVisibleArea();
  }
  
  private calculateMaxScroll(): void {
    if (this.cards.length === 0) {
      this.state.maxScrollY = 0;
      return;
    }
    
    const lastCard = this.cards[this.cards.length - 1];
    const totalHeight = lastCard.y + lastCard.height + 100;
    const visibleHeight = this.scene.cameras.main.height - 300;
    this.state.maxScrollY = Math.max(0, totalHeight - visibleHeight);
  }
  
  private updateVisibleArea(): void {
    const { height } = this.scene.cameras.main;
    this.visibleAreaTop = this.state.scrollY - 200;
    this.visibleAreaBottom = this.state.scrollY + height + 200;
  }
  
  updateCardPositions(): void {
    this.updateVisibleArea();
    
    this.cards.forEach((card) => {
      const cardTop = card.y;
      const cardBottom = card.y + card.height;
      const isVisible = cardBottom >= this.visibleAreaTop && cardTop <= this.visibleAreaBottom;
      
      if (card.container) {
        card.container.setVisible(isVisible);
      }
    });
    
    this.contentContainer.y = -this.state.scrollY;
  }
  
  reset(): void {
    this.state.scrollY = 0;
    this.state.scrollVelocity = 0;
    this.cards = [];
    this.updateCardPositions();
  }
  
  getScrollY(): number {
    return this.state.scrollY;
  }
  
  getDragDistance(): number {
    return this.state.dragDistance;
  }
  
  resetDragDistance(): void {
    this.state.dragDistance = 0;
  }
}
