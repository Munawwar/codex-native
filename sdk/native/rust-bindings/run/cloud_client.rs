fn build_cloud_client(
  base_url: Option<String>,
  api_key: Option<String>,
) -> anyhow::Result<cloud::HttpClient> {
  let base = base_url.unwrap_or_else(|| "https://chatgpt.com/backend-api".to_string());
  let ua = default_client::get_codex_user_agent();
  let mut client = cloud::HttpClient::new(base.clone())?.with_user_agent(ua);
  if let Some(token) = api_key.or_else(|| std::env::var("CODEX_API_KEY").ok()) {
    client = client.with_bearer_token(token);
  }
  Ok(client)
}

