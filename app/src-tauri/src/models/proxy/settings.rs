use std::path::PathBuf;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProxySettings {
    pub port: u16,
    pub allow_lan: bool,
    pub auth_enabled: bool,
    pub auth_username: String,
    pub auth_password: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProxyPaths {
    pub addon_path: PathBuf,
    pub config_path: PathBuf,
    pub state_path: PathBuf,
    pub event_log_path: PathBuf,
}
