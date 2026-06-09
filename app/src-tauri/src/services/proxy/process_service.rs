use std::io::{Error, ErrorKind, Result};
use std::process::{Child, Command, Stdio};

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

        let child = Command::new(command)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;
        self.child = Some(child);
        Ok(())
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
