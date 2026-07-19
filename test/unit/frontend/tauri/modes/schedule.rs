use chrono::NaiveDateTime;
use productivity_proxy_app::services::modes::schedule::active_schedule;
use serde_json::json;

fn at(value: &str) -> NaiveDateTime {
    NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M").unwrap()
}

#[test]
fn selects_a_daytime_schedule_only_inside_its_interval() {
    let config = json!({
        "modes": [
            {"id": "free", "defaultTime": null},
            {"id": "focus", "defaultTime": {"start": "09:00", "end": "17:00"}}
        ]
    });

    assert_eq!(active_schedule(&config, at("2026-07-20 08:59")), None);
    let active = active_schedule(&config, at("2026-07-20 09:00")).unwrap();
    assert_eq!(active.mode_id, "focus");
    assert!(active.occurrence_key.contains("2026-07-20"));
    assert_eq!(active_schedule(&config, at("2026-07-20 17:00")), None);
}

#[test]
fn overnight_schedule_uses_the_date_on_which_it_started() {
    let config = json!({
        "modes": [{"id": "night", "defaultTime": {"start": "22:00", "end": "07:00"}}]
    });

    let before_midnight = active_schedule(&config, at("2026-07-20 23:00")).unwrap();
    let after_midnight = active_schedule(&config, at("2026-07-21 06:30")).unwrap();

    assert_eq!(before_midnight.occurrence_key, after_midnight.occurrence_key);
    assert!(after_midnight.occurrence_key.contains("2026-07-20"));
    assert_eq!(active_schedule(&config, at("2026-07-21 07:00")), None);
}
