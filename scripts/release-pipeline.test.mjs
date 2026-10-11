// SPDX-License-Identifier: Apache-2.0
// The release pipeline (spec section 11): installers per OS (REL-01, REL-02), checksums and SBOM
// (REL-04), and update signing with the private key only in CI secrets (NFR-SEC-06).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const conf = JSON.parse(read('apps/desktop/src-tauri/tauri.conf.json'));
const release = read('.github/workflows/release.yml');

describe('REL-01 Windows installers', () => {
  it('NSIS per user without admin rights, MSI per machine, both from the x64 release job', () => {
    assert.equal(conf.bundle.windows.nsis.installMode, 'currentUser');
    assert.match(release, /target: x86_64-pc-windows-msvc\n\s+bundles: nsis,msi/);
    assert.match(release, /target: aarch64-pc-windows-msvc\n\s+bundles: nsis/);
  });
  it('associates .lwise files and installs WebView2 through the embedded bootstrapper', () => {
    assert.deepEqual(conf.bundle.fileAssociations[0].ext, ['lwise']);
    assert.equal(conf.bundle.windows.webviewInstallMode.type, 'embedBootstrapper');
  });
  it('silent install flags are documented for IT', () => {
    for (const doc of [read('docs/dev/release.md'), read('README.md')]) {
      assert.match(doc, /msiexec \/i \S+\.msi \/qn/);
      assert.match(doc, /setup\.exe \/S|Silent: `\/S`/);
    }
  });
});

describe('REL-02 macOS disk image', () => {
  it('is a universal binary with the hardened runtime and no extra entitlements', () => {
    assert.match(release, /target: universal-apple-darwin\n\s+bundles: app,dmg/);
    assert.match(release, /targets: .*aarch64-apple-darwin,x86_64-apple-darwin/);
    assert.equal(conf.bundle.macOS.hardenedRuntime, true);
    assert.equal(conf.bundle.macOS.entitlements, undefined, 'WKWebView needs none; add only with a reason');
  });
  it('has a background image with the app and the Applications shortcut side by side', () => {
    const dmg = conf.bundle.macOS.dmg;
    assert.ok(dmg.background);
    assert.ok(
      dmg.appPosition.y === dmg.applicationFolderPosition.y &&
        dmg.appPosition.x < dmg.applicationFolderPosition.x,
    );
  });
  it('is signed and notarized when the Apple secrets exist', () => {
    for (const s of [
      'APPLE_CERTIFICATE',
      'APPLE_SIGNING_IDENTITY',
      'APPLE_API_KEY',
      'APPLE_API_ISSUER',
      'APPLE_API_KEY_PATH',
    ])
      assert.ok(release.includes(s), s);
  });
});

describe('REL-04 checksums and SBOM', () => {
  it('every release carries SHA256SUMS.txt and a CycloneDX SBOM', () => {
    assert.match(release, /sha256sum -- \* \| sort -k2 > SHA256SUMS\.txt/);
    assert.match(release, /format: cyclonedx-json/);
    assert.match(release, /dist-release\/SHA256SUMS\.txt/);
    assert.match(release, /linewise-\$\{TAG\}-sbom\.cdx\.json/);
  });
});

describe('NFR-SEC-06 signed updates', () => {
  it('the updater private key exists only as a CI secret', () => {
    assert.match(release, /secrets\.TAURI_SIGNING_PRIVATE_KEY\b/);
    const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);
    for (const f of files) {
      if (/\.(png|ico|icns|bmp|woff2?|gz|zip)$/.test(f)) continue;
      const text = readFileSync(join(ROOT, f), 'utf8');
      assert.doesNotMatch(
        text,
        /rsign encrypted secret key|untrusted comment: minisign encrypted secret key/,
        f,
      );
    }
  });
  it('the app checks HTTPS feeds on GitHub Releases and verifies against the release public key', () => {
    for (const url of conf.plugins.updater.endpoints)
      assert.match(url, /^https:\/\/github\.com\/gavenrobertson\/linewise\/releases\//);
    const rust = read('apps/desktop/src-tauri/src/updates.rs');
    assert.match(rust, /download_and_install/);
    assert.match(rust, /log::error!\("update failed: \{e\}"\)/);
    assert.match(read('scripts/release-config.mjs'), /config\.plugins\.updater = \{ pubkey:/);
  });
});
