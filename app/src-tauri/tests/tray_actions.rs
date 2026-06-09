use productivity_proxy_app::controller::tray::actions::TrayAction;

#[test]
fn maps_menu_ids_to_actions() {
    assert_eq!(TrayAction::from_menu_id("open_dashboard"), Some(TrayAction::OpenDashboard));
    assert_eq!(TrayAction::from_menu_id("quit"), Some(TrayAction::Quit));
    assert_eq!(TrayAction::from_menu_id("unknown"), None);
}
