use base64::{engine::general_purpose, Engine as _};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

static ICON_CACHE: OnceLock<Mutex<BTreeMap<String, Option<String>>>> = OnceLock::new();

pub fn cached_icon(key: &str, load: impl FnOnce() -> Option<String>) -> Option<String> {
    let cache = ICON_CACHE.get_or_init(|| Mutex::new(BTreeMap::new()));
    if let Ok(cache) = cache.lock() {
        if let Some(value) = cache.get(key) {
            return value.clone();
        }
    }
    let value = load();
    if let Ok(mut cache) = cache.lock() {
        cache.insert(key.to_string(), value.clone());
    }
    value
}

pub fn file_data_url(path: &Path) -> Option<String> {
    let mime = mime_for_path(path)?;
    let bytes = std::fs::read(path).ok()?;
    Some(format!(
        "data:{mime};base64,{}",
        general_purpose::STANDARD.encode(bytes)
    ))
}

#[cfg(target_os = "macos")]
pub fn macos_bundle_icon_data_url(bundle_path: &str) -> Option<String> {
    cached_icon(bundle_path, || load_macos_bundle_icon(bundle_path))
}

#[cfg(target_os = "linux")]
pub fn linux_icon_data_url(icon: &str) -> Option<String> {
    cached_icon(icon, || load_linux_icon(icon))
}

#[cfg(target_os = "macos")]
fn load_macos_bundle_icon(bundle_path: &str) -> Option<String> {
    let icon = first_file_with_ext(&Path::new(bundle_path).join("Contents/Resources"), "icns")?;
    let output = std::env::temp_dir().join(format!(
        "productivityproxy-icon-{}-{}.png",
        std::process::id(),
        safe_file_name(bundle_path)
    ));
    let status = std::process::Command::new("sips")
        .args(["-s", "format", "png", "-Z", "64"])
        .arg(icon)
        .arg("--out")
        .arg(&output)
        .output()
        .ok()?;
    if !status.status.success() {
        return None;
    }
    let value = file_data_url(&output);
    let _ = std::fs::remove_file(output);
    value
}

#[cfg(target_os = "linux")]
fn load_linux_icon(icon: &str) -> Option<String> {
    let path = Path::new(icon);
    if path.is_absolute() {
        return file_data_url(path);
    }
    icon_dirs()
        .into_iter()
        .find_map(|dir| find_icon_file(&dir, icon, 0))
        .and_then(|path| file_data_url(&path))
}

#[cfg(target_os = "linux")]
fn icon_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![
        PathBuf::from("/usr/share/pixmaps"),
        PathBuf::from("/usr/share/icons/hicolor"),
    ];
    if let Some(home) = std::env::var_os("HOME") {
        dirs.push(PathBuf::from(home).join(".local/share/icons"));
    }
    dirs
}

#[cfg(target_os = "linux")]
fn find_icon_file(dir: &Path, icon: &str, depth: usize) -> Option<PathBuf> {
    if depth > 5 {
        return None;
    }
    for entry in std::fs::read_dir(dir).ok()?.filter_map(Result::ok) {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_icon_file(&path, icon, depth + 1) {
                return Some(found);
            }
        } else if path.file_stem().is_some_and(|stem| stem == icon) && mime_for_path(&path).is_some() {
            return Some(path);
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn first_file_with_ext(dir: &Path, ext: &str) -> Option<PathBuf> {
    std::fs::read_dir(dir)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| path.extension().is_some_and(|value| value == ext))
}

#[cfg(target_os = "macos")]
fn safe_file_name(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .take(40)
        .collect()
}

fn mime_for_path(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_string_lossy().to_lowercase().as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "svg" => Some("image/svg+xml"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}
