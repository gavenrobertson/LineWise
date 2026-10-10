// SPDX-License-Identifier: Apache-2.0
/**
 * Shared helpers for the license check and the third-party notices generator (OSS-02, OSS-03).
 * Reads npm dependencies through `pnpm licenses list --json` and Rust crates through
 * `cargo metadata`, so both work offline from the installed tree.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..');
export const TAURI_DIR = join(ROOT, 'apps/desktop/src-tauri');

/**
 * Licenses that may ship inside LineWise (spec OSS-02). 0BSD, MIT-0, Unlicense and
 * CDLA-Permissive-2.0 are public-domain-equivalent or more permissive than MIT; see
 * docs/decisions-log.md.
 */
export const ALLOWED = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'Apache-2.0',
  'Apache-2.0 WITH LLVM-exception',
  'MPL-2.0',
  'EPL-2.0',
  'Zlib',
  'Unicode-3.0',
  'Unicode-DFS-2016',
  'CC0-1.0',
  'OFL-1.1',
  'Unlicense',
  'CDLA-Permissive-2.0',
]);

/** Licenses that must never appear, even in development-only tooling. */
export const BLOCKED = /^(A?GPL|SSPL|LGPL|EUPL|CC-BY-NC|BUSL|Commons-Clause)/i;

/** Development-only tools may also use these (they are never bundled). */
export const DEV_ONLY_EXTRA = new Set(['Python-2.0', 'CC-BY-4.0', 'BlueOak-1.0.0', 'CC-BY-3.0']);

/** Tokenize and evaluate an SPDX expression against a predicate. "/" is treated as OR (legacy Cargo style). */
export function satisfies(expression, ok) {
  if (!expression) return false;
  const tokens = expression
    .replace(/\s*\/\s*/g, ' OR ')
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .split(/\s+/)
    .filter(Boolean);
  let i = 0;
  const peek = () => tokens[i];
  function primary() {
    if (peek() === '(') {
      i++;
      const v = orExpr();
      if (peek() === ')') i++;
      return v;
    }
    let id = tokens[i++] ?? '';
    if (peek() === 'WITH') {
      i++;
      id = `${id} WITH ${tokens[i++] ?? ''}`;
      return ok(id) || ok(id.split(' WITH ')[0]);
    }
    return ok(id.replace(/\+$/, ''));
  }
  function andExpr() {
    let v = primary();
    while (peek() === 'AND') {
      i++;
      const r = primary();
      v = v && r;
    }
    return v;
  }
  function orExpr() {
    let v = andExpr();
    while (peek() === 'OR') {
      i++;
      const r = andExpr();
      v = v || r;
    }
    return v;
  }
  return orExpr();
}

/**
 * Run pnpm portably: reuse the pnpm that launched us when there is one (npm_execpath), and
 * go through a shell on Windows otherwise, where pnpm is a .cmd shim Node cannot spawn directly.
 */
function pnpm(args) {
  const opts = { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  const exec = process.env.npm_execpath;
  if (exec && /pnpm\.(c?js|mjs)$/.test(exec)) return execFileSync(process.execPath, [exec, ...args], opts);
  return execFileSync('pnpm', args, { ...opts, shell: process.platform === 'win32' });
}

/** npm packages from pnpm, flattened to { name, version, license, path, homepage, author }. */
export function npmPackages({ prod }) {
  const args = ['licenses', 'list', '--json'];
  if (prod) args.push('--prod');
  const out = pnpm(args);
  const byLicense = JSON.parse(out);
  const list = [];
  for (const [license, pkgs] of Object.entries(byLicense)) {
    for (const p of pkgs) {
      p.versions.forEach((version, idx) => {
        list.push({
          ecosystem: 'npm',
          name: p.name,
          version,
          license,
          path: p.paths[idx] ?? p.paths[0],
          homepage: p.homepage ?? '',
          author: typeof p.author === 'string' ? p.author : (p.author?.name ?? ''),
        });
      });
    }
  }
  return list.filter((p) => !p.name.startsWith('@linewise/')).sort((a, b) => a.name.localeCompare(b.name));
}

/** Rust crates the app links, from cargo metadata (all target platforms). */
export function cargoPackages() {
  if (!existsSync(join(TAURI_DIR, 'Cargo.toml'))) return [];
  const out = execFileSync('cargo', ['metadata', '--format-version', '1', '--locked'], {
    cwd: TAURI_DIR,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const meta = JSON.parse(out);
  const workspace = new Set(meta.workspace_members);
  return meta.packages
    .filter((p) => !workspace.has(p.id))
    .map((p) => ({
      ecosystem: 'cargo',
      name: p.name,
      version: p.version,
      license: p.license ?? (p.license_file ? `SEE FILE ${p.license_file}` : ''),
      path: p.manifest_path.replace(/Cargo\.toml$/, ''),
      homepage: p.repository ?? p.homepage ?? '',
      author: (p.authors ?? []).join(', '),
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

/** Find the license text shipped with a package, if any. */
export function licenseText(dir) {
  if (!dir || !existsSync(dir)) return '';
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying|notice)(\.|-|$)/i.test(f));
  if (!file) return '';
  try {
    return readFileSync(join(dir, file), 'utf8').trim();
  } catch {
    return '';
  }
}
