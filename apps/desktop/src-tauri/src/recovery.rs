// SPDX-License-Identifier: Apache-2.0
//! Crash recovery (FR-FMT-07): autosaves go to the app-data recovery folder and
//! are offered on the next launch. Entries are deleted after a successful save.

use crate::files::{iso_now, write_atomic};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryEntry {
    pub doc_id: String,
    pub name: String,
    pub path: Option<String>,
    #[serde(default)]
    pub saved_at: String,
    pub text: String,
}

/// Only simple IDs become file names, so a crafted ID cannot escape the folder.
pub fn safe_id(id: &str) -> Result<&str, String> {
    if !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        Ok(id)
    } else {
        Err("Invalid document id".into())
    }
}

fn dir(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?.join("recovery");
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}

#[tauri::command]
pub fn recovery_write(app: AppHandle, mut entry: RecoveryEntry) -> Result<(), String> {
    let id = safe_id(&entry.doc_id)?.to_string();
    entry.saved_at = iso_now();
    let json = serde_json::to_vec(&entry).map_err(|e| e.to_string())?;
    write_atomic(&dir(&app)?.join(format!("{id}.json")), &json, false).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn recovery_list(app: AppHandle) -> Result<Vec<RecoveryEntry>, String> {
    let mut out = vec![];
    for e in fs::read_dir(dir(&app)?).map_err(|e| e.to_string())?.flatten() {
        if e.path().extension().is_some_and(|x| x == "json") {
            if let Some(entry) = fs::read(e.path()).ok().and_then(|b| serde_json::from_slice::<RecoveryEntry>(&b).ok()) {
                out.push(entry);
            }
        }
    }
    out.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
    Ok(out)
}

#[tauri::command]
pub fn recovery_clear(app: AppHandle, doc_id: String) -> Result<(), String> {
    let id = safe_id(&doc_id)?;
    let p = dir(&app)?.join(format!("{id}.json"));
    if p.exists() {
        fs::remove_file(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::safe_id;

    #[test]
    fn rejects_path_traversal_ids() {
        assert!(safe_id("0192f0a1-7c3e-7abc-8def-0123456789ab").is_ok());
        assert!(safe_id("../etc/passwd").is_err());
        assert!(safe_id("a/b").is_err());
        assert!(safe_id("").is_err());
    }
}
