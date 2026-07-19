use productivity_proxy_app::services::config::app_config::{read_stored, set_active_mode};
use productivity_proxy_app::services::config::runtime_paths::RuntimePaths;
use serde_json::json;
use std::fs;

#[test]
fn updates_only_the_runtime_active_mode() {
    let temp = std::env::temp_dir().join(format!("pp-app-config-{}", std::process::id()));
    let _ = fs::remove_dir_all(&temp);
    fs::create_dir_all(&temp).unwrap();
    let paths = RuntimePaths::new(temp.clone(), temp.join("repo"));
    fs::write(
        &paths.proxy.config_path,
        serde_json::to_string(&json!({
            "activeModeId": "focus",
            "modes": [
                {"id": "focus", "name": "Focus", "policyIds": []},
                {"id": "rest", "name": "Rest", "policyIds": []}
            ]
        }))
        .unwrap(),
    )
    .unwrap();

    set_active_mode(&paths, "rest").unwrap();
    let config = read_stored(&paths).unwrap();

    assert_eq!(config["activeModeId"], "rest");
    assert_eq!(config["modes"].as_array().unwrap().len(), 2);
    fs::remove_dir_all(temp).unwrap();
}
