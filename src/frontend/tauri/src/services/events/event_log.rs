use serde::Deserialize;
use serde_json::Value;
use std::fs;
use std::io::Result;
use std::path::Path;

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EventQuery {
    pub limit: usize,
    pub category: Option<String>,
    #[serde(rename = "type")]
    pub event_type: Option<String>,
    pub level: Option<String>,
    pub source: Option<String>,
    pub mode_id: Option<String>,
    pub policy_id: Option<String>,
    pub step_id: Option<String>,
    pub request_id: Option<String>,
    pub search: Option<String>,
    pub since: Option<f64>,
    pub until: Option<f64>,
}

pub fn read_recent_events(path: &Path, limit: usize) -> Result<Vec<Value>> {
    query_events(path, &EventQuery::recent(limit))
}

pub fn query_events(path: &Path, query: &EventQuery) -> Result<Vec<Value>> {
    if query.limit == 0 || !path.exists() {
        return Ok(Vec::new());
    }

    let text = fs::read_to_string(path)?;
    let lines: Vec<&str> = text.lines().filter(|line| !line.trim().is_empty()).collect();
    let mut events = Vec::new();

    for line in lines.iter().rev() {
        let event: Value = serde_json::from_str(line)?;
        if !matches_query(&event, query) {
            continue;
        }
        events.push(event);
        if events.len() >= query.limit {
            break;
        }
    }

    events.reverse();
    Ok(events)
}

impl EventQuery {
    pub fn recent(limit: usize) -> Self {
        Self {
            limit,
            category: None,
            event_type: None,
            level: None,
            source: None,
            mode_id: None,
            policy_id: None,
            step_id: None,
            request_id: None,
            search: None,
            since: None,
            until: None,
        }
    }
}

fn matches_query(event: &Value, query: &EventQuery) -> bool {
    matches_text(event, "category", &query.category)
        && matches_text(event, "type", &query.event_type)
        && matches_text(event, "level", &query.level)
        && matches_text(event, "source", &query.source)
        && matches_text(event, "modeId", &query.mode_id)
        && matches_text(event, "policyId", &query.policy_id)
        && matches_text(event, "stepId", &query.step_id)
        && matches_text(event, "requestId", &query.request_id)
        && matches_search(event, &query.search)
        && matches_bound(event, &query.since, true)
        && matches_bound(event, &query.until, false)
}

fn matches_text(event: &Value, field: &str, expected: &Option<String>) -> bool {
    match expected {
        None => true,
        Some(expected) => event.get(field).and_then(Value::as_str) == Some(expected.as_str()),
    }
}

fn matches_search(event: &Value, search: &Option<String>) -> bool {
    match search {
        None => true,
        Some(search) => event.to_string().to_lowercase().contains(&search.to_lowercase()),
    }
}

fn matches_bound(event: &Value, bound: &Option<f64>, lower: bool) -> bool {
    let Some(bound) = bound else {
        return true;
    };
    let Some(timestamp) = event.get("timestamp").and_then(Value::as_f64) else {
        return false;
    };
    if lower {
        timestamp >= *bound
    } else {
        timestamp <= *bound
    }
}
