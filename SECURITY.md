# Security policy

## Reporting a vulnerability

Please report security problems **privately** through GitHub's private vulnerability reporting:
[**Report a vulnerability**](https://github.com/gavenrobertson/linewise/security/advisories/new).

Do not open a public issue. Include the LineWise version, your OS, what an attacker could do, and steps or a file that reproduces it. Please do not include real network configurations or credentials; a sanitized sample is enough.

You can expect an acknowledgement within 5 working days and an assessment within 14. We will agree a disclosure date with you, credit you in the advisory unless you prefer otherwise, and publish a fixed release before disclosure.

## Supported versions

| Version               | Supported                |
| --------------------- | ------------------------ |
| Latest stable release | Yes                      |
| Latest beta           | Yes, on the beta channel |
| Older releases        | No — please update       |

## What we consider in scope

- Code execution or file access from a crafted `.lwise` file, icon pack, SVG, image or import (CLI text, CSV, draw.io, GNS3, Containerlab, Nmap XML).
- Secrets from an imported configuration being stored, exported or logged (they must be stripped, FR-IMP-25).
- Escaping the Tauri capability or file-path allowlist, or loading remote content into the app.
- Weaknesses in the update chain (signature verification, feed integrity).

## How LineWise is hardened

- **Offline by default.** The only default network call is the update check, which can be turned off. No telemetry unless you opt in (see [PRIVACY.md](PRIVACY.md)).
- **Strict Content Security Policy:** no remote scripts, no `eval`, no inline scripts; all assets are bundled.
- **Least-privilege Tauri capabilities:** only the commands the app uses; file access is limited to files you picked in a dialog and the app-data folder.
- **Sanitized input:** imported SVG and HTML go through DOMPurify (SVG profile); zip imports are checked for path traversal, size and file count; parsers have size limits, linear-time patterns and fuzz tests.
- **No credentials stored.** v1 never stores SSH/SNMP credentials; secrets in imported configs are removed before anything is stored.
- **Signed updates.** Update packages are verified against the public key compiled into the app before they are installed; the private key lives only in CI secrets.
- **Supply chain:** `pnpm audit`, `cargo audit`/`cargo-deny` and CodeQL run in CI; each release ships a CycloneDX SBOM and SHA-256 checksums.
