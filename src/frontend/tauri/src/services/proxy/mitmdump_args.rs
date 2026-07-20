use crate::models::proxy::settings::{LocalRoutingMode, ProxyPaths, ProxySettings};

pub fn build_mitmdump_args(
    settings: &ProxySettings,
    paths: &ProxyPaths,
    stream_large_bodies: &str,
) -> Result<Vec<String>, String> {
    let listen_host = if settings.uses_system_proxy() && settings.allow_lan {
        "0.0.0.0"
    } else {
        "127.0.0.1"
    };
    let mut args = Vec::new();

    if settings.local_routing_mode == LocalRoutingMode::AppSpecific {
        args.push("--mode".into());
        args.push(format!("local:{}", settings.local_capture_spec()?));
    }

    args.extend([
        "--quiet".into(),
        "--listen-host".into(),
        listen_host.into(),
        "--listen-port".into(),
        settings.port.to_string(),
        "-s".into(),
        paths.addon_path.to_string_lossy().to_string(),
        "--set".into(),
        format!("productive_config_path={}", paths.config_path.to_string_lossy()),
        "--set".into(),
        format!("productive_state_path={}", paths.state_path.to_string_lossy()),
        "--set".into(),
        format!("productive_event_log_path={}", paths.event_log_path.to_string_lossy()),
        "--set".into(),
        format!("stream_large_bodies={stream_large_bodies}"),
    ]);

    if settings.auth_enabled && settings.uses_system_proxy() {
        args.push("--proxyauth".into());
        args.push(format!("{}:{}", settings.auth_username, settings.auth_password));
    }

    Ok(args)
}
