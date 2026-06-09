use std::path::PathBuf;

use productivity_proxy_app::services::config::runtime_paths::RuntimePaths;

#[test]
fn creates_expected_paths_from_base_and_repo_root() {
    let paths = RuntimePaths::new(PathBuf::from("/data/app"), PathBuf::from("/repo"));

    assert_eq!(paths.proxy.config_path, PathBuf::from("/data/app/config.json"));
    assert_eq!(paths.proxy.state_path, PathBuf::from("/data/app/state.json"));
    assert_eq!(paths.proxy.event_log_path, PathBuf::from("/data/app/events.jsonl"));
    assert_eq!(paths.proxy.addon_path, PathBuf::from("/repo/src/proxy/addons/policy_proxy.py"));
    assert_eq!(paths.custom_nodes_dir, PathBuf::from("/data/app/custom_nodes"));
}
