// SPDX-License-Identifier: Apache-2.0
// Writes icons/<style>/<role>.svg from src/icons.ts so contributors and the docs site can use the files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_ROLES, renderIcon, type IconStyle } from '../src/icons.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const style of ['classic', 'line'] as IconStyle[]) {
  const dir = join(root, 'icons', style);
  mkdirSync(dir, { recursive: true });
  for (const role of ICON_ROLES) {
    const svg = renderIcon(role, style).replace(
      '<svg ',
      style === 'classic' ? '<svg color="#1F6FB2" ' : '<svg color="#0E1726" ',
    );
    writeFileSync(join(dir, `${role}.svg`), `${svg}\n`);
  }
}
console.log(`Wrote ${ICON_ROLES.length * 2} icons`);
