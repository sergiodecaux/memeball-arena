// src/utils/TextureConfigurator.ts

import Phaser from 'phaser';

/**
 * Конфигуратор текстур для оптимизации качества отображения
 */

/**
 * Применяет гибридную фильтрацию текстур для указанных ключей
 * LINEAR для HD ассетов, NEAREST для пиксель-арта
 */
export function applyHybridTextureFiltering(scene: Phaser.Scene, keys?: string[]): void {
  const textureKeys = keys || scene.textures.getTextureKeys();
  
  const hdPrefixes = [
    'faction_preview_',
    'ui_',
    'art_',
    'icon_',
    // ✅ НОВОЕ: Префиксы для всех 80 уникальных юнитов
    'magma_', 'cyborg_', 'void_', 'insect_',
    // Остальные HD-ассеты
    'ball_',
    'portrait_',
    'commander_',
    'bg_chapter_',
    'node_',
    'boss_',
    'star_',
  ];
  
  const hdExactKeys = [
    'metal_ring',
    'overlay_lighting',
    'ball_plasma',
    'ball_core', 
    'ball_quantum',
    'logo',
    'commander_nova',
    'portrait_krag',
    'portrait_unit734',
    'portrait_zra',
    'portrait_oracle',
    'portrait_announcer',
    'path_dotted',
  ];
  
  let hdCount = 0;
  let pixelCount = 0;
  
  textureKeys.forEach(key => {
    const texture = scene.textures.get(key);
    if (!texture || key === '__DEFAULT' || key === '__MISSING') return;

    const isHDByPrefix = hdPrefixes.some(prefix => key.startsWith(prefix));
    const isHDByExact = hdExactKeys.includes(key);
    const isHD = isHDByPrefix || isHDByExact;

    if (isHD) {
      texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      hdCount++;
    } else {
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      pixelCount++;
    }
  });
  
  if (import.meta.env.DEV) {
    console.log(`[TextureConfigurator] 🎨 Texture filtering: ${hdCount} HD (LINEAR), ${pixelCount} Pixel Art (NEAREST)`);
  }
}

/**
 * Генерирует мипмапы для указанных текстур (или всех HD текстур если keys не указан)
 * ⚠️ Use sparingly - only for critical textures that benefit from mipmaps
 */
export function generateMipmapsForKeys(scene: Phaser.Scene, keys?: string[]): void {
  if (!(scene.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) {
    if (import.meta.env.DEV) {
      console.warn('[TextureConfigurator] WebGL not available, skipping mipmaps');
    }
    return;
  }

  const gl = scene.game.renderer.gl;
  if (!gl) {
    if (import.meta.env.DEV) {
      console.warn('[TextureConfigurator] GL context not available, skipping mipmaps');
    }
    return;
  }

  const hdPrefixes = [
    'magma_', 'cyborg_', 'void_', 'insect_', 
    'ball_', 'portrait_', 'commander_',
    'bg_chapter_', 'boss_', 'node_'
  ];
  
  const textureKeys = keys || scene.textures.getTextureKeys();
  let mipmapCount = 0;
  
  textureKeys.forEach(key => {
    // If keys are provided, only process those. Otherwise check prefixes.
    const shouldProcess = keys 
      ? keys.includes(key)
      : hdPrefixes.some(prefix => key.startsWith(prefix));
    
    if (!shouldProcess) return;
    
    const texture = scene.textures.get(key);
    if (!texture || !texture.source || !texture.source[0]) return;
    
    const source = texture.source[0];
    if (!source.glTexture) return;
    
    try {
      const glTexture = source.glTexture;
      
      gl.bindTexture(gl.TEXTURE_2D, glTexture);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      
      const ext = gl.getExtension('EXT_texture_filter_anisotropic') ||
                  gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') ||
                  gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
      
      if (ext) {
        const maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        // ✅ FIX 2026-01-22: Увеличена анизотропия до 4 для лучшего качества фишек
        // 4x анизотропия дает отличное качество с минимальным влиянием на производительность
        const cappedAnisotropy = Math.min(4, maxAnisotropy);
        gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, cappedAnisotropy);
      }
      
      mipmapCount++;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn(`[TextureConfigurator] Failed to generate mipmap for: ${key}`, e);
      }
    }
  });
  
  if (import.meta.env.DEV) {
    console.log(`[TextureConfigurator] 🔥 Mipmaps generated for ${mipmapCount} textures`);
  }
}

/**
 * Legacy function: generates mipmaps for all HD textures
 * @deprecated Use generateMipmapsForKeys with specific keys instead
 */
export function generateMipmapsForHDTextures(scene: Phaser.Scene): void {
  generateMipmapsForKeys(scene);
}