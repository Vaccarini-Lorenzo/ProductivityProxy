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

You can run the proxy without the Tauri app via `./scripts/run_mitm.sh` — see [Development Guide](development.md#run-only-the-proxy) for the commands and the config-regeneration note.

This mode does not change system proxy settings: configure your browser/device manually to use the listener from `.env.example`.

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

The default modes — **Productivity** (blocks distractions) and **Chilling** (allows all traffic) — are detailed in [Conceptual Overview](architecture/0_conceptual/product.md#default-behavior).

## Custom nodes

Custom nodes are trusted Python files that can inspect or modify the mitmproxy flow. They run with local process permissions, so only use nodes you trust.

The technical execution contract is documented in [Python Proxy Engine](architecture/2_component/python-proxy-engine.md#semantic-model).

## Recovery if macOS proxy stays enabled

After a force-kill or crash, the app restores macOS proxy settings automatically the next time it launches. To clear them manually before then:

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

User-facing caveats:

- Desktop proxy start currently fails on non-macOS, because system proxy enable is unsupported there.
- HTTPS needs a manually installed and trusted mitmproxy CA.
- Custom Python nodes run unsandboxed (see [Custom nodes](#custom-nodes)).

After a crash, the macOS proxy is restored automatically on the next launch; the manual steps above are a fallback.

Full project status and remaining work live in [Roadmap and Readiness](roadmap/readiness.md).
