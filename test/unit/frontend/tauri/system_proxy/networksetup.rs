#[cfg(target_os = "macos")]
use productivity_proxy_app::models::proxy::settings::ProxySettings;
#[cfg(target_os = "macos")]
use productivity_proxy_app::services::system_proxy::{
    active_network_services_from_text, disable_commands_for_service, enable_commands_for_service,
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
fn builds_disable_commands() {
    let commands = disable_commands_for_service("Wi-Fi");

    assert_eq!(commands[0], vec!["-setwebproxystate", "Wi-Fi", "off"]);
    assert_eq!(commands[1], vec!["-setsecurewebproxystate", "Wi-Fi", "off"]);
}
