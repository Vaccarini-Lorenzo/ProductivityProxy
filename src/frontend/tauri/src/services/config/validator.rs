use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

/// Result of a backend validation pass. `issues` mirrors the Python validator
/// output verbatim so the frontend can render messages, hints, and node rings.
#[derive(Serialize, Deserialize)]
pub struct ValidationReport {
    pub ok: bool,
    pub issues: Vec<Value>,
}

pub fn validate_config(repo_root: &Path, config: &Value) -> Result<ValidationReport, String> {
    run_validator(repo_root, &json!({ "kind": "config", "payload": config }))
}

pub fn validate_node_code(repo_root: &Path, code: &str) -> Result<ValidationReport, String> {
    run_validator(repo_root, &json!({ "kind": "node", "payload": code }))
}

/// First issue message, or a generic fallback. Used when a command must fail
/// hard (e.g. refusing to write an invalid custom node file).
pub fn first_message(report: &ValidationReport) -> String {
    report
        .issues
        .first()
        .and_then(|issue| issue.get("message"))
        .and_then(|message| message.as_str())
        .unwrap_or("invalid configuration")
        .to_string()
}

fn run_validator(repo_root: &Path, request: &Value) -> Result<ValidationReport, String> {
    let script = repo_root.join("src/proxy/services/config/validate_cli.py");
    let mut child = Command::new("python3")
        .arg(&script)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("could not start validator: {error}"))?;

    child
        .stdin
        .take()
        .ok_or_else(|| "validator stdin unavailable".to_string())?
        .write_all(request.to_string().as_bytes())
        .map_err(|error| error.to_string())?;

    let output = child.wait_with_output().map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "validator failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())
}
