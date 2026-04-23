// src/config/assetKeys.ts
// Ключи ассетов для системы Galaxy League & Weekend Tournaments

// ========== LEAGUE ASSETS ==========

export const LEAGUE_BADGE_KEYS = {
  METEORITE: 'league_badge_meteorite_512',
  COMET: 'league_badge_comet_512',
  PLANET: 'league_badge_planet_512',
  STAR: 'league_badge_star_512',
  NEBULA: 'league_badge_nebula_512',
  CORE: 'league_badge_core_512',
} as const;

export const LEAGUE_DIVISION_KEYS = {
  I: 'league_division_I_128',
  II: 'league_division_II_128',
  III: 'league_division_III_128',
} as const;

export const LEAGUE_STAR_KEYS = {
  EMPTY: 'rank_star_empty_64',
  FULL: 'rank_star_full_64',
  GLOW: 'rank_star_glow_64',
} as const;

export const LEAGUE_ORBIT_KEYS = {
  DECAY_PANEL: 'orbit_decay_panel_1600x900',
  STABILIZE_ICON: 'orbit_stabilize_icon_256',
  WARNING_ICON: 'orbit_warning_icon_256',
} as const;

// ========== TOURNAMENT ASSETS ==========

export const TOURNAMENT_HUB_BG = 'tournament_hub_bg_1080x1920';
export const LEAGUE_HUB_BG = 'league_hub_bg_1080x1920';

export const TOURNAMENT_BACKGROUND_KEYS = {
  ROOKIE: 'tournament_bg_rookie_1080x1920',
  MINOR: 'tournament_bg_minor_1080x1920',
  MAJOR: 'tournament_bg_major_1080x1920',
  APEX: 'tournament_bg_apex_1080x1920',
} as const;

export const TOURNAMENT_CUP_KEYS = {
  ROOKIE: 'cup_rookie_draft_512',
  MINOR: 'cup_minor_512',
  MAJOR: 'cup_major_512',
  APEX: 'cup_galactic_apex_512',
} as const;

export const TOURNAMENT_KEY_KEYS = {
  FRAGMENT: 'tournament_key_fragment_128',
  FULL: 'tournament_key_full_256',
  TICKET: 'tournament_ticket_256x128',
} as const;

export const TOURNAMENT_BRACKET_KEYS = {
  SLOT_DEFAULT: 'bracket_slot_default_480x140',
  SLOT_WINNER: 'bracket_slot_winner_480x140',
} as const;

// ========== GAME ASSETS ==========

export const AIM_ASSIST_OFF_ICON = 'icon_aim_assist_off_128';

// ========== PREMIUM UNITS ASSETS ==========

export const UNIT_MAGMA_THUNDER_GOD = 'magma_thunder_god';
export const UNIT_INSECT_TOXIC_OVERLORD = 'insect_toxic_overlord';
export const UNIT_CYBORG_BLUE_STREAK = 'cyborg_blue_streak';
export const UNIT_VOID_DEMON_HUNTER = 'void_demon_hunter';

// ========== ROLE ICONS ==========

export const ROLE_ICON_KEYS = {
  balanced: 'role_balanced',
  tank: 'role_tank',
  sniper: 'role_sniper',
  trickster: 'role_trickster',
} as const;

export type RoleIconKey = keyof typeof ROLE_ICON_KEYS;