// SPDX-License-Identifier: Apache-2.0
/**
 * Native smoke test of the real app through tauri-driver (spec section 10): launch, new
 * diagram, add a device, save, quit, relaunch with the saved file, and check it reopened.
 *
 * Needs a debug build (`pnpm tauri build --debug --no-bundle`) and `tauri-driver` on PATH
 * (plus msedgedriver on Windows or WebKitWebDriver on Linux). macOS has no WKWebView driver,
 * so it is covered by docs/release-checklist.md instead.
 *
 *   node --test apps/desktop/smoke/smoke.test.mjs
 *
 * Uses the W3C WebDriver HTTP protocol directly to avoid a WebDriver client dependency.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';

const ROOT = resolve(import.meta.dirname, '..', 'src-tauri', 'target');
const exe = process.platform === 'win32' ? 'linewise.exe' : 'linewise';
const APP =
  process.env.LINEWISE_APP ?? [join(ROOT, 'debug', exe), join(ROOT, 'release', exe)].find(existsSync);
const DRIVER = 'http://127.0.0.1:4444';
const MOD = ''; // Control (the smoke test runs on Windows and Linux only)
const SHIFT = '';
const ENTER = '';

const smokeDir = mkdtempSync(join(tmpdir(), 'linewise-smoke-'));
let driver;

async function wd(method, path, body) {
  const res = await fetch(`${DRIVER}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(json.value)}`);
  return json.value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, what, timeout = 20_000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      last = e;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${what}${last ? `: ${last.message}` : ''}`);
}

async function session(args = []) {
  const value = await wd('POST', '/session', {
    capabilities: { alwaysMatch: { 'tauri:options': { application: APP, args } } },
  });
  return value.sessionId;
}

async function find(sid, xpath) {
  const el = await wd('POST', `/session/${sid}/element`, { using: 'xpath', value: xpath });
  return Object.values(el)[0];
}

async function keys(sid, ...chords) {
  for (const chord of chords) {
    const down = [...chord].map((value) => ({ type: 'keyDown', value }));
    const up = [...chord].reverse().map((value) => ({ type: 'keyUp', value }));
    await wd('POST', `/session/${sid}/actions`, {
      actions: [{ type: 'key', id: 'kb', actions: [...down, ...up] }],
    });
  }
}

const script = (sid, fn) =>
  wd('POST', `/session/${sid}/execute/sync`, { script: `return (${fn})()`, args: [] });

before(async () => {
  assert.ok(APP, 'Build the app first: pnpm tauri build --debug --no-bundle');
  // LINEWISE_NATIVE_DRIVER points tauri-driver at a specific native driver (CI uses a logging wrapper).
  const native = process.env.LINEWISE_NATIVE_DRIVER;
  driver = spawn('tauri-driver', native ? ['--native-driver', native] : [], {
    stdio: 'inherit',
    env: { ...process.env, LINEWISE_SMOKE_DIR: smokeDir },
  });
  await until(() => fetch(`${DRIVER}/status`).then((r) => r.ok), 'tauri-driver');
});

after(() => {
  driver?.kill();
  rmSync(smokeDir, { recursive: true, force: true });
});

test('launch, new diagram, save, reopen', { timeout: 180_000 }, async () => {
  let sid = await session();
  try {
    const blank = await until(
      () => find(sid, "//button[contains(., 'New blank diagram')]"),
      'welcome screen',
    );
    await wd('POST', `/session/${sid}/element/${blank}/click`, {});
    await until(
      async () => (await script(sid, () => document.querySelectorAll('[role="dialog"]').length)) === 0,
      'welcome screen to close',
    );

    // Place a router from the library with the keyboard (journey 7 path).
    await keys(sid, [MOD, SHIFT, 'd']);
    await until(
      () => script(sid, () => document.activeElement?.getAttribute('aria-label') === 'Search device library'),
      'the library search box to take focus',
    );
    const search = await find(sid, "//input[@aria-label='Search device library']");
    await wd('POST', `/session/${sid}/element/${search}/value`, { text: 'Router – 4×GE' });
    await sleep(300);
    await keys(sid, [ENTER]);
    await until(
      async () =>
        (await script(sid, () => document.querySelectorAll('.react-flow__node-device').length)) === 1,
      'the router on the canvas',
    );

    // Leave the search box (WebDriver keeps typing into the last input otherwise).
    await script(sid, () => /** @type {HTMLElement} */ (document.activeElement)?.blur());
    await keys(sid, [MOD, 's']);
    const saved = join(smokeDir, 'Untitled diagram.lwise');
    await until(() => existsSync(saved), `the saved file ${saved}`).catch(async (e) => {
      const ui = await script(
        sid,
        () =>
          `${document.title} :: ${[...document.querySelectorAll('[role=status],[role=alert]')].map((n) => n.textContent).join(' | ')} :: active=${document.activeElement?.outerHTML.slice(0, 200)}`,
      );
      throw new Error(`${e.message}\nfolder: ${readdirSync(smokeDir).join(', ')}\nui: ${ui}`);
    });
    const text = readFileSync(saved, 'utf8');
    const docJson = JSON.parse(text);
    assert.equal(docJson.format, 'LineWise');
    assert.equal(docJson.devices.length, 1);
    assert.equal(docJson.devices[0].role, 'router');
  } finally {
    await wd('DELETE', `/session/${sid}`).catch(() => {});
  }

  // Relaunch with the file as an argument, like double-clicking it (FR-APP-09).
  sid = await session([join(smokeDir, 'Untitled diagram.lwise')]);
  try {
    await until(
      async () =>
        (
          await script(sid, () =>
            [...document.querySelectorAll('.react-flow__node-device')].map((n) => n.textContent).join('|'),
          )
        ).includes('R1'),
      'the reopened diagram',
    );
    const title = await wd('GET', `/session/${sid}/title`);
    assert.match(title, /Untitled/);
  } finally {
    await wd('DELETE', `/session/${sid}`).catch(() => {});
  }
});
