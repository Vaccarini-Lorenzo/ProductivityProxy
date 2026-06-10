# Usage Guide

## What the app does

ProductivityProxy starts a local `mitmdump` proxy and applies the active mode policies to proxied traffic.

On macOS, starting the proxy also points system HTTP/HTTPS proxy settings at the local proxy. Stopping restores the previous proxy state.

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
export POLICY_MAX_STEPS="1000"
cd src/frontend/react
npm run tauri dev
```

The window starts hidden. Open it from the tray/menu-bar icon.

## Start the proxy from the app

1. Open **Settings**.
2. Choose port, LAN, and authentication options.
3. Click **Start proxy**.

The backend saves the current config, starts the local proxy, and manages macOS proxy settings. If setup fails, it stops the local proxy and rolls back the captured proxy state.

## Stop the proxy

Click **Stop proxy** or quit from the tray/menu-bar.

The backend restores captured macOS proxy state and stops `mitmdump`.

## Manual proxy mode

You can run the proxy without the Tauri app:

```bash
set -a
source .env.example
set +a
./scripts/run_mitm.sh
```

This does not change system proxy settings. Configure your browser/device manually to use the listener from `.env.example`.

The helper creates `PRODUCTIVE_PROXY_CONFIG_PATH` from the current default config when that file does not exist. If you have an old materialized config, delete it before running the helper.

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

A mode contains ordered policy IDs. Policies are edited on the Policy page and ordered inside a mode on the Modes page.

Default modes:

- **Productivity**: blocks YouTube Shorts and blocks Reddit after 30 minutes of daily tracked use.
- **Chilling**: has no active policies, so traffic is allowed.

## Custom nodes

Custom nodes are trusted Python files that can inspect or modify the mitmproxy flow. They run with local process permissions, so only use nodes you trust.

The technical execution contract is documented in [Python Proxy Engine](architecture/2_component/python-proxy-engine.md#semantic-model).

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
