# ProductiveProxy mitmproxy policies

This repo contains a small `mitmproxy` addon for local explicit-proxy use on macOS.

## Policies currently implemented

1. **Block YouTube Shorts**
   - Blocks requests to configured YouTube hosts when the path matches configured Shorts markers.
   - Default example markers: `/shorts`, `/youtubei/v1/reel`, `/api/stats/shorts`.

2. **Track Reddit time**
   - Tracks Reddit activity by measuring gaps between Reddit requests.
   - If two Reddit requests are less than `PRODUCTIVE_PROXY_REDDIT_IDLE_SECONDS` apart, the gap is counted as active time.
   - This is an approximation. It does not know true foreground/app focus time.

## Install

```bash
brew install mitmproxy
```

or:

```bash
python3 -m pip install -r requirements.txt
```

## Configure

Copy the example env file:

```bash
cp .env.example .env
```

Then load it in your shell:

```bash
set -a
source .env
set +a
```

All runtime settings are required environment variables. The addon fails fast if one is missing.

## Run

```bash
./scripts/run_mitm.sh
```

Then configure your client device/browser to use:

```text
HTTP proxy:  <Mac IP>:8080
HTTPS proxy: <Mac IP>:8080
```

For local Mac-only testing, use:

```text
127.0.0.1:8080
```

## Install the mitmproxy CA

With the proxy configured, open this on the client device:

```text
http://mitm.it
```

Install and trust the mitmproxy CA certificate.

## Output files

Configured by `.env.example`:

```text
./data/productive_proxy_state.json
./data/productive_proxy_events.jsonl
```

`productive_proxy_state.json` contains Reddit totals.

`productive_proxy_events.jsonl` contains policy events, including blocked Shorts requests and Reddit activity events.

## Notes

- Android apps may not trust user-installed CAs.
- Some apps use certificate pinning and will not work through TLS interception.
- YouTube app traffic may not be fully controllable if the app rejects the mitmproxy CA.
- The Reddit timer is request-based, not a true screen-time tracker.
