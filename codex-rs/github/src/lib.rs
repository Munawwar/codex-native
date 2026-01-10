//! GitHub Copilot auth helpers (OpenCode-compatible).
//!
//! Codex supports using GitHub Copilot as an OpenAI-compatible model provider.
//! OpenCode stores Copilot credentials in `auth.json` under the `opencode` data dir.
//! This crate reads those credentials and refreshes Copilot access tokens when needed.
//!
//! Relevant upstream references:
//! - https://github.com/sst/opencode-copilot-auth
//! - https://github.com/sst/opencode/blob/dev/packages/opencode/src/auth/index.ts

mod copilot;
mod opencode_auth;
mod token_refresh;

pub use copilot::CopilotAuthError;
pub use copilot::CopilotAuthToken;
pub use copilot::load_or_refresh_copilot_token;
pub use opencode_auth::OpenCodeAuth;
pub use opencode_auth::OpenCodeAuthEntry;
pub use opencode_auth::OpenCodeProviderId;
pub use opencode_auth::find_opencode_auth_path;
pub use token_refresh::CopilotEndpointInfo;
pub use token_refresh::CopilotToken;
pub use token_refresh::CopilotTokenRefreshError;
pub use token_refresh::fetch_copilot_token;

use http::HeaderMap;
use http::HeaderValue;
use serde::Deserialize;
use serde::Serialize;

/// Default Copilot base URL for the OpenAI-compatible API.
pub const DEFAULT_COPILOT_BASE_URL: &str = "https://api.githubcopilot.com";

/// Add headers expected by GitHub Copilot (mirrors OpenCode defaults).
///
/// Note: Copilot appears to require some of these for routing/feature gating.
pub fn copilot_default_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();

    // From OpenCode Copilot auth plugin (values may not need to be exact, but should
    // be plausible and stable).
    insert_static(&mut headers, "User-Agent", "GitHubCopilotChat/0.35.0");
    insert_static(&mut headers, "Editor-Version", "vscode/1.107.0");
    insert_static(&mut headers, "Editor-Plugin-Version", "copilot-chat/0.35.0");
    insert_static(&mut headers, "Copilot-Integration-Id", "vscode-chat");

    // Extra headers OpenCode sets for chat/responses calls.
    insert_static(&mut headers, "Openai-Intent", "conversation-edits");

    headers
}

fn insert_static(headers: &mut HeaderMap, name: &'static str, value: &'static str) {
    if let (Ok(name), Ok(value)) = (
        http::header::HeaderName::from_bytes(name.as_bytes()),
        HeaderValue::from_str(value),
    ) {
        headers.insert(name, value);
    }
}

/// Minimal view of the token endpoint response.
///
/// OpenCode uses `endpoints.api` to select an alternate base URL (e.g. `api.individual.githubcopilot.com`).
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct CopilotTokenEnvelope {
    pub token: String,
    pub expires_at: u64,
    pub endpoints: Option<CopilotEndpoints>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct CopilotEndpoints {
    pub api: Option<String>,
}
