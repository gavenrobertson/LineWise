// SPDX-License-Identifier: Apache-2.0
fn main() {
    // Declare app commands so capabilities can grant them explicitly (NFR-SEC-01).
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "app_version",
            "quit_app",
            "print_page",
            "read_text_file",
            "read_binary_file",
            "save_atomic",
            "write_binary_atomic",
            "recovery_write",
            "recovery_list",
            "recovery_clear",
            "take_pending_opens",
            "check_update",
            "install_update",
            "open_external",
            "open_logs_folder",
            "pick_open",
            "pick_save",
            "recent_list",
            "recent_add",
            "os_text_scale",
            "set_ui_scale",
        ]),
    ))
    .expect("failed to run tauri-build");
}
