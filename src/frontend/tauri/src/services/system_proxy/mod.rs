use crate::models::proxy::settings::ProxySettings;
use std::io::{Error, ErrorKind, Result};

#[cfg(target_os = "macos")]
use std::process::Command;

#[cfg(target_os = "macos")]
const LOCAL_PROXY_HOST: &str = "127.0.0.1";

#[cfg(target_os = "macos")]
pub fn enable_system_proxy(settings: &ProxySettings) -> Result<()> {
    let services = active_network_services()?;
    for service in services {
        for args in enable_commands_for_service(&service, settings) {
            run_networksetup(&args)?;
        }
    }
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn disable_system_proxy() -> Result<()> {
    let services = active_network_services()?;
    for service in services {
        for args in disable_commands_for_service(&service) {
            run_networksetup(&args)?;
        }
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn enable_system_proxy(_settings: &ProxySettings) -> Result<()> {
    Err(Error::new(
        ErrorKind::Unsupported,
        "system proxy updates are only implemented on macOS",
    ))
}

#[cfg(not(target_os = "macos"))]
pub fn disable_system_proxy() -> Result<()> {
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
pub fn enable_commands_for_service(service: &str, settings: &ProxySettings) -> Vec<Vec<String>> {
    let web = proxy_command("-setwebproxy", service, settings);
    let secure_web = proxy_command("-setsecurewebproxy", service, settings);
    vec![
        web,
        state_command("-setwebproxystate", service, "on"),
        secure_web,
        state_command("-setsecurewebproxystate", service, "on"),
    ]
}

#[cfg(target_os = "macos")]
pub fn disable_commands_for_service(service: &str) -> Vec<Vec<String>> {
    vec![
        state_command("-setwebproxystate", service, "off"),
        state_command("-setsecurewebproxystate", service, "off"),
    ]
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
fn proxy_command(command: &str, service: &str, settings: &ProxySettings) -> Vec<String> {
    let mut args = vec![
        command.to_string(),
        service.to_string(),
        LOCAL_PROXY_HOST.to_string(),
        settings.port.to_string(),
    ];

    if settings.auth_enabled {
        args.push("on".to_string());
        args.push(settings.auth_username.clone());
        args.push(settings.auth_password.clone());
    } else {
        args.push("off".to_string());
    }

    args
}

#[cfg(target_os = "macos")]
fn state_command(command: &str, service: &str, state: &str) -> Vec<String> {
    vec![command.to_string(), service.to_string(), state.to_string()]
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
