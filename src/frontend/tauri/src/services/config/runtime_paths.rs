use crate::models::proxy::settings::ProxyPaths;
use std::path::PathBuf;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RuntimePaths {
    pub proxy: ProxyPaths,
    pub custom_nodes_dir: PathBuf,
    pub system_proxy_snapshot_path: PathBuf,
}

impl RuntimePaths {
    pub fn new(app_data_dir: PathBuf, repo_root: PathBuf) -> Self {
        Self {
            proxy: ProxyPaths {
                addon_path: repo_root.join("src/proxy/addons/policy_proxy.py"),
                config_path: app_data_dir.join("config.json"),
                state_path: app_data_dir.join("state.json"),
                event_log_path: app_data_dir.join("events.jsonl"),
            },
            custom_nodes_dir: app_data_dir.join("custom_nodes"),
            system_proxy_snapshot_path: app_data_dir.join("system_proxy_snapshot.json"),
        }
    }
}
