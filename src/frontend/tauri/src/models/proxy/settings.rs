use serde::Deserialize;
use serde_json::Value;
use std::path::PathBuf;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProxySettings {
    pub port: u16,
    pub allow_lan: bool,
    pub auth_enabled: bool,
    pub auth_username: String,
    pub auth_password: String,
    #[serde(default)]
    pub local_routing_mode: LocalRoutingMode,
    #[serde(default)]
    pub app_capture_targets: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum LocalRoutingMode {
    SystemWide,
    AppSpecific,
}

impl Default for LocalRoutingMode {
    fn default() -> Self {
        Self::SystemWide
    }
}

impl ProxySettings {
    pub fn from_app_config(value: &Value) -> serde_json::Result<Self> {
        serde_json::from_value(value["proxy"].clone())
    }

    pub fn uses_system_proxy(&self) -> bool {
        self.local_routing_mode == LocalRoutingMode::SystemWide
    }

    pub fn local_capture_spec(&self) -> Result<String, String> {
        let mut names: Vec<&str> = Vec::new();
        for target in &self.app_capture_targets {
            let target = target.trim();
            if target.is_empty() {
                continue;
            }
            if target.contains(',') || target.starts_with('!') {
                return Err(format!("invalid app capture target: {target}"));
            }
            if !names.contains(&target) {
                names.push(target);
            }
        }
        if names.is_empty() {
            return Err("select at least one app for App-specific routing".to_string());
        }
        Ok(names.join(","))
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProxyPaths {
    pub addon_path: PathBuf,
    pub config_path: PathBuf,
    pub state_path: PathBuf,
    pub event_log_path: PathBuf,
    pub mitmdump_log_path: PathBuf,
}
