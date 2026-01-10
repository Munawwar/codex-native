use crate::CopilotEndpoints;
use crate::CopilotTokenEnvelope;
use crate::opencode_auth::OpenCodeAuth;
use crate::opencode_auth::OpenCodeAuthEntry;
use crate::token_refresh::CopilotEndpointInfo;
use crate::token_refresh::CopilotTokenRefreshError;
use http::HeaderMap;
use reqwest::Client;
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CopilotAuthToken {
    pub token: String,
    pub base_url: String,
}

#[derive(Debug, Error)]
pub enum CopilotAuthError {
    #[error("OpenCode auth.json not found")]
    AuthFileNotFound,

    #[error("OpenCode auth.json did not contain a github-copilot entry")]
    MissingCopilotEntry,

    #[error("OpenCode github-copilot entry is not oauth")]
    UnsupportedAuthType,

    #[error("OpenCode github-copilot entry missing refresh token")]
    MissingRefreshToken,

    #[error("failed to parse OpenCode auth.json: {0}")]
    Parse(#[from] std::io::Error),

    #[error("failed to refresh Copilot token: {0}")]
    Refresh(#[from] CopilotTokenRefreshError),
}

/// Load a bearer token for GitHub Copilot. If the stored access token is expired, refresh it.
///
/// This intentionally mirrors OpenCode behavior:
/// - Load `${XDG_DATA_HOME}/opencode/auth.json` or `~/.local/share/opencode/auth.json`
/// - Use the stored `refresh` token to call `copilot_internal/v2/token`
/// - Use the returned `token` directly as the API bearer
/// - Use `endpoints.api` when present to select an alternate base URL
pub async fn load_or_refresh_copilot_token(
    client: &Client,
    headers: HeaderMap,
    now_ms: u64,
) -> Result<CopilotAuthToken, CopilotAuthError> {
    let Some(path) = crate::opencode_auth::find_opencode_auth_path() else {
        return Err(CopilotAuthError::AuthFileNotFound);
    };
    let auth = OpenCodeAuth::load_from_path(&path)?;
    let (provider_id, entry) = auth
        .get_any_copilot()
        .ok_or(CopilotAuthError::MissingCopilotEntry)?;

    let entry = ensure_oauth_entry(entry)?;
    if entry.is_access_fresh(now_ms)
        && let Some(token) = entry.access.clone()
    {
        return Ok(CopilotAuthToken {
            token,
            base_url: crate::DEFAULT_COPILOT_BASE_URL.to_string(),
        });
    }

    // Token is missing or expired; refresh it.
    let refresh = entry
        .refresh
        .as_ref()
        .ok_or(CopilotAuthError::MissingRefreshToken)?;

    let endpoint = entry
        .normalized_enterprise_domain()
        .as_deref()
        .map(CopilotEndpointInfo::for_domain)
        .unwrap_or_else(CopilotEndpointInfo::github_dot_com);
    let env = fetch_token_envelope(client, &endpoint, headers, refresh).await?;

    let base_url = env
        .endpoints
        .as_ref()
        .and_then(|e| e.api.as_ref())
        .cloned()
        .unwrap_or_else(|| endpoint.base_url.clone());

    // Persist the refreshed access token back into auth.json so subsequent runs are cheap.
    let mut auth = auth;
    auth.upsert_entry(
        provider_id,
        OpenCodeAuthEntry {
            entry_type: "oauth".to_string(),
            refresh: Some(refresh.to_string()),
            access: Some(env.token.clone()),
            // Refresh a bit early to reduce mid-request expiries.
            expires: Some(
                env.expires_at
                    .saturating_mul(1000)
                    .saturating_sub(5 * 60 * 1000),
            ),
            enterprise_url: entry.enterprise_url.clone(),
        },
    );
    // Best-effort: if we can't write, just continue with the in-memory token.
    let _ = auth.save_to_path(&path);

    Ok(CopilotAuthToken {
        token: env.token,
        base_url,
    })
}

fn ensure_oauth_entry(entry: &OpenCodeAuthEntry) -> Result<OpenCodeAuthEntry, CopilotAuthError> {
    if entry.entry_type != "oauth" {
        return Err(CopilotAuthError::UnsupportedAuthType);
    }
    Ok(entry.clone())
}

async fn fetch_token_envelope(
    client: &Client,
    endpoint: &CopilotEndpointInfo,
    headers: HeaderMap,
    refresh: &str,
) -> Result<CopilotTokenEnvelope, CopilotAuthError> {
    let resp = client
        .get(&endpoint.token_url)
        .header(http::header::ACCEPT, "application/json")
        .header(http::header::AUTHORIZATION, format!("Bearer {refresh}"))
        .headers(headers)
        .send()
        .await
        .map_err(CopilotTokenRefreshError::RequestFailed)?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(CopilotAuthError::Refresh(
            CopilotTokenRefreshError::HttpStatus {
                status: status.as_u16(),
                body,
            },
        ));
    }

    let env = resp
        .json::<CopilotTokenEnvelope>()
        .await
        .map_err(CopilotTokenRefreshError::RequestFailed)?;

    // Some responses omit endpoints; normalize.
    let endpoints = env.endpoints.or(Some(CopilotEndpoints { api: None }));
    Ok(CopilotTokenEnvelope { endpoints, ..env })
}
