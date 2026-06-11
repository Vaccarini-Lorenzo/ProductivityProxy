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
}

impl ProxySettings {
    pub fn from_app_config(value: &Value) -> serde_json::Result<Self> {
        serde_json::from_value(value["proxy"].clone())
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
