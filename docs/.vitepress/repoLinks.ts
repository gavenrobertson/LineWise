// SPDX-License-Identifier: Apache-2.0
/**
 * The docs are written to read on GitHub, so they link to repo files with relative paths
 * (`../../CONTRIBUTING.md`, `../schema/v1.json`). On the site, a link to anything that is not a
 * page of the site points to the file on GitHub instead (DOC-01, DOC-02).
 */
import { existsSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import type MarkdownIt from 'markdown-it';

export const REPO = 'https://github.com/gavenrobertson/linewise';

/** Files and folders under docs/ that are working documents, not site pages. */
export const EXCLUDED = [
  'SPEC.md',
  'AGENT_PROMPT.md',
  'PLAN.md',
  'HUMAN-TODO.md',
  'unverified-templates.md',
  'reports/**',
  'examples/**',
];

const excluded = (path: string) =>
  EXCLUDED.some((p) => (p.endsWith('/**') ? path.startsWith(p.slice(0, -2)) : path === p));

/**
 * Where a relative link from `page` (a path under docs/) should go on the site: unchanged when it
 * is a site page or asset, else a GitHub URL. `docsDir` is the docs folder on disk.
 */
export function siteHref(href: string, page: string, docsDir: string): string {
  if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) return href;
  const [path, hash = ''] = href.split('#', 2) as [string, string?];
  const target = posix.normalize(posix.join(posix.dirname(`docs/${page}`), path));
  const inDocs = target.startsWith('docs/') ? target.slice('docs/'.length) : null;
  const anchor = hash ? `#${hash}` : '';
  if (inDocs !== null && !excluded(inDocs)) {
    const isDir = path.endsWith('/');
    if (!isDir || existsSync(join(docsDir, inDocs, 'index.md'))) return href;
  }
  const kind = path.endsWith('/') || !/\.[a-z0-9]+$/i.test(target) ? 'tree' : 'blob';
  return `${REPO}/${kind}/main/${target.replace(/\/$/, '')}${anchor}`;
}

export function repoLinks(md: MarkdownIt, docsDir: string): void {
  md.core.ruler.push('lw-repo-links', (state) => {
    const page = (state.env as { relativePath?: string }).relativePath ?? '';
    for (const block of state.tokens) {
      for (const tok of block.children ?? []) {
        if (tok.type !== 'link_open') continue;
        const href = tok.attrGet('href');
        if (href) tok.attrSet('href', siteHref(href, page, docsDir));
      }
    }
  });
}

export const docsDirOf = (configDir: string) => dirname(configDir);
