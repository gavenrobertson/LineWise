# ADR 0001: Tauri 2 over Electron for the desktop shell

- Status: Accepted
- Date: 2026-10-09

## Context

LineWise ships as a downloadable app for Windows and macOS. The spec targets installers under 25 MB and idle memory under 250 MB (NFR-PERF-06), a permission-scoped native layer (NFR-SEC-01), signed auto-updates (REL-10..12), and a strict offline posture (NFR-PRIV-01).

## Decision

Use Tauri 2 with a Rust native layer and the OS webview (WebView2 on Windows, WKWebView on macOS). All UI and domain logic is TypeScript; Rust only handles file I/O, autosave and recovery, menus, logging and the updater.

## Consequences

- Installers are typically 5–15 MB; memory is far below Electron's.
- Capabilities files restrict what the frontend can call.
- Rendering can differ between WebView2 (Chromium) and WKWebView (WebKit). Mitigation: Playwright runs every E2E journey in both Chromium and WebKit, and the UI avoids CSS features WebKit lacks.
- macOS has no WebDriver for WKWebView, so native E2E smoke tests run on Windows only; macOS is covered by the browser-mode WebKit run plus the manual release checklist.
- Fallback: Electron, if Tauri blocks a must-have requirement. Switching cost stays low because OS access goes through `PlatformAdapter` (ADR 0003).
