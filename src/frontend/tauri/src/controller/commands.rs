use crate::controller::proxy_lifecycle::{proxy_startup_grace, restore_marked_system_proxy, start_proxy_monitor};
use crate::models::proxy::settings::ProxySettings;
use crate::services::config::app_config;
use crate::services::config::bootstrap::discover_repo_root;
use crate::services::config::runtime_paths::RuntimePaths;
use crate::services::config::validator::{self, ValidationReport};
use crate::services::events::event_log::{query_events as query_event_log, read_recent_events as read_events, EventQuery};
use crate::services::network::network_info::{detect_network_info, NetworkInfo};
use crate::services::proxy::mitmdump_args::build_mitmdump_args;
use crate::services::proxy::process_service::ProcessService;
use crate::services::proxy::resources::sample_process;
use crate::services::system_proxy::{capture_system_proxy_snapshot, enable_system_proxy, remove_system_proxy_snapshot, restore_system_proxy, save_system_proxy_snapshot, SystemProxySnapshot};
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Manager, State};

pub struct AppState {
    pub lifecycle: Arc<Mutex<()>>,
    pub proxy: Arc<Mutex<ProcessService>>,
    pub system_proxy_snapshot: Arc<Mutex<Option<SystemProxySnapshot>>>,
    pub proxy_started: Arc<Mutex<Option<Instant>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            lifecycle: Arc::new(Mutex::new(())),
            proxy: Arc::new(Mutex::new(ProcessService::new())),
            system_proxy_snapshot: Arc::new(Mutex::new(None)),
            proxy_started: Arc::new(Mutex::new(None)),
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyResources {
    running: bool,
    pid: Option<u32>,
    mem_bytes: Option<u64>,
    cpu_percent: Option<f64>,
    uptime_seconds: Option<u64>,
}

#[tauri::command]
pub fn read_app_config(app: AppHandle) -> Result<Value, String> {
    app_config::read_for_frontend(&paths_for_app(&app)?)
}

/// Validate via the Python source-of-truth, then write only if it is valid.
/// Active mode is runtime-owned and changed through the mode switch commands.
#[tauri::command]
pub fn write_app_config(app: AppHandle, config: Value) -> Result<ValidationReport, String> {
    let (_, report) = app_config::validate_and_write(&paths_for_app(&app)?, config, true)?;
    Ok(report)
}

#[tauri::command(async)]
pub fn start_proxy(app: AppHandle, state: State<AppState>, config: Value) -> Result<(), String> {
    for name in [
        "POLICY_MAX_STEPS",
        "PRODUCTIVE_PROXY_TELEMETRY_VERBOSE",
        "PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES",
        "PRODUCTIVE_PROXY_EVENT_QUEUE_MAX_ITEMS",
        "PRODUCTIVE_PROXY_ASYNC_QUEUE_MAX_ITEMS",
        "PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS",
    ] {
        require_env(name)?;
    }
    let stream_large_bodies = require_env("PRODUCTIVE_PROXY_STREAM_LARGE_BODIES")?;
    let _lifecycle = state.lifecycle.lock().map_err(to_string)?;
    let paths = paths_for_app(&app)?;
    let (config, report) = app_config::validate_and_write(&paths, config, true)?;
    if !report.ok {
        return Err(validator::first_message(&report));
    }
    let running = state.proxy.lock().map_err(to_string)?.is_running().map_err(to_string)?;
    if running {
        return Err("process already running".to_string());
    }
    restore_marked_system_proxy(&state.system_proxy_snapshot, &paths.system_proxy_snapshot_path)?;

    let settings = ProxySettings::from_app_config(&config).map_err(to_string)?;
    let args = build_mitmdump_args(&settings, &paths.proxy, &stream_large_bodies)?;
    let snapshot = if settings.uses_system_proxy() {
        let snapshot = capture_system_proxy_snapshot().map_err(to_string)?;
        save_system_proxy_snapshot(&paths.system_proxy_snapshot_path, &snapshot)
            .map_err(to_string)?;
        Some(snapshot)
    } else {
        None
    };

    let start_result = state.proxy.lock().map_err(to_string).and_then(|mut proxy| {
        proxy
            .start_args_and_confirm_with_log(
                "mitmdump",
                &args,
                proxy_startup_grace(),
                &paths.proxy.mitmdump_log_path,
            )
            .map_err(to_string)
    });
    if let Err(error) = start_result {
        if snapshot.is_some() {
            let _ = remove_system_proxy_snapshot(&paths.system_proxy_snapshot_path);
        }
        return Err(error);
    }

    if let Some(snapshot) = &snapshot {
        if let Err(error) = enable_system_proxy(&settings, snapshot) {
            let _ = restore_system_proxy(snapshot);
            let _ = remove_system_proxy_snapshot(&paths.system_proxy_snapshot_path);
            if let Ok(mut proxy) = state.proxy.lock() {
                let _ = proxy.stop();
            }
            return Err(to_string(error));
        }
    }

    let still_running = state.proxy.lock().map_err(to_string)?.is_running().map_err(to_string)?;
    if !still_running {
        if let Some(snapshot) = &snapshot {
            let _ = restore_system_proxy(snapshot);
            let _ = remove_system_proxy_snapshot(&paths.system_proxy_snapshot_path);
        }
        return Err("proxy process exited during startup".to_string());
    }

    match state.system_proxy_snapshot.lock() {
        Ok(mut stored_snapshot) => {
            *stored_snapshot = snapshot.clone();
            if let Ok(mut started) = state.proxy_started.lock() {
                *started = Some(Instant::now());
            }
            if snapshot.is_some() {
                start_proxy_monitor(
                    Arc::downgrade(&state.proxy),
                    Arc::downgrade(&state.system_proxy_snapshot),
                    Arc::downgrade(&state.lifecycle),
                    paths.system_proxy_snapshot_path,
                );
            }
            Ok(())
        }
        Err(error) => {
            if let Some(snapshot) = &snapshot {
                let _ = restore_system_proxy(snapshot);
                let _ = remove_system_proxy_snapshot(&paths.system_proxy_snapshot_path);
            }
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
    state.proxy.lock().map_err(to_string)?.stop().map_err(to_string)?;
    if let Ok(mut started) = state.proxy_started.lock() {
        *started = None;
    }
    Ok(())
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

/// Live resource usage of the proxy process (CPU%, RSS, uptime). Sampled from
/// the OS via `ps`, so it adds nothing to the request hot path. Returns
/// `running: false` with empty fields when the proxy is stopped.
#[tauri::command(async)]
pub fn proxy_resources(state: State<AppState>) -> Result<ProxyResources, String> {
    let (running, pid) = {
        let mut proxy = state.proxy.lock().map_err(to_string)?;
        let running = proxy.is_running().map_err(to_string)?;
        (running, proxy.pid())
    };
    if !running {
        return Ok(ProxyResources {
            running: false,
            pid: None,
            mem_bytes: None,
            cpu_percent: None,
            uptime_seconds: None,
        });
    }
    let uptime_seconds = state
        .proxy_started
        .lock()
        .map_err(to_string)?
        .map(|started| started.elapsed().as_secs());
    let sample = pid.and_then(sample_process);
    Ok(ProxyResources {
        running: true,
        pid,
        mem_bytes: sample.map(|s| s.mem_bytes),
        cpu_percent: sample.map(|s| s.cpu_percent),
        uptime_seconds,
    })
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

pub(crate) fn paths_for_app(app: &AppHandle) -> Result<RuntimePaths, String> {
    let app_data = app.path().app_data_dir().map_err(to_string)?;
    Ok(RuntimePaths::new(app_data, discover_repo_root()?))
}

fn system_proxy_snapshot_path_for_app(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("system_proxy_snapshot.json"))
        .map_err(to_string)
}

fn require_env(name: &str) -> Result<String, String> {
    let value = std::env::var(name).map_err(|_| format!("Missing {name}"))?;
    if value.trim().is_empty() {
        return Err(format!("{name} must not be empty"));
    }
    Ok(value)
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
