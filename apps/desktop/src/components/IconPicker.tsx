// SPDX-License-Identifier: Apache-2.0
/** Choose a device's icon: its role icon, another role's icon, or one from an imported pack (FR-ICO-05/06). */
import * as Popover from '@radix-ui/react-popover';
import { addAsset, batch, updateDevices, type Device, type DeviceRole } from '@linewise/core';
import { ICON_ROLES } from '@linewise/device-library';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { customIconUrl, iconRole } from '../canvas/icons.ts';
import { DeviceIcon } from '../canvas/nodes.tsx';
import { packRef, type IconPack, type PackIcon } from '../lib/iconPacks.ts';
import { usePacks } from '../store/packs.ts';
import { usePrefs } from '../store/prefs.ts';
import { useEditor } from '../store/editor.ts';
import { cx, Tooltip } from './ui.tsx';
import { roleLabel } from '../lib/labels.ts';

export function IconPicker({ devices }: { devices: Device[] }) {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const execute = useEditor((s) => s.execute);
  const packs = usePacks((s) => s.packs);
  const embed = usePrefs((s) => s.embedIcons);
  const [open, setOpen] = useState(false);
  const first = devices[0];
  if (!first) return null;
  const ids = devices.map((d) => d.id);
  const style = doc.settings.iconStyle;
  const applyRole = (r: DeviceRole | undefined) => {
    execute(updateDevices(ids, { iconOverride: r && r !== first.role ? r : undefined }));
    setOpen(false);
  };
  const applyPackIcon = (pack: IconPack, icon: PackIcon) => {
    if (!embed) {
      // A reference: small files, but the pack must be installed to see the icon (FR-ICO-05).
      execute(updateDevices(ids, { iconOverride: packRef(pack.id, icon.id) }));
      setOpen(false);
      return;
    }
    // Reuse an identical embedded image instead of storing it twice.
    const existing = Object.entries(doc.assets).find(
      ([, a]) => a.base64 === icon.base64 && a.mime === icon.mime,
    )?.[0];
    if (existing) execute(updateDevices(ids, { iconOverride: `asset:${existing}` }));
    else {
      const asset = addAsset(icon.mime, icon.base64);
      execute(batch('Set icon', [asset, updateDevices(ids, { iconOverride: `asset:${asset.assetId}` })]));
    }
    setOpen(false);
  };
  const cell =
    'flex h-14 w-14 flex-col items-center justify-center rounded-md border border-transparent hover:border-line hover:bg-surface-2';
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-2">
      <span className="text-[11.5px] text-muted">{t('field.icon', 'Icon')}</span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2 text-left text-[12.5px] hover:bg-surface-2"
            aria-label={t('field.chooseIcon', 'Choose icon')}
          >
            <DeviceIcon
              role={iconRole(first.role, first.iconOverride)}
              style={style}
              size={24}
              url={customIconUrl(doc, first.iconOverride)}
            />
            <span className="truncate">
              {first.iconOverride?.startsWith('asset:') || first.iconOverride?.startsWith('pack:')
                ? t('field.customIcon', 'Custom icon')
                : roleLabel(iconRole(first.role, first.iconOverride))}
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            align="end"
            className="lw-pop lw-material z-50 max-h-[60vh] w-[340px] overflow-y-auto rounded-lg border border-line p-2 shadow-elev-2"
          >
            <button
              type="button"
              className="mb-2 w-full rounded-md px-2 py-1 text-left text-[12px] text-accent-ink hover:bg-accent-soft"
              onClick={() => applyRole(undefined)}
            >
              {t('field.roleIcon', 'Use the icon for its role')}
            </button>
            <h4 className="px-1 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-subtle">
              {t('field.builtIn', 'Built-in')}
            </h4>
            <div
              className="grid grid-cols-5 gap-1"
              role="listbox"
              aria-label={t('field.builtIn', 'Built-in')}
            >
              {ICON_ROLES.map((r) => (
                <Tooltip key={r} text={roleLabel(r)} side="top">
                  <button
                    type="button"
                    role="option"
                    aria-selected={
                      iconRole(first.role, first.iconOverride) === r &&
                      !first.iconOverride?.startsWith('asset:')
                    }
                    aria-label={roleLabel(r)}
                    className={cx(cell)}
                    onClick={() => applyRole(r)}
                  >
                    <DeviceIcon role={r} style={style} size={32} />
                  </button>
                </Tooltip>
              ))}
            </div>
            {packs.map((p) => (
              <div key={p.id} className="mt-2">
                <h4 className="px-1 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-subtle">
                  {p.name}
                </h4>
                <div className="grid grid-cols-5 gap-1" role="listbox" aria-label={p.name}>
                  {p.icons.map((i) => (
                    <Tooltip key={i.id} text={i.name} side="top">
                      <button
                        type="button"
                        role="option"
                        aria-selected={first.iconOverride === packRef(p.id, i.id)}
                        aria-label={i.name}
                        className={cell}
                        onClick={() => applyPackIcon(p, i)}
                      >
                        <img
                          src={`data:${i.mime};base64,${i.base64}`}
                          alt=""
                          width={32}
                          height={32}
                          className="object-contain"
                        />
                      </button>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}
            {packs.length === 0 && (
              <p className="mt-2 px-1 text-[11px] text-subtle">
                {t('field.noPacks', 'Import icon packs in Preferences to use your own icons.')}
              </p>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
