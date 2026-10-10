// SPDX-License-Identifier: Apache-2.0
import { createBrowserPlatform } from './browser.ts';
import { createTauriPlatform } from './tauri.ts';
import type { PlatformAdapter } from './types.ts';

export type * from './types.ts';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let instance: PlatformAdapter | undefined;

export function platform(): PlatformAdapter {
  instance ??= isTauri() ? createTauriPlatform() : createBrowserPlatform();
  return instance;
}

/** Tests can install a fake adapter. */
export function setPlatform(p: PlatformAdapter): void {
  instance = p;
}
