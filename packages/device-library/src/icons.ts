// SPDX-License-Identifier: Apache-2.0
/**
 * LineWise's original device icon set (FR-ICO-01..03). Drawn from scratch in
 * the visual language network engineers recognize (spec section 5): router =
 * round body with crossing arrows, switch = flat box with parallel arrows,
 * firewall = brick wall, and so on. No vendor artwork is used.
 *
 * Each icon is a 64×64 drawing whose elements carry one of four roles:
 *   b  = body, sh = shading on the body, g = stroked glyph, gf = filled glyph.
 * `renderIcon` turns those roles into concrete attributes for a style:
 *   classic → filled body in currentColor with white glyphs;
 *   line    → monochrome outline in currentColor (for print).
 */
import type { DeviceRole } from '@linewise/core';

export type IconStyle = 'classic' | 'line';

/** Arrow from (x1,y1) to (x2,y2) with a chevron head at the end. */
function arrow(x1: number, y1: number, x2: number, y2: number, head = 3.6): string {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h1x = x2 - head * Math.cos(a - Math.PI / 5);
  const h1y = y2 - head * Math.sin(a - Math.PI / 5);
  const h2x = x2 - head * Math.cos(a + Math.PI / 5);
  const h2y = y2 - head * Math.sin(a + Math.PI / 5);
  const f = (n: number) => Number(n.toFixed(2));
  return `<path class="g" d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}M${f(h1x)} ${f(h1y)}L${f(x2)} ${f(y2)}L${f(h2x)} ${f(h2y)}"/>`;
}

const flatBox = (top = 16, front = 30, bottom = 46) =>
  `<path class="b" d="M48 ${front}L58 ${top}V${bottom - 10}L48 ${bottom}Z"/>` +
  `<path class="sh" d="M48 ${front}L58 ${top}V${bottom - 10}L48 ${bottom}Z"/>` +
  `<rect class="b" x="6" y="${front}" width="42" height="${bottom - front}" rx="1.5"/>` +
  `<path class="b" d="M6 ${front}L16 ${top}H58L48 ${front}Z"/>`;

const cylinder = (cy: number, rx: number, ry: number, h: number) =>
  `<path class="b" d="M${32 - rx} ${cy}v${h}a${rx} ${ry} 0 0 0 ${2 * rx} 0V${cy}"/>` +
  `<path class="sh" d="M${32 - rx} ${cy}v${h}a${rx} ${ry} 0 0 0 ${2 * rx} 0V${cy}a${rx} ${ry} 0 0 1 ${-2 * rx} 0z"/>` +
  `<ellipse class="b" cx="32" cy="${cy}" rx="${rx}" ry="${ry}"/>`;

const CLOUD = 'M17 47h31a10 10 0 0 0 1.5-19.9A15 15 0 0 0 21.6 23 11.5 11.5 0 0 0 17 47z';

const tower = `<rect class="b" x="19" y="7" width="26" height="50" rx="3"/>`;

const routerArrows =
  arrow(10, 24, 24, 24) + arrow(54, 24, 40, 24) + arrow(32, 22, 32, 15.5, 3) + arrow(32, 26, 32, 32.5, 3);

const DEFS: Record<DeviceRole, string> = {
  router: cylinder(24, 24, 9, 14) + routerArrows,
  'l2-switch':
    flatBox() +
    arrow(18, 20.5, 31, 20.5) +
    arrow(52, 20.5, 39, 20.5) +
    arrow(28, 26, 15, 26) +
    arrow(34, 26, 47, 26),
  'l3-switch':
    flatBox() +
    arrow(15, 23, 26, 23, 3) +
    arrow(49, 23, 38, 23, 3) +
    arrow(32, 21.5, 32, 17.5, 2.6) +
    arrow(32, 24.5, 32, 28.5, 2.6),
  firewall:
    `<rect class="b" x="8" y="14" width="48" height="36" rx="2"/>` +
    `<path class="g" d="M8 23H56M8 32H56M8 41H56M24 14V23M40 14V23M16 23V32M32 23V32M48 23V32M24 32V41M40 32V41M16 41V50M32 41V50M48 41V50"/>`,
  wlc:
    flatBox() +
    `<path class="g" d="M23 23a9 9 0 0 1 18 0M27 23a5 5 0 0 1 10 0"/><circle class="gf" cx="32" cy="23" r="1.6"/>`,
  'access-point':
    `<path class="b" d="M8 44A24 20 0 0 1 56 44Z"/><rect class="b" x="8" y="44" width="48" height="6" rx="1.5"/><rect class="sh" x="8" y="44" width="48" height="6" rx="1.5"/>` +
    `<path class="g" d="M20 40a12 12 0 0 1 24 0M25 40a7 7 0 0 1 14 0"/><circle class="gf" cx="32" cy="39.5" r="2"/>`,
  'load-balancer':
    flatBox() +
    arrow(12, 23, 24, 23, 2.8) +
    arrow(26, 23, 38, 19, 2.8) +
    arrow(26, 23, 40, 23, 2.8) +
    arrow(26, 23, 38, 27, 2.8),
  server:
    tower + `<path class="g" d="M25 16H39M25 22H39M25 28H39"/><circle class="gf" cx="32" cy="47" r="2.5"/>`,
  'virtual-machine':
    `<rect class="b" x="12" y="12" width="40" height="40" rx="5"/>` +
    `<rect class="g" x="20" y="24" width="20" height="16" rx="2"/><path class="g" d="M24 24V20H44V36H40"/>`,
  hypervisor:
    tower +
    `<rect class="gf" x="24" y="14" width="7" height="7" rx="1"/><rect class="gf" x="33" y="14" width="7" height="7" rx="1"/><rect class="gf" x="24" y="23" width="7" height="7" rx="1"/><rect class="gf" x="33" y="23" width="7" height="7" rx="1"/><path class="g" d="M25 40H39"/>`,
  workstation:
    `<rect class="b" x="8" y="10" width="48" height="32" rx="3"/><path class="b" d="M27 42H37L39 52H25Z"/><rect class="b" x="18" y="51" width="28" height="4" rx="2"/>` +
    `<rect class="g" x="13" y="15" width="38" height="22" rx="1"/>`,
  laptop:
    `<rect class="b" x="12" y="12" width="40" height="28" rx="3"/><path class="b" d="M6 44H58L54 52H10Z"/><path class="sh" d="M6 44H58L54 52H10Z"/>` +
    `<rect class="g" x="17" y="17" width="30" height="18" rx="1"/>`,
  'ip-phone':
    `<path class="b" d="M10 50L16 22H48L54 50Z"/>` +
    `<path class="b" d="M14 18c0-5 36-5 36 0v4c0 2-6 2-6 0v-2c-6-2-18-2-24 0v2c0 2-6 2-6 0z"/>` +
    `<path class="gf" d="M24 32h4v3h-4zM30 32h4v3h-4zM36 32h4v3h-4zM24 38h4v3h-4zM30 38h4v3h-4zM36 38h4v3h-4zM24 44h4v3h-4zM30 44h4v3h-4zM36 44h4v3h-4z"/>`,
  printer:
    `<rect class="b" x="18" y="10" width="28" height="14" rx="1"/>` +
    `<rect class="b" x="8" y="22" width="48" height="22" rx="3"/><rect class="sh" x="8" y="22" width="48" height="22" rx="3"/>` +
    `<rect class="b" x="18" y="38" width="28" height="16" rx="1"/><path class="g" d="M23 44H41M23 49H35M13 28H19"/>`,
  iot:
    `<rect class="b" x="18" y="22" width="28" height="28" rx="3"/>` +
    `<path class="b" d="M22.5 16h3v6h-3zM30.5 16h3v6h-3zM38.5 16h3v6h-3zM22.5 50h3v6h-3zM30.5 50h3v6h-3zM38.5 50h3v6h-3zM12 28.5h6v3h-6zM12 40.5h6v3h-6zM46 28.5h6v3h-6zM46 40.5h6v3h-6z"/>` +
    `<rect class="g" x="25" y="29" width="14" height="14" rx="1.5"/>`,
  storage: cylinder(14, 20, 7, 36) + `<path class="g" d="M12 26a20 7 0 0 0 40 0M12 38a20 7 0 0 0 40 0"/>`,
  cloud: `<path class="b" d="${CLOUD}"/>`,
  internet:
    `<path class="b" d="${CLOUD}"/>` +
    `<circle class="g" cx="34" cy="36" r="8"/><path class="g" d="M26 36H42M34 28c-4 4-4 12 0 16M34 28c4 4 4 12 0 16"/>`,
  'wan-cloud':
    `<path class="b" d="${CLOUD}"/>` +
    `<text class="gt" x="33" y="40" text-anchor="middle" font-size="10" font-weight="700" font-family="IBM Plex Mono, monospace">WAN</text>`,
  'mpls-cloud':
    `<path class="b" d="${CLOUD}"/>` +
    `<text class="gt" x="33" y="40" text-anchor="middle" font-size="9" font-weight="700" font-family="IBM Plex Mono, monospace">MPLS</text>`,
  modem:
    `<rect class="b" x="8" y="28" width="48" height="16" rx="3"/><path class="b" d="M44 28V14"/><circle class="b" cx="44" cy="13" r="2"/>` +
    `<circle class="gf" cx="16" cy="36" r="2"/><circle class="gf" cx="23" cy="36" r="2"/><circle class="gf" cx="30" cy="36" r="2"/><path class="g" d="M38 36H50"/>`,
  'vpn-concentrator':
    flatBox() +
    `<rect class="gf" x="27" y="21" width="10" height="7" rx="1"/><path class="g" d="M29 21v-2.5a3 3 0 0 1 6 0V21"/>`,
  'ids-ips':
    flatBox() +
    `<path class="g" d="M20 23c6-6 18-6 24 0-6 6-18 6-24 0z"/><circle class="gf" cx="32" cy="23" r="2.2"/>`,
  proxy: flatBox() + `<path class="g" d="M14 20H40a3.5 3.5 0 0 1 0 7H24"/>` + arrow(27, 27, 22, 27, 3),
  'dns-dhcp':
    tower +
    `<circle class="g" cx="32" cy="22" r="7"/><path class="g" d="M25 22H39M32 15c-3 3-3 11 0 14M32 15c3 3 3 11 0 14M25 40H39M25 46H39"/>`,
  'patch-panel':
    `<rect class="b" x="4" y="24" width="56" height="16" rx="2"/>` +
    `<path class="gf" d="M9 29h4v5h-4zM16 29h4v5h-4zM23 29h4v5h-4zM30 29h4v5h-4zM37 29h4v5h-4zM44 29h4v5h-4zM51 29h4v5h-4z"/>`,
  generic:
    `<rect class="b" x="12" y="12" width="40" height="40" rx="8"/>` +
    `<circle class="gf" cx="23" cy="32" r="3"/><circle class="gf" cx="32" cy="32" r="3"/><circle class="gf" cx="41" cy="32" r="3"/>`,
};

const STYLE_ATTRS: Record<IconStyle, Record<string, string>> = {
  classic: {
    b: 'fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"',
    sh: 'fill="#000000" fill-opacity="0.22" stroke="none"',
    g: 'fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"',
    gf: 'fill="#FFFFFF" stroke="none"',
    gt: 'fill="#FFFFFF"',
  },
  line: {
    b: 'fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"',
    sh: 'fill="none" stroke="none"',
    g: 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"',
    gf: 'fill="currentColor" stroke="none"',
    gt: 'fill="currentColor"',
  },
};

export const ICON_ROLES = Object.keys(DEFS) as DeviceRole[];

/** Inner SVG markup of an icon (no <svg> wrapper), for embedding in a larger drawing. */
export function iconMarkup(role: DeviceRole, style: IconStyle = 'classic'): string {
  const attrs = STYLE_ATTRS[style];
  const def = DEFS[role] ?? DEFS.generic;
  return def.replace(/class="(b|sh|gf|gt|g)"/g, (_, cls: string) => attrs[cls] ?? '');
}

/** Standalone SVG document for an icon. */
export function renderIcon(role: DeviceRole, style: IconStyle = 'classic', size = 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${role}">${iconMarkup(role, style)}</svg>`;
}

/** Human-readable names for the library panel. */
export const ROLE_LABELS: Record<DeviceRole, string> = {
  router: 'Router',
  'l2-switch': 'L2 switch',
  'l3-switch': 'L3 switch',
  firewall: 'Firewall',
  wlc: 'Wireless LAN controller',
  'access-point': 'Access point',
  'load-balancer': 'Load balancer',
  server: 'Server',
  'virtual-machine': 'Virtual machine',
  hypervisor: 'Hypervisor host',
  workstation: 'Workstation',
  laptop: 'Laptop',
  'ip-phone': 'IP phone',
  printer: 'Printer',
  iot: 'IoT device',
  storage: 'Storage / NAS',
  cloud: 'Cloud',
  internet: 'Internet',
  'wan-cloud': 'ISP / WAN cloud',
  'mpls-cloud': 'MPLS cloud',
  modem: 'Modem',
  'vpn-concentrator': 'VPN concentrator',
  'ids-ips': 'IDS / IPS',
  proxy: 'Proxy',
  'dns-dhcp': 'DNS / DHCP server',
  'patch-panel': 'Patch panel',
  generic: 'Generic device',
};

export type RoleCategory =
  | 'Routing & switching'
  | 'Security'
  | 'Wireless'
  | 'Compute & storage'
  | 'Endpoints'
  | 'Clouds & WAN'
  | 'Other';

export const ROLE_CATEGORY: Record<DeviceRole, RoleCategory> = {
  router: 'Routing & switching',
  'l2-switch': 'Routing & switching',
  'l3-switch': 'Routing & switching',
  'load-balancer': 'Routing & switching',
  firewall: 'Security',
  'vpn-concentrator': 'Security',
  'ids-ips': 'Security',
  proxy: 'Security',
  wlc: 'Wireless',
  'access-point': 'Wireless',
  server: 'Compute & storage',
  'virtual-machine': 'Compute & storage',
  hypervisor: 'Compute & storage',
  storage: 'Compute & storage',
  'dns-dhcp': 'Compute & storage',
  workstation: 'Endpoints',
  laptop: 'Endpoints',
  'ip-phone': 'Endpoints',
  printer: 'Endpoints',
  iot: 'Endpoints',
  cloud: 'Clouds & WAN',
  internet: 'Clouds & WAN',
  'wan-cloud': 'Clouds & WAN',
  'mpls-cloud': 'Clouds & WAN',
  modem: 'Clouds & WAN',
  'patch-panel': 'Other',
  generic: 'Other',
};
