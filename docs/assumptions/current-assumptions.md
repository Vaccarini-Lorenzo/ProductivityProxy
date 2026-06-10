# Current Assumptions

## macOS is the first supported system-proxy target

**Assumption:** macOS support is enough for the first usable system proxy automation.

**Why:** macOS exposes stable `networksetup` commands. Linux proxy settings vary by desktop environment.

**Impact if wrong:** Linux users cannot start through the current desktop flow because non-macOS system proxy enable returns unsupported.

## `mitmdump` is installed separately

**Assumption:** users/developers install mitmproxy themselves and `mitmdump` is on `PATH`.

**Why:** bundling mitmproxy and Python is packaging work outside the current feature set.

**Impact if wrong:** proxy start fails with a process spawn error.

## Users can install/trust the mitmproxy CA manually

**Assumption:** users can complete CA setup when they need HTTPS interception.

**Why:** CA installation differs by OS/browser/device and is not automated yet.

**Impact if wrong:** HTTPS traffic fails with certificate errors or does not behave as the user expects.

## Existing authenticated macOS system proxies are rare

**Assumption:** refusing to start when an authenticated system proxy already exists is acceptable.

**Why:** macOS does not expose the saved proxy password, so restoring it safely is not possible with the current approach.

**Impact if wrong:** users behind authenticated corporate proxies cannot use the system proxy automation.

## Custom Python nodes are trusted

**Assumption:** the user owns and trusts custom Python code.

**Why:** the product is local-first and intentionally allows powerful mitmproxy customization.

**Impact if wrong:** malicious or broken custom code can read files, make network calls, alter traffic, hang requests, or crash the proxy.

## Policy authors configure a loop guard

**Assumption:** `POLICY_MAX_STEPS` is set to a sane value.

**Why:** loops are allowed, but the evaluator stops after the configured step count.

**Impact if wrong:** valid long-running policies may stop early, or bad loops may waste request time.

## App process exits normally most of the time

**Assumption:** stop/quit paths usually run, so system proxy settings are restored.

**Why:** the snapshot is stored in memory, not durably.

**Impact if wrong:** force-kill or crash can leave macOS proxy settings pointed at the local proxy until manually fixed.

## Source-tree runtime is acceptable for now

**Assumption:** running from the repo is acceptable for development and early use.

**Why:** the backend discovers the repo root and launches the addon from `src/proxy/addons/policy_proxy.py`.

**Impact if wrong:** packaged app behavior will fail until addon/runtime bundling is redesigned.

## Config validation lives only in the backend

**Assumption:** the Python validator is the single source of truth, and the dashboard can rely on it for every save.

**Why:** `write_app_config` validates through `validate_cli.py` before writing, so a broken policy (for example a disconnected step) blocks autosave and is surfaced in the UI with a message and a hint.

**Impact if wrong:** a gap in the Python rules would let a config save that the proxy then refuses to load, and the dashboard would show “saved” for something inert.
