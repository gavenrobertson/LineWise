#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Developer Certificate of Origin check (OSS-05): every commit in a pull request carries a
 * `Signed-off-by:` line for its author. dco.yml runs it on pull requests from contributors who are
 * not maintainers, like the DCO GitHub app with `require.members: false`.
 *
 *   gh api repos/<owner>/<repo>/pulls/<n>/commits --paginate | node scripts/dco.mjs
 */
import { readFileSync } from 'node:fs';

const SIGNED_OFF = /^Signed-off-by: .+ <([^>]+)>\s*$/gim;

/** Pure: GitHub's pull-request commits → the commits that fail, with the reason. */
export function unsigned(commits) {
  const failures = [];
  for (const c of commits) {
    if ((c.parents ?? []).length > 1) continue; // merge commits
    const message = c.commit.message;
    const author = c.commit.author.email.toLowerCase();
    const emails = [...message.matchAll(SIGNED_OFF)].map((m) => m[1].toLowerCase());
    if (emails.length === 0) failures.push({ sha: c.sha, reason: 'no Signed-off-by line' });
    else if (!emails.includes(author))
      failures.push({ sha: c.sha, reason: `Signed-off-by does not match the author (${author})` });
  }
  return failures;
}

if (process.argv[1]?.endsWith('dco.mjs')) {
  // `gh api --paginate` prints one JSON array per page.
  const text = readFileSync(0, 'utf8').replace(/\]\s*\[/g, ',');
  const failures = unsigned(JSON.parse(text));
  for (const f of failures) console.error(`::error::${f.sha.slice(0, 7)}: ${f.reason}`);
  if (failures.length) {
    console.error(
      'Sign off each commit with `git commit -s` (see CONTRIBUTING.md). To fix existing commits: `git rebase --signoff main` and force-push.',
    );
    process.exit(1);
  }
  console.log('Every commit is signed off.');
}
