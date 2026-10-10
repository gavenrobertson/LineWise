// SPDX-License-Identifier: Apache-2.0
/**
 * Native `.lwise` file format (ADR 0004, FR-FMT-01..05): stable JSON,
 * validation on load, ordered migrations, and recovery of partially valid files.
 */
import { FORMAT_NAME, NetworkDocument, SCHEMA_VERSION } from './schema.ts';

export const FILE_EXTENSION = 'lwise';
export const SCHEMA_URL = `https://raw.githubusercontent.com/gavenrobertson/linewise/main/schema/v${SCHEMA_VERSION}.json`;
export const LARGE_FILE_BYTES = 20 * 1024 * 1024;

/**
 * Entity arrays whose order carries no meaning: sorted by id on save.
 * `zones` and `annotations` are not here: their order is the drawing order
 * (bring to front / send to back), so it is preserved.
 */
const SORTED_ARRAYS = new Set(['devices', 'links', 'portChannels', 'vlans', 'vrfs', 'subnets']);

function sortValue(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) {
    const items = value.map((v) => sortValue(v));
    if (key && SORTED_ARRAYS.has(key)) {
      items.sort((a, b) =>
        String((a as { id?: string }).id ?? '').localeCompare(String((b as { id?: string }).id ?? '')),
      );
    }
    if (key === 'pages' || key === 'layers')
      items.sort((a, b) => ((a as { order: number }).order ?? 0) - ((b as { order: number }).order ?? 0));
    return items;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v === undefined) continue;
      out[k] = sortValue(v, k);
    }
    return out;
  }
  return value;
}

/** JSON with recursively sorted keys and 2-space indentation. */
export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

export function serializeDocument(doc: NetworkDocument): string {
  return stableStringify({ ...doc, $schema: SCHEMA_URL, format: FORMAT_NAME, schemaVersion: SCHEMA_VERSION });
}

export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** migrations[n] upgrades a file from schemaVersion n to n + 1. */
export const migrations: Record<number, Migration> = {};

export function registerMigration(fromVersion: number, m: Migration): void {
  migrations[fromVersion] = m;
}

export function migrate(
  raw: Record<string, unknown>,
  target = SCHEMA_VERSION,
): { raw: Record<string, unknown>; applied: number[] } {
  let version = Number(raw.schemaVersion ?? 1);
  const applied: number[] = [];
  let current = raw;
  while (version < target) {
    const m = migrations[version];
    if (!m) throw new Error(`No migration from schema v${version}`);
    current = { ...m(current), schemaVersion: version + 1 };
    applied.push(version);
    version++;
  }
  return { raw: current, applied };
}

export interface LoadIssue {
  path: string;
  message: string;
}

export type LoadResult =
  | { status: 'ok'; doc: NetworkDocument; readOnly: false; migratedFrom?: number; warnings: string[] }
  | { status: 'newer'; doc: NetworkDocument; readOnly: true; fileVersion: number; warnings: string[] }
  | { status: 'invalid'; issues: LoadIssue[]; recovered: NetworkDocument | null }
  | { status: 'unreadable'; message: string };

/**
 * Parse a `.lwise` file. Older files are migrated in memory (the file on disk
 * is untouched until the user saves); newer files open read-only.
 */
export function parseDocument(text: string): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { status: 'unreadable', message: `Not valid JSON: ${(e as Error).message}` };
  }
  if (!raw || typeof raw !== 'object' || (raw as { format?: unknown }).format !== FORMAT_NAME) {
    return { status: 'unreadable', message: 'This is not a LineWise diagram.' };
  }
  const warnings: string[] = [];
  if (text.length > LARGE_FILE_BYTES)
    warnings.push('This file is larger than 20 MB; consider removing embedded images.');
  const fileVersion = Number((raw as { schemaVersion?: unknown }).schemaVersion ?? 1);

  if (fileVersion > SCHEMA_VERSION) {
    const parsed = NetworkDocument.safeParse({ ...(raw as object), schemaVersion: SCHEMA_VERSION });
    const doc = parsed.success ? parsed.data : recover(raw as Record<string, unknown>);
    if (!doc)
      return {
        status: 'unreadable',
        message: `Made with a newer version of LineWise (schema v${fileVersion}).`,
      };
    warnings.push(`Made with a newer version of LineWise (schema v${fileVersion}); opened read-only.`);
    return { status: 'newer', doc, readOnly: true, fileVersion, warnings };
  }

  let migratedRaw = raw as Record<string, unknown>;
  let migratedFrom: number | undefined;
  try {
    const m = migrate(migratedRaw);
    migratedRaw = m.raw;
    if (m.applied.length) migratedFrom = fileVersion;
  } catch (e) {
    return { status: 'unreadable', message: (e as Error).message };
  }

  const parsed = NetworkDocument.safeParse(migratedRaw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return { status: 'invalid', issues, recovered: recover(migratedRaw) };
  }
  const result: LoadResult = { status: 'ok', doc: parsed.data, readOnly: false, warnings };
  if (migratedFrom !== undefined) result.migratedFrom = migratedFrom;
  return result;
}

/**
 * Best-effort recovery (FR-FMT-05): keep every entity that validates on its
 * own, drop the rest, and drop links that point at missing devices.
 */
export function recover(raw: Record<string, unknown>): NetworkDocument | null {
  const shape = NetworkDocument.shape;
  type Parser = { safeParse: (v: unknown) => { success: boolean; data?: unknown } };
  type Wrapped = { element?: Parser; unwrap?: () => Wrapped; def?: { innerType?: Wrapped } };
  const elementOf = (s: Wrapped): Parser => {
    let t: Wrapped | undefined = s;
    for (let i = 0; i < 4 && t && !t.element; i++) t = t.unwrap ? t.unwrap() : t.def?.innerType;
    if (!t?.element) throw new Error('not an array schema');
    return t.element;
  };
  const pick = <K extends keyof typeof shape>(key: K): unknown[] => {
    const arr = raw[key as string];
    if (!Array.isArray(arr)) return [];
    const itemSchema = elementOf(shape[key] as unknown as Wrapped);
    return arr.flatMap((v) => {
      const r = itemSchema.safeParse(v);
      return r.success ? [r.data] : [];
    });
  };
  try {
    const candidate = {
      format: FORMAT_NAME,
      schemaVersion: SCHEMA_VERSION,
      id: typeof raw.id === 'string' && raw.id ? raw.id : 'recovered',
      name: typeof raw.name === 'string' ? raw.name : 'Recovered diagram',
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
      pages: pick('pages'),
      devices: pick('devices'),
      links: pick('links'),
      portChannels: pick('portChannels'),
      zones: pick('zones'),
      vlans: pick('vlans'),
      vrfs: pick('vrfs'),
      subnets: pick('subnets'),
    };
    const ids = new Set((candidate.devices as { id: string }[]).map((d) => d.id));
    candidate.links = (
      candidate.links as { endpointA: { deviceId: string }; endpointB: { deviceId: string } }[]
    ).filter((l) => ids.has(l.endpointA.deviceId) && ids.has(l.endpointB.deviceId));
    if (candidate.pages.length === 0) {
      const t = new Date(0).toISOString();
      candidate.pages = [{ id: 'page-recovered', name: 'Page 1', order: 0, createdAt: t, updatedAt: t }];
    }
    const r = NetworkDocument.safeParse(candidate);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
