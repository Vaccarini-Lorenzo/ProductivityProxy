use crate::controller::proxy_lifecycle::{
    proxy_startup_grace, restore_marked_system_proxy, start_proxy_monitor,
};
use crate::models::proxy::settings::ProxySettings;
use crate::services::config::bootstrap::{discover_repo_root, ensure_config_exists};
use crate::services::config::file_store::FileStore;
use crate::services::config::runtime_paths::RuntimePaths;
use crate::services::config::validator::{self, ValidationReport};
use crate::services::events::event_log::{query_events as query_event_log, read_recent_events as read_events, EventQuery};
use crate::services::network::network_info::{detect_network_info, NetworkInfo};
use crate::services::proxy::mitmdump_args::build_mitmdump_args;
use crate::services::proxy::process_service::ProcessService;
use crate::services::system_proxy::{
    capture_system_proxy_snapshot, enable_system_proxy, remove_system_proxy_snapshot,
    restore_system_proxy, save_system_proxy_snapshot, SystemProxySnapshot,
};
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};

pub struct AppState {
    /// Serializes the whole start/stop/status lifecycle. Held for the entire
    /// operation so the async commands cannot interleave their multi-step
    /// capture/enable/restore sequences (which would let one observe the proxy
    /// already pointed at us and persist a self-referential snapshot).
    pub lifecycle: Arc<Mutex<()>>,
    pub proxy: Arc<Mutex<ProcessService>>,
    pub system_proxy_snapshot: Arc<Mutex<Option<SystemProxySnapshot>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            lifecycle: Arc::new(Mutex::new(())),
            proxy: Arc::new(Mutex::new(ProcessService::new())),
            system_proxy_snapshot: Arc::new(Mutex::new(None)),
        }
    }
}

impl Drop for AppState {
    fn drop(&mut self) {
        if let Ok(mut snapshot) = self.system_proxy_snapshot.lock() {
            if let Some(snapshot) = snapshot.take() {
                let _ = restore_system_proxy(&snapshot);
            }
        }
    }
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

/// Validate via the Python source-of-truth, then write only if it is valid.
/// Returns the report either way so the frontend can show issues without saving.
#[tauri::command]
pub fn write_app_config(app: AppHandle, config: Value) -> Result<ValidationReport, String> {
    let paths = paths_for_app(&app)?;
    let report = validator::validate_config(&discover_repo_root()?, &config)?;
    if report.ok {
        FileStore::new(paths.proxy.config_path)
            .write_json(&config)
            .map_err(to_string)?;
    }
    Ok(report)
}

#[tauri::command]
pub fn validate_node_code(code: String) -> Result<ValidationReport, String> {
    validator::validate_node_code(&discover_repo_root()?, &code)
}

#[tauri::command]
pub fn write_custom_node(app: AppHandle, file_name: String, code: String) -> Result<String, String> {
    let paths = paths_for_app(&app)?;
    let report = validator::validate_node_code(&discover_repo_root()?, &code)?;
    if !report.ok {
        return Err(validator::first_message(&report));
    }
    fs::create_dir_all(&paths.custom_nodes_dir).map_err(to_string)?;
    let safe_name = Path::new(&file_name)
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "invalid custom node file name".to_string())?;
    if safe_name.is_empty() || safe_name == "." || safe_name == ".." {
        return Err("invalid custom node file name".to_string());
    }
    let path = paths.custom_nodes_dir.join(safe_name);
    fs::write(&path, code).map_err(to_string)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_custom_node(app: AppHandle, path: String) -> Result<String, String> {
    let paths = paths_for_app(&app)?;
    let repo_root = discover_repo_root()?;
    let raw_path = PathBuf::from(path);
    let requested_path = if raw_path.is_absolute() {
        raw_path
    } else {
        repo_root.join(raw_path)
    };
    let requested = requested_path.canonicalize().map_err(to_string)?;
    let custom_dir = paths.custom_nodes_dir.canonicalize().ok();
    let defaults_dir = repo_root
        .join("src/proxy/defaults/nodes")
        .canonicalize()
        .map_err(to_string)?;
    let allowed = requested.starts_with(defaults_dir)
        || custom_dir.as_ref().is_some_and(|dir| requested.starts_with(dir));
    if !allowed {
        return Err("custom node path is outside allowed directories".to_string());
    }
    fs::read_to_string(requested).map_err(to_string)
}

#[tauri::command(async)]
pub fn start_proxy(app: AppHandle, state: State<AppState>, config: Value) -> Result<(), String> {
    require_env("POLICY_MAX_STEPS")?;
    // Hold the lifecycle lock for the whole start sequence so a concurrent
    // status poll or stop cannot interleave between capture, enable, and store.
    let _lifecycle = state.lifecycle.lock().map_err(to_string)?;
    let paths = paths_for_app(&app)?;
    let report = validator::validate_config(&discover_repo_root()?, &config)?;
    if !report.ok {
        return Err(validator::first_message(&report));
    }
    let running = state.proxy.lock().map_err(to_string)?.is_running().map_err(to_string)?;
    if running {
        return Err("process already running".to_string());
    }
    restore_marked_system_proxy(&state.system_proxy_snapshot, &paths.system_proxy_snapshot_path)?;

    FileStore::new(paths.proxy.config_path.clone())
        .write_json(&config)
        .map_err(to_string)?;
    let settings = ProxySettings::from_app_config(&config).map_err(to_string)?;
    let snapshot = capture_system_proxy_snapshot().map_err(to_string)?;
    save_system_proxy_snapshot(&paths.system_proxy_snapshot_path, &snapshot).map_err(to_string)?;
    let args = build_mitmdump_args(&settings, &paths.proxy);

    let start_result = state.proxy.lock().map_err(to_string).and_then(|mut proxy| {
        proxy
            .start_args_and_confirm("mitmdump", &args, proxy_startup_grace())
            .map_err(to_string)
    });
    if let Err(error) = start_result {
        let _ = remove_system_proxy_snapshot(&paths.system_proxy_snapshot_path);
        return Err(error);
    }

    if let Err(error) = enable_system_proxy(&settings, &snapshot) {
        let _ = restore_system_proxy(&snapshot);
        let _ = remove_system_proxy_snapshot(&paths.system_proxy_snapshot_path);
        if let Ok(mut proxy) = state.proxy.lock() {
            let _ = proxy.stop();
        }
        return Err(to_string(error));
    }

    let still_running = state.proxy.lock().map_err(to_string)?.is_running().map_err(to_string)?;
    if !still_running {
        let _ = restore_system_proxy(&snapshot);
        let _ = remove_system_proxy_snapshot(&paths.system_proxy_snapshot_path);
        return Err("proxy process exited during startup".to_string());
    }

    match state.system_proxy_snapshot.lock() {
        Ok(mut stored_snapshot) => {
            *stored_snapshot = Some(snapshot);
            start_proxy_monitor(
                Arc::downgrade(&state.proxy),
                Arc::downgrade(&state.system_proxy_snapshot),
                Arc::downgrade(&state.lifecycle),
                paths.system_proxy_snapshot_path,
            );
            Ok(())
        }
        Err(error) => {
            let _ = restore_system_proxy(&snapshot);
            let _ = remove_system_proxy_snapshot(&paths.system_proxy_snapshot_path);
            if let Ok(mut proxy) = state.proxy.lock() {
                let _ = proxy.stop();
            }
            Err(to_string(error))
        }
    }
}

#[tauri::command(async)]
pub fn stop_proxy(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let _lifecycle = state.lifecycle.lock().map_err(to_string)?;
    let snapshot_path = system_proxy_snapshot_path_for_app(&app)?;
    restore_marked_system_proxy(&state.system_proxy_snapshot, &snapshot_path)?;
    state.proxy.lock().map_err(to_string)?.stop().map_err(to_string)
}

#[tauri::command(async)]
pub fn proxy_status(app: AppHandle, state: State<AppState>) -> Result<ProxyStatus, String> {
    let _lifecycle = state.lifecycle.lock().map_err(to_string)?;
    let snapshot_path = system_proxy_snapshot_path_for_app(&app)?;
    let running = state.proxy.lock().map_err(to_string)?.is_running().map_err(to_string)?;
    if !running {
        restore_marked_system_proxy(&state.system_proxy_snapshot, &snapshot_path)?;
    }
    Ok(ProxyStatus { running })
}

#[tauri::command]
pub fn read_recent_events(app: AppHandle, limit: usize) -> Result<Vec<Value>, String> {
    let paths = paths_for_app(&app)?;
    read_events(&paths.proxy.event_log_path, limit).map_err(to_string)
}

#[tauri::command]
pub fn query_events(app: AppHandle, query: EventQuery) -> Result<Vec<Value>, String> {
    let paths = paths_for_app(&app)?;
    query_event_log(&paths.proxy.event_log_path, &query).map_err(to_string)
}

#[tauri::command]
pub fn network_info() -> NetworkInfo {
    detect_network_info()
}

fn paths_for_app(app: &AppHandle) -> Result<RuntimePaths, String> {
    let app_data = app.path().app_data_dir().map_err(to_string)?;
    Ok(RuntimePaths::new(app_data, discover_repo_root()?))
}

fn system_proxy_snapshot_path_for_app(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("system_proxy_snapshot.json"))
        .map_err(to_string)
}

fn require_env(name: &str) -> Result<(), String> {
    std::env::var(name)
        .map(|_| ())
        .map_err(|_| format!("Missing {name}"))
}

/// Best-effort cleanup on app exit: restore the captured system proxy state and
/// stop mitmdump. Safe to call repeatedly (the snapshot is taken once).
pub fn shutdown_cleanup(app: &AppHandle, state: &AppState) {
    // Best-effort: serialize with any in-flight start/stop before restoring.
    let _lifecycle = state.lifecycle.lock();
    match system_proxy_snapshot_path_for_app(app) {
        Ok(snapshot_path) => {
            if let Err(error) =
                restore_marked_system_proxy(&state.system_proxy_snapshot, &snapshot_path)
            {
                log::error!("failed to restore system proxy on exit: {error}");
            }
        }
        Err(error) => log::error!("failed to find system proxy snapshot on exit: {error}"),
    }
    if let Ok(mut proxy) = state.proxy.lock() {
        let _ = proxy.stop();
    }
}

fn to_string(error: impl ToString) -> String {
    error.to_string()
}
