use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
use serde_json::Value;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActiveSchedule {
    pub mode_id: String,
    pub occurrence_key: String,
}

pub fn active_schedule(config: &Value, now: NaiveDateTime) -> Option<ActiveSchedule> {
    let modes = config["modes"].as_array()?;
    for mode in modes {
        let Some(mode_id) = mode["id"].as_str() else {
            continue;
        };
        let Some(default_time) = mode.get("defaultTime").and_then(Value::as_object) else {
            continue;
        };
        let (Some(start_text), Some(end_text)) = (
            default_time.get("start").and_then(Value::as_str),
            default_time.get("end").and_then(Value::as_str),
        ) else {
            continue;
        };
        let (Some(start), Some(end)) = (parse_time(start_text), parse_time(end_text)) else {
            continue;
        };
        let Some(occurrence_date) = occurrence_start_date(now, start, end) else {
            continue;
        };
        return Some(ActiveSchedule {
            mode_id: mode_id.to_string(),
            occurrence_key: format!("{mode_id}|{occurrence_date}|{start_text}-{end_text}"),
        });
    }
    None
}

fn occurrence_start_date(
    now: NaiveDateTime,
    start: NaiveTime,
    end: NaiveTime,
) -> Option<NaiveDate> {
    if start == end {
        return None;
    }
    let time = now.time();
    if start < end {
        return (time >= start && time < end).then_some(now.date());
    }
    if time >= start {
        return Some(now.date());
    }
    if time < end {
        return now.date().pred_opt();
    }
    None
}

fn parse_time(value: &str) -> Option<NaiveTime> {
    NaiveTime::parse_from_str(value, "%H:%M").ok()
}
