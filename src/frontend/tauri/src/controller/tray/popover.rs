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

/// Toggle the popover from a tray left-click located at `icon`.
pub fn toggle_popover(app: &AppHandle, icon: Rect) {
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
    #[cfg(target_os = "macos")]
    bring_to_front(&window);
    let _ = window.set_focus();
}

/// On macOS a menu-bar popover must float above every other window — including
/// other always-on-top windows and fullscreen apps — even though this is an
/// accessory app that never becomes the active application. The config's
/// `alwaysOnTop` only reaches the floating level, so raise the native window to
/// the pop-up-menu level (what AppKit menus use) and order it to the front
/// unconditionally, regardless of which app is currently active.
#[cfg(target_os = "macos")]
fn bring_to_front(window: &WebviewWindow) {
    use objc::runtime::Object;
    use objc::{msg_send, sel, sel_impl};

    const NS_POPUP_MENU_WINDOW_LEVEL: i64 = 101;
    // NSWindowCollectionBehaviorCanJoinAllSpaces | FullScreenAuxiliary.
    const ALL_SPACES_OVER_FULLSCREEN: u64 = (1 << 0) | (1 << 8);

    let Ok(ns_window) = window.ns_window() else {
        return;
    };
    let ns_window = ns_window as *mut Object;
    // SAFETY: `ns_window` is the live NSWindow backing this WebviewWindow.
    unsafe {
        let _: () = msg_send![ns_window, setLevel: NS_POPUP_MENU_WINDOW_LEVEL];
        let _: () = msg_send![ns_window, setCollectionBehavior: ALL_SPACES_OVER_FULLSCREEN];
        let _: () = msg_send![ns_window, orderFrontRegardless];
    }
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
