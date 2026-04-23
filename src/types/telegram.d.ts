// src/types/telegram.d.ts
// Типы для Telegram Mini Apps API (Bot API 8.0+)

interface SafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface TelegramWebApp {
  // === Lifecycle ===
  ready: () => void;
  expand: () => void;
  close: () => void;
  
  // === Fullscreen (Bot API 8.0+) ===
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  isFullscreen?: boolean;
  
  // === Orientation (Bot API 8.0+) ===
  lockOrientation?: () => void;
  unlockOrientation?: () => void;
  
  // === Viewport ===
  viewportWidth: number;
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded?: boolean;
  
  // === Safe Area (Bot API 8.0+) ===
  safeAreaInset?: SafeAreaInset;
  contentSafeAreaInset?: SafeAreaInset;
  
  // === Platform ===
  platform: string;
  version?: string;
  isVersionAtLeast?: (version: string) => boolean;
  
  // === Swipes ===
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  isVerticalSwipesEnabled?: boolean;
  
  // === Closing ===
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  isClosingConfirmationEnabled?: boolean;
  
  // === Colors ===
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  headerColor?: string;
  backgroundColor?: string;
  bottomBarColor?: string;
  
  // === Events ===
  onEvent: (event: string, callback: (data?: any) => void) => void;
  offEvent?: (event: string, callback: (data?: any) => void) => void;
  
  // === Haptic Feedback ===
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  
  // === Main Button ===
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  
  // === Back Button (Bot API 6.1+) ===
  BackButton?: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  
  // === Settings Button (Bot API 7.0+) ===
  SettingsButton?: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  
  // === Cloud Storage ===
  CloudStorage: {
    setItem: (key: string, value: string, callback?: (error: Error | null, success?: boolean) => void) => void;
    getItem: (key: string, callback: (error: Error | null, value?: string) => void) => void;
    getItems: (keys: string[], callback: (error: Error | null, values?: Record<string, string>) => void) => void;
    removeItem: (key: string, callback?: (error: Error | null, success?: boolean) => void) => void;
    removeItems: (keys: string[], callback?: (error: Error | null, success?: boolean) => void) => void;
    getKeys: (callback: (error: Error | null, keys?: string[]) => void) => void;
  };
  
  // === User Data ===
  initDataUnsafe?: {
    query_id?: string;
    user?: {
      id: number;
      is_bot?: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
      photo_url?: string;
    };
    receiver?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
    chat?: {
      id: number;
      type: 'group' | 'supergroup' | 'channel';
      title: string;
      username?: string;
      photo_url?: string;
    };
    start_param?: string;
    auth_date: number;
    hash: string;
  };
  initData?: string;
  
  // === Theme ===
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
    header_bg_color?: string;
    accent_text_color?: string;
    section_bg_color?: string;
    section_header_text_color?: string;
    subtitle_text_color?: string;
    destructive_text_color?: string;
  };
  
  // === Popups ===
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{
      id?: string;
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
      text?: string;
    }>;
  }, callback?: (buttonId: string) => void) => void;
  
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  
  // === Links ===
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void) => void;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
  
  // Глобальные функции управления загрузочным экраном
  updateLoadingProgress?: (percent: number, text?: string) => void;
  showLoadingScreen?: (message?: string) => void;
  hideLoadingScreen?: () => void;
  
  // Флаги инициализации игры
  __GAME__?: Phaser.Game;
  __GAME_INITIALIZING__?: boolean;
  __GAME_INITIALIZED__?: boolean;
  __BOOT_ASSETS_LOADED__?: boolean;
}
