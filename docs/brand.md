# LineWise brand guide for contributors

This page summarizes section 15 of the [spec](SPEC.md#15-brand-and-logo) (BRD-01..06) and shows
where each piece lives in the repo. The spec's SVG masters are the source of truth. Do not redraw,
recolor or re-export them by hand.

## The mark

LineWise uses the **"Routed L"** mark: a link leaves a switch port, carries a packet, bends at an
interface and lands on an endpoint, all drawn on the app's dot-grid canvas.

| Part           | Shape                                                   | Meaning                                            |
| -------------- | ------------------------------------------------------- | -------------------------------------------------- |
| Port node      | White rounded square with an RJ45-style notch, top left | Where the link starts: a switch port               |
| Link           | White orthogonal stroke                                 | The canvas's right-angle routing; it forms the "L" |
| Packet         | Small teal square on the vertical run                   | Traffic on the link                                |
| Interface ring | Hollow node at the bend                                 | An interface where the path changes direction      |
| Endpoint       | Teal node with a white centre                           | The destination, and the "wise" accent             |
| Dot grid       | Faint dots, large sizes only                            | The LineWise canvas                                |

## Files

| File                                                   | What it is                                              | Made by                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/brand/svg/app-icon.svg`                      | Full mark with dot grid (96 px and up)                  | Spec master, verbatim                                                                                         |
| `packages/brand/svg/app-icon-small.svg`                | Simplified mark (32 px and below)                       | Spec master, verbatim                                                                                         |
| `packages/brand/svg/logo-mark-mono.svg`                | One color, transparent background                       | Spec master, verbatim                                                                                         |
| `packages/brand/svg/doc-icon.svg`                      | `.lwise` document icon                                  | Spec master, verbatim                                                                                         |
| `packages/brand/svg/doc-icon-shipped.svg`              | Document icon with the `.lwise` label as paths          | `build-brand.mjs`                                                                                             |
| `packages/brand/svg/lockup-{light,dark}[-subline].svg` | Icon plus wordmark, wordmark as paths                   | `build-brand.mjs`                                                                                             |
| `packages/brand/fonts/`                                | Sora and IBM Plex Mono WOFF2 files plus OFL licenses    | `build-brand.mjs`                                                                                             |
| `apps/desktop/src-tauri/icons/`                        | App icons for every platform, and `document.{ico,icns}` | `build-icons.mjs`: `tauri icon` from a 1024 px render of `app-icon.svg`, then the size rules (BRD-02, BRD-03) |
| `apps/desktop/src-tauri/installer/`                    | NSIS, WiX and DMG background images                     | `build-icons.mjs` (BRD-04)                                                                                    |

Rebuild the generated files with `pnpm --filter @linewise/brand build`, then the icons and
installer images with `pnpm --filter @linewise/brand icons` (it renders with Chromium; set
`PW_CHROMIUM_PATH` to use an installed one). `scripts/brand.test.mjs` fails if a master changed
without a rebuild. The lockups and the shipped doc icon convert text to paths with opentype.js,
so they render the same on machines without the fonts.

## Colors

| Token      | Hex                             | Use                                                              |
| ---------- | ------------------------------- | ---------------------------------------------------------------- |
| Ink        | `#0E1726`                       | Icon background, "Line" in the wordmark, dark-theme app surfaces |
| Ink raised | `#1A2436` (border `#2C3A52`)    | Icon body on an ink background                                   |
| Link teal  | `#0D9488`                       | Packet, endpoint, "Wise" in the wordmark, the app's UI accent    |
| White      | `#FFFFFF`                       | Link stroke, port node, interface ring, endpoint centre          |
| Panel      | `#F4F6F8`                       | Light surfaces behind the logo                                   |
| Muted text | `#4B5563` light, `#A3AEBF` dark | Subline and captions                                             |

Approved alternates (blue `#2563EB`, purple `#7C3AED`, orange `#EA580C`) are for internal
experiments only. Do not ship them.

In the app, the colors are CSS custom properties in `apps/desktop/src/styles.css`. Use the
tokens (`var(--accent)`, `var(--surface)`, …) or the Tailwind classes built on them, never raw
hex values. The accent must stay Link teal, the dark theme's base surface must be Ink, and every
text pair must meet the NFR-A11Y-04 contrast ratios (BRD-05).

## Typography

- **Wordmark:** Sora SemiBold (600), letter-spacing −3%. "Line" is Ink ("Line" is white on dark
  backgrounds) and "Wise" is Link teal.
- **Subline and technical accents:** IBM Plex Mono 400/500, for example the subline
  "network architecture diagrams", interface labels and IP addresses.
- **App body text:** the system UI font stack.
- Both brand fonts are SIL OFL 1.1 and ship inside the app. Never load them from Google Fonts or
  any other CDN (NFR-SEC-02, NFR-PRIV-01).

## Lockup and sizes

- **Lockup:** icon, a 22-unit gap, then the wordmark at 0.6× the icon height. The optional
  subline sits 10 units below the wordmark at 0.15× the icon height.
- **Clear space:** around any lockup, at least the width of the port node.

| Rendered size                | Master                                                                     |
| ---------------------------- | -------------------------------------------------------------------------- |
| 96 px and up                 | `app-icon.svg`                                                             |
| 48–64 px                     | `app-icon.svg` without the `grid-layer`                                    |
| 32 px and below              | `app-icon-small.svg` (also the 16 and 32 px entries of the Windows `.ico`) |
| Print, one color, watermarks | `logo-mark-mono.svg`                                                       |

On macOS, the icon body is centred at about 80% of the 1024 px canvas, like Apple's 824 px
template.

## Where the brand appears (BRD-04)

Welcome screen, About dialog, macOS DMG background, Windows NSIS and MSI installer images, README
header, docs-site logo and favicon. The `.lwise` file association uses the document icon on both
operating systems (BRD-03).

## Don'ts

Don't rotate, stretch or outline the mark, and don't add gradients or shadows. Don't change the
node shapes or the bend direction. Don't recolor it except with the approved alternates above.

## Trademarks of others

LineWise ships its own original device icons. Never add Cisco or other vendor icons, logos or
trademarks to the repository. Vendor names appear only as plain text in device templates, with a
link to the public datasheet.
