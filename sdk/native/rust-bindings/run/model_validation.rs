fn supported_hosted_models_list() -> String {
  codex_core::models_manager::model_presets::supported_model_slugs()
    .into_iter()
    .map(|model| format!("\"{model}\""))
    .collect::<Vec<_>>()
    .join(", ")
}

fn is_supported_hosted_model(model: &str) -> bool {
  codex_core::models_manager::model_presets::supported_model_slugs()
    .into_iter()
    .any(|preset_model| preset_model == model)
}

fn validate_model_name(
  model: Option<&str>,
  oss: bool,
  model_provider: Option<&str>,
) -> napi::Result<()> {
  let Some(model_name) = model else {
    return Ok(());
  };

  let trimmed = model_name.trim();
  if oss && !trimmed.starts_with("gpt-oss:") {
    return Err(napi::Error::from_reason(format!(
      "Invalid model \"{trimmed}\" for OSS mode. Use models prefixed with \"gpt-oss:\", e.g. \"gpt-oss:20b\"."
    )));
  }

  // Only validate against Codex-hosted models when using the default OpenAI provider.
  // For third-party providers (e.g. GitHub Copilot), model names are provider-specific.
  let provider = model_provider.map(str::trim).filter(|v| !v.is_empty());
  let is_default_provider = provider.is_none() || provider == Some("openai");
  if !oss && is_default_provider && !is_supported_hosted_model(trimmed) {
    return Err(napi::Error::from_reason(format!(
      "Invalid model \"{trimmed}\". Supported models are {}.",
      supported_hosted_models_list()
    )));
  }

  Ok(())
}

