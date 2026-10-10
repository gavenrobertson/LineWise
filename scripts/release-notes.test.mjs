// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sectionFor } from './release-notes.mjs';

const log = `# Changelog\n\n## [0.2.0] - 2026-10-11\n\n- VLANs\n\n## [0.1.0] - 2026-10-10\n\n- Canvas\n`;

test('extracts one version section', () => {
  assert.equal(sectionFor(log, '0.2.0'), '- VLANs');
  assert.equal(sectionFor(log, '0.1.0'), '- Canvas');
  assert.equal(sectionFor(log, '9.9.9'), null);
  assert.equal(sectionFor(log, '0.2'), null);
});

test('understands release-please headings', () => {
  const rp =
    '## [1.1.0](https://github.com/o/r/compare/v1.0.0...v1.1.0) (2026-11-01)\n\n### Features\n\n* x\n';
  assert.equal(sectionFor(rp, '1.1.0'), '### Features\n\n* x');
});
