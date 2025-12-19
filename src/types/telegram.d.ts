// src/types/telegram.d.ts

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  viewportWidth: number;
  viewportHeight: number;
  viewportStableHeight: number;
  platform: string;
  disableVerticalSwipes?: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  onEvent: (event: string, callback: (data: any) => void) => void;
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
  };
  CloudStorage: {
    setItem: (key: string, value: string, callback?: () => void) => void;
    getItem: (key: string, callback: (err: any, value: string) => void) => void;
  };
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
  };
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}