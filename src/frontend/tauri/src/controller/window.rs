use crate::controller::commands::{stop_proxy, AppState};
use crate::controller::tray::popover::POPOVER_LABEL;
use tauri::{AppHandle, LogicalSize, Manager, State, WebviewWindow};

/// Reveal the dashboard window and dismiss the popover.
#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(popover) = app.get_webview_window(POPOVER_LABEL) {
        let _ = popover.hide();
    }
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

/// Resize the popover to fit its content, so it never needs to scroll. Height
/// is the content height (logical px) measured by the webview; width is kept.
#[tauri::command]
pub fn resize_popover(app: AppHandle, height: f64) -> Result<(), String> {
    let window = app
        .get_webview_window(POPOVER_LABEL)
        .ok_or_else(|| "popover window not found".to_string())?;
    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    let width = window
        .outer_size()
        .map_err(|error| error.to_string())?
        .to_logical::<f64>(scale)
        .width;
    let max_height = max_popover_height(&window).unwrap_or(height);
    let height = height.min(max_height).max(140.0);
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|error| error.to_string())
}

/// Tallest the popover may grow: the monitor work area minus a small margin.
fn max_popover_height(window: &WebviewWindow) -> Option<f64> {
    let monitor = window.current_monitor().ok().flatten()?;
    let area = monitor.work_area().size.to_logical::<f64>(monitor.scale_factor());
    Some(area.height - 16.0)
}

/// Stop the proxy (restoring system settings) and quit. Refuses to quit if the
/// proxy cleanup fails, to avoid leaving the system proxy enabled.
#[tauri::command]
pub fn quit_app(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    stop_proxy(state)?;
    app.exit(0);
    Ok(())
}
