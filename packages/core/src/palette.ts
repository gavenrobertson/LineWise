// SPDX-License-Identifier: Apache-2.0
/**
 * Default VLAN colors (NFR-A11Y-03): the Okabe–Ito color-blind-safe set, with luminance kept
 * between 0.135 and 0.285 so every color has at least 3:1 contrast on both the light and the dark
 * canvas (WCAG 1.4.11). Yellow is left out: darkened enough for a light canvas it is too close to
 * orange. Colors are never the only signal; links also carry their VLAN as a label.
 */
export const VLAN_PALETTE = ['#0072B2', '#C28600', '#009E73', '#C977A5', '#489AC7', '#D55E00'] as const;

/** The default color for the `index`-th VLAN of a document. */
export function vlanColorAt(index: number): string {
  return VLAN_PALETTE[((index % VLAN_PALETTE.length) + VLAN_PALETTE.length) % VLAN_PALETTE.length]!;
}
