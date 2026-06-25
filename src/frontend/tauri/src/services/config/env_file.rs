use std::env;
use std::fs;
use std::path::Path;

/// Load the app environment from Application Support.
///
/// Missing files are allowed: the existing runtime env checks still fail fast
/// when a required value is absent.
pub fn load_for_app(app_data_dir: &Path) -> Result<(), String> {
    load_env_file_if_exists(&app_data_dir.join(".env"))?;

    #[cfg(debug_assertions)]
    if let Ok(repo_root) = super::bootstrap::discover_repo_root() {
        load_env_file_if_exists(&repo_root.join(".env"))?;
    }

    Ok(())
}

fn load_env_file_if_exists(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    load_env_text(&content).map_err(|error| format!("{}: {error}", path.display()))
}

fn load_env_text(content: &str) -> Result<(), String> {
    for (index, line) in content.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let line = line.strip_prefix("export ").unwrap_or(line).trim();
        let Some((key, value)) = line.split_once('=') else {
            return Err(format!("line {} is missing '='", index + 1));
        };
        let key = key.trim();
        if !valid_key(key) {
            return Err(format!("line {} has invalid key", index + 1));
        }
        env::set_var(key, parse_value(value.trim()));
    }
    Ok(())
}

fn parse_value(value: &str) -> String {
    if value.len() >= 2 {
        let bytes = value.as_bytes();
        let quote = bytes[0];
        if (quote == b'\'' || quote == b'\"') && bytes[value.len() - 1] == quote {
            return value[1..value.len() - 1].to_string();
        }
    }
    value.to_string()
}

fn valid_key(key: &str) -> bool {
    !key.is_empty()
        && key
            .bytes()
            .all(|byte| byte == b'_' || byte.is_ascii_alphanumeric())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_exported_and_quoted_values() {
        env::remove_var("PP_ENV_FILE_TEST_ALPHA");
        env::remove_var("PP_ENV_FILE_TEST_BETA");

        load_env_text(
            r#"
            # comment
            export PP_ENV_FILE_TEST_ALPHA="one two"
            PP_ENV_FILE_TEST_BETA='three'
            "#,
        )
        .unwrap();

        assert_eq!(env::var("PP_ENV_FILE_TEST_ALPHA").unwrap(), "one two");
        assert_eq!(env::var("PP_ENV_FILE_TEST_BETA").unwrap(), "three");

        env::remove_var("PP_ENV_FILE_TEST_ALPHA");
        env::remove_var("PP_ENV_FILE_TEST_BETA");
    }

    #[test]
    fn rejects_invalid_lines() {
        assert!(load_env_text("PP_ENV_FILE_TEST_NO_VALUE").is_err());
        assert!(load_env_text("PP-ENV-FILE-TEST=value").is_err());
    }
}
