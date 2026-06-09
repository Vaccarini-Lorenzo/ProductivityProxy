use serde::Serialize;
use std::net::UdpSocket;

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInfo {
    pub local_host: String,
    pub lan_host: Option<String>,
}

pub fn detect_network_info() -> NetworkInfo {
    NetworkInfo {
        local_host: "127.0.0.1".to_string(),
        lan_host: detect_lan_ip(),
    }
}

fn detect_lan_ip() -> Option<String> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    Some(socket.local_addr().ok()?.ip().to_string())
}
