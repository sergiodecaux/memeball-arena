import { LeakGuardPlugin } from '../plugins/LeakGuardPlugin';

declare module 'phaser' {
  interface Scene {
    leakGuard: LeakGuardPlugin;
  }
}
