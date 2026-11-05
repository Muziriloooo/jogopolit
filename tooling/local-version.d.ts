import type { Plugin } from 'vite';
export function localUpdates(): Plugin;
export function localVersion(root: string): Promise<string>;
