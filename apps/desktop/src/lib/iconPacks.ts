// SPDX-License-Identifier: Apache-2.0
/**
 * Icon packs (FR-ICO-05..07). A pack is a .zip, or a set of SVG/PNG files,
 * with an optional manifest.json:
 *
 *   { "name": "My icons", "icons": [{ "file": "edge.svg", "role": "router", "name": "Edge router" }] }
 *
 * SVGs are sanitized on import. Packs live in the app's own storage
 * (IndexedDB in the web view's app-data folder). Using an icon embeds it in
 * the diagram's assets, so diagrams render anywhere without the pack (FR-ICO-06).
 */
import { DEVICE_ROLES, type DeviceRole } from '@linewise/core';
import { sanitizeSvg } from './sanitize.ts';

export interface PackIcon {
  id: string;
  name: string;
  role?: DeviceRole;
  mime: 'image/svg+xml' | 'image/png';
  base64: string;
}

export interface IconPack {
  id: string;
  name: string;
  importedAt: string;
  icons: PackIcon[];
}

export const MAX_ICON_BYTES = 512 * 1024;
export const MAX_PACK_ICONS = 500;

interface Manifest {
  name?: string;
  icons?: { file: string; role?: string; name?: string }[];
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function guessRole(name: string): DeviceRole | undefined {
  const n = name
    .toLowerCase()
    .replace(/\.[a-z]+$/, '')
    .replace(/[\s_]+/g, '-');
  return (DEVICE_ROLES as readonly string[]).includes(n) ? (n as DeviceRole) : undefined;
}

/** Build a pack from files (already unzipped). Pure apart from DOMPurify; unit-tested. */
export function buildPack(
  files: { name: string; bytes: Uint8Array }[],
  fallbackName: string,
  warnings: string[] = [],
): IconPack {
  const manifestFile = files.find((f) => baseName(f.name).toLowerCase() === 'manifest.json');
  let manifest: Manifest = {};
  if (manifestFile) {
    try {
      manifest = JSON.parse(new TextDecoder().decode(manifestFile.bytes)) as Manifest;
    } catch {
      warnings.push('manifest.json is not valid JSON and was ignored.');
    }
  }
  const meta = new Map((manifest.icons ?? []).map((m) => [baseName(m.file).toLowerCase(), m]));
  const icons: PackIcon[] = [];
  for (const f of files) {
    const file = baseName(f.name);
    const lower = file.toLowerCase();
    const isSvg = lower.endsWith('.svg');
    const isPng = lower.endsWith('.png');
    if (!isSvg && !isPng) continue;
    if (f.bytes.length > MAX_ICON_BYTES) {
      warnings.push(`${file} is larger than 512 KB and was skipped.`);
      continue;
    }
    if (icons.length >= MAX_PACK_ICONS) {
      warnings.push(`Only the first ${MAX_PACK_ICONS} icons were imported.`);
      break;
    }
    const m = meta.get(lower);
    const role =
      m?.role && (DEVICE_ROLES as readonly string[]).includes(m.role)
        ? (m.role as DeviceRole)
        : guessRole(file);
    let base64: string;
    if (isSvg) {
      const clean = sanitizeSvg(new TextDecoder().decode(f.bytes));
      if (!clean.includes('<svg')) {
        warnings.push(`${file} is not a usable SVG and was skipped.`);
        continue;
      }
      base64 = toBase64(new TextEncoder().encode(clean));
    } else {
      // PNG signature check; anything else is rejected.
      const sig = [0x89, 0x50, 0x4e, 0x47];
      if (!sig.every((b, i) => f.bytes[i] === b)) {
        warnings.push(`${file} is not a PNG and was skipped.`);
        continue;
      }
      base64 = toBase64(f.bytes);
    }
    icons.push({
      id: `${icons.length}-${lower}`,
      name: m?.name ?? file.replace(/\.[a-z]+$/i, ''),
      ...(role ? { role } : {}),
      mime: isSvg ? 'image/svg+xml' : 'image/png',
      base64,
    });
  }
  return {
    id: `pack-${Date.now().toString(36)}`,
    name: manifest.name?.trim() || fallbackName,
    importedAt: new Date().toISOString(),
    icons,
  };
}

export async function unzipFiles(bytes: Uint8Array): Promise<{ name: string; bytes: Uint8Array }[]> {
  const { unzipSync } = await import('fflate');
  // Only read image and manifest entries; ignore everything else (zip-bomb safety via size filter).
  const entries = unzipSync(bytes, {
    filter: (f) =>
      /\.(svg|png|json)$/i.test(f.name) &&
      f.originalSize <= MAX_ICON_BYTES * 2 &&
      !f.name.startsWith('__MACOSX/'),
  });
  return Object.entries(entries).map(([name, b]) => ({ name, bytes: b }));
}

// ---------------------------------------------------------------- storage

const DB = 'linewise';
const STORE = 'iconPacks';
let memory: IconPack[] = [];

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function listPacks(): Promise<IconPack[]> {
  const db = await openDb();
  if (!db) return memory;
  return new Promise((resolve) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as IconPack[]).sort((a, b) => a.name.localeCompare(b.name)));
    req.onerror = () => resolve(memory);
  });
}

export async function savePack(pack: IconPack): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory = [...memory.filter((p) => p.id !== pack.id), pack];
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(pack);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not save the icon pack'));
  });
}

export async function deletePack(id: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory = memory.filter((p) => p.id !== id);
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
