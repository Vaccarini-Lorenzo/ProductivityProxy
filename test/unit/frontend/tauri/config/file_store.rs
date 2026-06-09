use serde_json::json;
use std::fs;

use productivity_proxy_app::services::config::file_store::FileStore;

#[test]
fn writes_and_reads_json() {
    let temp = std::env::temp_dir().join(format!("pp-file-store-{}", std::process::id()));
    let path = temp.join("nested/config.json");
    let store = FileStore::new(path.clone());

    store.write_json(&json!({"activeModeId": "productivity"})).unwrap();
    let value = store.read_json().unwrap();

    fs::remove_dir_all(temp).unwrap();

    assert_eq!(value["activeModeId"], "productivity");
}
