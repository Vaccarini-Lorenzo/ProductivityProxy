pub mod controller;
pub mod models;
pub mod services;

use controller::commands::{
    network_info, proxy_status, query_events, read_app_config, read_custom_node, read_recent_events,
    shutdown_cleanup, start_proxy, stop_proxy, validate_node_code, write_app_config,
    write_custom_node, AppState,
};
use controller::tray::actions::TrayAction;
use controller::tray::popover::{self, PopoverState};
use controller::window::{quit_app, resize_popover, show_main_window};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, RunEvent, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::default())
        .manage(PopoverState::default())
        .invoke_handler(tauri::generate_handler![
            read_app_config,
            write_app_config,
            validate_node_code,
            write_custom_node,
            read_custom_node,
            start_proxy,
            stop_proxy,
            proxy_status,
            read_recent_events,
            query_events,
            network_info,
            show_main_window,
            resize_popover,
            quit_app
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            create_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                let _ = window.hide();
                api.prevent_close();
            }
            // Dismiss the menu-bar popover when it loses focus (click outside).
            WindowEvent::Focused(false) if window.label() == popover::POPOVER_LABEL => {
                window.app_handle().state::<PopoverState>().mark_dismissed();
                let _ = window.hide();
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building ProductivityProxy")
        .run(|app_handle, event| {
            // Reliable cleanup hook on macOS, where the platform run loop
            // terminates the process without running AppState's Drop.
            if let RunEvent::Exit = event {
                shutdown_cleanup(app_handle, app_handle.state::<AppState>().inner());
            }
        });
}

fn create_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open_dashboard", "Open Dashboard", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    // Left-click opens the styled popover; right-click shows this native menu
    // as a fallback (e.g. if the popover webview ever fails to load).
    let mut tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .tooltip("ProductivityProxy")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match TrayAction::from_menu_id(event.id().as_ref()) {
            Some(TrayAction::OpenDashboard) => {
                let _ = show_main_window(app.clone());
            }
            Some(TrayAction::Quit) => {
                if let Err(error) = quit_app(app.clone(), app.state::<AppState>()) {
                    log::error!("refusing to quit because proxy cleanup failed: {error}");
                }
            }
            None => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                popover::toggle_popover(tray.app_handle(), rect);
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone()).icon_as_template(true);
    }

    tray.build(app)?;

    Ok(())
}
