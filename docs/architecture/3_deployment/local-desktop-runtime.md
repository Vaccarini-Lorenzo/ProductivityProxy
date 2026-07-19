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

The desktop mode runtime requires `PRODUCTIVE_PROXY_FRICTION_SECONDS`, a positive integer. The supplied value is `1200` seconds (20 minutes).

The manual proxy helper also requires the `PRODUCTIVE_PROXY_*` engine variables shown in `.env.example`. The desktop app pre-checks only `POLICY_MAX_STEPS`, but the `mitmdump` it launches runs the Python engine, so those same engine variables must also be present in the environment that starts the desktop app — otherwise the engine raises at runtime. See [Development Guide](../../development.md#environment).

Command examples live in [Development Guide](../../development.md) and [Usage Guide](../../usage.md).

## App data paths

The backend uses Tauri's app data directory.

macOS shape:

```text
~/Library/Application Support/ProductivityProxy/
  config.json
  state.json
  events.jsonl
  mitmdump.log
  system_proxy_snapshot.json
  custom_nodes/
```

Linux shape intended by Tauri:

```text
~/.config/productivity-proxy/
  config.json
  state.json
  events.jsonl
  mitmdump.log
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

Runtime durability: the snapshot is persisted to `system_proxy_snapshot.json`, so a force-kill or crash is recovered automatically on the next app launch ([restore mechanics](../2_component/tauri-desktop-backend.md#durable-restore-across-crashes)). Manual `networksetup` recovery is only a fallback — see [Usage Guide](../../usage.md#recovery-if-macos-proxy-stays-enabled).

## Packaging status

The local macOS build can produce a `.app` and `.dmg`. The bundle includes the Python proxy source under app resources, so it no longer needs to discover the repository when launched from Finder. Built-in default node paths are rebased to the current source/resource root at app read/start time and again inside the Python runtime; user-created custom nodes still live in the per-user app data directory.

Still not self-contained:

- mitmproxy/`mitmdump` and the Python runtime are expected on the host,
- the required engine environment is loaded from `~/Library/Application Support/com.productivityproxy.desktop/.env` or the parent process environment,
- installer signing and notarization are not configured.

The remaining packaging work — bundling mitmproxy/Python, installer signing/notarization, and per-desktop-environment Linux validation — is tracked in [Roadmap and Readiness](../../roadmap/readiness.md#not-ready-for-broad-daily-use-yet).

## Scaling model

This is a single-user local app. Scaling is about local robustness, not horizontal infrastructure.

The main bottlenecks are:

- mitmproxy request throughput,
- custom Python node latency,
- policy loops or slow custom code,
- local disk writes for state/events.
