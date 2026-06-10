# Documentation Index

This folder documents the current project, not only the original plan.

## Start here

- [Usage guide](usage.md) — how to run the app, use the proxy, and understand macOS system proxy behavior.
- [Development guide](development.md) — prerequisites, commands, tests, and common workflows.
- [Command contracts](architecture/4_data_layer/command-contracts.md) — React ↔ Tauri command request/response contracts.
- [Roadmap and readiness](roadmap/readiness.md) — what remains before comfortable daily use.

## Architecture views

- [Conceptual overview](architecture/0_conceptual/product.md) — product purpose, actors, capabilities, and non-goals.
- [Logical architecture](architecture/1_logical/system-overview.md) — black-box services and their relationships.
- [Tauri desktop backend](architecture/2_component/tauri-desktop-backend.md) — Rust shell, tray, process control, and system proxy handling.
- [React dashboard](architecture/2_component/react-dashboard.md) — current UI structure and frontend service layer.
- [React graph editor](architecture/2_component/react-graph-editor.md) — graph editor components and React Flow maintenance rules.
- [Python proxy engine](architecture/2_component/python-proxy-engine.md) — mitmproxy addon, policy evaluator, nodes, and custom nodes.
- [Local deployment runtime](architecture/3_deployment/local-desktop-runtime.md) — runtime topology, prerequisites, paths, packaging gaps.
- [Data layer](architecture/4_data_layer/config-state-events.md) — config, policies, state, events, and custom node storage.

## Assumptions

- [Current assumptions](assumptions/current-assumptions.md) — assumptions that shape the current implementation.

## Notes about documentation ownership

- `docs/decisions/` is reserved for human-written ADRs.
- `docs/unofficial/` is for scratch notes and should not be treated as source of truth.
