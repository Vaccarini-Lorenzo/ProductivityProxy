use crate::controller::commands::paths_for_app;
use crate::services::config::bootstrap::discover_repo_root;
use crate::services::config::validator::{self, ValidationReport};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

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

fn to_string(error: impl ToString) -> String {
    error.to_string()
}
