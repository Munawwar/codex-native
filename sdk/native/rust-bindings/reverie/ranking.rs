#[derive(Clone)]
struct SemanticCandidate {
  conversation: ReverieConversation,
  insights: Vec<String>,
  message_chunks: Vec<String>,
}

struct MessageDocRef {
  candidate_idx: usize,
  message_idx: usize,
  keyword_score: usize,
}

struct MessageMatch {
  message_idx: usize,
  semantic_score: f64,
  keyword_score: usize,
}

#[derive(Clone)]
struct RankedMatch {
  doc_text: String,
  result: ReverieSearchResult,
}

impl RankedMatch {
  fn new(candidate: SemanticCandidate, mut message_matches: Vec<MessageMatch>) -> Option<Self> {
    if message_matches.is_empty() {
      return None;
    }

    message_matches.sort_by(|a, b| {
      b
        .semantic_score
        .partial_cmp(&a.semantic_score)
        .unwrap_or(std::cmp::Ordering::Equal)
        .then(b.keyword_score.cmp(&a.keyword_score))
    });

    let SemanticCandidate {
      conversation,
      insights,
      message_chunks,
    } = candidate;

    let best_match = message_matches.first()?;
    let doc_text = message_chunks.get(best_match.message_idx)?.clone();
    let top_k = message_matches.iter().take(3).collect::<Vec<_>>();
    let avg_semantic = top_k
      .iter()
      .map(|entry| entry.semantic_score)
      .sum::<f64>()
      / (top_k.len() as f64);
    let best_keyword_raw = top_k
      .iter()
      .map(|entry| entry.keyword_score)
      .max()
      .unwrap_or(0);

    let semantic_component = normalize_semantic_score(avg_semantic);
    let keyword_component = normalize_keyword_score(best_keyword_raw);
    let recency_component = recency_score(&conversation.updated_at);
    let importance_component = compute_conversation_importance(&message_matches, &message_chunks);
    let blended_score = blend_similarity_scores(
      semantic_component,
      keyword_component,
      recency_component,
      importance_component,
    );

    let mut excerpts = Vec::new();
    for entry in message_matches.iter().take(3) {
      if let Some(text) = message_chunks.get(entry.message_idx) {
        let excerpt = build_excerpt(text);
        if !excerpt.is_empty() {
          excerpts.push(excerpt);
        }
      }
    }

    if excerpts.is_empty() {
      excerpts.push(build_excerpt(&doc_text));
    }

    Some(Self {
      doc_text,
      result: ReverieSearchResult {
        conversation,
        relevance_score: blended_score,
        matching_excerpts: excerpts,
        insights,
        reranker_score: None,
      },
    })
  }
}
