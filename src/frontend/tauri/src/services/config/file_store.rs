use serde_json::Value;
use std::fs;
use std::io::Result;
use std::path::PathBuf;

pub struct FileStore {
    path: PathBuf,
}

impl FileStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn read_json(&self) -> Result<Value> {
        let text = fs::read_to_string(&self.path)?;
        let value = serde_json::from_str(&text)?;
        Ok(value)
    }

    pub fn write_json(&self, value: &Value) -> Result<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        let text = serde_json::to_string_pretty(value)?;
        let file_name = self
            .path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("file");
        let tmp = self.path.with_file_name(format!("{file_name}.tmp"));
        fs::write(&tmp, text)?;
        fs::rename(&tmp, &self.path)
    }
}
