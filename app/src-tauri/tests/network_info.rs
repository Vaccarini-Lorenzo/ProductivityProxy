use productivity_proxy_app::services::network::network_info::detect_network_info;

#[test]
fn returns_local_host() {
    let info = detect_network_info();

    assert_eq!(info.local_host, "127.0.0.1");
}
