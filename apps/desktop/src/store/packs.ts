// SPDX-License-Identifier: Apache-2.0
/** Installed icon packs (FR-ICO-05), loaded once and refreshed after an import or a removal. */
import { create } from 'zustand';
import { setPackIcons } from '../canvas/icons.ts';
import { listPacks, type IconPack } from '../lib/iconPacks.ts';

interface PacksState {
  packs: IconPack[];
  loaded: boolean;
  refresh: () => Promise<void>;
}

export const usePacks = create<PacksState>((set) => ({
  packs: [],
  loaded: false,
  refresh: async () => {
    const packs = await listPacks();
    setPackIcons(packs.flatMap((p) => p.icons.map((i) => [`${p.id}/${i.id}`, i] as [string, PackIcon])));
    set({ packs, loaded: true });
  },
}));

type PackIcon = IconPack['icons'][number];
