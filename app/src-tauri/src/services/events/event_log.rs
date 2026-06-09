use serde_json::Value;
use std::fs;
use std::io::Result;
use std::path::Path;

pub fn read_recent_events(path: &Path, limit: usize) -> Result<Vec<Value>> {
    if limit == 0 || !path.exists() {
        return Ok(Vec::new());
    }

    let text = fs::read_to_string(path)?;
    let lines: Vec<&str> = text.lines().filter(|line| !line.trim().is_empty()).collect();
    let start = lines.len().saturating_sub(limit);
    let mut events = Vec::new();

    for line in &lines[start..] {
        events.push(serde_json::from_str(line)?);
    }

    Ok(events)
}
