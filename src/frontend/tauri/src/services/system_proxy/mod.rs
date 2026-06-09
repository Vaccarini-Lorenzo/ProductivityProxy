#[cfg(target_os = "macos")]
mod macos;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SystemProxySnapshot {
    pub services: Vec<ServiceProxySnapshot>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ServiceProxySnapshot {
    pub service: String,
    pub web: ProxySnapshot,
    pub secure_web: ProxySnapshot,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProxySnapshot {
    pub enabled: bool,
    pub server: String,
    pub port: String,
    pub auth_enabled: bool,
}

#[cfg(target_os = "macos")]
pub use macos::{
    active_network_services_from_text, capture_system_proxy_snapshot, enable_commands_for_service,
    enable_system_proxy, proxy_snapshot_from_text, restore_commands_for_service,
    restore_system_proxy,
};

#[cfg(not(target_os = "macos"))]
use crate::models::proxy::settings::ProxySettings;
#[cfg(not(target_os = "macos"))]
use std::io::{Error, ErrorKind, Result};

#[cfg(not(target_os = "macos"))]
pub fn capture_system_proxy_snapshot() -> Result<SystemProxySnapshot> {
    Ok(SystemProxySnapshot {
        services: Vec::new(),
    })
}

#[cfg(not(target_os = "macos"))]
pub fn enable_system_proxy(
    _settings: &ProxySettings,
    _snapshot: &SystemProxySnapshot,
) -> Result<()> {
    Err(Error::new(
        ErrorKind::Unsupported,
        "system proxy updates are only implemented on macOS",
    ))
}

#[cfg(not(target_os = "macos"))]
pub fn restore_system_proxy(_snapshot: &SystemProxySnapshot) -> Result<()> {
    Ok(())
}
