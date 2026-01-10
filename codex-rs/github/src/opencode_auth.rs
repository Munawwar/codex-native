use serde::Deserialize;
use serde::Serialize;
use std::borrow::Cow;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use url::Url;

/// OpenCode provider IDs for GitHub Copilot.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpenCodeProviderId {
    Copilot,
    CopilotEnterprise,
}

impl OpenCodeProviderId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Copilot => "github-copilot",
            Self::CopilotEnterprise => "github-copilot-enterprise",
        }
    }
}

/// Single entry in OpenCode's auth.json.
///
/// We only care about OAuth tokens. For the Copilot plugin, OpenCode stores:
/// - refresh: GitHub OAuth device flow token (used to mint Copilot tokens)
/// - access: current Copilot token (bearer used against `api.githubcopilot.com`)
/// - expires: unix ms timestamp
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct OpenCodeAuthEntry {
    #[serde(rename = "type")]
    pub entry_type: String,
    pub refresh: Option<String>,
    pub access: Option<String>,
    pub expires: Option<u64>,
    #[serde(rename = "enterpriseUrl", alias = "enterprise_url")]
    pub enterprise_url: Option<String>,
}

impl OpenCodeAuthEntry {
    pub fn is_oauth(&self) -> bool {
        self.entry_type == "oauth"
    }

    pub fn is_access_fresh(&self, now_ms: u64) -> bool {
        self.expires.unwrap_or(0) > now_ms
    }

    pub fn normalized_enterprise_domain(&self) -> Option<Cow<'_, str>> {
        self.enterprise_url.as_deref().and_then(normalize_domain)
    }
}

/// Loaded OpenCode auth.json payload.
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
pub struct OpenCodeAuth {
    raw: HashMap<String, OpenCodeAuthEntry>,
}

impl OpenCodeAuth {
    /// Load the OpenCode auth file from the default location(s).
    ///
    /// OpenCode uses `${XDG_DATA_HOME}/opencode/auth.json` when set, otherwise
    /// `dirs::data_dir()/opencode/auth.json`.
    ///
    /// On macOS, `dirs::data_dir()` maps to `~/Library/Application Support`.
    pub fn load() -> std::io::Result<Option<Self>> {
        let path = find_opencode_auth_path();
        let Some(path) = path else {
            return Ok(None);
        };
        Self::load_from_path(&path).map(Some)
    }

    pub fn load_from_path(path: &PathBuf) -> std::io::Result<Self> {
        let text = fs::read_to_string(path)?;
        let raw: HashMap<String, OpenCodeAuthEntry> = serde_json::from_str(&text)
            .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidData, err))?;
        Ok(Self { raw })
    }

    pub fn save_to_path(&self, path: &PathBuf) -> std::io::Result<()> {
        let json = serde_json::to_string_pretty(&self.raw).map_err(std::io::Error::other)?;
        fs::write(path, json)?;
        Ok(())
    }

    pub fn upsert_entry(&mut self, id: OpenCodeProviderId, entry: OpenCodeAuthEntry) {
        self.raw.insert(id.as_str().to_string(), entry);
    }

    pub fn get(&self, id: OpenCodeProviderId) -> Option<&OpenCodeAuthEntry> {
        self.raw.get(id.as_str())
    }

    pub fn get_any_copilot(&self) -> Option<(OpenCodeProviderId, &OpenCodeAuthEntry)> {
        if let Some(entry) = self.get(OpenCodeProviderId::Copilot) {
            return Some((OpenCodeProviderId::Copilot, entry));
        }
        self.get(OpenCodeProviderId::CopilotEnterprise)
            .map(|entry| (OpenCodeProviderId::CopilotEnterprise, entry))
    }
}

pub fn find_opencode_auth_path() -> Option<PathBuf> {
    // 1) XDG_DATA_HOME override (OpenCode's first choice)
    if let Ok(xdg) = std::env::var("XDG_DATA_HOME")
        && !xdg.trim().is_empty()
    {
        let candidate = PathBuf::from(xdg).join("opencode").join("auth.json");
        if candidate.exists() {
            return Some(candidate);
        }
    }

    // 2) dirs::data_dir (matches OpenCode's Global.Path.data behavior).
    if let Some(dir) = dirs::data_dir() {
        let candidate = dir.join("opencode").join("auth.json");
        if candidate.exists() {
            return Some(candidate);
        }
    }

    // 3) Common Linux-style fallback some tooling uses even on macOS.
    if let Ok(home) = std::env::var("HOME") {
        let candidate = PathBuf::from(&home)
            .join(".local")
            .join("share")
            .join("opencode")
            .join("auth.json");
        if candidate.exists() {
            return Some(candidate);
        }
    }

    // 3) Legacy/uncommon macOS fallback used by some tooling (not OpenCode's default).
    if let Ok(home) = std::env::var("HOME") {
        let candidate = PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("opencode")
            .join("auth.json");
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

fn normalize_domain(value: &str) -> Option<Cow<'_, str>> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Prefer URL parsing when scheme is present; otherwise treat as hostname-ish string.
    if trimmed.contains("://") {
        if let Ok(url) = Url::parse(trimmed)
            && let Some(host) = url.host_str()
            && !host.is_empty()
        {
            return Some(Cow::Owned(host.trim_end_matches('/').to_string()));
        }
        return None;
    }

    Some(Cow::Borrowed(trimmed.trim_end_matches('/')))
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;
    use tempfile::TempDir;

    #[test]
    fn access_freshness_checks_expiry_ms() {
        let entry = OpenCodeAuthEntry {
            entry_type: "oauth".to_string(),
            refresh: Some("refresh".to_string()),
            access: Some("access".to_string()),
            expires: Some(123),
            enterprise_url: None,
        };
        assert!(entry.is_access_fresh(122));
        assert!(!entry.is_access_fresh(123));
        assert!(!entry.is_access_fresh(124));
    }

    #[test]
    fn load_from_path_round_trips() {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("auth.json");

        let raw = r#"{
  "github-copilot": {
    "type": "oauth",
    "refresh": "refresh-token",
    "access": "access-token",
    "expires": 123,
    "enterpriseUrl": "https://example.ghe.com/"
  }
}"#;
        fs::write(&path, raw).expect("write auth.json");

        let auth = OpenCodeAuth::load_from_path(&path).expect("load ok");
        let entry = auth
            .get(OpenCodeProviderId::Copilot)
            .expect("copilot entry");
        assert_eq!(entry.refresh.as_deref(), Some("refresh-token"));
        assert_eq!(
            entry.enterprise_url.as_deref(),
            Some("https://example.ghe.com/")
        );
        assert_eq!(
            entry.normalized_enterprise_domain().as_deref(),
            Some("example.ghe.com")
        );

        let mut updated = auth.clone();
        updated.upsert_entry(
            OpenCodeProviderId::Copilot,
            OpenCodeAuthEntry {
                entry_type: "oauth".to_string(),
                refresh: Some("refresh-2".to_string()),
                access: Some("access-2".to_string()),
                expires: Some(999),
                enterprise_url: Some("example.ghe.com".to_string()),
            },
        );
        updated.save_to_path(&path).expect("save ok");

        let auth2 = OpenCodeAuth::load_from_path(&path).expect("reload ok");
        let entry2 = auth2
            .get(OpenCodeProviderId::Copilot)
            .expect("copilot entry");
        assert_eq!(entry2.refresh.as_deref(), Some("refresh-2"));
        assert_eq!(entry2.enterprise_url.as_deref(), Some("example.ghe.com"));
    }
}
