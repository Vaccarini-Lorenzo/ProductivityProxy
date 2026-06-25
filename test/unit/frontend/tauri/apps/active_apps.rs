use productivity_proxy_app::services::apps::active_apps::parse_ps_output;
use std::collections::BTreeSet;

#[cfg(target_os = "macos")]
#[test]
fn groups_macos_app_bundle_processes() {
    let text = "me 10 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome\nme 11 /Applications/Google Chrome.app/Contents/Helpers/Google Chrome Helper.app/Contents/MacOS/Google Chrome Helper\nroot 12 /sbin/launchd\n";
    let apps = parse_ps_output(text, "me", &set(["Google Chrome"]), &BTreeSet::new());

    let chrome = apps.iter().find(|app| app.name == "Google Chrome").unwrap();
    assert_eq!(chrome.process_count, 2);
    assert!(chrome.process_names.contains(&"Google Chrome".to_string()));
    assert!(chrome.process_names.contains(&"Google Chrome Helper".to_string()));
}

#[test]
fn ignores_invalid_local_capture_names() {
    let text = "me 10 /usr/bin/good\nme 11 /usr/bin/bad,name\nme 12 /usr/bin/!negated\n";
    let apps = parse_ps_output(text, "me", &BTreeSet::new(), &BTreeSet::new());

    assert_eq!(apps.len(), 1);
    assert_eq!(apps[0].name, "good");
}

#[test]
fn filters_to_desktop_process_names() {
    let text = "me 10 /usr/bin/firefox\nme 11 /usr/bin/zsh\n";
    let apps = parse_ps_output(text, "me", &BTreeSet::new(), &set(["firefox"]));

    assert_eq!(apps.len(), 1);
    assert_eq!(apps[0].name, "firefox");
}

fn set(items: [&str; 1]) -> BTreeSet<String> {
    items.into_iter().map(str::to_string).collect()
}
