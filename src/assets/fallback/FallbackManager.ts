// src/assets/fallback/FallbackManager.ts

import Phaser from 'phaser';
import { UIGenerator } from '../generation/UIGenerator';
import { FactionGenerator } from '../generation/FactionGenerator';
import { CampaignGenerator } from '../generation/CampaignGenerator';
import { FACTION_IDS, FACTIONS, FACTION_ARENAS } from '../../constants/gameConstants';
import { UNITS_CATALOG } from '../../data/UnitsCatalog';
import { UNITS_REPOSITORY } from '../../data/UnitsRepository';

/**
 * Manages on-demand fallback texture generation
 * Only generates fallbacks when textures are actually needed and missing
 */
export class FallbackManager {
  constructor(private scene: Phaser.Scene) {}

  /**
   * Ensures a texture exists, generating fallback if missing
   */
  ensureTexture(key: string, generatorFn: () => void): void {
    if (this.scene.textures.exists(key)) {
      return;
    }
    generatorFn();
  }

  /**
   * Ensures UI fallbacks (minimal - only what's needed for immediate UI)
   */
  ensureUIFallbacks(): void {
    const uiGenerator = new UIGenerator(this.scene);
    
    // Only generate essential UI textures that might be needed immediately
    this.ensureTexture('aura_glow', () => uiGenerator.generateAuraTexture());
    this.ensureTexture('aura_selected_ring', () => uiGenerator.generateSelectedRingTexture());
    this.ensureTexture('metal_ring', () => uiGenerator.generateMetalRingTexture());
    this.ensureTexture('ui_scoreboard', () => uiGenerator.generateScoreboardFallback());
  }

  /**
   * Ensures campaign fallbacks (only when entering campaign scene)
   */
  ensureCampaignFallbacks(): void {
    const campaignGenerator = new CampaignGenerator(this.scene);
    
    // Campaign map assets
    this.ensureTexture('node_locked', () => campaignGenerator.generateCampaignMapFallbacks());
    this.ensureTexture('node_active', () => campaignGenerator.generateCampaignMapFallbacks());
    this.ensureTexture('node_completed_1star', () => campaignGenerator.generateCampaignMapFallbacks());
    this.ensureTexture('node_completed_2stars', () => campaignGenerator.generateCampaignMapFallbacks());
    this.ensureTexture('node_completed_3stars', () => campaignGenerator.generateCampaignMapFallbacks());
    this.ensureTexture('node_boss', () => campaignGenerator.generateCampaignMapFallbacks());
    this.ensureTexture('path_dotted', () => campaignGenerator.generateCampaignMapFallbacks());
    
    // Stars
    this.ensureTexture('star_empty', () => campaignGenerator.generateStarFallbacks());
    this.ensureTexture('star_filled', () => campaignGenerator.generateStarFallbacks());
    
    // Chapter backgrounds (only generate if missing)
    const chapters = ['magma', 'cyborg', 'void', 'insect'];
    chapters.forEach(chapter => {
      const key = `bg_chapter_${chapter}`;
      this.ensureTexture(key, () => campaignGenerator.generateCampaignChapterBackgroundFallbacks());
    });
    
    // Bosses
    this.ensureTexture('boss_krag', () => campaignGenerator.generateBossFallbacks());
    this.ensureTexture('boss_unit734', () => campaignGenerator.generateBossFallbacks());
    this.ensureTexture('boss_zra', () => campaignGenerator.generateBossFallbacks());
    this.ensureTexture('boss_oracle', () => campaignGenerator.generateBossFallbacks());
  }

  /**
   * Ensures faction fallbacks (only when needed for gameplay)
   */
  ensureFactionFallbacks(): void {
    const factionGenerator = new FactionGenerator(this.scene);
    
    // Faction tokens
    let needsFactionFallbacks = false;
    FACTION_IDS.forEach((factionId) => {
      const faction = FACTIONS[factionId];
      if (!this.scene.textures.exists(faction.assetKey)) {
        needsFactionFallbacks = true;
      }
    });
    if (needsFactionFallbacks) {
      factionGenerator.generateFactionFallbacks();
    }
    
    // Units (only generate if missing - don't generate all eagerly)
    let needsUnitFallbacks = false;
    UNITS_CATALOG.forEach((unit) => {
      if (!this.scene.textures.exists(unit.assetKey)) {
        needsUnitFallbacks = true;
      }
    });
    if (needsUnitFallbacks) {
      factionGenerator.generateUnitFallbacks();
    }
    
    // Arenas
    let needsArenaFallbacks = false;
    FACTION_IDS.forEach((factionId) => {
      const arena = FACTION_ARENAS[factionId];
      if (!this.scene.textures.exists(arena.assetKey)) {
        needsArenaFallbacks = true;
      }
    });
    if (needsArenaFallbacks) {
      factionGenerator.generateArenaFallbacks();
    }
    
    // Faction art
    let needsArtFallbacks = false;
    ['art_magma', 'art_cyborg', 'art_void', 'art_insect'].forEach(key => {
      if (!this.scene.textures.exists(key)) {
        needsArtFallbacks = true;
      }
    });
    if (needsArtFallbacks) {
      factionGenerator.generateFactionArtFallbacks();
    }
    
    // Faction UI backgrounds
    let needsUIFallbacks = false;
    ['faction_preview_magma', 'faction_preview_cyber', 'faction_preview_void', 'faction_preview_terran'].forEach(key => {
      if (!this.scene.textures.exists(key)) {
        needsUIFallbacks = true;
      }
    });
    if (needsUIFallbacks) {
      factionGenerator.generateFactionUIBackgroundFallbacks();
    }
  }

  /**
   * Ensures portrait fallbacks (only when needed for dialogues)
   */
  ensurePortraitFallbacks(): void {
    const uiGenerator = new UIGenerator(this.scene);
    
    // Only generate portraits that are actually missing
    const portraitKeys = [
      'commander_nova', 'portrait_nova', 'portrait_nova_happy', 'portrait_nova_neutral', 'portrait_nova_determined',
      'portrait_krag', 'portrait_krag_angry', 'portrait_krag_neutral', 'portrait_krag_surprised',
      'portrait_unit734', 'portrait_unit734_neutral', 'portrait_unit_734', 'portrait_unit_734_neutral',
      'portrait_zra', 'portrait_zra_neutral', 'portrait_zra_mysterious',
      'portrait_oracle', 'portrait_oracle_neutral', 'portrait_oracle_menacing',
      'portrait_announcer', 'portrait_announcer_neutral', 'portrait_announcer_happy',
    ];
    
    let needsPortraitFallbacks = false;
    let needsEmotionFallbacks = false;
    
    portraitKeys.forEach(key => {
      if (!this.scene.textures.exists(key)) {
        if (key.includes('_') && key.split('_').length > 2) {
          needsEmotionFallbacks = true;
        } else {
          needsPortraitFallbacks = true;
        }
      }
    });
    
    if (needsPortraitFallbacks) {
      uiGenerator.generatePortraitFallbacks();
    }
    if (needsEmotionFallbacks) {
      uiGenerator.generateEmotionPortraitFallbacks();
    }
  }

  /**
   * Ensures shop fallbacks (cards, chests, etc.)
   */
  ensureShopFallbacks(): void {
    // Card fallbacks are handled in BootScene.generateCardFallbacks()
    // This is a placeholder for future shop-specific fallbacks
  }

  /**
   * ✅ NEW: Ensures fallbacks for UNITS_REPOSITORY (80 new unique units)
   */
  ensureUnitsRepositoryFallbacks(): void {
    const factionGenerator = new FactionGenerator(this.scene);
    
    // Проверяем все юниты из UNITS_REPOSITORY
    let needsUnitFallbacks = false;
    UNITS_REPOSITORY.forEach((unit) => {
      if (!this.scene.textures.exists(unit.id) || !this.scene.textures.exists(unit.assetKey)) {
        needsUnitFallbacks = true;
        
        if (import.meta.env.DEV) {
          console.warn(`[FallbackManager] Missing texture for unit: ${unit.id}/${unit.assetKey} (path: ${unit.assetPath})`);
        }
      }
    });
    
    if (needsUnitFallbacks) {
      if (import.meta.env.DEV) {
        console.log(`[FallbackManager] Generating fallbacks for UNITS_REPOSITORY...`);
      }
      factionGenerator.generateUnitsRepositoryFallbacks();
    }
  }
}

