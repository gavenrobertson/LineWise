// SPDX-License-Identifier: Apache-2.0
// REL-21: the ruleset for main (imported by the owner under Settings → Rules) requires the CI
// checks that exist, one review, and linear history.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = join(import.meta.dirname, '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const ruleset = JSON.parse(read('.github/rulesets/protect-main.json'));
const rule = (type) => ruleset.rules.find((r) => r.type === type);

/** Job names CI reports, with each matrix entry expanded (only the forms ci.yml uses). */
function jobNames() {
  const ci = read('.github/workflows/ci.yml');
  const names = [];
  for (const job of ci.split(/\n  (?=[a-z][\w-]*:\n)/).slice(1)) {
    const name = /\n    name: (.+)/.exec(job)?.[1];
    if (!name) continue;
    const list = /\n        os: \[([^\]]+)\]/.exec(job);
    const include = [...job.matchAll(/- \{ os: ([\w.-]+), browser: (\w+) \}/g)];
    if (include.length)
      for (const [, os, browser] of include)
        names.push(name.replace('${{ matrix.os }}', os).replace('${{ matrix.browser }}', browser));
    else if (list) for (const os of list[1].split(/,\s*/)) names.push(name.replace('${{ matrix.os }}', os));
    else names.push(name);
  }
  return names;
}

test('every required check is a job that CI or the DCO workflow runs, and every CI job is required', () => {
  const required = rule('required_status_checks').parameters.required_status_checks.map((c) => c.context);
  const dco = /\n    name: (.+)/.exec(read('.github/workflows/dco.yml'))[1];
  const known = [...jobNames(), dco];
  for (const c of required) assert.ok(known.includes(c), `${c} is not a job name`);
  for (const j of known) assert.ok(required.includes(j), `${j} is not required`);
});

test('main needs a reviewed pull request, keeps linear history and cannot be force-pushed or deleted', () => {
  assert.deepEqual(ruleset.conditions.ref_name.include, ['~DEFAULT_BRANCH']);
  assert.equal(rule('pull_request').parameters.required_approving_review_count, 1);
  for (const t of ['required_linear_history', 'non_fast_forward', 'deletion']) assert.ok(rule(t), t);
  assert.ok(!rule('pull_request').parameters.allowed_merge_methods.includes('merge'), 'no merge commits');
});
