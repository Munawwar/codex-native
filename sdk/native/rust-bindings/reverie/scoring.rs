fn normalize_semantic_score(value: f64) -> f64 {
  ((value + 1.0) / 2.0).clamp(0.0, 1.0)
}

fn normalize_keyword_score(value: usize) -> f64 {
  if value == 0 {
    0.0
  } else {
    (value as f64) / ((value as f64) + KEYWORD_SCORE_SMOOTHING)
  }
}

fn blend_similarity_scores(
  semantic_component: f64,
  keyword_component: f64,
  recency_component: f64,
  importance_component: f64,
) -> f64 {
  (semantic_component * SEMANTIC_SCORE_WEIGHT)
    + (keyword_component * KEYWORD_SCORE_WEIGHT)
    + (recency_component.clamp(0.0, 1.0) * RECENCY_SCORE_WEIGHT)
    + (importance_component.clamp(0.0, 1.0) * IMPORTANCE_SCORE_WEIGHT)
}

fn conversation_lexical_score(conversation: &ReverieConversation, keyword_text: &str) -> usize {
  conversation
    .head_records_toon
    .iter()
    .chain(conversation.tail_records_toon.iter())
    .take(20)
    .map(|line| score_query_relevance(line, keyword_text))
    .max()
    .unwrap_or(0)
}

fn recency_score(updated_at: &Option<String>) -> f64 {
  if let Some(ts) = updated_at
    && let Ok(dt) = DateTime::parse_from_rfc3339(ts)
  {
    let utc: DateTime<Utc> = dt.with_timezone(&Utc);
    let age_seconds = (Utc::now() - utc).num_seconds().max(0) as f64;
    let age_days = age_seconds / 86_400.0;
    let lambda = 0.05_f64; // ~half-life of ~14 days
    return (-lambda * age_days).exp().clamp(0.0, 1.0);
  }
  0.5
}

fn compute_conversation_importance(message_matches: &[MessageMatch], message_chunks: &[String]) -> f64 {
  if message_matches.is_empty() {
    return 0.0;
  }

  let mut best = 0usize;
  for entry in message_matches.iter().take(8) {
    if let Some(text) = message_chunks.get(entry.message_idx) {
      let local = score_message_importance(text);
      if local > best {
        best = local;
      }
    }
  }

  (best as f64 / 20.0).clamp(0.0, 1.0)
}

fn extract_insight_from_json(value: &serde_json::Value) -> Option<String> {
  // Extract meaningful content from JSON records, excluding system prompts

  // First classify the message type
  let msg_type = classify_message_type(value);

  // Skip system prompts and tool outputs
  if msg_type == MessageType::System || msg_type == MessageType::Tool {
    return None;
  }

  // Extract text content
  let text = extract_text_content(value)?;

  // Final check: ensure it's not an instruction marker
  if contains_instruction_marker(&text) {
    return None;
  }

  Some(text)
}

fn derive_insights_for_semantic(head_records_toon: &[String], tail_records_toon: &[String]) -> Vec<String> {
  let mut insights = Vec::new();
  let mut seen_prefixes: HashSet<String> = HashSet::new();

  // TOON-encoded records are already in LLM-friendly format, but filter for quality
  for record in head_records_toon.iter().chain(tail_records_toon.iter()) {
    if insights.len() >= MAX_INSIGHTS_PER_CONVERSATION {
      break;
    }

    let trimmed = record.trim();

    // Quality check: require substantive content (100+ chars minimum)
    if trimmed.len() < 100 {
      continue;
    }

    // Quality check: skip if looks like metadata/JSON/code blocks
    if trimmed.starts_with('{')
      || trimmed.starts_with('[')
      || trimmed.starts_with("```")
      || trimmed.starts_with("type:")
      || trimmed.starts_with("id:")
    {
      continue;
    }

    let lowercase = trimmed.to_lowercase();

    // Quality check: skip if starts with common system/thinking markers
    if lowercase.starts_with("**")
      || lowercase.starts_with("context")
      || lowercase.starts_with("hello")
      || lowercase.starts_with("#")
      || lowercase.starts_with("<")
    {
      continue;
    }

    // Quality check: require lexical diversity (not just repetitive text)
    let unique_words: HashSet<&str> = lowercase.split_whitespace().collect();
    let total_words = lowercase.split_whitespace().count();
    if total_words > 0 && (unique_words.len() as f64 / total_words as f64) < 0.4 {
      continue; // Skip if less than 40% unique words (too repetitive)
    }

    // Deduplicate by checking if we've seen similar content
    // Take first 60 chars as a fingerprint (after any timestamp)
    let content_start = if lowercase.starts_with("timestamp:") {
      trimmed.find('\n').map(|pos| pos + 1).unwrap_or(0)
    } else {
      0
    };
    let prefix: String = trimmed.chars().skip(content_start).take(60).collect();

    if seen_prefixes.contains(&prefix) {
      continue;
    }

    seen_prefixes.insert(prefix);
    insights.push(trimmed.chars().take(400).collect());
  }

  insights
}

fn build_compact_document(
  conversation: &ReverieConversation,
  insights: &[String],
  query: Option<&str>,
) -> Vec<String> {
  const MAX_CHARS: usize = 6000; // Increased from 4000 to preserve more technical details
  const MAX_MESSAGES: usize = 50; // Increased from 32 to sample more of conversation

  let segments = load_full_conversation_json_segments(&conversation.path, 200); // Load more segments

  // Filter and score messages by relevance to query
  let mut scored_messages: Vec<(String, usize)> = segments
    .iter()
    .filter_map(|value| {
      let msg_type = classify_message_type(value);

      // Skip system prompts and tool outputs entirely
      if msg_type == MessageType::System || msg_type == MessageType::Tool {
        return None;
      }

      // Extract clean content from user/agent messages
      let text = extract_text_content(value)?
        .trim()
        .to_string();

      if text.is_empty() || contains_instruction_marker(&text) {
        return None;
      }

      // Score by query relevance if query provided, otherwise by general importance
      let score = if let Some(q) = query {
        score_query_relevance(&text, q)
      } else {
        score_message_importance(&text)
      };
      Some((text, score))
    })
    .collect();

  // Sort by relevance (descending) to prioritize most relevant messages
  scored_messages.sort_by(|a, b| b.1.cmp(&a.1));

  // Take top messages
  let mut message_chunks: Vec<String> = scored_messages
    .into_iter()
    .take(MAX_MESSAGES)
    .map(|(text, _score)| text)
    .collect();

  // Fallback: if no valid messages found, use TOON records (LLM-friendly format)
  if message_chunks.is_empty() {
    message_chunks = conversation
      .head_records_toon
      .iter()
      .chain(conversation.tail_records_toon.iter())
      .filter(|line| !line.trim().is_empty())
      .take(MAX_MESSAGES)
      .cloned()
      .collect();
  }

  // Add insights at the beginning (they're high-value summaries)
  let mut final_chunks = insights.to_vec();
  final_chunks.extend(message_chunks);

  if final_chunks.is_empty() {
    return Vec::new();
  }

  // Smart truncation: preserve complete messages, don't cut mid-message
  let mut selected = Vec::new();
  let mut total_chars = 0usize;
  for chunk in final_chunks {
    let trimmed = chunk.trim();
    if trimmed.is_empty() {
      continue;
    }

    let chunk_chars = trimmed.chars().count();
    if total_chars + chunk_chars <= MAX_CHARS {
      selected.push(trimmed.to_string());
      total_chars += chunk_chars;
    } else if selected.is_empty() {
      selected.push(truncate_to_chars(trimmed, MAX_CHARS));
      break;
    } else {
      break;
    }
  }

  selected
}

/// Represents a meaningful block extracted from the current conversation
struct ConversationBlock {
  text: String,
  weight: f32,  // Recency and importance weight
  block_type: BlockType,
}

#[derive(Debug, PartialEq)]
enum BlockType {
  UserRequest,       // User messages (define intent)
  AgentResponse,     // Agent explanations
  Implementation,    // Code/technical details
}

/// Extract meaningful blocks from current conversation messages
fn extract_conversation_query_blocks(messages: &[String]) -> Vec<ConversationBlock> {
  let mut blocks = Vec::new();

  for (idx, msg) in messages.iter().enumerate() {
    // Parse message as JSON if possible to get structured content
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(msg) {
      // Extract text content
      if let Some(text) = extract_text_content(&value) {
        let trimmed = text.trim();
        if trimmed.is_empty() || trimmed.len() < 20 {
          continue;
        }

        // Determine block type by message structure only (no content assumptions)
        let msg_type = classify_message_type(&value);
        let has_code = trimmed.contains("```") || trimmed.contains("fn ") || trimmed.contains("function ") || trimmed.contains("class ");

        let (block_type, base_weight) = match msg_type {
          MessageType::User => {
            // User messages are prioritized (they define intent)
            (BlockType::UserRequest, 1.3)
          },
          MessageType::Agent => {
            if has_code && trimmed.len() > 300 {
              // Long agent messages with code are likely implementations
              (BlockType::Implementation, 1.2)
            } else {
              (BlockType::AgentResponse, 1.0)
            }
          },
          MessageType::Reasoning => {
            // Reasoning can contain important context
            (BlockType::AgentResponse, 0.9)
          },
          _ => {
            // Tool and System messages filtered elsewhere
            (BlockType::AgentResponse, 0.5)
          }
        };

        // Recency weight: more recent messages are more important
        let recency_weight = 0.5 + (idx as f32 / messages.len() as f32) * 0.5;
        let final_weight = base_weight * recency_weight;

        blocks.push(ConversationBlock {
          text: trimmed.to_string(),
          weight: final_weight,
          block_type,
        });
      }
    } else {
      // Plain text message
      let trimmed = msg.trim();
      if trimmed.len() >= 20 {
        let recency_weight = 0.5 + (idx as f32 / messages.len() as f32) * 0.5;
        blocks.push(ConversationBlock {
          text: trimmed.to_string(),
          weight: recency_weight,
          block_type: BlockType::UserRequest,
        });
      }
    }
  }

  // Sort by weight (highest first) and limit to most important blocks
  blocks.sort_by(|a, b| b.weight.partial_cmp(&a.weight).unwrap_or(std::cmp::Ordering::Equal));
  blocks.truncate(10);  // Top 10 most important blocks

  blocks
}

/// Build a composite query from conversation blocks (fully dynamic, no content assumptions)
fn build_composite_query(blocks: &[ConversationBlock]) -> String {
  if blocks.is_empty() {
    return String::new();
  }

  // Blocks are already sorted by weight (importance * recency)
  // Just take the top weighted blocks for the query
  let query_parts: Vec<&str> = blocks
    .iter()
    .filter(|block| !matches!(block.block_type, BlockType::AgentResponse)) // Prioritize user requests and implementations
    .take(3)
    .map(|block| block.text.as_str())
    .collect();

  // If we don't have enough, include agent responses too
  let final_parts: Vec<&str> = if query_parts.len() < 3 {
    blocks
      .iter()
      .take(5)
      .map(|block| block.text.as_str())
      .collect()
  } else {
    query_parts
  };

  // Join with spacing, truncate if too long
  let composite = final_parts.join(" ");
  if composite.len() > 2000 {
    composite.chars().take(2000).collect()
  } else {
    composite
  }
}

