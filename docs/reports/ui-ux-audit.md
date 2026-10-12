# UI/UX audit (2026-10-12)

The state of the interface before the polish pass (FR-UX-01..12, `TRACEABILITY.md`). Screenshots come
from the browser build at 1440 px and 1024 px, in light and dark mode, with the starter diagrams in
each view. The fixes are listed in [ui-ux-polish.md](ui-ux-polish.md).

![Three-tier campus, L2, light](img/ux-before-light-1440-three-tier-campus-L2.png)

![Three-tier campus, L2, zoomed in](img/ux-before-light-1440-campus-L2-zoom.png)

![CCNA lab, L3, dark](img/ux-before-dark-1440-ccna-lab-L3.png)

## Link labels (FR-LNK-03, FR-LNK-05)

1. **Too small.** Link labels are 10 px monospace. Zoom to fit opens the starter diagrams at 64–100%,
   so labels are drawn at 6.4–10 px on screen (6.4 px in the spine-leaf data center, 6.6 px in the
   three-tier campus).
2. **They collide.** Measured on all seven starter diagrams in L1, L2 and L3 (21 views): 17
   label-on-label overlaps and 20 labels covering a device icon or hostname. The worst views are
   the three-tier campus in L2 (8 and 6) and the spine-leaf data center in L3 (4 and 7). Labels are
   only moved apart from labels at the same device, so labels from different devices that meet in
   the middle of the page still overlap.
3. **They repeat.** In L2, both ends of a trunk say `trunk 10,20,99`, so the VLAN list is drawn twice
   on every uplink. In L3, both ends repeat the whole subnet (`10.0.12.1/30`, `10.0.12.2/30`).
4. **No separation from the stroke.** The 85% translucent background lets the link show through
   (pale grey strokes under grey text). There is no border or halo.
5. **The mid label sits 10 px above the link midpoint.** On orthogonal links the midpoint can be a
   bend, so the label hangs off a corner.
6. **Medium is shown by color only on screen.** Fiber is orange and serial is purple, but no text
   says so (NFR-A11Y-03 is met by line style, not by words).
7. **No details on hover.** Hovering a link only shows the pointer. To read both ends, the VLANs or
   the problems, you have to select the link and read the inspector.

## Tooltips (FR-KEY-01)

8. **Two kinds of tooltip.** Icon buttons use the Radix tooltip (400 ms, label and shortcut). About 20
   controls use the browser's `title` instead: the VLAN highlight, the command palette button, the
   L1/L2/L3 segments, the zoom-to-fit status item, tab names, the pages bar, problem fixes, interface
   table cells, the library items and the device hover card (FR-NET-09). Browser tooltips are
   slow, unstyled, do not appear on keyboard focus and cannot show shortcut keycaps.
9. **Shortcuts are plain text** (`Ctrl+Z`) rather than keycaps, and a shortcut is not shown in a
   segment's browser tooltip until you hover for about a second.
10. **No moving between tooltips.** Moving from one toolbar button to the next waits the full delay again.

## Motion and feedback

11. **Nothing animates.** Dialogs, menus, popovers, tooltips and toasts appear and disappear in one
    frame, and panels pop in and out.
12. **Buttons only change color on hover.** There is no pressed state, and icon-button hover is a hard
    swap of the background.
13. **Device hover only shows four tiny handles**, which cover the hostname ("DI■T2"). Selection is
    a ring that snaps on.
14. **Link hover does nothing.** The link under the pointer is not highlighted.
15. **The L1/L2/L3 control and the side-panel tabs jump** between options with no indicator movement.

## Depth, materials and consistency

16. **One shadow (`--shadow`) is used for everything**, from toasts to dialogs. Dark mode has no
    hairline highlight, so raised surfaces merge into Ink.
17. **Radii vary.** 3, 4, 6, 8 and 12 px all appear (`rounded`, `rounded-md`, `rounded-lg`,
    `rounded-xl`, `rx=3` in exports).
18. **In dark mode, the React Flow attribution is a grey box** over the canvas.
19. **The command palette's input draws a second focus outline** inside the palette border.

## Help and guidance

20. **There is no help in context.** Terms such as native VLAN, trunk, access, port-channel and VRF
    are not explained anywhere in the app. Field hints exist only for the label template.
21. **Problems say what is wrong but not why it matters.** The fix button is labelled with the fix,
    but the panel does not explain the rule.
22. **There is no first-run guidance** after the welcome screen. The empty canvas has one line of
    text, and empty panels say "No …" with no action.
23. **Terms are inconsistent.** "Port names", "Port IPs" and "Port VLANs" in the inspector,
    "interfaces" in the table and the outline, and "connection" and "link" both in the guide.

## What already works and stays

- Contrast meets WCAG AA in all three themes; forced colors are handled; axe is clean.
- `prefers-reduced-motion` collapses transitions globally.
- Level of detail: labels hide below 40% zoom and devices simplify below 25%, which keeps 500-device
  drags inside the frame budget.
