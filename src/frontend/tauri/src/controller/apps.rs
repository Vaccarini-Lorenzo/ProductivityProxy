use crate::services::apps::active_apps::{list_active_apps as load_active_apps, ActiveApp};

#[tauri::command]
pub fn list_active_apps() -> Result<Vec<ActiveApp>, String> {
    load_active_apps()
}
