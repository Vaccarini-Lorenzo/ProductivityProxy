use serde_json::json;
use std::path::PathBuf;

use productivity_proxy_app::models::proxy::settings::{
    LocalRoutingMode, ProxyPaths, ProxySettings,
};
use productivity_proxy_app::services::proxy::mitmdump_args::build_mitmdump_args;

#[test]
fn builds_local_unauthenticated_args() {
    let settings = ProxySettings {
        port: 8080,
        allow_lan: false,
        auth_enabled: false,
        auth_username: "productive".into(),
        auth_password: "change-me".into(),
        local_routing_mode: LocalRoutingMode::SystemWide,
        app_capture_targets: vec![],
    };
    let paths = paths();

    let args = build_mitmdump_args(&settings, &paths, "1m").unwrap();

    assert!(args.contains(&"--quiet".into()));
    assert!(args.contains(&"stream_large_bodies=1m".into()));
    assert!(args.contains(&"--listen-host".into()));
    assert!(args.contains(&"127.0.0.1".into()));
    assert!(args.contains(&"--listen-port".into()));
    assert!(args.contains(&"8080".into()));
    assert!(!args.contains(&"http2=false".into()));
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
        local_routing_mode: LocalRoutingMode::SystemWide,
        app_capture_targets: vec![],
    };
    let paths = paths();

    let args = build_mitmdump_args(&settings, &paths, "1m").unwrap();

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
            "authPassword": "secret",
            "localRoutingMode": "appSpecific",
            "appCaptureTargets": ["Google Chrome", "Google Chrome Helper"]
        }
    });

    let settings = ProxySettings::from_app_config(&value).unwrap();

    assert_eq!(settings.port, 9090);
    assert!(settings.allow_lan);
    assert!(settings.auth_enabled);
    assert_eq!(settings.auth_username, "user");
    assert_eq!(settings.local_routing_mode, LocalRoutingMode::AppSpecific);
    assert_eq!(
        settings.app_capture_targets,
        vec!["Google Chrome".to_string(), "Google Chrome Helper".to_string()]
    );
}

#[test]
fn builds_app_specific_local_capture_args() {
    let settings = ProxySettings {
        port: 8080,
        allow_lan: true,
        auth_enabled: true,
        auth_username: "user".into(),
        auth_password: "secret".into(),
        local_routing_mode: LocalRoutingMode::AppSpecific,
        app_capture_targets: vec!["Google Chrome".into(), "Google Chrome Helper".into()],
    };
    let paths = paths();

    let args = build_mitmdump_args(&settings, &paths, "1m").unwrap();

    assert!(args.contains(&"--mode".into()));
    assert!(args.contains(&"local:Google Chrome,Google Chrome Helper".into()));
    assert!(args.contains(&"127.0.0.1".into()));
    assert!(!args.contains(&"0.0.0.0".into()));
    assert!(!args.contains(&"--proxyauth".into()));
}

#[test]
fn rejects_app_specific_without_apps() {
    let settings = ProxySettings {
        port: 8080,
        allow_lan: false,
        auth_enabled: false,
        auth_username: "productive".into(),
        auth_password: "change-me".into(),
        local_routing_mode: LocalRoutingMode::AppSpecific,
        app_capture_targets: vec![],
    };

    let error = build_mitmdump_args(&settings, &paths(), "1m").unwrap_err();

    assert_eq!(error, "select at least one app for App-specific routing");
}

#[test]
fn rejects_local_capture_names_that_change_the_spec() {
    let settings = ProxySettings {
        port: 8080,
        allow_lan: false,
        auth_enabled: false,
        auth_username: "productive".into(),
        auth_password: "change-me".into(),
        local_routing_mode: LocalRoutingMode::AppSpecific,
        app_capture_targets: vec!["curl,!wget".into()],
    };

    let error = build_mitmdump_args(&settings, &paths(), "1m").unwrap_err();

    assert_eq!(error, "invalid app capture target: curl,!wget");
}

fn paths() -> ProxyPaths {
    ProxyPaths {
        addon_path: PathBuf::from("src/proxy/addons/policy_proxy.py"),
        config_path: PathBuf::from("data/config.json"),
        state_path: PathBuf::from("data/state.json"),
        event_log_path: PathBuf::from("data/events.jsonl"),
        mitmdump_log_path: PathBuf::from("data/mitmdump.log"),
    }
}
