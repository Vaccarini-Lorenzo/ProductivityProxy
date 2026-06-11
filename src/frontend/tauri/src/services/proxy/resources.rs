use std::process::Command;

/// A point-in-time resource reading for a process.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ResourceSample {
    pub mem_bytes: u64,
    pub cpu_percent: f64,
}

/// Current RSS and CPU% of a process, sampled with `ps`. Returns None if the
/// process is gone or the output can't be parsed. `LC_ALL=C` forces a '.'
/// decimal separator so it parses under any system locale. Works on macOS and
/// Linux; this is the only place the app reads proxy process metrics, so it
/// never touches the Python hot path.
pub fn sample_process(pid: u32) -> Option<ResourceSample> {
    let output = Command::new("ps")
        .env("LC_ALL", "C")
        .args(["-p", &pid.to_string(), "-o", "rss=", "-o", "%cpu="])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    parse_sample(&String::from_utf8_lossy(&output.stdout))
}

fn parse_sample(text: &str) -> Option<ResourceSample> {
    let mut fields = text.split_whitespace();
    let rss_kb: u64 = fields.next()?.parse().ok()?;
    let cpu_percent: f64 = fields.next()?.parse().ok()?;
    Some(ResourceSample {
        mem_bytes: rss_kb * 1024,
        cpu_percent,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ps_output() {
        let sample = parse_sample(" 62720   2.3\n").unwrap();
        assert_eq!(sample.mem_bytes, 62720 * 1024);
        assert_eq!(sample.cpu_percent, 2.3);
    }

    #[test]
    fn rejects_blank_or_partial() {
        assert!(parse_sample("\n").is_none());
        assert!(parse_sample("  12345\n").is_none());
    }
}
