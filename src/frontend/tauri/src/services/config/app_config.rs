use crate::services::config::bootstrap::{
    discover_repo_root, ensure_config_exists, normalize_config_paths,
};
use crate::services::config::file_store::FileStore;
use crate::services::config::runtime_paths::RuntimePaths;
use crate::services::config::validator::{self, ValidationReport};
use serde_json::Value;
use std::sync::Mutex;

static CONFIG_FILE_LOCK: Mutex<()> = Mutex::new(());

pub fn read_for_frontend(paths: &RuntimePaths) -> Result<Value, String> {
    let _guard = CONFIG_FILE_LOCK.lock().map_err(to_string)?;
    ensure_config_exists(paths)?;
    let mut config = read_unlocked(paths)?;
    normalize_config_paths(&mut config, &discover_repo_root()?);
    Ok(config)
}

pub fn read_stored(paths: &RuntimePaths) -> Result<Value, String> {
    let _guard = CONFIG_FILE_LOCK.lock().map_err(to_string)?;
    ensure_config_exists(paths)?;
    read_unlocked(paths)
}

pub fn validate_and_write(
    paths: &RuntimePaths,
    mut config: Value,
    preserve_active_mode: bool,
) -> Result<(Value, ValidationReport), String> {
    let _guard = CONFIG_FILE_LOCK.lock().map_err(to_string)?;
    ensure_config_exists(paths)?;
    if preserve_active_mode {
        let stored = read_unlocked(paths)?;
        preserve_active(&stored, &mut config);
    }
    let repo_root = discover_repo_root()?;
    normalize_config_paths(&mut config, &repo_root);
    let report = validator::validate_config(&repo_root, &config)?;
    if report.ok {
        write_unlocked(paths, &config)?;
    }
    Ok((config, report))
}

pub fn set_active_mode(paths: &RuntimePaths, mode_id: &str) -> Result<Value, String> {
    let _guard = CONFIG_FILE_LOCK.lock().map_err(to_string)?;
    ensure_config_exists(paths)?;
    let mut config = read_unlocked(paths)?;
    if !mode_exists(&config, mode_id) {
        return Err(format!("Unknown mode: {mode_id}"));
    }
    config["activeModeId"] = Value::String(mode_id.to_string());
    write_unlocked(paths, &config)?;
    Ok(config)
}

fn preserve_active(stored: &Value, incoming: &mut Value) {
    let Some(active) = stored["activeModeId"].as_str() else {
        return;
    };
    if mode_exists(incoming, active) {
        incoming["activeModeId"] = Value::String(active.to_string());
    }
}

fn mode_exists(config: &Value, mode_id: &str) -> bool {
    config["modes"]
        .as_array()
        .is_some_and(|modes| modes.iter().any(|mode| mode["id"].as_str() == Some(mode_id)))
}

fn read_unlocked(paths: &RuntimePaths) -> Result<Value, String> {
    FileStore::new(paths.proxy.config_path.clone())
        .read_json()
        .map_err(to_string)
}

fn write_unlocked(paths: &RuntimePaths, config: &Value) -> Result<(), String> {
    FileStore::new(paths.proxy.config_path.clone())
        .write_json(config)
        .map_err(to_string)
}

fn to_string(error: impl ToString) -> String {
    error.to_string()
}
