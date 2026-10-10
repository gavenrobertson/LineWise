// SPDX-License-Identifier: Apache-2.0
/** PNG export (FR-EXP-01): the SVG export rasterized at 1×–4×. */
import type { SvgExport } from './svg.ts';

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not render the diagram image'));
    img.src = src;
  });
}

/** Browsers cap canvas area; keep exports under ~16k px per side and ~250 MP. */
export function clampScale(width: number, height: number, scale: number): number {
  const maxSide = 16384;
  const maxArea = 250_000_000;
  let s = Math.min(scale, maxSide / width, maxSide / height);
  if (width * height * s * s > maxArea) s = Math.sqrt(maxArea / (width * height));
  return Math.max(0.1, s);
}

export async function svgToPng(exp: SvgExport, scale: number): Promise<Uint8Array> {
  const s = clampScale(exp.width, exp.height, scale);
  const img = await loadImage(svgDataUrl(exp.svg));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(exp.width * s);
  canvas.height = Math.round(exp.height * s);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('PNG encoding failed');
  return new Uint8Array(await blob.arrayBuffer());
}

export async function svgToPngDataUrl(exp: SvgExport, scale = 1): Promise<string> {
  const bytes = await svgToPng(exp, scale);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/png;base64,${btoa(bin)}`;
}
