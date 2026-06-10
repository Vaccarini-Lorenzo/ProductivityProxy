use super::SystemProxySnapshot;
use std::fs;
use std::io::{ErrorKind, Result};
use std::path::Path;

pub fn save_system_proxy_snapshot(path: &Path, snapshot: &SystemProxySnapshot) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let text = serde_json::to_string_pretty(snapshot)?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("system_proxy_snapshot.json");
    let tmp = path.with_file_name(format!("{file_name}.tmp"));
    fs::write(&tmp, text)?;
    fs::rename(&tmp, path)
}

pub fn load_system_proxy_snapshot(path: &Path) -> Result<Option<SystemProxySnapshot>> {
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).map(Some).map_err(Into::into),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

pub fn remove_system_proxy_snapshot(path: &Path) -> Result<()> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}
