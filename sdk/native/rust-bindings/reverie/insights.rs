#[napi]
pub async fn reverie_get_conversation_insights(
  conversation_path: String,
  query: Option<String>,
) -> napi::Result<Vec<String>> {
  use std::path::Path;
  use tokio::fs;

  let path = Path::new(&conversation_path);

  // Read the conversation file
  let content = fs::read_to_string(path)
    .await
    .map_err(|e| napi::Error::from_reason(format!("Failed to read conversation: {e}")))?;

  let mut insights = Vec::new();
  let lines: Vec<&str> = content.lines().collect();

  for line in lines {
    if line.trim().is_empty() {
      continue;
    }

    if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(line)
      && let Some(insight) = extract_insight_from_json(&json_value)
    {
      // Filter by query if provided
      if let Some(ref q) = query {
        if insight.to_lowercase().contains(&q.to_lowercase()) {
          insights.push(insight);
        }
      } else {
        insights.push(insight);
      }
    }
  }

  // Limit to most relevant insights
  insights.truncate(50);

  Ok(insights)
}

