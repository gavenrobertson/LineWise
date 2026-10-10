// SPDX-License-Identifier: Apache-2.0
/** SVG sanitization for imported images and icon packs (NFR-SEC-03, FR-ICO-07). */
import DOMPurify from 'dompurify';

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'use', 'image', 'a', 'style'],
    FORBID_ATTR: ['href', 'xlink:href', 'onload', 'onerror', 'onclick'],
  });
}
