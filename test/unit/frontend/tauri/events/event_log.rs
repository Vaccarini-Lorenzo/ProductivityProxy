use std::fs;

use productivity_proxy_app::services::events::event_log::{query_events, read_recent_events, EventQuery};

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

#[test]
fn queries_events_with_filters() {
    let temp = std::env::temp_dir().join(format!("pp-filtered-events-{}", std::process::id()));
    fs::create_dir_all(&temp).unwrap();
    let path = temp.join("events.jsonl");
    fs::write(
        &path,
        concat!(
            "{\"timestamp\":1,\"category\":\"observability\",\"level\":\"debug\",\"type\":\"policy_step\",\"policyId\":\"p1\",\"message\":\"skip\"}\n",
            "{\"timestamp\":2,\"category\":\"observability\",\"level\":\"error\",\"type\":\"policy_error\",\"policyId\":\"p1\",\"message\":\"boom\"}\n",
            "{\"timestamp\":3,\"category\":\"custom_node\",\"level\":\"info\",\"type\":\"custom_node_log\",\"policyId\":\"p2\",\"message\":\"hello\"}\n"
        ),
    )
    .unwrap();

    let mut query = EventQuery::recent(10);
    query.category = Some("observability".into());
    query.level = Some("error".into());
    query.search = Some("boom".into());
    let events = query_events(&path, &query).unwrap();

    fs::remove_dir_all(temp).unwrap();

    assert_eq!(events.len(), 1);
    assert_eq!(events[0]["type"], "policy_error");
}
