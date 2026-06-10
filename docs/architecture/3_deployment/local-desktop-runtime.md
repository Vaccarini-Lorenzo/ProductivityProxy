# Local Desktop Runtime

## Current deployment model

ProductivityProxy currently runs as a local development desktop app.

Runtime resources:

```text
Tauri app process
  ├─ embedded React dashboard
  ├─ Rust command backend
  ├─ tray/menu-bar icon
  └─ child process: mitmdump
       └─ Python ProductivityProxy addon
```

There are no servers, queues, cloud databases, or remote services.

## Prerequisites

Required for local development/use:

- Python 3,
- `mitmproxy` / `mitmdump`,
- Rust toolchain,
- Node.js and npm,
- Tauri dependencies for the host OS.

Python package requirement:

```text
mitmproxy>=11.0.0
```

The desktop app currently expects `mitmdump` to be available on `PATH`.

## Required startup environment

Desktop proxy startup and the manual proxy helper both require `POLICY_MAX_STEPS` in the environment. The value must be a positive integer and is used by the Python evaluator as the loop guard.

The manual proxy helper also requires the `PRODUCTIVE_PROXY_*` variables shown in `.env.example`.

Command examples live in [Development Guide](../../development.md) and [Usage Guide](../../usage.md).

## App data paths

The backend uses Tauri's app data directory.

macOS shape:

```text
~/Library/Application Support/ProductivityProxy/
  config.json
  state.json
  events.jsonl
  custom_nodes/
```

Linux shape intended by Tauri:

```text
~/.config/productivity-proxy/
  config.json
  state.json
  events.jsonl
  custom_nodes/
```

Linux system proxy automation is not implemented, so the full desktop start flow currently fails on Linux.

## Local network behavior

Proxy listen host comes from the `allowLan` setting:

- `false`: listen on `127.0.0.1`, only local clients.
- `true`: listen on `0.0.0.0`, LAN clients can connect if firewall/network allow it.

The macOS system proxy always points to `127.0.0.1:<port>` because it is configuring the same machine.

LAN devices need manual proxy configuration using the desktop machine's LAN IP and proxy port.

## HTTPS interception

For HTTPS traffic, mitmproxy needs its CA certificate installed and trusted by the client.

Without the CA:

- HTTP traffic can still work,
- HTTPS clients will show certificate errors or fail requests,
- blocking/redirecting HTTPS traffic may be inconsistent from the user's point of view.

The app does not yet automate CA installation.

## macOS system proxy lifecycle

When starting, the app snapshots enabled network services' HTTP and HTTPS proxy settings, then points them to the local proxy.

When stopping or quitting through the tray, it restores the snapshot.

Failure modes to know:

- If the app process is force-killed or crashes, Rust `Drop` may not run and macOS proxy settings may remain pointed at the local proxy.
- If restore fails, the backend keeps the snapshot in memory and retries on a later stop/status path.
- If the machine had an authenticated system proxy before start, the app refuses to start because macOS does not expose the saved password for safe restore.
- If the previous proxy was disabled or missing endpoint data, restore turns the proxy state off but may not restore old server/port fields.

Manual recovery on macOS:

```bash
networksetup -setwebproxystate "Wi-Fi" off
networksetup -setsecurewebproxystate "Wi-Fi" off
```

Replace `Wi-Fi` with the active network service name.

## Packaging status

Packaging is not finished.

Known gaps:

- mitmproxy is not bundled,
- Python runtime/addon packaging is unresolved,
- repo-root discovery depends on source files existing on disk,
- bundle config has `active: false`,
- installer signing/notarization is not configured,
- Linux tray and proxy behavior need validation per desktop environment.

## Scaling model

This is a single-user local app. Scaling is about local robustness, not horizontal infrastructure.

The main bottlenecks are:

- mitmproxy request throughput,
- custom Python node latency,
- policy loops or slow custom code,
- local disk writes for state/events.
