; SPDX-License-Identifier: Apache-2.0
; NSIS installer hooks (bundle.windows.nsis.installerHooks).
;
; The .lwise document icon (BRD-03, FR-APP-09). Tauri's template registers the "LineWise diagram"
; file class (the file association's name) with the app's own icon; this points it at
; document.ico, which the installer copies next to the app (tauri.windows.conf.json). Uninstalling
; removes the whole file class, icon included.
!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\LineWise diagram\DefaultIcon" "" "$INSTDIR\document.ico"
  ; SHCNE_ASSOCCHANGED, so Explorer shows the new icon without a restart.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
