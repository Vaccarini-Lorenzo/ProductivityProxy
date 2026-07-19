# ProductivityProxy Conceptual Overview

## Purpose

ProductivityProxy is a local desktop tool for shaping a user's own web traffic. It runs a local proxy, routes device or system traffic through that proxy, and applies editable traffic policies.

The product is meant for personal productivity control, not enterprise network administration.

## Users and actors

- **Primary user**: the person running the desktop app and editing their own policies.
- **Local desktop app**: starts/stops the proxy and stores user configuration.
- **Proxy engine**: evaluates traffic policies for each request.
- **Client applications/devices**: browsers, apps, or LAN devices configured to use the local proxy.

## Core capabilities

- Start and stop a local web proxy.
- Switch between named policy modes.
- Add a cancellable friction delay when manually leaving selected modes.
- Activate modes once per daily local-time interval.
- Represent each policy as a directed flow of nodes and operators.
- Block, redirect, log, track, or notify through custom nodes.
- Run user-authored Python nodes inside the proxy process.
- Persist policy configuration, usage state, and event logs locally.
- On macOS, temporarily point system HTTP/HTTPS proxy settings at the local proxy and restore prior settings when stopping.

## Default behavior

The default configuration has two modes:

- **Productivity**
  - Blocks YouTube Shorts.
  - Tracks Reddit usage.
  - Blocks Reddit after 30 minutes of tracked daily use.
- **Chilling**
  - Has no active policies, so traffic is allowed.

## Non-goals for the current version

- Cloud sync.
- User accounts.
- Enterprise policy management.
- Sandboxed custom code.
- Bundled mitmproxy runtime.
- Linux system proxy automation.
- Production-grade crash recovery.

## Safety boundaries

The app is intentionally powerful. It can inspect and modify proxied traffic, and custom Python nodes run with local process permissions.

A user should only run custom nodes they trust.

## Current readiness

The core local proxy flow works for development and careful macOS trials; it is not yet a polished daily-use app. Status and remaining work live in [Roadmap and Readiness](../../roadmap/readiness.md).
