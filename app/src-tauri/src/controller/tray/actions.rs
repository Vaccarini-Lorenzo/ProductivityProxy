#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TrayAction {
    OpenDashboard,
    Quit,
}

impl TrayAction {
    pub fn from_menu_id(id: &str) -> Option<Self> {
        match id {
            "open_dashboard" => Some(Self::OpenDashboard),
            "quit" => Some(Self::Quit),
            _ => None,
        }
    }
}
