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
  system_proxy_snapshot.json
  custom_nodes/
```

Linux shape intended by Tauri:

```text
~/.config/productivity-proxy/
  config.json
  state.json
  events.jsonl
  system_proxy_snapshot.json
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

While the proxy runs, the system HTTP/HTTPS proxy points at `127.0.0.1:<port>`; stopping or quitting restores the previous settings. The snapshot/restore mechanics, the authenticated-proxy refusal, and the disabled/missing-endpoint behavior are documented in [Tauri Desktop Backend](../2_component/tauri-desktop-backend.md#macos-system-proxy-handling).

Runtime durability: the snapshot is persisted to `system_proxy_snapshot.json`, so a force-kill or crash is recovered automatically on the next app launch (the dashboard's `proxy_status` call, or a later start/stop, restores from the file). Manual `networksetup` recovery is only a fallback — see [Usage Guide](../../usage.md#recovery-if-macos-proxy-stays-enabled).

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
