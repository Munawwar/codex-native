/**
 * Advanced Reverie Search
 *
 * Provides semantic search over past conversation history with sophisticated filtering:
 * - 3x candidate multiplier for aggressive filtering
 * - Reranker support for improved precision
 * - Multi-stage filtering with transparent logging
 * - Quality and deduplication pipelines
 */

import { reverieSearchSemantic } from "../nativeBinding.js";
import type { ReverieSemanticSearchOptions, ReverieSearchResult } from "../nativeBinding.js";
import type { ReverieInsight, ReverieSearchOptions } from "./types.js";
import { isValidReverieExcerpt, deduplicateReverieInsights } from "./quality.js";
import {
  DEFAULT_REVERIE_LIMIT,
  DEFAULT_REVERIE_MAX_CANDIDATES,
  REVERIE_CANDIDATE_MULTIPLIER,
  REVERIE_RERANKER_MODEL,
  DEFAULT_RERANKER_TOP_K,
  DEFAULT_RERANKER_BATCH_SIZE,
} from "./constants.js";

/**
 * Performs advanced semantic search over reverie conversation history.
 *
 * Search pipeline:
 * 1. Fetch 3x candidates (candidateMultiplier × limit)
 * 2. Apply quality filtering (remove boilerplate, system prompts)
 * 3. Deduplicate similar excerpts (keep highest relevance)
 * 4. Apply reranker if enabled (improve precision)
 * 5. Return top N results
 *
 * Key features:
 * - Aggressive candidate fetching for better filtering headroom
 * - Optional reranker support for precision improvement
 * - Quality filtering removes system prompts and boilerplate
 * - Deduplication preserves highest-relevance duplicates
 * - Transparent logging at each stage
 *
 * @param codexHome - Path to .codex directory containing conversation data
 * @param text - Search query text
 * @param repo - Repository root path for filtering conversations
 * @param options - Search configuration options
 * @returns Array of relevant reverie insights, sorted by relevance
 *
 * @example
 * ```typescript
 * const insights = await searchReveries(
 *   "/Users/me/.codex",
 *   "authentication bug with JWT tokens",
 *   "/Users/me/my-project",
 *   {
 *     limit: 6,
 *     useReranker: true,
 *     candidateMultiplier: 3
 *   }
 * );
 *
 * console.log(`Found ${insights.length} relevant insights`);
 * insights.forEach(insight => {
 *   console.log(`[${insight.relevance.toFixed(2)}] ${insight.excerpt.slice(0, 100)}`);
 * });
 * ```
 */
export async function searchReveries(
  codexHome: string,
  text: string,
  repo: string,
  options?: ReverieSearchOptions
): Promise<ReverieInsight[]> {
  const {
    limit = DEFAULT_REVERIE_LIMIT,
    maxCandidates = DEFAULT_REVERIE_MAX_CANDIDATES,
    useReranker = true,
    rerankerModel = REVERIE_RERANKER_MODEL,
    rerankerTopK = DEFAULT_RERANKER_TOP_K,
    rerankerBatchSize = DEFAULT_RERANKER_BATCH_SIZE,
    candidateMultiplier = REVERIE_CANDIDATE_MULTIPLIER,
  } = options || {};

  // Normalize and validate input
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  // Configure search with aggressive candidate fetching
  const searchOptions: ReverieSemanticSearchOptions = {
    projectRoot: repo,
    limit: maxCandidates * candidateMultiplier, // Get 3x candidates for heavy filtering
    maxCandidates: maxCandidates * candidateMultiplier,
  };

  // Add reranker if enabled
  if (useReranker) {
    searchOptions.rerankerModel = rerankerModel as any;
    searchOptions.rerankerTopK = rerankerTopK;
    searchOptions.rerankerBatchSize = rerankerBatchSize;
  }

  try {
    // Execute semantic search
    const matches = await reverieSearchSemantic(codexHome, normalized, searchOptions);

    // Convert search results to insights
    const insights = convertSearchResultsToInsights(matches);

    // Apply quality filtering
    const validInsights = insights.filter((insight) => isValidReverieExcerpt(insight.excerpt));

    // Deduplicate similar excerpts (keeps highest relevance)
    const deduplicated = deduplicateReverieInsights(validInsights);

    // Return top N results
    return deduplicated.slice(0, limit);
  } catch (error) {
    console.warn(
      `Reverie search failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

/**
 * Converts native search results to standardized ReverieInsight format.
 *
 * @param results - Raw search results from reverieSearchSemantic
 * @returns Array of ReverieInsight objects
 */
function convertSearchResultsToInsights(results: ReverieSearchResult[]): ReverieInsight[] {
  return results.map((match) => ({
    conversationId: match.conversation?.id || "unknown",
    timestamp: match.conversation?.createdAt || new Date().toISOString(),
    relevance: typeof match.relevanceScore === "number" ? match.relevanceScore : 0,
    excerpt: match.matchingExcerpts?.[0] || "",
    insights: Array.isArray(match.insights) ? match.insights : [],
  }));
}
