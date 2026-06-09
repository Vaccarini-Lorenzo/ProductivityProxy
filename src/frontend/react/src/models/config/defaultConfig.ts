import type { AppConfig } from "./types";

export function createDefaultConfig(): AppConfig {
  return {
    activeModeId: "productivity",
    proxy: {
      port: 8080,
      allowLan: false,
      authEnabled: false,
      authUsername: "productive",
      authPassword: "change-me",
    },
    customNodes: [
      { id: "block-response", name: "Block Response", path: "src/proxy/defaults/nodes/block_response.py" },
      { id: "track-time", name: "Track Time", path: "src/proxy/defaults/nodes/track_time.py" },
      { id: "is-usage-over-limit", name: "Is Usage Over Limit", path: "src/proxy/defaults/nodes/is_usage_over_limit.py" },
    ],
    modes: [
      {
        id: "productivity",
        name: "Productivity",
        description: "Focused work mode",
        policies: [
          {
            id: "block-youtube-shorts",
            name: "Block YouTube Shorts",
            steps: [
              { id: "start", kind: "node", type: "start", position: { x: 80, y: 120 }, params: { trigger: { hostPatterns: ["youtube.com", "www.youtube.com", "m.youtube.com"], pathPatterns: ["/shorts", "/reel"] } } },
              { id: "block", kind: "node", type: "block-response", position: { x: 460, y: 120 }, params: { status: 403, message: "YouTube Shorts blocked" } },
              { id: "end", kind: "node", type: "end", position: { x: 800, y: 120 } },
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
              { id: "start", kind: "node", type: "start", position: { x: 80, y: 120 }, params: { trigger: { hostPatterns: ["reddit.com", "www.reddit.com", "old.reddit.com"] } } },
              { id: "track", kind: "node", type: "track-time", position: { x: 380, y: 120 }, params: { platform: "reddit", idleSeconds: 300 } },
              { id: "check-limit", kind: "node", type: "is-usage-over-limit", position: { x: 680, y: 120 }, params: { platform: "reddit", seconds: 1800 } },
              { id: "over-limit", kind: "operator", type: "if", position: { x: 980, y: 120 }, params: { path: "over_limit" } },
              { id: "block", kind: "node", type: "block-response", position: { x: 1260, y: 60 }, params: { status: 403, message: "Reddit daily limit reached" } },
              { id: "end", kind: "node", type: "end", position: { x: 1260, y: 200 } },
            ],
            edges: [
              { from: "start", output: "next", to: "track" },
              { from: "track", output: "next", to: "check-limit" },
              { from: "check-limit", output: "next", to: "over-limit" },
              { from: "over-limit", output: "true", to: "block" },
              { from: "over-limit", output: "false", to: "end" },
              { from: "block", output: "next", to: "end" },
            ],
          },
        ],
      },
      {
        id: "chilling",
        name: "Chilling",
        description: "Low restriction mode",
        policies: [
          {
            id: "allow-all",
            name: "Allow All",
            steps: [
              { id: "start", kind: "node", type: "start", position: { x: 80, y: 120 } },
              { id: "end", kind: "node", type: "end", position: { x: 320, y: 120 } },
            ],
            edges: [{ from: "start", output: "next", to: "end" }],
          },
        ],
      },
    ],
  };
}
