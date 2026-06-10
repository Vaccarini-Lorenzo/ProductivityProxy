// Dev-only seed used to record the README demo media. Not shipped, not committed.
// It gives the dashboard a realistic, wired complex policy (Switch + If) and a
// couple of custom-node sources so the graph and editors look real on camera.
import type { AppConfig } from "../models/config/types";

const START_TRIGGER = `def triggered_by(request: Request) -> bool:
    host = request.host.lower().strip(".")
    targets = ["youtube.com", "reddit.com", "x.com", "twitter.com", "tiktok.com"]
    return any(host == t or host.endswith("." + t) for t in targets)
`;

const SWITCH_CODE = `def switch_condition(input) -> str:
    return str(input.get("platform", "default"))
`;

const IF_CODE = `def if_condition(input) -> bool:
    return bool(input.get("over_limit"))
`;

const YT_TRIGGER = `def triggered_by(request: Request) -> bool:
    host = request.host.lower().strip(".")
    if not (host == "youtube.com" or host.endswith(".youtube.com")):
        return False
    return "/shorts" in request.url.lower()
`;

const REDDIT_TRIGGER = `def triggered_by(request: Request) -> bool:
    host = request.host.lower().strip(".")
    return host == "reddit.com" or host.endswith(".reddit.com")
`;

const DETECT_SOURCE = `from typing import Any

from proxy.api import Context, Request


def run(input: Any, request: Request, context: Context, params: dict[str, Any]) -> Any:
    host = request.host.lower().strip(".")
    if "youtube" in host:
        platform = "youtube"
    elif "reddit" in host:
        platform = "reddit"
    else:
        platform = "default"
    context.log("platform_detected", "Detected platform", platform=platform)
    return {"platform": platform}
`;

// Intentionally blank: used to film a clean autocomplete/intellisense beat.
const SCRATCHPAD_SOURCE = "";

export const NODE_SOURCES: Record<string, string> = {
  "/demo/custom_nodes/detect_platform.py": DETECT_SOURCE,
  "/demo/custom_nodes/scratchpad.py": SCRATCHPAD_SOURCE,
};

export const demoConfig: AppConfig = {
  activeModeId: "productivity",
  proxy: { port: 8080, allowLan: false, authEnabled: false, authUsername: "productive", authPassword: "change-me" },
  customNodes: [
    { id: "block-response", name: "Block Response", path: "src/proxy/defaults/nodes/block_response.py" },
    { id: "track-time", name: "Track Time", path: "src/proxy/defaults/nodes/track_time.py" },
    { id: "is-usage-over-limit", name: "Is Usage Over Limit", path: "src/proxy/defaults/nodes/is_usage_over_limit.py" },
    { id: "detect-platform", name: "Detect Platform", path: "/demo/custom_nodes/detect_platform.py" },
    { id: "scratchpad", name: "Scratchpad", path: "/demo/custom_nodes/scratchpad.py" },
  ],
  policies: [
    {
      id: "tame-distractions",
      name: "Tame Distractions",
      steps: [
        { id: "start", kind: "node", type: "start", position: { x: 40, y: 240 }, params: { code: START_TRIGGER } },
        { id: "detect", kind: "node", type: "detect-platform", position: { x: 340, y: 240 }, params: {} },
        { id: "route", kind: "operator", type: "switch", position: { x: 660, y: 240 }, params: { code: SWITCH_CODE, cases: ["youtube", "reddit", "default"] } },
        { id: "block-youtube", kind: "node", type: "block-response", position: { x: 1000, y: 40 }, params: { status: 403, message: "No YouTube in Deep Work" } },
        { id: "allow", kind: "node", type: "end", position: { x: 1000, y: 440 } },
        { id: "track", kind: "node", type: "track-time", position: { x: 1000, y: 240 }, params: { platform: "reddit", idleSeconds: 300 } },
        { id: "check", kind: "node", type: "is-usage-over-limit", position: { x: 1320, y: 240 }, params: { platform: "reddit", seconds: 1800 } },
        { id: "over", kind: "operator", type: "if", position: { x: 1640, y: 240 }, params: { code: IF_CODE } },
        { id: "block-reddit", kind: "node", type: "block-response", position: { x: 1980, y: 150 }, params: { status: 403, message: "Reddit limit reached" } },
        { id: "end", kind: "node", type: "end", position: { x: 1980, y: 330 } },
      ],
      edges: [
        { from: "start", output: "next", to: "detect" },
        { from: "detect", output: "next", to: "route" },
        { from: "route", output: "youtube", to: "block-youtube" },
        { from: "route", output: "reddit", to: "track" },
        { from: "route", output: "default", to: "allow" },
        { from: "track", output: "next", to: "check" },
        { from: "check", output: "next", to: "over" },
        { from: "over", output: "then", to: "block-reddit" },
        { from: "over", output: "else", to: "end" },
      ],
    },
    {
      id: "block-youtube-shorts",
      name: "Block YouTube Shorts",
      steps: [
        { id: "start", kind: "node", type: "start", position: { x: 80, y: 160 }, params: { code: YT_TRIGGER } },
        { id: "block", kind: "node", type: "block-response", position: { x: 460, y: 160 }, params: { status: 403, message: "YouTube Shorts blocked" } },
        { id: "end", kind: "node", type: "end", position: { x: 820, y: 160 } },
      ],
      edges: [
        { from: "start", output: "next", to: "block" },
        { from: "block", output: "next", to: "end" },
      ],
    },
    {
      id: "limit-reddit",
      name: "Limit Reddit",
      steps: [
        { id: "start", kind: "node", type: "start", position: { x: 80, y: 160 }, params: { code: REDDIT_TRIGGER } },
        { id: "track", kind: "node", type: "track-time", position: { x: 380, y: 160 }, params: { platform: "reddit", idleSeconds: 300 } },
        { id: "check", kind: "node", type: "is-usage-over-limit", position: { x: 700, y: 160 }, params: { platform: "reddit", seconds: 1800 } },
        { id: "over", kind: "operator", type: "if", position: { x: 1020, y: 160 }, params: { code: IF_CODE } },
        { id: "block", kind: "node", type: "block-response", position: { x: 1320, y: 80 }, params: { status: 403, message: "Reddit daily limit reached" } },
        { id: "end", kind: "node", type: "end", position: { x: 1320, y: 260 } },
      ],
      edges: [
        { from: "start", output: "next", to: "track" },
        { from: "track", output: "next", to: "check" },
        { from: "check", output: "next", to: "over" },
        { from: "over", output: "then", to: "block" },
        { from: "over", output: "else", to: "end" },
        { from: "block", output: "next", to: "end" },
      ],
    },
  ],
  modes: [
    { id: "productivity", name: "Productivity", description: "Focused work mode", policyIds: ["block-youtube-shorts", "limit-reddit", "tame-distractions"] },
    { id: "chilling", name: "Chilling", description: "No restrictions", policyIds: [] },
  ],
};
