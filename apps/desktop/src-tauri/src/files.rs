// SPDX-License-Identifier: Apache-2.0
//! File access, scoped to paths the user chose (NFR-SEC-01): paths from native
//! dialogs, from "open with" / argv, and from the persisted recent-files list.
//! Saves are atomic (FR-FMT-06): temp file in the same folder, fsync, rename,
//! keeping one `.bak` of the previous version.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

const MAX_READ_BYTES: u64 = 256 * 1024 * 1024;
const MAX_RECENT: usize = 10;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub opened_at: String,
}

pub struct AllowedPaths {
    paths: Mutex<HashSet<PathBuf>>,
    recent: Mutex<Vec<RecentFile>>,
    recent_file: Option<PathBuf>,
}

fn normalize(p: &Path) -> PathBuf {
    fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf())
}

impl AllowedPaths {
    pub fn load(app: &AppHandle) -> Self {
        let recent_file = app
            .path()
            .app_data_dir()
            .ok()
            .map(|d| d.join("recent.json"));
        let recent: Vec<RecentFile> = recent_file
            .as_ref()
            .and_then(|f| fs::read_to_string(f).ok())
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        let paths = recent
            .iter()
            .map(|r| normalize(Path::new(&r.path)))
            .collect();
        Self {
            paths: Mutex::new(paths),
            recent: Mutex::new(recent),
            recent_file,
        }
    }

    #[cfg(test)]
    pub fn empty() -> Self {
        Self {
            paths: Mutex::new(HashSet::new()),
            recent: Mutex::new(vec![]),
            recent_file: None,
        }
    }

    pub fn allow(&self, p: &str) {
        self.paths
            .lock()
            .expect("allowed lock")
            .insert(normalize(Path::new(p)));
    }

    pub fn check(&self, p: &str) -> Result<PathBuf, String> {
        let path = PathBuf::from(p);
        let set = self.paths.lock().expect("allowed lock");
        if set.contains(&normalize(&path)) || set.contains(&path) {
            Ok(path)
        } else {
            Err("Access denied: open or save the file through LineWise first.".into())
        }
    }

    fn add_recent(&self, path: &str, now: String) -> Vec<RecentFile> {
        let name = Path::new(path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let mut recent = self.recent.lock().expect("recent lock");
        recent.retain(|r| r.path != path);
        recent.insert(
            0,
            RecentFile {
                path: path.to_string(),
                name,
                opened_at: now,
            },
        );
        recent.truncate(MAX_RECENT);
        if let Some(f) = &self.recent_file {
            if let Some(dir) = f.parent() {
                let _ = fs::create_dir_all(dir);
            }
            if let Ok(json) = serde_json::to_string_pretty(&*recent) {
                let _ = write_atomic(f, json.as_bytes(), false);
            }
        }
        recent.clone()
    }
}

/// Write `contents` to `target` atomically. When `backup` is set and the target
/// exists, the previous version is kept as `<target>.bak`.
pub fn write_atomic(target: &Path, contents: &[u8], backup: bool) -> std::io::Result<()> {
    let dir = target
        .parent()
        .filter(|d| !d.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let file_name = target
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".into());
    let tmp = dir.join(format!(".{file_name}.tmp-{}", std::process::id()));
    {
        let mut f = File::create(&tmp)?;
        f.write_all(contents)?;
        f.sync_all()?;
    }
    if backup && target.exists() {
        let bak = dir.join(format!("{file_name}.bak"));
        let _ = fs::copy(target, bak);
    }
    if let Err(e) = fs::rename(&tmp, target) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    #[cfg(unix)]
    if let Ok(d) = File::open(dir) {
        let _ = d.sync_all();
    }
    Ok(())
}

pub fn iso_now() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    iso_from_unix(secs)
}

/// Unix seconds → RFC 3339 UTC, without extra dependencies.
pub fn iso_from_unix(secs: i64) -> String {
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    // Civil-from-days (Howard Hinnant).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

fn read_limited(path: &Path) -> Result<Vec<u8>, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_READ_BYTES {
        return Err("File is too large".into());
    }
    fs::read(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_text_file(
    state: tauri::State<'_, AllowedPaths>,
    path: String,
) -> Result<String, String> {
    let p = state.check(&path)?;
    String::from_utf8(read_limited(&p)?).map_err(|_| "File is not valid UTF-8 text".into())
}

#[tauri::command]
pub fn read_binary_file(
    state: tauri::State<'_, AllowedPaths>,
    path: String,
) -> Result<Vec<u8>, String> {
    let p = state.check(&path)?;
    read_limited(&p)
}

#[tauri::command]
pub fn save_atomic(
    state: tauri::State<'_, AllowedPaths>,
    path: String,
    contents: String,
) -> Result<(), String> {
    let p = state.check(&path)?;
    write_atomic(&p, contents.as_bytes(), true).map_err(|e| e.to_string())?;
    log::info!("saved {}", p.display());
    Ok(())
}

#[tauri::command]
pub fn write_binary_atomic(
    state: tauri::State<'_, AllowedPaths>,
    path: String,
    contents: Vec<u8>,
) -> Result<(), String> {
    let p = state.check(&path)?;
    write_atomic(&p, &contents, false).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct Filter {
    name: String,
    extensions: Vec<String>,
}

#[tauri::command]
pub async fn pick_open(
    app: AppHandle,
    state: tauri::State<'_, AllowedPaths>,
    filters: Vec<Filter>,
    multiple: bool,
) -> Result<Vec<String>, String> {
    let mut builder = app.dialog().file();
    for f in &filters {
        let exts: Vec<&str> = f.extensions.iter().map(String::as_str).collect();
        builder = builder.add_filter(&f.name, &exts);
    }
    let picked: Vec<String> = if multiple {
        builder
            .blocking_pick_files()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|p| p.into_path().ok())
            .map(|p| p.to_string_lossy().to_string())
            .collect()
    } else {
        builder
            .blocking_pick_file()
            .and_then(|p| p.into_path().ok())
            .map(|p| vec![p.to_string_lossy().to_string()])
            .unwrap_or_default()
    };
    for p in &picked {
        state.allow(p);
    }
    Ok(picked)
}

/// Debug builds only: the native smoke test (tauri-driver, spec section 10) cannot drive OS
/// file dialogs, so `LINEWISE_SMOKE_DIR` makes Save pick `<dir>/<default name>`. Release
/// builds compile this out entirely.
#[cfg(debug_assertions)]
fn smoke_save_path(default_name: &str) -> Option<String> {
    let dir = std::env::var_os("LINEWISE_SMOKE_DIR")?;
    let name = Path::new(default_name).file_name()?;
    Some(Path::new(&dir).join(name).to_string_lossy().to_string())
}

#[cfg(not(debug_assertions))]
fn smoke_save_path(_default_name: &str) -> Option<String> {
    None
}

#[tauri::command]
pub async fn pick_save(
    app: AppHandle,
    state: tauri::State<'_, AllowedPaths>,
    default_name: String,
    filters: Vec<Filter>,
) -> Result<Option<String>, String> {
    if let Some(p) = smoke_save_path(&default_name) {
        state.allow(&p);
        return Ok(Some(p));
    }
    let mut builder = app.dialog().file().set_file_name(&default_name);
    for f in &filters {
        let exts: Vec<&str> = f.extensions.iter().map(String::as_str).collect();
        builder = builder.add_filter(&f.name, &exts);
    }
    let picked = builder
        .blocking_save_file()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().to_string());
    if let Some(p) = &picked {
        state.allow(p);
    }
    Ok(picked)
}

#[tauri::command]
pub fn recent_list(state: tauri::State<'_, AllowedPaths>) -> Vec<RecentFile> {
    state.recent.lock().expect("recent lock").clone()
}

#[tauri::command]
pub fn recent_add(
    state: tauri::State<'_, AllowedPaths>,
    path: String,
) -> Result<Vec<RecentFile>, String> {
    state.check(&path)?;
    Ok(state.add_recent(&path, iso_now()))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// FR-FMT-06, NFR-REL-01: temp file + fsync + rename, one .bak of the previous version.
    #[test]
    fn atomic_write_keeps_backup_and_leaves_no_temp() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("net.lwise");
        write_atomic(&target, b"one", true).unwrap();
        write_atomic(&target, b"two", true).unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "two");
        assert_eq!(
            fs::read_to_string(dir.path().join("net.lwise.bak")).unwrap(),
            "one"
        );
        let leftovers: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains(".tmp-"))
            .collect();
        assert!(leftovers.is_empty());
    }

    /// NFR-SEC-01: file access is limited to paths the user picked in a dialog.
    #[test]
    fn paths_must_be_allowed() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("a.lwise");
        fs::write(&target, "x").unwrap();
        let allowed = AllowedPaths::empty();
        let p = target.to_string_lossy().to_string();
        assert!(allowed.check(&p).is_err());
        allowed.allow(&p);
        assert!(allowed.check(&p).is_ok());
        assert!(allowed
            .check(&dir.path().join("other.lwise").to_string_lossy())
            .is_err());
    }

    /// FR-APP-05: the last 10 recent files, most recent first.
    #[test]
    fn recent_list_is_capped_and_deduplicated() {
        let allowed = AllowedPaths::empty();
        for i in 0..15 {
            allowed.add_recent(&format!("/tmp/{i}.lwise"), iso_from_unix(0));
        }
        let list = allowed.add_recent("/tmp/3.lwise", iso_from_unix(0));
        assert_eq!(list.len(), MAX_RECENT);
        assert_eq!(list[0].path, "/tmp/3.lwise");
        assert_eq!(list.iter().filter(|r| r.path == "/tmp/3.lwise").count(), 1);
    }

    #[test]
    fn iso_dates() {
        assert_eq!(iso_from_unix(0), "1970-01-01T00:00:00Z");
        assert_eq!(iso_from_unix(1_791_504_000), "2026-10-09T00:00:00Z");
        assert_eq!(iso_from_unix(951_782_400), "2000-02-29T00:00:00Z");
    }
}
