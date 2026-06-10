pub mod controller;
pub mod models;
pub mod services;

use controller::commands::{
    network_info, proxy_status, query_events, read_app_config, read_custom_node, read_recent_events,
    shutdown_cleanup, start_proxy, stop_proxy, write_app_config, write_custom_node, AppState,
};
use controller::tray::actions::TrayAction;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, RunEvent, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            read_app_config,
            write_app_config,
            write_custom_node,
            read_custom_node,
            start_proxy,
            stop_proxy,
            proxy_status,
            read_recent_events,
            query_events,
            network_info
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
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building ProductivityProxy")
        .run(|app_handle, event| {
            // Reliable cleanup hook on macOS, where the platform run loop
            // terminates the process without running AppState's Drop.
            if let RunEvent::Exit = event {
                shutdown_cleanup(app_handle.state::<AppState>().inner());
            }
        });
}

fn create_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open_dashboard", "Open Dashboard", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .tooltip("ProductivityProxy")
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match TrayAction::from_menu_id(event.id().as_ref()) {
            Some(TrayAction::OpenDashboard) => show_dashboard(app),
            Some(TrayAction::Quit) => {
                if let Err(error) = stop_proxy(app.state::<AppState>()) {
                    log::error!("refusing to quit because proxy cleanup failed: {error}");
                    return;
                }
                app.exit(0);
            }
            None => {}
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone()).icon_as_template(true);
    }

    tray.build(app)?;

    Ok(())
}

fn show_dashboard(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
