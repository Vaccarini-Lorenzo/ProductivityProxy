use productivity_proxy_app::services::proxy::process_service::ProcessService;

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
