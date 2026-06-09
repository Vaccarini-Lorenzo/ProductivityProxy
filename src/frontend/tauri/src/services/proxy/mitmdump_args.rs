use crate::models::proxy::settings::{ProxyPaths, ProxySettings};

pub fn build_mitmdump_args(settings: &ProxySettings, paths: &ProxyPaths) -> Vec<String> {
    let listen_host = if settings.allow_lan { "0.0.0.0" } else { "127.0.0.1" };
    let mut args = vec![
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
    ];

    if settings.auth_enabled {
        args.push("--proxyauth".into());
        args.push(format!("{}:{}", settings.auth_username, settings.auth_password));
    }

    args
}
