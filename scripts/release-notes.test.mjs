// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sectionFor } from './release-notes.mjs';

const log = `# Changelog\n\n## [0.2.0] - 2026-10-11\n\n- VLANs\n\n## [0.1.0] - 2026-10-10\n\n- Canvas\n`;

test('extracts one version section', () => {
  assert.equal(sectionFor(log, '0.2.0'), '- VLANs');
  assert.equal(sectionFor(log, '0.1.0'), '- Canvas');
  assert.equal(sectionFor(log, '9.9.9'), null);
});
