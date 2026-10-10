// SPDX-License-Identifier: Apache-2.0
/** Native shell configuration: menus, CSP, capabilities, bundle identity, file association. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = (p: string) => resolve(__dirname, '..', p);
const conf = JSON.parse(readFileSync(here('src-tauri/tauri.conf.json'), 'utf8'));
const menuRs = readFileSync(here('src-tauri/src/menu.rs'), 'utf8');
const buildRs = readFileSync(here('src-tauri/build.rs'), 'utf8');
const caps = JSON.parse(readFileSync(here('src-tauri/capabilities/default.json'), 'utf8'));

describe('FR-APP-01 native menu bar', () => {
  it('has File, Edit, View, Insert, Arrange, Network, Window and Help, plus the macOS app menu', () => {
    const menus = [...menuRs.matchAll(/SubmenuBuilder::new\(app, "([^"]+)"\)/g)].map((m) => m[1]);
    expect(menus).toEqual(
      expect.arrayContaining(['File', 'Edit', 'View', 'Insert', 'Arrange', 'Network', 'Window', 'Help']),
    );
    // macOS: an app menu named after the app with About, Services-style Hide items and Quit.
    expect(menuRs).toMatch(/cfg!\(target_os = "macos"\)/);
    expect(menuRs).toMatch(/SubmenuBuilder::new\(app, "LineWise"\)[\s\S]*PredefinedMenuItem::quit/);
    // Windows/Linux: Preferences lives in the Edit menu instead of the app menu.
    expect(menuRs).toMatch(/if !cfg!\(target_os = "macos"\)[\s\S]*edit\.preferences/);
  });
});

describe('NFR-SEC-02 content security policy', () => {
  const csp: string = conf.app.security.csp;
  const directive = (name: string) =>
    csp
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith(`${name} `)) ?? '';

  it('allows only bundled scripts: no eval, no inline scripts, no remote hosts', () => {
    expect(directive('default-src')).toBe("default-src 'self'");
    expect(directive('script-src')).toBe("script-src 'self'");
    expect(csp).not.toMatch(/unsafe-eval|https?:\/\/(?!ipc\.localhost)|\*/);
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
  });

  it('the page has no inline or remote scripts and fonts are bundled', () => {
    const html = readFileSync(here('index.html'), 'utf8');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/(src|href)="https?:/);
    const css =
      readFileSync(here('src/styles.css'), 'utf8') +
      readFileSync(here('../../packages/brand/fonts/fonts.css'), 'utf8');
    expect(css).not.toMatch(/url\(['"]?https?:|fonts\.googleapis/);
  });
});

describe('NFR-SEC-01 least-privilege capabilities', () => {
  const declared = [...buildRs.matchAll(/"([a-z_]+)",/g)].map((m) => m[1] as string);
  const granted: string[] = caps.permissions;

  it('grants every app command it declares, and nothing broad', () => {
    for (const c of declared) expect(granted, c).toContain(`allow-${c.replace(/_/g, '-')}`);
    expect(granted.filter((p) => /^(fs|shell|http|process|os|clipboard-manager):/.test(p))).toEqual([]);
    expect(granted.filter((p) => p.endsWith(':default') && p !== 'core:default')).toEqual([]);
  });

  it('applies only to the main window', () => {
    expect(caps.windows).toEqual(['main']);
  });

  it('opens a remote debugging port only in the CI smoke build, which is never shipped', () => {
    const smoke = JSON.parse(readFileSync(here('src-tauri/tauri.smoke.conf.json'), 'utf8'));
    const debug = readFileSync(here('src-tauri/tauri.debug.conf.json'), 'utf8');
    expect(JSON.stringify(conf)).not.toContain('remote-debugging');
    expect(debug).not.toContain('remote-debugging');
    // The smoke window is the shipped window plus the debugging port (the config merge replaces arrays).
    const { additionalBrowserArgs, ...rest } = smoke.app.windows[0];
    expect(rest).toEqual(conf.app.windows[0]);
    expect(additionalBrowserArgs).toMatch(/--remote-debugging-port=\d+/);
    const ci = readFileSync(here('../../.github/workflows/ci.yml'), 'utf8');
    const release = readFileSync(here('../../.github/workflows/release.yml'), 'utf8');
    expect(release).not.toContain('tauri.smoke.conf.json');
    // The smoke build runs after the debug installers are bundled and uploads nothing itself.
    expect(ci.indexOf('tauri.smoke.conf.json')).toBeGreaterThan(ci.indexOf('name: Debug installers'));
  });
});

describe('REL-03, FR-APP-09 bundle identity and file association', () => {
  it('uses the project identity and reads the version from package.json', () => {
    expect(conf.identifier).toBe('dev.gavenrobertson.linewise');
    expect(conf.productName).toBe('LineWise');
    expect(conf.version).toBe('../package.json');
  });

  it('registers .lwise files and installs per-user on Windows', () => {
    const assoc = conf.bundle.fileAssociations[0];
    expect(assoc.ext).toEqual(['lwise']);
    expect(assoc.role).toBe('Editor');
    expect(conf.bundle.windows.nsis.installMode).toBe('currentUser');
    expect(conf.bundle.windows.webviewInstallMode.type).toBe('embedBootstrapper');
    expect(conf.bundle.macOS.minimumSystemVersion).toBe('12.0');
  });
});
