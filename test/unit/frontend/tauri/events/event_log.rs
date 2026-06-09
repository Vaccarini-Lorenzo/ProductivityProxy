use std::fs;

use productivity_proxy_app::services::events::event_log::read_recent_events;

#[test]
fn reads_recent_jsonl_events() {
    let temp = std::env::temp_dir().join(format!("pp-events-{}", std::process::id()));
    fs::create_dir_all(&temp).unwrap();
    let path = temp.join("events.jsonl");
    fs::write(&path, "{\"type\":\"first\"}\n{\"type\":\"second\"}\n").unwrap();

    let events = read_recent_events(&path, 1).unwrap();

    fs::remove_dir_all(temp).unwrap();

    assert_eq!(events.len(), 1);
    assert_eq!(events[0]["type"], "second");
}
