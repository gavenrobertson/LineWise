// SPDX-License-Identifier: Apache-2.0
//! Auto-update (REL-10..12). The updater verifies each package's signature
//! against the public key in tauri.conf.json before installing; a failed
//! verification aborts and is logged. Updates are never forced.

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

const REPO: &str = "https://github.com/gavenrobertson/linewise/releases";

fn endpoint(channel: &str) -> String {
    match channel {
        "beta" => format!("{REPO}/download/beta/latest.json"),
        _ => format!("{REPO}/latest/download/latest.json"),
    }
}

#[derive(Serialize)]
pub struct UpdateMeta {
    version: String,
    notes: String,
}

async fn find(app: &AppHandle, channel: &str) -> Result<Option<tauri_plugin_updater::Update>, String> {
    let url = endpoint(channel).parse().map_err(|e: url::ParseError| e.to_string())?;
    app.updater_builder()
        .endpoints(vec![url])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_update(app: AppHandle, channel: String) -> Result<Option<UpdateMeta>, String> {
    let update = find(&app, &channel).await?;
    Ok(update.map(|u| UpdateMeta { version: u.version.clone(), notes: u.body.clone().unwrap_or_default() }))
}

#[tauri::command]
pub async fn install_update(app: AppHandle, channel: String) -> Result<(), String> {
    let Some(update) = find(&app, &channel).await? else {
        return Ok(());
    };
    log::info!("installing update {}", update.version);
    if let Err(e) = update.download_and_install(|_, _| {}, || {}).await {
        log::error!("update failed: {e}");
        return Err(e.to_string());
    }
    app.restart();
}

#[cfg(test)]
mod tests {
    use super::endpoint;

    #[test]
    fn channels_have_distinct_endpoints() {
        assert!(endpoint("stable").ends_with("/latest/download/latest.json"));
        assert!(endpoint("beta").contains("/download/beta/"));
    }
}
