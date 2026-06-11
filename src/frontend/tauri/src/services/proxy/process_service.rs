use std::fs::{create_dir_all, OpenOptions};
use std::io::{Error, ErrorKind, Result, Write};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub struct ProcessService {
    child: Option<Child>,
}

impl ProcessService {
    pub fn new() -> Self {
        Self { child: None }
    }

    pub fn start(&mut self, command: &str, args: &[&str]) -> Result<()> {
        if self.is_running()? {
            return Err(Error::new(ErrorKind::AlreadyExists, "process already running"));
        }

        let child = self.spawn(command, args)?;
        self.child = Some(child);
        Ok(())
    }

    pub fn start_args(&mut self, command: &str, args: &[String]) -> Result<()> {
        let borrowed: Vec<&str> = args.iter().map(String::as_str).collect();
        self.start(command, &borrowed)
    }

    pub fn start_and_confirm(
        &mut self,
        command: &str,
        args: &[&str],
        startup_grace: Duration,
    ) -> Result<()> {
        self.start(command, args)?;
        if !startup_grace.is_zero() {
            thread::sleep(startup_grace);
        }
        if self.is_running()? {
            return Ok(());
        }
        Err(Error::new(ErrorKind::BrokenPipe, "process exited during startup"))
    }

    pub fn start_args_and_confirm(
        &mut self,
        command: &str,
        args: &[String],
        startup_grace: Duration,
    ) -> Result<()> {
        let borrowed: Vec<&str> = args.iter().map(String::as_str).collect();
        self.start_and_confirm(command, &borrowed, startup_grace)
    }

    pub fn start_args_and_confirm_with_log(
        &mut self,
        command: &str,
        args: &[String],
        startup_grace: Duration,
        log_path: &Path,
    ) -> Result<()> {
        let borrowed: Vec<&str> = args.iter().map(String::as_str).collect();
        self.start_with_log(command, &borrowed, log_path)?;
        if !startup_grace.is_zero() {
            thread::sleep(startup_grace);
        }
        if self.is_running()? {
            return Ok(());
        }
        Err(Error::new(ErrorKind::BrokenPipe, "process exited during startup"))
    }

    pub fn stop(&mut self) -> Result<()> {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        Ok(())
    }

    pub fn is_running(&mut self) -> Result<bool> {
        match self.child.as_mut() {
            None => Ok(false),
            Some(child) => match child.try_wait()? {
                None => Ok(true),
                Some(_) => {
                    self.child = None;
                    Ok(false)
                }
            },
        }
    }

    /// PID of the running child, if any. Used to sample its resource usage.
    pub fn pid(&self) -> Option<u32> {
        self.child.as_ref().map(Child::id)
    }

    fn start_with_log(&mut self, command: &str, args: &[&str], log_path: &Path) -> Result<()> {
        if self.is_running()? {
            return Err(Error::new(ErrorKind::AlreadyExists, "process already running"));
        }

        let child = self.spawn_with_log(command, args, log_path)?;
        self.child = Some(child);
        Ok(())
    }

    fn spawn(&self, command: &str, args: &[&str]) -> Result<Child> {
        Command::new(command)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
    }

    fn spawn_with_log(&self, command: &str, args: &[&str], log_path: &Path) -> Result<Child> {
        if let Some(parent) = log_path.parent() {
            create_dir_all(parent)?;
        }
        let started = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or(0);
        let mut marker = OpenOptions::new().create(true).append(true).open(log_path)?;
        writeln!(marker, "\n--- {command} started at unix={started} ---")?;
        drop(marker);

        let stdout = OpenOptions::new().create(true).append(true).open(log_path)?;
        let stderr = OpenOptions::new().create(true).append(true).open(log_path)?;
        Command::new(command)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::from(stdout))
            .stderr(Stdio::from(stderr))
            .spawn()
    }
}

impl Default for ProcessService {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for ProcessService {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}
