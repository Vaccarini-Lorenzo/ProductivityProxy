use crate::models::proxy::settings::ProxySettings;
use std::io::{Error, ErrorKind, Result};

#[cfg(target_os = "macos")]
use std::process::Command;

#[cfg(target_os = "macos")]
const LOCAL_PROXY_HOST: &str = "127.0.0.1";

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
pub fn capture_system_proxy_snapshot() -> Result<SystemProxySnapshot> {
    let services = active_network_services()?;
    let mut snapshots = Vec::new();

    for service in services {
        let web = get_proxy_snapshot(&service, "-getwebproxy")?;
        let secure_web = get_proxy_snapshot(&service, "-getsecurewebproxy")?;
        reject_authenticated_snapshot(&service, &web, &secure_web)?;
        snapshots.push(ServiceProxySnapshot {
            service,
            web,
            secure_web,
        });
    }

    Ok(SystemProxySnapshot { services: snapshots })
}

#[cfg(target_os = "macos")]
pub fn enable_system_proxy(settings: &ProxySettings, snapshot: &SystemProxySnapshot) -> Result<()> {
    for service in &snapshot.services {
        for args in enable_commands_for_service(&service.service, settings) {
            run_networksetup(&args)?;
        }
    }
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn restore_system_proxy(snapshot: &SystemProxySnapshot) -> Result<()> {
    for service in &snapshot.services {
        for args in restore_commands_for_service(service) {
            run_networksetup(&args)?;
        }
    }
    Ok(())
}

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

#[cfg(target_os = "macos")]
pub fn active_network_services_from_text(text: &str) -> Vec<String> {
    text.lines()
        .skip(1)
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('*'))
        .map(ToString::to_string)
        .collect()
}

#[cfg(target_os = "macos")]
pub fn proxy_snapshot_from_text(text: &str) -> ProxySnapshot {
    ProxySnapshot {
        enabled: bool_value(line_value(text, "Enabled")),
        server: line_value(text, "Server").to_string(),
        port: line_value(text, "Port").to_string(),
        auth_enabled: bool_value(line_value(text, "Authenticated Proxy Enabled")),
    }
}

#[cfg(target_os = "macos")]
pub fn enable_commands_for_service(service: &str, settings: &ProxySettings) -> Vec<Vec<String>> {
    let port = settings.port.to_string();
    vec![
        proxy_command(
            "-setwebproxy",
            service,
            LOCAL_PROXY_HOST,
            &port,
            settings.auth_enabled,
            settings,
        ),
        state_command("-setwebproxystate", service, "on"),
        proxy_command(
            "-setsecurewebproxy",
            service,
            LOCAL_PROXY_HOST,
            &port,
            settings.auth_enabled,
            settings,
        ),
        state_command("-setsecurewebproxystate", service, "on"),
    ]
}

#[cfg(target_os = "macos")]
pub fn restore_commands_for_service(service: &ServiceProxySnapshot) -> Vec<Vec<String>> {
    let mut commands = Vec::new();
    commands.extend(restore_proxy_commands(
        "-setwebproxy",
        "-setwebproxystate",
        &service.service,
        &service.web,
    ));
    commands.extend(restore_proxy_commands(
        "-setsecurewebproxy",
        "-setsecurewebproxystate",
        &service.service,
        &service.secure_web,
    ));
    commands
}

#[cfg(target_os = "macos")]
fn active_network_services() -> Result<Vec<String>> {
    let output = Command::new("networksetup")
        .arg("-listallnetworkservices")
        .output()?;

    if !output.status.success() {
        return Err(command_error("-listallnetworkservices", &output));
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let services = active_network_services_from_text(&text);
    if services.is_empty() {
        return Err(Error::new(ErrorKind::NotFound, "no enabled network services found"));
    }
    Ok(services)
}

#[cfg(target_os = "macos")]
fn get_proxy_snapshot(service: &str, command: &str) -> Result<ProxySnapshot> {
    let output = Command::new("networksetup").args([command, service]).output()?;
    if !output.status.success() {
        return Err(command_error(command, &output));
    }
    Ok(proxy_snapshot_from_text(&String::from_utf8_lossy(&output.stdout)))
}

#[cfg(target_os = "macos")]
fn reject_authenticated_snapshot(
    service: &str,
    web: &ProxySnapshot,
    secure_web: &ProxySnapshot,
) -> Result<()> {
    if web.auth_enabled || secure_web.auth_enabled {
        return Err(Error::new(
            ErrorKind::Unsupported,
            format!("cannot safely restore existing authenticated system proxy for {service}"),
        ));
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn restore_proxy_commands(
    proxy_command_name: &str,
    state_command_name: &str,
    service: &str,
    proxy: &ProxySnapshot,
) -> Vec<Vec<String>> {
    let state = if proxy.enabled { "on" } else { "off" };
    if proxy.server.is_empty() || proxy.port.is_empty() {
        return vec![state_command(state_command_name, service, state)];
    }
    vec![
        restore_proxy_command(proxy_command_name, service, proxy),
        state_command(state_command_name, service, state),
    ]
}

#[cfg(target_os = "macos")]
fn proxy_command(
    command: &str,
    service: &str,
    host: &str,
    port: &str,
    auth_enabled: bool,
    settings: &ProxySettings,
) -> Vec<String> {
    let mut args = vec![
        command.to_string(),
        service.to_string(),
        host.to_string(),
        port.to_string(),
    ];

    if auth_enabled {
        args.push("on".to_string());
        args.push(settings.auth_username.clone());
        args.push(settings.auth_password.clone());
    } else {
        args.push("off".to_string());
    }

    args
}

#[cfg(target_os = "macos")]
fn restore_proxy_command(command: &str, service: &str, proxy: &ProxySnapshot) -> Vec<String> {
    vec![
        command.to_string(),
        service.to_string(),
        proxy.server.clone(),
        proxy.port.clone(),
        "off".to_string(),
    ]
}

#[cfg(target_os = "macos")]
fn state_command(command: &str, service: &str, state: &str) -> Vec<String> {
    vec![command.to_string(), service.to_string(), state.to_string()]
}

#[cfg(target_os = "macos")]
fn line_value<'a>(text: &'a str, key: &str) -> &'a str {
    let prefix = format!("{key}:");
    for line in text.lines() {
        if let Some(value) = line.trim().strip_prefix(&prefix) {
            return value.trim();
        }
    }
    ""
}

#[cfg(target_os = "macos")]
fn bool_value(value: &str) -> bool {
    matches!(
        value.to_ascii_lowercase().as_str(),
        "yes" | "on" | "1" | "true"
    )
}

#[cfg(target_os = "macos")]
fn run_networksetup(args: &[String]) -> Result<()> {
    let output = Command::new("networksetup").args(args).output()?;
    if output.status.success() {
        return Ok(());
    }
    Err(command_error(args.first().map(String::as_str).unwrap_or(""), &output))
}

#[cfg(target_os = "macos")]
fn command_error(command: &str, output: &std::process::Output) -> Error {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let message = if stderr.is_empty() { stdout } else { stderr };
    Error::new(
        ErrorKind::Other,
        format!("networksetup {command} failed: {message}"),
    )
}
