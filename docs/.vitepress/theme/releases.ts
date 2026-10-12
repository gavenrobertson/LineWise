// SPDX-License-Identifier: Apache-2.0
/**
 * What the download page offers: the newest published release on GitHub and its installers,
 * and which one fits the visitor's computer. Pure functions, so the page and its tests share them.
 * Drafts are never public, so a release appears here only once the maintainer publishes it.
 */

export const REPO = 'gavenrobertson/LineWise';
export const RELEASES_API = `https://api.github.com/repos/${REPO}/releases?per_page=20`;
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`;

export interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

export interface GitHubRelease {
  tag_name: string;
  name?: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at?: string | null;
  assets: GitHubAsset[];
}

export type InstallerKind = 'windows-x64' | 'windows-arm64' | 'windows-msi' | 'macos';
export type Platform = 'windows-x64' | 'windows-arm64' | 'macos' | 'linux' | 'other';

export interface Installer {
  kind: InstallerKind;
  name: string;
  url: string;
  size: number;
}

/** File names the release workflow produces (Tauri bundler), e.g. `LineWise_1.0.0_x64-setup.exe`. */
const PATTERNS: Record<InstallerKind, RegExp> = {
  'windows-x64': /_x64-setup\.exe$/i,
  'windows-arm64': /_arm64-setup\.exe$/i,
  'windows-msi': /_x64_[a-z]{2}-[A-Z]{2}\.msi$/,
  macos: /_universal\.dmg$/i,
};

/**
 * The release to offer: the newest stable one, or the newest beta while there is no stable release.
 * `beta` is also set when a beta is newer than the stable release, so the page can mention it.
 */
export function pickRelease(releases: GitHubRelease[]): {
  release: GitHubRelease | null;
  beta: GitHubRelease | null;
} {
  const published = releases
    .filter((r) => !r.draft && r.published_at)
    .sort((a, b) => Date.parse(b.published_at!) - Date.parse(a.published_at!));
  const stable = published.find((r) => !r.prerelease) ?? null;
  const newestBeta = published.find((r) => r.prerelease) ?? null;
  if (!stable) return { release: newestBeta, beta: null };
  const betaIsNewer = newestBeta && Date.parse(newestBeta.published_at!) > Date.parse(stable.published_at!);
  return { release: stable, beta: betaIsNewer ? newestBeta : null };
}

/** The installers in a release, by kind; signatures (`.sig`) and updater archives are left out. */
export function installers(release: GitHubRelease): Partial<Record<InstallerKind, Installer>> {
  const out: Partial<Record<InstallerKind, Installer>> = {};
  for (const asset of release.assets) {
    for (const [kind, re] of Object.entries(PATTERNS) as [InstallerKind, RegExp][]) {
      if (re.test(asset.name) && !out[kind])
        out[kind] = { kind, name: asset.name, url: asset.browser_download_url, size: asset.size };
    }
  }
  return out;
}

/** `v1.2.0-beta` → `1.2.0-beta`. */
export const versionOf = (release: GitHubRelease) => release.tag_name.replace(/^v/, '');

/** Bytes as the release page shows them: `7.7 MB`. */
export function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * The visitor's platform from what the browser reports. `arch` comes from
 * `navigator.userAgentData.getHighEntropyValues(['architecture'])` where available; Windows on
 * ARM is otherwise indistinguishable, so it falls back to x64 (which also runs there).
 */
export function detectPlatform(userAgent: string, platform = '', arch = ''): Platform {
  const ua = `${platform} ${userAgent}`;
  if (/android|iphone|ipad|ipod/i.test(ua)) return 'other';
  if (/win/i.test(ua))
    return /arm/i.test(arch) || /\barm64\b|aarch64/i.test(userAgent) ? 'windows-arm64' : 'windows-x64';
  if (/mac/i.test(ua)) return 'macos';
  if (/linux|x11|cros/i.test(ua)) return 'linux';
  return 'other';
}

/** The installer to put on the main button for a platform. */
export function recommended(platform: Platform): InstallerKind | null {
  if (platform === 'windows-x64' || platform === 'windows-arm64' || platform === 'macos') return platform;
  return null;
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  'windows-x64': 'Windows',
  'windows-arm64': 'Windows on ARM',
  macos: 'macOS',
  linux: 'Linux',
  other: 'your computer',
};
