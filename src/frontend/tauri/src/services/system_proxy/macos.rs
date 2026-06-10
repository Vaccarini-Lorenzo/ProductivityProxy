use super::{ProxySnapshot, ServiceProxySnapshot, SystemProxySnapshot};
use crate::models::proxy::settings::ProxySettings;
use std::io::{Error, ErrorKind, Result};
use std::process::Command;

const LOCAL_PROXY_HOST: &str = "127.0.0.1";

pub fn capture_system_proxy_snapshot() -> Result<SystemProxySnapshot> {
    let services = active_network_services()?;
    let mut snapshots = Vec::new();

    for service in services {
        let web = sanitize_self_reference(get_proxy_snapshot(&service, "-getwebproxy")?);
        let secure_web = sanitize_self_reference(get_proxy_snapshot(&service, "-getsecurewebproxy")?);
        reject_authenticated_snapshot(&service, &web, &secure_web)?;
        snapshots.push(ServiceProxySnapshot {
            service,
            web,
            secure_web,
        });
    }

    Ok(SystemProxySnapshot { services: snapshots })
}

pub fn enable_system_proxy(settings: &ProxySettings, snapshot: &SystemProxySnapshot) -> Result<()> {
    for service in &snapshot.services {
        for args in enable_commands_for_service(&service.service, settings) {
            run_networksetup(&args)?;
        }
    }
    Ok(())
}

pub fn restore_system_proxy(snapshot: &SystemProxySnapshot) -> Result<()> {
    for service in &snapshot.services {
        for args in restore_commands_for_service(service) {
            run_networksetup(&args)?;
        }
    }
    Ok(())
}

pub fn active_network_services_from_text(text: &str) -> Vec<String> {
    text.lines()
        .skip(1)
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('*'))
        .map(ToString::to_string)
        .collect()
}

pub fn proxy_snapshot_from_text(text: &str) -> ProxySnapshot {
    ProxySnapshot {
        enabled: bool_value(line_value(text, "Enabled")),
        server: line_value(text, "Server").to_string(),
        port: line_value(text, "Port").to_string(),
        auth_enabled: bool_value(line_value(text, "Authenticated Proxy Enabled")),
    }
}

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

fn get_proxy_snapshot(service: &str, command: &str) -> Result<ProxySnapshot> {
    let output = Command::new("networksetup").args([command, service]).output()?;
    if !output.status.success() {
        return Err(command_error(command, &output));
    }
    Ok(proxy_snapshot_from_text(&String::from_utf8_lossy(&output.stdout)))
}

/// Never record our own proxy endpoint as the user's "original" setting.
/// If the system proxy already points at our local host, capturing it would let
/// a later restore re-enable the system proxy at a dead local port while the
/// proxy process is offline. Treat it as "no original proxy" instead.
pub fn sanitize_self_reference(proxy: ProxySnapshot) -> ProxySnapshot {
    if proxy.server.trim() == LOCAL_PROXY_HOST {
        return ProxySnapshot {
            enabled: false,
            server: String::new(),
            port: String::new(),
            auth_enabled: false,
        };
    }
    proxy
}

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

fn restore_proxy_commands(
    proxy_command_name: &str,
    state_command_name: &str,
    service: &str,
    proxy: &ProxySnapshot,
) -> Vec<Vec<String>> {
    if !proxy.enabled || proxy_endpoint_missing(proxy) {
        return vec![state_command(state_command_name, service, "off")];
    }
    vec![
        restore_proxy_command(proxy_command_name, service, proxy),
        state_command(state_command_name, service, "on"),
    ]
}

fn proxy_endpoint_missing(proxy: &ProxySnapshot) -> bool {
    proxy.server.trim().is_empty() || proxy.port.trim().is_empty() || proxy.port.trim() == "0"
}

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

fn restore_proxy_command(command: &str, service: &str, proxy: &ProxySnapshot) -> Vec<String> {
    vec![
        command.to_string(),
        service.to_string(),
        proxy.server.clone(),
        proxy.port.clone(),
        "off".to_string(),
    ]
}

fn state_command(command: &str, service: &str, state: &str) -> Vec<String> {
    vec![command.to_string(), service.to_string(), state.to_string()]
}

fn line_value<'a>(text: &'a str, key: &str) -> &'a str {
    let prefix = format!("{key}:");
    for line in text.lines() {
        if let Some(value) = line.trim().strip_prefix(&prefix) {
            return value.trim();
        }
    }
    ""
}

fn bool_value(value: &str) -> bool {
    matches!(
        value.to_ascii_lowercase().as_str(),
        "yes" | "on" | "1" | "true"
    )
}

fn run_networksetup(args: &[String]) -> Result<()> {
    let output = Command::new("networksetup").args(args).output()?;
    if output.status.success() {
        return Ok(());
    }
    Err(command_error(args.first().map(String::as_str).unwrap_or(""), &output))
}

fn command_error(command: &str, output: &std::process::Output) -> Error {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let message = if stderr.is_empty() { stdout } else { stderr };
    Error::new(
        ErrorKind::Other,
        format!("networksetup {command} failed: {message}"),
    )
}
