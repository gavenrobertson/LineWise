// SPDX-License-Identifier: Apache-2.0
//! LineWise native shell. Rust only touches the OS (spec section 9): file I/O
//! with atomic saves, crash recovery, native menus, file associations,
//! logging and the updater. All diagram logic lives in TypeScript.

mod files;
mod menu;
mod recovery;
mod updates;

use std::sync::Mutex;
use tauri::{Emitter, Manager};

/// Files the OS asked us to open before the UI was ready (file association, argv).
#[derive(Default)]
pub struct PendingOpens(pub Mutex<Vec<String>>);

fn diagram_paths_from_args<I: IntoIterator<Item = String>>(args: I) -> Vec<String> {
    args.into_iter()
        .filter(|a| a.to_lowercase().ends_with(".lwise"))
        .collect()
}

#[tauri::command]
fn app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn take_pending_opens(state: tauri::State<'_, PendingOpens>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().expect("pending opens lock"))
}

#[tauri::command]
fn open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    if !(url.starts_with("https://") || url.starts_with("mailto:")) {
        return Err("Only https and mailto links can be opened".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_logs_folder(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

fn queue_open(app: &tauri::AppHandle, path: String) {
    let allowed = app.state::<files::AllowedPaths>();
    allowed.allow(&path);
    log::info!("open requested: {path}");
    // Emit to a running UI; also queue in case the UI has not subscribed yet.
    app.state::<PendingOpens>()
        .0
        .lock()
        .expect("pending opens lock")
        .push(path.clone());
    let _ = app.emit("open-file", path);
}

/// Set once the UI has confirmed it is safe to close (no unsaved changes, or discarded).
#[derive(Default)]
struct CloseGate(std::sync::atomic::AtomicBool);

/// The UI calls this after handling "close-requested" (FR-APP-02: unsaved changes prompt).
#[tauri::command]
fn quit_app(app: tauri::AppHandle, gate: tauri::State<'_, CloseGate>) {
    gate.0.store(true, std::sync::atomic::Ordering::SeqCst);
    app.exit(0);
}

/// WKWebView ignores window.print(), so printing goes through the native web view (FR-EXP-10).
#[tauri::command]
fn print_page(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    install_panic_hook();

    let app = tauri::Builder::default()
        // Must be registered first: forwards "open with" from a second launch to this instance.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            for path in diagram_paths_from_args(argv) {
                queue_open(app, path);
            }
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("linewise".into()),
                    }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                ])
                .max_file_size(5 * 1024 * 1024)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(5))
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(PendingOpens::default())
        .manage(CloseGate::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let open = !window
                    .state::<CloseGate>()
                    .0
                    .load(std::sync::atomic::Ordering::SeqCst);
                if open {
                    api.prevent_close();
                    let _ = window.emit("close-requested", ());
                }
            }
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let allowed = files::AllowedPaths::load(&handle);
            app.manage(allowed);
            let menu = menu::build(&handle)?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                let _ = app.emit("menu", event.id().0.as_str());
            });
            for path in diagram_paths_from_args(std::env::args().skip(1)) {
                queue_open(&handle, path);
            }
            log::info!("LineWise {} started", handle.package_info().version);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_version,
            take_pending_opens,
            quit_app,
            print_page,
            open_external,
            open_logs_folder,
            files::read_text_file,
            files::read_binary_file,
            files::save_atomic,
            files::write_binary_atomic,
            files::pick_open,
            files::pick_save,
            files::recent_list,
            files::recent_add,
            recovery::recovery_write,
            recovery::recovery_list,
            recovery::recovery_clear,
            updates::check_update,
            updates::install_update,
        ])
        .build(tauri::generate_context!())
        .expect("error while building LineWise");

    app.run(|_app, _event| {
        // Cmd+Q and the app menu's Quit ask the UI first, like closing the window.
        if let tauri::RunEvent::ExitRequested { api, code, .. } = &_event {
            let allowed = _app
                .state::<CloseGate>()
                .0
                .load(std::sync::atomic::Ordering::SeqCst);
            if !allowed && code.is_none() {
                api.prevent_exit();
                let _ = _app.emit("close-requested", ());
            }
        }
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = _event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    queue_open(_app, path.to_string_lossy().to_string());
                }
            }
        }
    });
}

/// Panics are logged before the process aborts (NFR-REL-02). The UI shows its
/// own recoverable error screen for JavaScript errors.
fn install_panic_hook() {
    let default = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        log::error!("panic: {info}");
        default(info);
    }));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_lwise_args_are_opened() {
        let args = vec![
            "--flag".to_string(),
            "/tmp/a.lwise".into(),
            "C:\\B.LWISE".into(),
            "x.json".into(),
        ];
        assert_eq!(
            diagram_paths_from_args(args),
            vec!["/tmp/a.lwise", "C:\\B.LWISE"]
        );
    }
}
