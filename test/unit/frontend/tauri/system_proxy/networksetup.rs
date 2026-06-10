#[cfg(target_os = "macos")]
use productivity_proxy_app::models::proxy::settings::ProxySettings;
#[cfg(target_os = "macos")]
use productivity_proxy_app::services::system_proxy::{
    active_network_services_from_text, enable_commands_for_service, load_system_proxy_snapshot,
    proxy_snapshot_from_text, remove_system_proxy_snapshot, restore_commands_for_service,
    sanitize_self_reference, save_system_proxy_snapshot, ProxySnapshot, ServiceProxySnapshot,
    SystemProxySnapshot,
};

#[cfg(target_os = "macos")]
#[test]
fn parses_enabled_network_services() {
    let text = "An asterisk (*) denotes that a network service is disabled.\nWi-Fi\n*Thunderbolt Bridge\nUSB 10/100/1000 LAN\n";

    let services = active_network_services_from_text(text);

    assert_eq!(services, vec!["Wi-Fi", "USB 10/100/1000 LAN"]);
}

#[cfg(target_os = "macos")]
#[test]
fn parses_proxy_snapshot() {
    let text = "Enabled: Yes\nServer: proxy.example\nPort: 3128\nAuthenticated Proxy Enabled: 0\n";

    let snapshot = proxy_snapshot_from_text(text);

    assert!(snapshot.enabled);
    assert_eq!(snapshot.server, "proxy.example");
    assert_eq!(snapshot.port, "3128");
    assert!(!snapshot.auth_enabled);
}

#[cfg(target_os = "macos")]
#[test]
fn sanitize_self_reference_clears_our_own_local_endpoint() {
    // A snapshot pointing at our own local proxy must never be recorded as the
    // user's original setting, or a later restore would re-enable the system
    // proxy at a dead local port while the app is offline.
    let ours = ProxySnapshot {
        enabled: true,
        server: "127.0.0.1".into(),
        port: "8080".into(),
        auth_enabled: false,
    };

    let sanitized = sanitize_self_reference(ours);

    assert!(!sanitized.enabled);
    assert_eq!(sanitized.server, "");
    assert_eq!(sanitized.port, "");
}

#[cfg(target_os = "macos")]
#[test]
fn sanitize_self_reference_keeps_a_real_external_proxy() {
    let real = ProxySnapshot {
        enabled: true,
        server: "proxy.example".into(),
        port: "3128".into(),
        auth_enabled: false,
    };

    let kept = sanitize_self_reference(real.clone());

    assert_eq!(kept, real);
}

#[cfg(target_os = "macos")]
#[test]
fn builds_enable_commands_for_http_and_https() {
    let settings = ProxySettings {
        port: 8080,
        allow_lan: false,
        auth_enabled: false,
        auth_username: "productive".into(),
        auth_password: "change-me".into(),
    };

    let commands = enable_commands_for_service("Wi-Fi", &settings);

    assert_eq!(commands[0], vec!["-setwebproxy", "Wi-Fi", "127.0.0.1", "8080", "off"]);
    assert_eq!(commands[1], vec!["-setwebproxystate", "Wi-Fi", "on"]);
    assert_eq!(commands[2], vec!["-setsecurewebproxy", "Wi-Fi", "127.0.0.1", "8080", "off"]);
    assert_eq!(commands[3], vec!["-setsecurewebproxystate", "Wi-Fi", "on"]);
}

#[cfg(target_os = "macos")]
#[test]
fn includes_auth_when_enabled() {
    let settings = ProxySettings {
        port: 9090,
        allow_lan: true,
        auth_enabled: true,
        auth_username: "user".into(),
        auth_password: "secret".into(),
    };

    let commands = enable_commands_for_service("Wi-Fi", &settings);

    assert_eq!(
        commands[0],
        vec!["-setwebproxy", "Wi-Fi", "127.0.0.1", "9090", "on", "user", "secret"],
    );
}

#[cfg(target_os = "macos")]
#[test]
fn builds_restore_commands_from_snapshot() {
    let service = ServiceProxySnapshot {
        service: "Wi-Fi".into(),
        web: ProxySnapshot {
            enabled: true,
            server: "proxy.example".into(),
            port: "3128".into(),
            auth_enabled: false,
        },
        secure_web: ProxySnapshot {
            enabled: false,
            server: "secure.example".into(),
            port: "4443".into(),
            auth_enabled: false,
        },
    };

    let commands = restore_commands_for_service(&service);

    assert_eq!(commands[0], vec!["-setwebproxy", "Wi-Fi", "proxy.example", "3128", "off"]);
    assert_eq!(commands[1], vec!["-setwebproxystate", "Wi-Fi", "on"]);
    assert_eq!(commands[2], vec!["-setsecurewebproxystate", "Wi-Fi", "off"]);
}

#[cfg(target_os = "macos")]
#[test]
fn saves_loads_and_removes_system_proxy_snapshot() {
    let path = std::env::temp_dir().join(format!(
        "productivity-proxy-system-proxy-{}.json",
        std::process::id()
    ));
    let snapshot = SystemProxySnapshot {
        services: vec![ServiceProxySnapshot {
            service: "Wi-Fi".into(),
            web: ProxySnapshot {
                enabled: true,
                server: "proxy.example".into(),
                port: "3128".into(),
                auth_enabled: false,
            },
            secure_web: ProxySnapshot {
                enabled: false,
                server: "".into(),
                port: "0".into(),
                auth_enabled: false,
            },
        }],
    };

    save_system_proxy_snapshot(&path, &snapshot).unwrap();
    assert_eq!(load_system_proxy_snapshot(&path).unwrap(), Some(snapshot));
    remove_system_proxy_snapshot(&path).unwrap();
    assert_eq!(load_system_proxy_snapshot(&path).unwrap(), None);
}

#[cfg(target_os = "macos")]
#[test]
fn restores_disabled_port_zero_snapshot_without_setting_proxy_endpoint() {
    let service = ServiceProxySnapshot {
        service: "Wi-Fi".into(),
        web: ProxySnapshot {
            enabled: false,
            server: "".into(),
            port: "0".into(),
            auth_enabled: false,
        },
        secure_web: ProxySnapshot {
            enabled: false,
            server: "127.0.0.1".into(),
            port: "8080".into(),
            auth_enabled: false,
        },
    };

    let commands = restore_commands_for_service(&service);

    assert_eq!(commands[0], vec!["-setwebproxystate", "Wi-Fi", "off"]);
    assert_eq!(commands[1], vec!["-setsecurewebproxystate", "Wi-Fi", "off"]);
}
