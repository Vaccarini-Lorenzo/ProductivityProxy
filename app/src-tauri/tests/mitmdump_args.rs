use serde_json::json;
use std::path::PathBuf;

use productivity_proxy_app::models::proxy::settings::{ProxyPaths, ProxySettings};
use productivity_proxy_app::services::proxy::mitmdump_args::build_mitmdump_args;

#[test]
fn builds_local_unauthenticated_args() {
    let settings = ProxySettings {
        port: 8080,
        allow_lan: false,
        auth_enabled: false,
        auth_username: "productive".into(),
        auth_password: "change-me".into(),
    };
    let paths = paths();

    let args = build_mitmdump_args(&settings, &paths);

    assert!(args.contains(&"--listen-host".into()));
    assert!(args.contains(&"127.0.0.1".into()));
    assert!(args.contains(&"--listen-port".into()));
    assert!(args.contains(&"8080".into()));
    assert!(!args.contains(&"--proxyauth".into()));
}

#[test]
fn builds_lan_authenticated_args() {
    let settings = ProxySettings {
        port: 9090,
        allow_lan: true,
        auth_enabled: true,
        auth_username: "user".into(),
        auth_password: "secret".into(),
    };
    let paths = paths();

    let args = build_mitmdump_args(&settings, &paths);

    assert!(args.contains(&"0.0.0.0".into()));
    assert!(args.contains(&"9090".into()));
    assert!(args.contains(&"--proxyauth".into()));
    assert!(args.contains(&"user:secret".into()));
}

#[test]
fn reads_settings_from_app_config_json() {
    let value = json!({
        "proxy": {
            "port": 9090,
            "allowLan": true,
            "authEnabled": true,
            "authUsername": "user",
            "authPassword": "secret"
        }
    });

    let settings = ProxySettings::from_app_config(&value).unwrap();

    assert_eq!(settings.port, 9090);
    assert!(settings.allow_lan);
    assert!(settings.auth_enabled);
    assert_eq!(settings.auth_username, "user");
}

fn paths() -> ProxyPaths {
    ProxyPaths {
        addon_path: PathBuf::from("proxy/addons/graph_proxy.py"),
        config_path: PathBuf::from("data/config.json"),
        state_path: PathBuf::from("data/state.json"),
        event_log_path: PathBuf::from("data/events.jsonl"),
    }
}
