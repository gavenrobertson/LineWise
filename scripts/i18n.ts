// SPDX-License-Identifier: Apache-2.0
/**
 * i18n extractor (NFR-I18N-01): writes apps/desktop/src/i18n/locales/en.json from the code.
 *
 *   pnpm i18n           regenerate en.json
 *   pnpm i18n --check   fail if en.json is out of date (CI)
 *
 * Sources of keys:
 * - every t('key', 'English') / i18n.t('key', { defaultValue: 'English' }) call with literal
 *   arguments in apps/desktop/src, and the command palette's L('name', 'English') (key cmd.name);
 * - data-backed vocabularies from the device library: roles, role categories, starter diagrams.
 *
 * A t() call whose key is not a literal fails the run unless its prefix is one of the
 * data-backed ones, so every string a user can see ends up in the resource file. So does any
 * English left in JSX text or in a label-like attribute (aria-label, title, placeholder, …),
 * apart from technical tokens and the brand name (TECHNICAL below).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { ROLE_CATEGORY, ROLE_LABELS, STARTERS } from '../packages/device-library/src/index.ts';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'apps/desktop/src');
const OUT = join(SRC, 'i18n/locales/en.json');
const DATA_PREFIXES = ['role.', 'category.', 'starter.'];
/** Words that are the same in every language: the brand, protocol names, units and keys. */
const TECHNICAL = new Set([
  'LineWise',
  'Line',
  'Wise',
  'VLAN',
  'VLANs',
  'VRF',
  'VRFs',
  'RD',
  'RU',
  'PoE',
  'MTU',
  'IPv4',
  'IPv6',
  'ID',
  'px',
  'DPI',
  'Po',
  'Esc',
  'IOS-XE',
  'https',
]);
const LABEL_ATTRS = new Set(['aria-label', 'title', 'placeholder', 'alt', 'label', 'description', 'hint']);
/** True when the text contains a word a translator would need to see. */
const needsTranslation = (text: string) =>
  (text.match(/[A-Za-z][A-Za-z0-9-]*/g) ?? []).some(
    (w) => !TECHNICAL.has(w) && !/\d/.test(w) && w.length > 1,
  );

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts') ? [p] : [];
  });
}

const literal = (n: ts.Node | undefined): string | undefined =>
  n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : undefined;

function defaultOf(arg: ts.Node | undefined): string | undefined {
  const lit = literal(arg);
  if (lit !== undefined) return lit;
  // i18n.t('key', { defaultValue: 'English', ... })
  if (arg && ts.isObjectLiteralExpression(arg))
    for (const p of arg.properties)
      if (ts.isPropertyAssignment(p) && p.name.getText() === 'defaultValue') return literal(p.initializer);
  return undefined;
}

export function extract(): { strings: Record<string, string>; problems: string[] } {
  const strings: Record<string, string> = {};
  const problems: string[] = [];
  const add = (key: string, value: string, where: string) => {
    if (key in strings && strings[key] !== value)
      problems.push(`${where}: "${key}" has two English texts: "${strings[key]}" and "${value}"`);
    else strings[key] = value;
  };
  for (const file of files(SRC)) {
    const text = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (n: ts.Node) => {
      const line = () => `${relative(ROOT, file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
      if (ts.isJsxText(n) && needsTranslation(n.text))
        problems.push(`${line()}: untranslated text "${n.text.trim()}"`);
      if (
        ts.isJsxAttribute(n) &&
        LABEL_ATTRS.has(n.name.getText()) &&
        n.initializer &&
        ts.isStringLiteral(n.initializer) &&
        needsTranslation(n.initializer.text)
      )
        problems.push(`${line()}: untranslated ${n.name.getText()}="${n.initializer.text}"`);
      if (ts.isCallExpression(n)) {
        const callee = n.expression;
        const name = ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee)
            ? callee.name.text
            : '';
        if (name === 't' || name === 'L') {
          const where = `${relative(ROOT, file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
          const [k, d] = n.arguments;
          const key = literal(k);
          const value = defaultOf(d);
          if (key !== undefined && value !== undefined) add(name === 'L' ? `cmd.${key}` : key, value, where);
          else if (key === undefined && k) {
            const src = k.getText(sf);
            const dataBacked = DATA_PREFIXES.some((p) => src.startsWith(`\`${p}`));
            // The helpers that forward a key (const t = (k, d) => i18n.t(k, ...)) are not call sites.
            const forwarding = ts.isIdentifier(k) && (k.text === 'k' || k.text === 'key');
            const cmdHelper = src === '`cmd.${k}`';
            if (!dataBacked && !forwarding && !cmdHelper)
              problems.push(`${where}: t() key is not a literal: ${src}`);
          } else if (key !== undefined && value === undefined)
            problems.push(`${where}: "${key}" has no English default`);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  for (const [role, label] of Object.entries(ROLE_LABELS)) add(`role.${role}`, label, 'device-library');
  for (const c of new Set(Object.values(ROLE_CATEGORY))) add(`category.${c}`, c, 'device-library');
  for (const s of STARTERS) {
    add(`starter.${s.id}.name`, s.name, 'device-library');
    add(`starter.${s.id}.desc`, s.description, 'device-library');
  }
  const sorted = Object.fromEntries(Object.entries(strings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return { strings: sorted, problems };
}

if (import.meta.main) {
  const { strings, problems } = extract();
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  const json = `${JSON.stringify(strings, null, 2)}\n`;
  if (process.argv.includes('--check')) {
    if (readFileSync(OUT, 'utf8') !== json) {
      console.error('apps/desktop/src/i18n/locales/en.json is out of date: run `pnpm i18n`.');
      process.exit(1);
    }
    console.log(`en.json is up to date (${Object.keys(strings).length} strings).`);
  } else {
    writeFileSync(OUT, json);
    console.log(`Wrote ${Object.keys(strings).length} strings to ${relative(ROOT, OUT)}.`);
  }
}
