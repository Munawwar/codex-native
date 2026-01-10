use crate::opencode_auth::OpenCodeAuthEntry;
use http::HeaderMap;
use reqwest::Client;
use thiserror::Error;

/// Copilot token endpoint response (subset).
#[derive(Debug, Clone, PartialEq)]
pub struct CopilotToken {
    pub token: String,
    pub expires_at: u64,
}

impl CopilotToken {
    pub fn expires_at_ms(&self) -> u64 {
        self.expires_at * 1000
    }
}

#[derive(Debug, Clone)]
pub struct CopilotEndpointInfo {
    pub token_url: String,
    pub base_url: String,
}

#[derive(Debug, Error)]
pub enum CopilotTokenRefreshError {
    #[error("missing refresh token in OpenCode auth.json entry")]
    MissingRefreshToken,

    #[error("token refresh HTTP request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),

    #[error("token refresh failed with HTTP status {status}: {body}")]
    HttpStatus { status: u16, body: String },
}

/// Fetch a fresh Copilot access token using the OpenCode OAuth refresh token.
///
/// This mirrors OpenCode's logic: it calls the GitHub internal Copilot token endpoint using
/// the stored `refresh` token as the bearer, and expects `token` + `expires_at` in response.
pub async fn fetch_copilot_token(
    client: &Client,
    endpoint: &CopilotEndpointInfo,
    headers: HeaderMap,
    entry: &OpenCodeAuthEntry,
) -> Result<CopilotToken, CopilotTokenRefreshError> {
    let refresh = entry
        .refresh
        .as_ref()
        .ok_or(CopilotTokenRefreshError::MissingRefreshToken)?;

    let resp = client
        .get(&endpoint.token_url)
        .header(http::header::ACCEPT, "application/json")
        .header(http::header::AUTHORIZATION, format!("Bearer {refresh}"))
        .headers(headers)
        .send()
        .await?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(CopilotTokenRefreshError::HttpStatus {
            status: status.as_u16(),
            body,
        });
    }

    let env: serde_json::Value = resp.json().await?;
    let token = env
        .get("token")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let expires_at = env
        .get("expires_at")
        .and_then(serde_json::Value::as_u64)
        .unwrap_or_default();

    Ok(CopilotToken { token, expires_at })
}

impl CopilotEndpointInfo {
    pub fn github_dot_com() -> Self {
        Self::for_domain("github.com")
    }

    pub fn for_domain(domain: &str) -> Self {
        if domain == "github.com" {
            return Self {
                token_url: "https://api.github.com/copilot_internal/v2/token".to_string(),
                base_url: crate::DEFAULT_COPILOT_BASE_URL.to_string(),
            };
        }

        // Mirrors https://github.com/anomalyco/opencode-copilot-auth baseURL selection:
        // - token refresh: https://api.<domain>/copilot_internal/v2/token
        // - chat API: https://copilot-api.<domain>
        Self {
            token_url: format!("https://api.{domain}/copilot_internal/v2/token"),
            base_url: format!("https://copilot-api.{domain}"),
        }
    }
}
