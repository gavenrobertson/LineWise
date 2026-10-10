// SPDX-License-Identifier: Apache-2.0
/** PDF paper sizes (FR-EXP-03). */
export type PaperSize = 'letter' | 'a4' | 'a3' | 'tabloid';

/** Paper sizes in PostScript points (portrait). */
export const PAPER: Record<PaperSize, { w: number; h: number; label: string }> = {
  letter: { w: 612, h: 792, label: 'Letter' },
  a4: { w: 595.28, h: 841.89, label: 'A4' },
  a3: { w: 841.89, h: 1190.55, label: 'A3' },
  tabloid: { w: 792, h: 1224, label: 'Tabloid' },
};
