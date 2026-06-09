use crate::models::proxy::settings::ProxySettings;
use crate::services::config::file_store::FileStore;
use crate::services::config::runtime_paths::RuntimePaths;
use crate::services::events::event_log::read_recent_events as read_events;
use crate::services::network::network_info::{detect_network_info, NetworkInfo};
use crate::services::proxy::mitmdump_args::build_mitmdump_args;
use crate::services::proxy::process_service::ProcessService;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Default)]
pub struct AppState {
    pub proxy: Mutex<ProcessService>,
}

#[derive(Serialize)]
pub struct ProxyStatus {
    running: bool,
}

#[tauri::command]
pub fn read_app_config(app: AppHandle) -> Result<Value, String> {
    let paths = paths_for_app(&app)?;
    ensure_config_exists(&paths)?;
    FileStore::new(paths.proxy.config_path).read_json().map_err(to_string)
}

#[tauri::command]
pub fn write_app_config(app: AppHandle, config: Value) -> Result<(), String> {
    let paths = paths_for_app(&app)?;
    FileStore::new(paths.proxy.config_path)
        .write_json(&config)
        .map_err(to_string)
}

#[tauri::command]
pub fn write_custom_block(app: AppHandle, file_name: String, code: String) -> Result<String, String> {
    let paths = paths_for_app(&app)?;
    fs::create_dir_all(&paths.custom_blocks_dir).map_err(to_string)?;
    let path = paths.custom_blocks_dir.join(file_name);
    fs::write(&path, code).map_err(to_string)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn start_proxy(app: AppHandle, state: State<AppState>, config: Value) -> Result<(), String> {
    let paths = paths_for_app(&app)?;
    FileStore::new(paths.proxy.config_path.clone())
        .write_json(&config)
        .map_err(to_string)?;
    let settings = ProxySettings::from_app_config(&config).map_err(to_string)?;
    let args = build_mitmdump_args(&settings, &paths.proxy);
    state
        .proxy
        .lock()
        .map_err(to_string)?
        .start_args("mitmdump", &args)
        .map_err(to_string)
}

#[tauri::command]
pub fn stop_proxy(state: State<AppState>) -> Result<(), String> {
    state.proxy.lock().map_err(to_string)?.stop().map_err(to_string)
}

#[tauri::command]
pub fn proxy_status(state: State<AppState>) -> Result<ProxyStatus, String> {
    let running = state.proxy.lock().map_err(to_string)?.is_running().map_err(to_string)?;
    Ok(ProxyStatus { running })
}

#[tauri::command]
pub fn read_recent_events(app: AppHandle, limit: usize) -> Result<Vec<Value>, String> {
    let paths = paths_for_app(&app)?;
    read_events(&paths.proxy.event_log_path, limit).map_err(to_string)
}

#[tauri::command]
pub fn network_info() -> NetworkInfo {
    detect_network_info()
}

fn paths_for_app(app: &AppHandle) -> Result<RuntimePaths, String> {
    let app_data = app.path().app_data_dir().map_err(to_string)?;
    Ok(RuntimePaths::new(app_data, discover_repo_root()?))
}

fn ensure_config_exists(paths: &RuntimePaths) -> Result<(), String> {
    if paths.proxy.config_path.exists() {
        return Ok(());
    }
    let default_path = discover_repo_root()?.join("src/proxy/defaults/default_config.json");
    let config = FileStore::new(default_path).read_json().map_err(to_string)?;
    FileStore::new(paths.proxy.config_path.clone())
        .write_json(&config)
        .map_err(to_string)
}

fn discover_repo_root() -> Result<PathBuf, String> {
    let mut dir = std::env::current_dir().map_err(to_string)?;
    loop {
        if dir.join("src/proxy/addons/graph_proxy.py").exists() {
            return Ok(dir);
        }
        if !dir.pop() {
            return Err("Cannot find repository root".to_string());
        }
    }
}

fn to_string(error: impl ToString) -> String {
    error.to_string()
}
