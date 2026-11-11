/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SafeStorage {
  private static isAvailable(type: 'localStorage' | 'sessionStorage'): boolean {
    try {
      const storage = window[type];
      if (!storage) return false;
      const x = '__storage_test__';
      storage.setItem(x, x);
      storage.removeItem(x);
      return true;
    } catch (e) {
      return false;
    }
  }

  private static memoryStorage: Record<string, string> = {};

  static getItem(key: string, type: 'localStorage' | 'sessionStorage' = 'localStorage'): string | null {
    try {
      if (this.isAvailable(type)) {
        return window[type].getItem(key);
      }
    } catch (e) {
      console.warn(`[STORAGE WARNING] Fallback to memory for getItem(${key})`);
    }
    return this.memoryStorage[key] !== undefined ? this.memoryStorage[key] : null;
  }

  static setItem(key: string, value: string, type: 'localStorage' | 'sessionStorage' = 'localStorage'): void {
    try {
      if (this.isAvailable(type)) {
        window[type].setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`[STORAGE WARNING] Fallback to memory for setItem(${key})`);
    }
    this.memoryStorage[key] = value;
  }

  static removeItem(key: string, type: 'localStorage' | 'sessionStorage' = 'localStorage'): void {
    try {
      if (this.isAvailable(type)) {
        window[type].removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`[STORAGE WARNING] Fallback to memory for removeItem(${key})`);
    }
    delete this.memoryStorage[key];
  }
}

export default SafeStorage;
