// SPDX-License-Identifier: Apache-2.0
//! Native menu bar (FR-APP-01). Item IDs match the frontend's MenuCommand
//! strings; clicks are forwarded as a "menu" event. macOS gets the standard
//! app menu; Windows and Linux render the same structure in the window.

use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, Submenu, SubmenuBuilder};
use tauri::{AppHandle, Runtime};

/// Human-readable shortcut for Windows/Linux menu labels: "CmdOrCtrl+Shift+S" → "Ctrl+Shift+S".
pub fn shortcut_hint(accel: &str) -> String {
    accel.replace("CmdOrCtrl", "Ctrl").replace("Cmd", "Ctrl")
}

/// On macOS shortcuts are real menu key equivalents. On Windows and Linux the
/// web view handles every shortcut itself (so typing in text fields keeps the
/// native Ctrl+C/V/Z behavior) and the menu only shows the hint after a tab.
fn item<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    label: &str,
    accel: Option<&str>,
) -> tauri::Result<tauri::menu::MenuItem<R>> {
    if cfg!(target_os = "macos") {
        let mut b = MenuItemBuilder::with_id(id, label);
        if let Some(a) = accel {
            b = b.accelerator(a);
        }
        b.build(app)
    } else {
        let text = match accel {
            Some(a) => format!("{label}\t{}", shortcut_hint(a)),
            None => label.to_string(),
        };
        MenuItemBuilder::with_id(id, text).build(app)
    }
}

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let file = SubmenuBuilder::new(app, "File")
        .item(&item(app, "file.new", "New Diagram", Some("CmdOrCtrl+N"))?)
        .item(&item(app, "file.open", "Open…", Some("CmdOrCtrl+O"))?)
        .separator()
        .item(&item(app, "file.save", "Save", Some("CmdOrCtrl+S"))?)
        .item(&item(
            app,
            "file.saveAs",
            "Save As…",
            Some("CmdOrCtrl+Shift+S"),
        )?)
        .separator()
        .item(&item(app, "file.import", "Import…", Some("CmdOrCtrl+I"))?)
        .item(&item(app, "file.export", "Export…", Some("CmdOrCtrl+E"))?)
        .item(&item(app, "file.print", "Print…", Some("CmdOrCtrl+P"))?)
        .separator()
        .item(&item(
            app,
            "file.close",
            "Close Diagram",
            Some("CmdOrCtrl+W"),
        )?)
        .build()?;

    let mut edit_b = SubmenuBuilder::new(app, "Edit");
    if cfg!(target_os = "macos") {
        // Predefined items keep text editing working in inputs; the web view
        // handles these keys itself for the canvas (lib/keyboard.ts).
        edit_b = edit_b
            .item(&PredefinedMenuItem::undo(app, None)?)
            .item(&PredefinedMenuItem::redo(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::cut(app, None)?)
            .item(&PredefinedMenuItem::copy(app, None)?)
            .item(&PredefinedMenuItem::paste(app, None)?)
            .item(&item(
                app,
                "edit.duplicate",
                "Duplicate",
                Some("CmdOrCtrl+D"),
            )?)
            .item(&item(app, "edit.delete", "Delete", None)?)
            .item(&PredefinedMenuItem::select_all(app, None)?);
    } else {
        edit_b = edit_b
            .item(&item(app, "edit.undo", "Undo", Some("CmdOrCtrl+Z"))?)
            .item(&item(app, "edit.redo", "Redo", Some("CmdOrCtrl+Shift+Z"))?)
            .separator()
            .item(&item(app, "edit.cut", "Cut", Some("CmdOrCtrl+X"))?)
            .item(&item(app, "edit.copy", "Copy", Some("CmdOrCtrl+C"))?)
            .item(&item(app, "edit.paste", "Paste", Some("CmdOrCtrl+V"))?)
            .item(&item(
                app,
                "edit.duplicate",
                "Duplicate",
                Some("CmdOrCtrl+D"),
            )?)
            .item(&item(app, "edit.delete", "Delete", Some("Delete"))?)
            .item(&item(
                app,
                "edit.selectAll",
                "Select All",
                Some("CmdOrCtrl+A"),
            )?);
    }
    edit_b = edit_b
        .item(&item(
            app,
            "edit.selectSameType",
            "Select Same Type",
            Some("CmdOrCtrl+Shift+A"),
        )?)
        .item(&item(
            app,
            "edit.selectConnected",
            "Select Connected",
            None,
        )?)
        .separator()
        .item(&item(
            app,
            "edit.copyStyle",
            "Copy Style",
            Some("CmdOrCtrl+Alt+C"),
        )?)
        .item(&item(
            app,
            "edit.pasteStyle",
            "Paste Style",
            Some("CmdOrCtrl+Alt+V"),
        )?)
        .separator()
        .item(&item(app, "edit.find", "Find…", Some("CmdOrCtrl+F"))?);
    if !cfg!(target_os = "macos") {
        edit_b = edit_b.separator().item(&item(
            app,
            "edit.preferences",
            "Preferences…",
            Some("CmdOrCtrl+,"),
        )?);
    }
    let edit = edit_b.build()?;

    let view = SubmenuBuilder::new(app, "View")
        .item(&item(
            app,
            "view.commandPalette",
            "Command Palette…",
            Some("CmdOrCtrl+K"),
        )?)
        .item(&item(
            app,
            "view.library",
            "Search Device Library",
            Some("CmdOrCtrl+Shift+D"),
        )?)
        .separator()
        .item(&item(app, "view.l1", "Physical (L1)", Some("CmdOrCtrl+1"))?)
        .item(&item(
            app,
            "view.l2",
            "Data Link (L2)",
            Some("CmdOrCtrl+2"),
        )?)
        .item(&item(app, "view.l3", "Network (L3)", Some("CmdOrCtrl+3"))?)
        .separator()
        .item(&item(app, "view.zoomIn", "Zoom In", Some("CmdOrCtrl+="))?)
        .item(&item(app, "view.zoomOut", "Zoom Out", Some("CmdOrCtrl+-"))?)
        .item(&item(
            app,
            "view.zoomFit",
            "Zoom to Fit",
            Some("CmdOrCtrl+0"),
        )?)
        .item(&item(
            app,
            "view.zoomSelection",
            "Zoom to Selection",
            Some("CmdOrCtrl+Shift+0"),
        )?)
        .separator()
        .item(&item(app, "view.minimap", "Toggle Minimap", None)?)
        .item(&item(
            app,
            "view.problemBadges",
            "Toggle Problem Badges",
            None,
        )?)
        .item(&item(
            app,
            "view.problems",
            "Toggle Problems Panel",
            Some("CmdOrCtrl+Shift+M"),
        )?)
        .item(&item(
            app,
            "view.presentation",
            "Presentation Mode",
            Some("F5"),
        )?)
        .build()?;

    let insert = SubmenuBuilder::new(app, "Insert")
        .item(&item(app, "insert.zone", "Zone", None)?)
        .item(&item(app, "insert.text", "Text", None)?)
        .item(&item(app, "insert.note", "Sticky Note", None)?)
        .item(&item(app, "insert.rect", "Rectangle", None)?)
        .item(&item(app, "insert.ellipse", "Ellipse", None)?)
        .item(&item(app, "insert.arrow", "Arrow", None)?)
        .item(&item(app, "insert.image", "Image…", None)?)
        .separator()
        .item(&item(app, "insert.page", "New Page", None)?)
        .build()?;

    let arrange = SubmenuBuilder::new(app, "Arrange")
        .item(&item(
            app,
            "arrange.layout",
            "Auto-Layout…",
            Some("CmdOrCtrl+Shift+L"),
        )?)
        .separator()
        .item(&item(app, "arrange.alignLeft", "Align Left", None)?)
        .item(&item(app, "arrange.alignCenter", "Align Centers", None)?)
        .item(&item(app, "arrange.alignRight", "Align Right", None)?)
        .item(&item(app, "arrange.alignTop", "Align Top", None)?)
        .item(&item(app, "arrange.alignMiddle", "Align Middles", None)?)
        .item(&item(app, "arrange.alignBottom", "Align Bottom", None)?)
        .item(&item(
            app,
            "arrange.distributeH",
            "Distribute Horizontally",
            None,
        )?)
        .item(&item(
            app,
            "arrange.distributeV",
            "Distribute Vertically",
            None,
        )?)
        .separator()
        .item(&item(
            app,
            "arrange.front",
            "Bring to Front",
            Some("CmdOrCtrl+Shift+]"),
        )?)
        .item(&item(
            app,
            "arrange.back",
            "Send to Back",
            Some("CmdOrCtrl+Shift+["),
        )?)
        .separator()
        .item(&item(app, "arrange.group", "Group", Some("CmdOrCtrl+G"))?)
        .item(&item(
            app,
            "arrange.ungroup",
            "Ungroup",
            Some("CmdOrCtrl+Shift+G"),
        )?)
        .separator()
        .item(&item(app, "arrange.lock", "Lock", Some("CmdOrCtrl+L"))?)
        .item(&item(
            app,
            "arrange.unlock",
            "Unlock",
            Some("CmdOrCtrl+Shift+K"),
        )?)
        .build()?;

    let network = SubmenuBuilder::new(app, "Network")
        .item(&item(app, "network.vlans", "VLAN Manager…", None)?)
        .item(&item(app, "network.ipam", "Subnets & IPAM…", None)?)
        .item(&item(
            app,
            "network.calculator",
            "Subnet Calculator…",
            None,
        )?)
        .separator()
        .item(&item(app, "network.validate", "Validate Now", None)?)
        .build()?;

    let window = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .separator()
        .item(&item(
            app,
            "window.nextTab",
            "Next Diagram",
            Some("Ctrl+Tab"),
        )?)
        .item(&item(
            app,
            "window.prevTab",
            "Previous Diagram",
            Some("Ctrl+Shift+Tab"),
        )?)
        .build()?;

    let help = SubmenuBuilder::new(app, "Help")
        .item(&item(
            app,
            "help.shortcuts",
            "Keyboard Shortcuts",
            Some("CmdOrCtrl+/"),
        )?)
        .item(&item(app, "help.docs", "Documentation", None)?)
        .item(&item(app, "help.tour", "Take the Tour", None)?)
        .separator()
        .item(&item(app, "help.updates", "Check for Updates…", None)?)
        .item(&item(app, "help.logs", "Open Logs Folder", None)?)
        .item(&item(app, "help.about", "About LineWise", None)?)
        .build()?;

    let mut top: Vec<Submenu<R>> = vec![];
    if cfg!(target_os = "macos") {
        let app_menu = SubmenuBuilder::new(app, "LineWise")
            .item(&item(app, "help.about", "About LineWise", None)?)
            .separator()
            .item(&item(app, "edit.preferences", "Settings…", Some("Cmd+,"))?)
            .separator()
            .item(&PredefinedMenuItem::hide(app, None)?)
            .item(&PredefinedMenuItem::hide_others(app, None)?)
            .item(&PredefinedMenuItem::show_all(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::quit(app, None)?)
            .build()?;
        top.push(app_menu);
    }
    top.extend([file, edit, view, insert, arrange, network, window, help]);
    let refs: Vec<&dyn tauri::menu::IsMenuItem<R>> = top
        .iter()
        .map(|s| s as &dyn tauri::menu::IsMenuItem<R>)
        .collect();
    Menu::with_items(app, &refs)
}

#[cfg(test)]
mod tests {
    use super::shortcut_hint;

    /// FR-KEY-01: Windows/Linux menus show Ctrl shortcuts; macOS uses Cmd key equivalents.
    #[test]
    fn hints_use_ctrl() {
        assert_eq!(shortcut_hint("CmdOrCtrl+Shift+S"), "Ctrl+Shift+S");
        assert_eq!(shortcut_hint("F5"), "F5");
    }
}
