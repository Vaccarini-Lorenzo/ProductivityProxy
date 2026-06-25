use crate::services::config::file_store::FileStore;
use crate::services::config::runtime_paths::RuntimePaths;
use serde_json::Value;
use std::env;
use std::path::{Path, PathBuf};

const BUILTIN_NODE_PATHS: &[(&str, &str)] = &[
    ("block-response", "src/proxy/defaults/nodes/block_response.py"),
    ("track-time", "src/proxy/defaults/nodes/track_time.py"),
    ("is-usage-over-limit", "src/proxy/defaults/nodes/is_usage_over_limit.py"),
];

/// Find source resources for the Python proxy addon.
pub fn discover_repo_root() -> Result<PathBuf, String> {
    if let Ok(value) = env::var("PRODUCTIVE_PROXY_SOURCE_ROOT") {
        return require_source_root(PathBuf::from(value));
    }

    if let Some(root) = find_source_root(env::current_dir().map_err(|error| error.to_string())?) {
        return Ok(root);
    }

    let exe = env::current_exe().map_err(|error| error.to_string())?;
    let Some(contents_dir) = exe.parent().and_then(|dir| dir.parent()) else {
        return Err("Cannot find repository root".to_string());
    };
    require_source_root(contents_dir.join("Resources"))
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
    normalize_config_paths(&mut config, &repo_root);
    FileStore::new(paths.proxy.config_path.clone())
        .write_json(&config)
        .map_err(|error| error.to_string())
}

fn find_source_root(mut dir: PathBuf) -> Option<PathBuf> {
    loop {
        if has_proxy_source(&dir) {
            return Some(dir);
        }
        if !dir.pop() {
            return None;
        }
    }
}

fn require_source_root(path: PathBuf) -> Result<PathBuf, String> {
    if has_proxy_source(&path) {
        Ok(path)
    } else {
        Err(format!("Cannot find Python proxy source at {}", path.display()))
    }
}

fn has_proxy_source(path: &Path) -> bool {
    path.join("src/proxy/addons/policy_proxy.py").exists()
}

pub fn normalize_config_paths(config: &mut Value, repo_root: &Path) {
    let Some(nodes) = config["customNodes"].as_array_mut() else {
        return;
    };
    for node in nodes {
        if let Some(path) = builtin_path(node["id"].as_str(), repo_root) {
            node["path"] = Value::String(path);
            continue;
        }
        let Some(path) = node["path"].as_str() else {
            continue;
        };
        if !Path::new(path).is_absolute() {
            node["path"] = Value::String(repo_root.join(path).to_string_lossy().to_string());
        }
    }
}

fn builtin_path(id: Option<&str>, repo_root: &Path) -> Option<String> {
    let (_, path) = BUILTIN_NODE_PATHS.iter().find(|(node_id, _)| Some(*node_id) == id)?;
    Some(repo_root.join(path).to_string_lossy().to_string())
}
