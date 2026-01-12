/// Detect if a term is a technical identifier (CamelCase, PascalCase, snake_case, kebab-case, or has special chars)
fn is_technical_term(term: &str) -> bool {
  // CamelCase or PascalCase (e.g., FastEmbed, fastEmbedInit, TurnItem)
  let has_internal_caps = term.chars().skip(1).any(|c| c.is_uppercase());

  // snake_case or kebab-case (e.g., fast_embed, codex-native)
  let has_separator = term.contains('_') || term.contains('-');

  // Contains numbers or special chars (e.g., @codex-native/sdk, v1.5, gpt-4)
  let has_special = term.chars().any(|c| !c.is_alphabetic() && !c.is_whitespace());

  // Has file extension (e.g., .rs, .ts, .json)
  let is_file = term.contains('.');

  has_internal_caps || has_separator || has_special || is_file
}

/// Extract all technical terms from query before stop-word filtering
fn extract_technical_terms(query: &str) -> Vec<String> {
  query
    .split_whitespace()
    .filter(|term| is_technical_term(term))
    .map(|s| s.to_string())
    .collect()
}

/// Score message relevance to search query (enhanced RAG with stemming and n-grams)
fn score_query_relevance(text: &str, query: &str) -> usize {
  use stop_words::{get, LANGUAGE};
  use rust_stemmers::{Algorithm, Stemmer};

  let text_lower = text.to_lowercase();
  let query_lower = query.to_lowercase();

  // Extract technical terms BEFORE stop word filtering (critical for API names, etc.)
  let technical_terms = extract_technical_terms(query);

  // Extract meaningful query terms (filter out common words)
  let stop_words_set = get(LANGUAGE::English);
  let query_terms: Vec<&str> = query_lower
    .split_whitespace()
    .filter(|term| {
      // Keep if: technical term, longer than 2 chars and not a stop word
      is_technical_term(term) || (term.len() > 2 && !stop_words_set.contains(&term.to_string()))
    })
    .collect();

  if query_terms.is_empty() {
    return score_message_importance(text);
  }

  let mut score = 0;
  let stemmer = Stemmer::create(Algorithm::English);

  // CRITICAL: Exact technical term matching (structural detection, not content assumptions)
  // Technical terms are identified by structure (CamelCase, kebab-case, etc.), not by domain knowledge
  for tech_term in &technical_terms {
    let tech_lower = tech_term.to_lowercase();
    if text_lower.contains(&tech_lower) {
      score += 100; // High value for matching structural technical identifiers

      // Frequency bonus
      let occurrences = text_lower.matches(&tech_lower).count();
      if occurrences > 1 {
        score += (occurrences - 1).min(3) * 20;
      }
    }
  }

  // Exact multi-word phrase match (query appears verbatim in text)
  if text_lower.contains(&query_lower) {
    score += 150;
  }

  // Stem query terms for fuzzy matching
  let stemmed_query: Vec<String> = query_terms
    .iter()
    .map(|term| stemmer.stem(term).to_string())
    .collect();

  // Stem text words for comparison
  let text_words: Vec<&str> = text_lower.split_whitespace().collect();
  let stemmed_text: Vec<String> = text_words
    .iter()
    .map(|word| stemmer.stem(word).to_string())
    .collect();

  // Count matching query terms (both exact and stemmed)
  let mut matched_terms = 0;
  let mut rare_term_bonus = 0;

  for (i, term) in query_terms.iter().enumerate() {
    let mut term_matched = false;
    let mut term_count = 0;

    // Exact match
    let exact_count = text_lower.matches(term).count();
    if exact_count > 0 {
      term_matched = true;
      term_count += exact_count;
      score += 25; // Exact match worth more
    }

    // Stemmed match (catches plurals, tenses, etc.)
    let stemmed_matches = stemmed_text.iter().filter(|w| **w == stemmed_query[i]).count();
    if stemmed_matches > exact_count {
      term_matched = true;
      term_count += stemmed_matches - exact_count;
      score += 15; // Stemmed match worth less than exact
    }

    if term_matched {
      matched_terms += 1;

      // Frequency bonus (but with diminishing returns)
      if term_count > 1 {
        score += (term_count - 1).min(3) * 5;
      }

      // Rare term bonus (longer terms are usually more specific/valuable)
      if term.len() > 8 {
        rare_term_bonus += 10;
      } else if term.len() > 6 {
        rare_term_bonus += 5;
      }
    }
  }

  score += rare_term_bonus;

  // N-gram matching for partial matches (e.g., "FastEmbed" matches "fast" + "embed")
  for term in &query_terms {
    if term.len() > 5 {
      let bigrams = extract_bigrams(term);
      for bigram in bigrams {
        if text_lower.contains(&bigram) {
          score += 8; // Partial match bonus
        }
      }
    }
  }

  // Match ratio bonus (BM25-inspired)
  let match_ratio = matched_terms as f64 / query_terms.len() as f64;
  if match_ratio > 0.7 {
    score += 50; // Most terms matched
  } else if match_ratio > 0.5 {
    score += 30;
  } else if match_ratio > 0.3 {
    score += 15;
  }

  // Proximity scoring: reward terms appearing close together
  if matched_terms >= 2 {
    let proximity_score = calculate_proximity_score(&text_lower, &query_terms);
    score += proximity_score;
  }

  // Add base importance score (weighted lower than query relevance)
  score += score_message_importance(text) / 3;

  score
}

/// Extract character bigrams from a term for partial matching (UTF-8 safe)
fn extract_bigrams(term: &str) -> Vec<String> {
  let chars: Vec<char> = term.chars().collect();
  if chars.len() < 4 {
    return vec![];
  }
  (0..chars.len().saturating_sub(2))
    .map(|i| {
      let end = (i + 3).min(chars.len());
      chars[i..end].iter().collect()
    })
    .collect()
}

/// Calculate proximity score based on how close query terms appear in text
fn calculate_proximity_score(text: &str, query_terms: &[&str]) -> usize {
  let words: Vec<&str> = text.split_whitespace().collect();
  let mut max_proximity = 0;

  // Find positions of query terms
  for (i, word) in words.iter().enumerate() {
    let word_lower = word.to_lowercase();
    for term in query_terms {
      if word_lower.contains(term) {
        // Check nearby words for other query terms
        let window_start = i.saturating_sub(10);
        let window_end = (i + 10).min(words.len());

        let nearby_matches = words[window_start..window_end]
          .iter()
          .filter(|w| {
            let w_lower = w.to_lowercase();
            query_terms.iter().any(|t| w_lower.contains(t))
          })
          .count();

        max_proximity = max_proximity.max(nearby_matches);
      }
    }
  }

  // Reward terms appearing in close proximity
  match max_proximity {
    0..=1 => 0,
    2 => 15,
    3 => 25,
    4..=5 => 35,
    _ => 50,
  }
}

/// Score message importance based on structural properties only (fallback when no query)
/// Relies on semantic embeddings for content understanding
fn score_message_importance(text: &str) -> usize {
  let mut score: usize = 0;

  // Structural indicators only - no content assumptions

  // Has question mark (structural indicator of question)
  if text.contains('?') {
    score += 5;
  }

  // Reasonable length (not too short, not too long)
  if text.len() > 200 && text.len() < 1000 {
    score += 3;
  } else if text.len() >= 100 && text.len() < 200 {
    score += 2;
  }

  // Very short messages are less informative
  if text.len() < 50 {
    score = score.saturating_sub(3);
  }

  // Contains code-like structures (structural)
  if text.contains("```") || text.contains("fn ") || text.contains("function ") || text.contains("class ") {
    score += 4;
  }

  score
}

fn expand_query_terms(query: &str) -> Vec<String> {
  let mut extras = Vec::new();
  let mut seen = HashSet::new();

  for raw in query.split(|c: char| c.is_ascii_punctuation() || c.is_whitespace()) {
    let normalized = raw
      .trim_matches(|ch: char| !ch.is_alphanumeric() && ch != '-' && ch != '_')
      .to_lowercase();
    if normalized.is_empty() {
      continue;
    }
    if !seen.insert(normalized.clone()) {
      continue;
    }
    for synonym in lookup_query_synonyms(&normalized) {
      if seen.insert((*synonym).to_string()) {
        extras.push((*synonym).to_string());
      }
    }
  }

  extras
}

fn lookup_query_synonyms(term: &str) -> &'static [&'static str] {
  match term {
    "slow" | "slowness" => &["latency", "lag", "bottleneck", "performance"],
    "latency" => &["slow", "delay", "lag", "throughput"],
    "lag" => &["latency", "slow", "delay"],
    "performance" => &["latency", "throughput", "optimization", "profiling"],
    "bottleneck" => &["slow", "constraint", "latency"],
    "optimize" | "optimization" => &["improve", "tune", "refine"],
    "improve" | "improvement" => &["optimize", "enhance", "refine"],
    "quality" => &["relevance", "accuracy", "precision"],
    "error" | "errors" => &["bug", "failure", "exception", "crash"],
    "bug" | "bugs" => &["defect", "issue", "error"],
    "failure" | "fail" | "failed" => &["error", "fault", "crash"],
    "crash" | "panic" => &["failure", "exception", "bug"],
    "timeout" | "timeouts" => &["hang", "delay", "latency"],
    "hang" | "hung" => &["freeze", "timeout", "deadlock"],
    "memory" => &["ram", "heap", "allocation"],
    "cpu" => &["processor", "core", "utilization"],
    "network" => &["latency", "connectivity", "bandwidth"],
    "api" | "apis" => &["endpoint", "service", "request"],
    "endpoint" | "endpoints" => &["api", "route", "service"],
    "auth" | "authentication" => &["login", "token", "credentials"],
    "token" | "tokens" => &["auth", "credential", "session"],
    "deploy" | "deployment" => &["release", "ship", "rollout"],
    "release" | "rollout" => &["deploy", "ship", "launch"],
    "search" => &["retrieval", "lookup", "query"],
    "query" | "queries" => &["search", "lookup", "prompt"],
    "index" | "indexing" => &["catalog", "ingest", "register"],
    "embedding" | "embeddings" => &["vector", "semantic", "representation"],
    "rerank" | "reranker" => &["rescore", "rank", "cross-encoder"],
    "similarity" => &["distance", "match", "closeness"],
    "diagnose" => &["debug", "investigate", "triage"],
    "debug" => &["diagnose", "investigate", "trace"],
    "latencies" => &["slow", "delay", "throughput"],
    "throughput" => &["performance", "latency", "capacity"],
    _ => &[],
  }
}
