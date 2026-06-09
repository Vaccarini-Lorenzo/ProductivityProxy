use std::io::{Error, ErrorKind, Result};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::Duration;

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

    fn spawn(&self, command: &str, args: &[&str]) -> Result<Child> {
        Command::new(command)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
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
