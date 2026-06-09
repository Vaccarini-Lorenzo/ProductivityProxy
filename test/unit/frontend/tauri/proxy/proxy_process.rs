use productivity_proxy_app::services::proxy::process_service::ProcessService;
use std::time::Duration;

#[test]
fn starts_and_stops_a_real_process() {
    let mut service = ProcessService::new();

    service
        .start("python3", &["-c", "import time; time.sleep(10)"])
        .unwrap();

    assert!(service.is_running().unwrap());

    service.stop().unwrap();

    assert!(!service.is_running().unwrap());
}

#[test]
fn starts_with_owned_string_args() {
    let mut service = ProcessService::new();
    let args = vec!["-c".to_string(), "import time; time.sleep(10)".to_string()];

    service.start_args("python3", &args).unwrap();

    assert!(service.is_running().unwrap());
    service.stop().unwrap();
}

#[test]
fn reports_process_that_exits_during_startup() {
    let mut service = ProcessService::new();

    let error = service
        .start_and_confirm("sh", &["-c", "exit 2"], Duration::from_millis(100))
        .unwrap_err();

    assert_eq!(error.kind(), std::io::ErrorKind::BrokenPipe);
}

#[test]
fn rejects_start_when_process_is_already_running() {
    let mut service = ProcessService::new();

    service
        .start("python3", &["-c", "import time; time.sleep(10)"])
        .unwrap();

    let error = service
        .start("python3", &["-c", "import time; time.sleep(10)"])
        .unwrap_err();

    service.stop().unwrap();

    assert_eq!(error.kind(), std::io::ErrorKind::AlreadyExists);
}
