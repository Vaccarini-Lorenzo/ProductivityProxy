use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, LogicalPosition, Manager, Rect, WebviewWindow};

/// Label of the menu-bar popover window declared in `tauri.conf.json`.
pub const POPOVER_LABEL: &str = "popover";

/// How long after an auto-dismiss a tray click is treated as "close", so the
/// same click that made the popover lose focus does not immediately reopen it.
const REOPEN_GUARD: Duration = Duration::from_millis(250);

/// Gap, in logical pixels, between the tray icon and the popover.
const ICON_GAP: f64 = 6.0;

/// Margin kept between the popover and the edges of the monitor work area.
const EDGE_MARGIN: f64 = 8.0;

#[cfg(target_os = "macos")]
tauri_nspanel::tauri_panel! {
    panel!(PopoverPanel {
        config: {
            can_become_key_window: true,
            can_become_main_window: false,
            is_floating_panel: true,
            becomes_key_only_if_needed: true,
            hides_on_deactivate: false,
            works_when_modal: true
        }
    })
}

/// Remembers when the popover was last dismissed by losing focus.
#[derive(Default)]
pub struct PopoverState {
    last_dismissed: Mutex<Option<Instant>>,
}

impl PopoverState {
    pub fn mark_dismissed(&self) {
        if let Ok(mut guard) = self.last_dismissed.lock() {
            *guard = Some(Instant::now());
        }
    }

    fn dismissed_recently(&self) -> bool {
        self.last_dismissed
            .lock()
            .ok()
            .and_then(|guard| *guard)
            .is_some_and(|at| at.elapsed() < REOPEN_GUARD)
    }
}

/// Convert the Tauri popover window into a native NSPanel. macOS only allows
/// panel-style windows to reliably float above another app's fullscreen Space.
#[cfg(target_os = "macos")]
pub fn install_panel(app: &AppHandle) -> tauri::Result<()> {
    use tauri_nspanel::{CollectionBehavior, PanelLevel, StyleMask, WebviewWindowExt};

    let Some(window) = app.get_webview_window(POPOVER_LABEL) else {
        return Ok(());
    };
    let panel = window.to_panel::<PopoverPanel>()?;
    panel.set_level(PanelLevel::PopUpMenu.value());
    panel.set_floating_panel(true);
    panel.set_hides_on_deactivate(false);
    panel.set_has_shadow(false);
    panel.set_transparent(true);
    panel.set_style_mask(StyleMask::empty().borderless().nonactivating_panel().value());
    panel.set_collection_behavior(
        CollectionBehavior::new()
            .can_join_all_spaces()
            .stationary()
            .transient()
            .ignores_cycle()
            .full_screen_auxiliary()
            .value(),
    );
    Ok(())
}

/// Toggle the popover from a tray left-click located at `icon`.
pub fn toggle_popover(app: &AppHandle, icon: Rect) {
    #[cfg(target_os = "macos")]
    {
        use tauri_nspanel::ManagerExt;

        if let Ok(panel) = app.get_webview_panel(POPOVER_LABEL) {
            if panel.is_visible() {
                panel.hide();
                return;
            }
            if app.state::<PopoverState>().dismissed_recently() {
                return;
            }
            if let Some(window) = app.get_webview_window(POPOVER_LABEL) {
                let _ = position_below_icon(&window, icon);
            }
            panel.show_and_make_key();
            return;
        }
    }

    let Some(window) = app.get_webview_window(POPOVER_LABEL) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }
    if app.state::<PopoverState>().dismissed_recently() {
        return;
    }
    let _ = position_below_icon(&window, icon);
    let _ = window.show();
    let _ = window.set_focus();
}

/// Center the popover horizontally under the tray icon, clamped to the screen.
fn position_below_icon(window: &WebviewWindow, icon: Rect) -> tauri::Result<()> {
    let scale = window.scale_factor()?;
    let icon_pos = icon.position.to_logical::<f64>(scale);
    let icon_size = icon.size.to_logical::<f64>(scale);
    let win = window.outer_size()?.to_logical::<f64>(scale);

    let mut x = icon_pos.x + icon_size.width / 2.0 - win.width / 2.0;
    let y = icon_pos.y + icon_size.height + ICON_GAP;

    // Resolve the monitor under the tray icon (works while the popover is
    // still hidden, unlike `current_monitor`) so the first open is clamped too.
    let icon_phys = icon.position.to_physical::<f64>(scale);
    let icon_phys_size = icon.size.to_physical::<f64>(scale);
    let center_x = icon_phys.x + icon_phys_size.width / 2.0;
    let center_y = icon_phys.y + icon_phys_size.height / 2.0;
    if let Some(monitor) = window.monitor_from_point(center_x, center_y)? {
        let monitor_scale = monitor.scale_factor();
        let area_pos = monitor.work_area().position.to_logical::<f64>(monitor_scale);
        let area_size = monitor.work_area().size.to_logical::<f64>(monitor_scale);
        let min_x = area_pos.x + EDGE_MARGIN;
        let max_x = area_pos.x + area_size.width - win.width - EDGE_MARGIN;
        if max_x >= min_x {
            x = x.clamp(min_x, max_x);
        }
    }

    window.set_position(LogicalPosition::new(x, y))
}
