// SPDX-License-Identifier: Apache-2.0
/** Vite `?url` import of ELK's worker script (served as an asset, not bundled). */
declare module 'elkjs/lib/elk-worker.min.js?url' {
  const url: string;
  export default url;
}
