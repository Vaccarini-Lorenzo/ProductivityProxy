from pathlib import Path
import os
import sys

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

os.environ["POLICY_MAX_STEPS"] = "100"
os.environ["PRODUCTIVE_PROXY_TELEMETRY_VERBOSE"] = "false"
os.environ["PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES"] = "1000000"
os.environ["PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS"] = "0"
