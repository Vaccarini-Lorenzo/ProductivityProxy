use crate::services::proxy::process_service::ProcessService;
use crate::services::system_proxy::{
    load_system_proxy_snapshot, remove_system_proxy_snapshot, restore_system_proxy,
    SystemProxySnapshot,
};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, Weak};
use std::thread;
use std::time::Duration;

pub fn start_proxy_monitor(
    proxy: Weak<Mutex<ProcessService>>,
    snapshot: Weak<Mutex<Option<SystemProxySnapshot>>>,
    lifecycle: Weak<Mutex<()>>,
    snapshot_path: PathBuf,
) {
    thread::spawn(move || loop {
        thread::sleep(proxy_monitor_interval());
        let Some(proxy) = proxy.upgrade() else {
            break;
        };
        let Some(snapshot) = snapshot.upgrade() else {
            break;
        };
        let Some(lifecycle) = lifecycle.upgrade() else {
            break;
        };
        // Same lock order as the commands (lifecycle before proxy) so the
        // check-running + restore is atomic against start/stop/status.
        let Ok(_lifecycle) = lifecycle.lock() else {
            break;
        };
        let running = match proxy.lock() {
            Ok(mut proxy) => proxy.is_running().unwrap_or(false),
            Err(_) => false,
        };
        if running {
            continue;
        }
        match restore_marked_system_proxy(&snapshot, &snapshot_path) {
            Ok(()) => break,
            Err(error) => {
                log::error!("failed to restore system proxy after proxy process exit: {error}");
            }
        }
    });
}

pub fn proxy_startup_grace() -> Duration {
    Duration::from_millis(800)
}

pub fn restore_marked_system_proxy(
    snapshot: &Mutex<Option<SystemProxySnapshot>>,
    snapshot_path: &Path,
) -> Result<(), String> {
    let captured = snapshot.lock().map_err(to_string)?.take();
    let captured = match captured {
        Some(captured) => Some(captured),
        None => load_system_proxy_snapshot(snapshot_path).map_err(to_string)?,
    };
    if let Some(captured) = captured {
        if let Err(error) = restore_system_proxy(&captured) {
            *snapshot.lock().map_err(to_string)? = Some(captured);
            return Err(to_string(error));
        }
        remove_system_proxy_snapshot(snapshot_path).map_err(to_string)?;
    }
    Ok(())
}

fn proxy_monitor_interval() -> Duration {
    Duration::from_secs(2)
}

fn to_string(error: impl ToString) -> String {
    error.to_string()
}
