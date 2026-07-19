use crate::controller::commands::paths_for_app;
use crate::services::config::app_config;
use crate::services::config::runtime_paths::RuntimePaths;
use crate::services::modes::schedule::active_schedule;
use chrono::{Local, Utc};
use serde::Serialize;
use serde_json::Value;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

const FRICTION_SECONDS_ENV: &str = "PRODUCTIVE_PROXY_FRICTION_SECONDS";

#[derive(Default)]
pub struct ModeRuntime {
    inner: Mutex<ModeRuntimeInner>,
}

#[derive(Default)]
struct ModeRuntimeInner {
    pending: Option<PendingModeSwitch>,
    last_schedule_key: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingModeSwitch {
    source_mode_id: String,
    target_mode_id: String,
    ready_at_ms: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModeRuntimeStatus {
    active_mode_id: String,
    friction_seconds: i64,
    pending: Option<PendingModeSwitch>,
}

#[tauri::command]
pub fn mode_runtime_status(
    app: AppHandle,
    state: State<ModeRuntime>,
) -> Result<ModeRuntimeStatus, String> {
    let paths = paths_for_app(&app)?;
    let mut inner = state.inner.lock().map_err(to_string)?;
    let config = sync_runtime(&paths, &mut inner)?;
    status(&config, &inner)
}

#[tauri::command]
pub fn request_mode_switch(
    app: AppHandle,
    state: State<ModeRuntime>,
    target_mode_id: String,
) -> Result<ModeRuntimeStatus, String> {
    let paths = paths_for_app(&app)?;
    let mut inner = state.inner.lock().map_err(to_string)?;
    let config = sync_runtime(&paths, &mut inner)?;
    let current_id = active_mode_id(&config)?;
    let target = mode_by_id(&config, &target_mode_id)
        .ok_or_else(|| format!("Unknown mode: {target_mode_id}"))?;

    if target["id"].as_str() == Some(current_id) {
        inner.pending = None;
        return status(&config, &inner);
    }

    let source = mode_by_id(&config, current_id)
        .ok_or_else(|| format!("Unknown active mode: {current_id}"))?;
    if source["createFriction"].as_bool().unwrap_or(false) {
        let now = Utc::now().timestamp_millis();
        let keep_existing = inner.pending.as_ref().is_some_and(|pending| {
            pending.source_mode_id == current_id
                && pending.target_mode_id == target_mode_id
                && pending.ready_at_ms > now
        });
        if !keep_existing {
            inner.pending = Some(PendingModeSwitch {
                source_mode_id: current_id.to_string(),
                target_mode_id,
                ready_at_ms: now + friction_delay_ms()?,
            });
        }
        return status(&config, &inner);
    }

    let config = app_config::set_active_mode(&paths, &target_mode_id)?;
    inner.pending = None;
    status(&config, &inner)
}

#[tauri::command]
pub fn cancel_mode_switch(
    app: AppHandle,
    state: State<ModeRuntime>,
) -> Result<ModeRuntimeStatus, String> {
    let paths = paths_for_app(&app)?;
    let mut inner = state.inner.lock().map_err(to_string)?;
    inner.pending = None;
    let config = sync_runtime(&paths, &mut inner)?;
    status(&config, &inner)
}

pub fn start_mode_monitor(app: AppHandle) -> Result<(), String> {
    friction_delay_seconds()?;
    let paths = paths_for_app(&app)?;
    thread::spawn(move || loop {
        let result = {
            let state = app.state::<ModeRuntime>();
            state
                .inner
                .lock()
                .map_err(to_string)
                .and_then(|mut inner| sync_runtime(&paths, &mut inner).map(|_| ()))
        };
        if let Err(error) = result {
            log::error!("mode runtime monitor failed: {error}");
        }
        thread::sleep(Duration::from_secs(1));
    });
    Ok(())
}

fn sync_runtime(paths: &RuntimePaths, inner: &mut ModeRuntimeInner) -> Result<Value, String> {
    let mut config = app_config::read_stored(paths)?;

    if let Some(schedule) = active_schedule(&config, Local::now().naive_local()) {
        if inner.last_schedule_key.as_deref() != Some(schedule.occurrence_key.as_str()) {
            config = app_config::set_active_mode(paths, &schedule.mode_id)?;
            inner.last_schedule_key = Some(schedule.occurrence_key);
            inner.pending = None;
        }
    }

    let now = Utc::now().timestamp_millis();
    if let Some(pending) = inner.pending.clone() {
        let source_is_active = active_mode_id(&config)? == pending.source_mode_id;
        let target_exists = mode_by_id(&config, &pending.target_mode_id).is_some();
        if !source_is_active || !target_exists {
            inner.pending = None;
        } else if now >= pending.ready_at_ms {
            config = app_config::set_active_mode(paths, &pending.target_mode_id)?;
            inner.pending = None;
        }
    }
    Ok(config)
}

fn status(config: &Value, inner: &ModeRuntimeInner) -> Result<ModeRuntimeStatus, String> {
    Ok(ModeRuntimeStatus {
        active_mode_id: active_mode_id(config)?.to_string(),
        friction_seconds: friction_delay_seconds()?,
        pending: inner.pending.clone(),
    })
}

fn active_mode_id(config: &Value) -> Result<&str, String> {
    config["activeModeId"]
        .as_str()
        .ok_or_else(|| "Config is missing activeModeId".to_string())
}

fn mode_by_id<'a>(config: &'a Value, mode_id: &str) -> Option<&'a Value> {
    config["modes"]
        .as_array()?
        .iter()
        .find(|mode| mode["id"].as_str() == Some(mode_id))
}

fn friction_delay_ms() -> Result<i64, String> {
    friction_delay_seconds()?
        .checked_mul(1000)
        .ok_or_else(|| format!("{FRICTION_SECONDS_ENV} is too large"))
}

fn friction_delay_seconds() -> Result<i64, String> {
    let raw = std::env::var(FRICTION_SECONDS_ENV)
        .map_err(|_| format!("Missing {FRICTION_SECONDS_ENV}"))?;
    let seconds: i64 = raw
        .parse()
        .map_err(|_| format!("{FRICTION_SECONDS_ENV} must be a positive integer"))?;
    if seconds <= 0 {
        return Err(format!("{FRICTION_SECONDS_ENV} must be greater than zero"));
    }
    Ok(seconds)
}

fn to_string(error: impl ToString) -> String {
    error.to_string()
}
