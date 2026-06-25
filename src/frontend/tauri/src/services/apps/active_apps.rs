use crate::services::apps::icons;
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::process::Command;

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveApp {
    pub name: String,
    pub process_names: Vec<String>,
    pub process_count: usize,
    pub icon_data_url: Option<String>,
}

#[derive(Default)]
struct AppCatalog {
    names: BTreeSet<String>,
    icons: BTreeMap<String, String>,
}

#[derive(Default)]
struct AppGroup {
    process_names: BTreeSet<String>,
    process_count: usize,
}

pub fn list_active_apps() -> Result<Vec<ActiveApp>, String> {
    let output = Command::new("ps")
        .args(ps_args())
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let catalog = visible_app_catalog()?;
    let desktop = desktop_app_catalog();
    let current_user = std::env::var("USER")
        .or_else(|_| std::env::var("LOGNAME"))
        .unwrap_or_default();
    let mut apps = parse_ps_output(
        &String::from_utf8_lossy(&output.stdout),
        &current_user,
        &catalog.names,
        &desktop.names,
    );
    for app in &mut apps {
        app.icon_data_url = catalog
            .icons
            .get(&app.name)
            .or_else(|| desktop.icons.get(&app.name))
            .cloned();
    }
    Ok(apps)
}

pub fn parse_ps_output(
    text: &str,
    current_user: &str,
    app_names: &BTreeSet<String>,
    process_names: &BTreeSet<String>,
) -> Vec<ActiveApp> {
    let mut groups: BTreeMap<String, AppGroup> = BTreeMap::new();
    for line in text.lines() {
        let Some((user, rest)) = split_token(line) else {
            continue;
        };
        if !current_user.is_empty() && user != current_user {
            continue;
        }
        let Some((_pid, command)) = split_token(rest) else {
            continue;
        };
        let process_name = process_name(command.trim());
        if !valid_capture_name(&process_name) {
            continue;
        }
        let app_name = app_name(command.trim(), &process_name);
        if !app_names.is_empty() && !app_names.contains(&app_name) {
            continue;
        }
        if !process_names.is_empty() && !process_names.contains(&process_name) {
            continue;
        }
        let group = groups.entry(app_name).or_default();
        group.process_count += 1;
        group.process_names.insert(process_name);
    }
    groups
        .into_iter()
        .map(|(name, group)| ActiveApp {
            name,
            process_names: group.process_names.into_iter().collect(),
            process_count: group.process_count,
            icon_data_url: None,
        })
        .collect()
}

fn ps_args() -> [&'static str; 2] {
    if cfg!(target_os = "linux") {
        ["-eo", "user=,pid=,comm="]
    } else {
        ["-axo", "user=,pid=,comm="]
    }
}

fn split_token(text: &str) -> Option<(&str, &str)> {
    let text = text.trim_start();
    let index = text.find(|ch: char| ch.is_whitespace())?;
    Some((&text[..index], text[index..].trim_start()))
}

fn process_name(command: &str) -> String {
    Path::new(command)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| command.to_string())
}

fn app_name(command: &str, process_name: &str) -> String {
    if cfg!(target_os = "macos") {
        for part in command.split('/') {
            if let Some(name) = part.strip_suffix(".app") {
                return name.to_string();
            }
        }
    }
    process_name.to_string()
}

fn valid_capture_name(name: &str) -> bool {
    !name.is_empty() && !name.contains(',') && !name.starts_with('!')
}

#[cfg(target_os = "macos")]
fn visible_app_catalog() -> Result<AppCatalog, String> {
    let output = Command::new("lsappinfo")
        .arg("visibleProcessList")
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let mut catalog = AppCatalog::default();
    for token in String::from_utf8_lossy(&output.stdout).split_whitespace() {
        if let Some((name, path)) = visible_bundle_info(token)? {
            if let Some(icon) = icons::macos_bundle_icon_data_url(&path) {
                catalog.icons.insert(name.clone(), icon);
            }
            catalog.names.insert(name);
        }
    }
    Ok(catalog)
}

#[cfg(target_os = "macos")]
fn visible_bundle_info(token: &str) -> Result<Option<(String, String)>, String> {
    let output = Command::new("lsappinfo")
        .args(["info", "-only", "bundlepath", token])
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Ok(None);
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let Some(path) = text.trim().strip_prefix("\"LSBundlePath\"=\"") else {
        return Ok(None);
    };
    let path = path.trim_end_matches('"').to_string();
    Ok(bundle_name(&path).map(|name| (name, path)))
}

#[cfg(target_os = "macos")]
fn bundle_name(path: &str) -> Option<String> {
    Path::new(path)
        .file_name()
        .and_then(|name| name.to_string_lossy().strip_suffix(".app").map(str::to_string))
}

#[cfg(not(target_os = "macos"))]
fn visible_app_catalog() -> Result<AppCatalog, String> {
    Ok(AppCatalog::default())
}

#[cfg(target_os = "linux")]
fn desktop_app_catalog() -> AppCatalog {
    let mut catalog = AppCatalog::default();
    for path in desktop_entry_paths() {
        let Some((process_name, icon)) = std::fs::read_to_string(path).ok().and_then(|text| desktop_app_info(&text)) else {
            continue;
        };
        if let Some(icon) = icon {
            catalog.icons.insert(process_name.clone(), icon);
        }
        catalog.names.insert(process_name);
    }
    catalog
}

#[cfg(not(target_os = "linux"))]
fn desktop_app_catalog() -> AppCatalog {
    AppCatalog::default()
}

#[cfg(target_os = "linux")]
fn desktop_entry_paths() -> Vec<std::path::PathBuf> {
    let mut dirs = vec![
        std::path::PathBuf::from("/usr/share/applications"),
        std::path::PathBuf::from("/usr/local/share/applications"),
    ];
    if let Some(home) = std::env::var_os("HOME") {
        dirs.push(std::path::PathBuf::from(home).join(".local/share/applications"));
    }
    dirs.into_iter()
        .filter_map(|dir| std::fs::read_dir(dir).ok())
        .flat_map(|entries| entries.filter_map(Result::ok))
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "desktop"))
        .collect()
}

#[cfg(target_os = "linux")]
fn desktop_app_info(text: &str) -> Option<(String, Option<String>)> {
    if text.lines().any(|line| line.trim() == "NoDisplay=true") {
        return None;
    }
    let exec = text.lines().find_map(|line| line.strip_prefix("Exec="))?;
    let process_name = exec
        .split_whitespace()
        .map(|token| token.trim_matches('"'))
        .find(|token| !token.starts_with('%') && *token != "env" && !token.contains('='))
        .map(process_name)
        .filter(|name| valid_capture_name(name))?;
    let icon = text
        .lines()
        .find_map(|line| line.strip_prefix("Icon="))
        .and_then(icons::linux_icon_data_url);
    Some((process_name, icon))
}
