/**
 * Reverie Quality Utilities
 *
 * Provides filtering, deduplication, and quality assessment for reverie search results.
 * Ensures that only meaningful conversation excerpts are surfaced to agents and users.
 */

/**
 * Represents a single reverie insight from past conversations.
 * This is a generic interface that can be extended with additional metadata.
 */
export interface ReverieInsight {
  /** Unique identifier for the conversation */
  conversationId: string;
  /** ISO timestamp of when the conversation occurred */
  timestamp: string;
  /** Relevance score from semantic search (0-1) */
  relevance: number;
  /** Text excerpt from the conversation */
  excerpt: string;
  /** Extracted insights or key points from the excerpt */
  insights: string[];
}

/**
 * Type alias for reverie results (used for logging compatibility).
 */
export type ReverieResult = ReverieInsight;

/**
 * Statistics from the quality filtering pipeline.
 */
export interface QualityFilterStats {
  /** Number of insights before filtering */
  initial: number;
  /** Number after validity filtering */
  afterValidityFilter: number;
  /** Number after deduplication */
  afterDeduplication: number;
  /** Final number of insights */
  final: number;
}

/**
 * Validates whether a reverie excerpt contains meaningful content worth indexing.
 *
 * Filters out:
 * - Very short excerpts (< 20 chars)
 * - System prompts and boilerplate text
 * - Tool outputs and structured data
 * - Excerpts with excessive XML/HTML tags
 * - JSON objects and configuration snippets
 *
 * @param excerpt - The text excerpt to validate
 * @returns true if the excerpt contains meaningful content, false otherwise
 *
 * @example
 * ```typescript
 * const excerpt = "Let's refactor the auth module to use async/await";
 * isValidReverieExcerpt(excerpt); // true
 *
 * const systemPrompt = "<INSTRUCTIONS>You are a coding assistant</INSTRUCTIONS>";
 * isValidReverieExcerpt(systemPrompt); // false
 * ```
 */
export function isValidReverieExcerpt(excerpt: string): boolean {
  if (!excerpt || excerpt.trim().length < 20) {
    return false;
  }

  // Skip excerpts that are primarily system prompts or boilerplate
  const skipPatterns = [
    "# AGENTS.md instructions",
    "AGENTS.md instructions for",
    "<INSTRUCTIONS>",
    "<environment_context>",
    "<system>",
    "Sandbox env vars",
    "Tool output:",
    "approval_policy",
    "sandbox_mode",
    "network_access",
    "<cwd>",
    "</cwd>",
    "CODEX_SAN",
    "# Codex Workspace Agent Guide",
    "## Core Expectations",
    "Crates in `codex-rs` use the `codex-` prefix",
    "Install repo helpers",
    "CI Fix Orchestrator",
    "CI Remediation Orchestrator",
    "Branch Intent Analyst",
    "File Diff Inspector",
    "You are coordinating an automated",
    "Respond strictly with JSON",
    "Judge whether each change",
    "Multi-Agent Codex System",
    "orchestrator pattern",
    "<claude_background_info>",
    "</claude_background_info>",
    "function_calls",
    "<invoke",
  ];

  const normalized = excerpt.toLowerCase();

  // Check if excerpt is mostly boilerplate
  const boilerplateCount = skipPatterns.filter((pattern) =>
    normalized.includes(pattern.toLowerCase())
  ).length;

  // If ANY boilerplate patterns found, skip this excerpt (stricter filtering)
  if (boilerplateCount >= 1) {
    return false;
  }

  // Skip excerpts with weird percentage indicators that appear in tool outputs
  // (like "(130%)" or "(89%)" at the end)
  if (/\(\d{2,3}%\)\s*$/.test(excerpt.trim())) {
    return false;
  }

  // Skip excerpts that look like JSON output
  if (excerpt.trim().startsWith("{") && excerpt.includes('"file"')) {
    return false;
  }

  // Skip excerpts that are mostly XML/HTML tags
  const tagCount = (excerpt.match(/<[^>]+>/g) || []).length;
  if (tagCount > 3) {
    return false;
  }

  return true;
}

/**
 * Removes duplicate or highly similar reverie insights based on content fingerprinting.
 *
 * CRITICAL FIX: Groups by fingerprint and keeps the insight with the HIGHEST relevance score.
 * Previous implementations incorrectly kept the first occurrence, which could discard
 * higher-quality duplicates found later in the list.
 *
 * Uses the first 100 characters of each excerpt (normalized) as a fingerprint
 * to identify duplicates. This prevents redundant insights from being shown
 * to the user while preserving the most relevant unique insights.
 *
 * @param insights - Array of reverie insights to deduplicate
 * @returns Deduplicated array of reverie insights, sorted by relevance (highest first)
 *
 * @example
 * ```typescript
 * const insights = [
 *   { excerpt: "We refactored the auth module...", relevance: 0.7, ... },
 *   { excerpt: "We refactored the auth module to use async/await", relevance: 0.9, ... },
 *   { excerpt: "Updated the database schema", relevance: 0.8, ... }
 * ];
 *
 * const deduplicated = deduplicateReverieInsights(insights);
 * // Returns 2 insights: the higher-scoring auth one (0.9) and the database one (0.8)
 * ```
 */
export function deduplicateReverieInsights<T extends ReverieInsight>(insights: T[]): T[] {
  // Group insights by fingerprint, keeping the one with highest relevance
  const fingerprintMap = new Map<string, T>();

  for (const insight of insights) {
    // Create a fingerprint based on first 100 chars
    const fingerprint = insight.excerpt.slice(0, 100).toLowerCase().replace(/\s+/g, " ");

    const existing = fingerprintMap.get(fingerprint);
    if (!existing || insight.relevance > existing.relevance) {
      // Keep the insight with higher relevance
      fingerprintMap.set(fingerprint, insight);
    }
  }

  // Convert back to array and sort by relevance (highest first)
  return Array.from(fingerprintMap.values()).sort((a, b) => b.relevance - a.relevance);
}

/**
 * Applies the complete quality pipeline to reverie insights.
 *
 * Pipeline steps:
 * 1. Filter out invalid excerpts (system prompts, boilerplate, etc.)
 * 2. Deduplicate similar insights, keeping highest relevance
 * 3. Sort by relevance score (highest first)
 * 4. Limit to top N results
 *
 * @param insights - Raw reverie insights from search
 * @param limit - Maximum number of insights to return (default: 10)
 * @returns Filtered, deduplicated, and sorted insights with statistics
 *
 * @example
 * ```typescript
 * const rawInsights = await reverieSearchSemantic(codexHome, query, options);
 * const { insights, stats } = applyQualityPipeline(rawInsights, 5);
 *
 * console.log(`Filtered ${stats.initial} → ${stats.final} insights`);
 * insights.forEach(insight => {
 *   console.log(`[${insight.relevance.toFixed(2)}] ${insight.excerpt.slice(0, 100)}`);
 * });
 * ```
 */
export function applyQualityPipeline<T extends ReverieInsight>(
  insights: T[],
  limit: number = 10
): { insights: T[]; stats: QualityFilterStats } {
  const stats: QualityFilterStats = {
    initial: insights.length,
    afterValidityFilter: 0,
    afterDeduplication: 0,
    final: 0,
  };

  // Step 1: Filter out invalid excerpts
  const validInsights = insights.filter((insight) => isValidReverieExcerpt(insight.excerpt));
  stats.afterValidityFilter = validInsights.length;

  // Step 2: Deduplicate similar insights (keeps highest relevance)
  const deduplicated = deduplicateReverieInsights(validInsights);
  stats.afterDeduplication = deduplicated.length;

  // Step 3: Already sorted by relevance in deduplicateReverieInsights
  // Step 4: Limit to top N
  const final = deduplicated.slice(0, limit);
  stats.final = final.length;

  return { insights: final, stats };
}
