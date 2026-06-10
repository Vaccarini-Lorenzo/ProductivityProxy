use crate::services::config::file_store::FileStore;
use crate::services::config::runtime_paths::RuntimePaths;
use serde_json::Value;
use std::path::{Path, PathBuf};

/// Walk up from the working directory until the Python proxy addon is found.
pub fn discover_repo_root() -> Result<PathBuf, String> {
    let mut dir = std::env::current_dir().map_err(|error| error.to_string())?;
    loop {
        if dir.join("src/proxy/addons/policy_proxy.py").exists() {
            return Ok(dir);
        }
        if !dir.pop() {
            return Err("Cannot find repository root".to_string());
        }
    }
}

/// On first run, materialize the bundled default config into the app data dir.
pub fn ensure_config_exists(paths: &RuntimePaths) -> Result<(), String> {
    if paths.proxy.config_path.exists() {
        return Ok(());
    }
    let repo_root = discover_repo_root()?;
    let default_path = repo_root.join("src/proxy/defaults/default_config.json");
    let mut config = FileStore::new(default_path)
        .read_json()
        .map_err(|error| error.to_string())?;
    materialize_custom_node_paths(&mut config, &repo_root);
    FileStore::new(paths.proxy.config_path.clone())
        .write_json(&config)
        .map_err(|error| error.to_string())
}

fn materialize_custom_node_paths(config: &mut Value, repo_root: &Path) {
    let Some(nodes) = config["customNodes"].as_array_mut() else {
        return;
    };
    for node in nodes {
        let Some(path) = node["path"].as_str() else {
            continue;
        };
        if Path::new(path).is_absolute() {
            continue;
        }
        node["path"] = Value::String(repo_root.join(path).to_string_lossy().to_string());
    }
}
