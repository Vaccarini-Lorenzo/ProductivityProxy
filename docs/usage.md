# Usage Guide

## What the app does

ProductivityProxy starts a local `mitmdump` proxy and applies the active mode policies to proxied traffic.

On macOS, starting the proxy also points system HTTP/HTTPS proxy settings at the local proxy. Stopping restores the previous proxy settings.

## Before running

Install mitmproxy:

```bash
brew install mitmproxy
```

For HTTPS traffic, install and trust the mitmproxy CA certificate for the client you want to proxy.

Mitmproxy's CA is usually available after first run at:

```text
~/.mitmproxy/mitmproxy-ca-cert.pem
```

## Start the desktop app

```bash
cd src/frontend/react
npm run tauri dev
```

The window starts hidden. Open it from the tray/menu-bar icon.

## Start the proxy from the app

1. Open **Settings**.
2. Choose port, LAN, and authentication options.
3. Click **Start proxy**.

The backend will:

1. save the current config,
2. snapshot macOS proxy settings,
3. start `mitmdump`,
4. point macOS HTTP/HTTPS proxy settings to `127.0.0.1:<port>`.

If setup fails, it stops `mitmdump` and restores the proxy snapshot.

## Stop the proxy

Click **Stop proxy** or quit from the tray/menu-bar.

The backend restores the captured macOS proxy settings and stops `mitmdump`.

## Manual proxy mode

You can run the proxy without the Tauri app:

```bash
set -a
source .env.example
set +a
./scripts/run_mitm.sh
```

This does not change system proxy settings. Configure your browser/device manually to use the listener from `.env.example`.

## LAN devices

If `allowLan` is enabled, `mitmdump` listens on `0.0.0.0`.

Configure another device to use:

```text
Host: <desktop LAN IP>
Port: <configured proxy port>
```

Notes:

- The desktop firewall must allow incoming connections.
- For HTTPS, the LAN device must trust the mitmproxy CA.
- Proxy authentication may not be supported by every client app.

## Modes and policies

Policies live in named modes. Only the active mode is evaluated.

A mode contains ordered policies. Each policy starts at one `start` node and follows edges. Nodes do work, operators route.

Default modes:

- `Productivity`: blocks YouTube Shorts and blocks Reddit after 30 minutes of daily tracked use.
- `Chilling`: allows traffic.

## Custom nodes

Custom nodes are Python files with this entrypoint:

```python
def run(input, context, params):
    return input
```

They can inspect and modify the mitmproxy flow. They run with local process permissions. Only use nodes you trust.

Operators are built-in routing steps: `if` and `switch`.

## Recovery if macOS proxy stays enabled

If the app is force-killed or crashes, macOS proxy settings may remain enabled.

List network services:

```bash
networksetup -listallnetworkservices
```

Disable proxy state for your active service:

```bash
networksetup -setwebproxystate "Wi-Fi" off
networksetup -setsecurewebproxystate "Wi-Fi" off
```

Replace `Wi-Fi` with your active service name.

## Current limitations

- Linux system proxy automation is not implemented.
- Desktop proxy start currently fails on non-macOS because system proxy enable is unsupported.
- mitmproxy is not bundled.
- HTTPS CA setup is manual.
- App crash recovery for system proxy settings is manual.
- Custom Python nodes are unsandboxed.
- Policy loops are stopped by required `POLICY_MAX_STEPS`.
