import type { CapacitorConfig } from '@capacitor/cli';

// URL of the deployed game. Override at build time with NATIVE_APP_URL.
// Keeping the WebView on the production origin preserves localStorage progress
// and lets web deploys update the native app without shipping a new APK.
const NATIVE_APP_URL =
  process.env.NATIVE_APP_URL || 'https://sergiodecaux.github.io/memeball-arena/';

const config: CapacitorConfig = {
  appId: 'ru.galaxyleague.game',
  appName: 'Galaxy League',
  webDir: 'native-web',
  backgroundColor: '#050505',
  server: {
    url: NATIVE_APP_URL,
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
