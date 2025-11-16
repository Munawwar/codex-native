/**
 * Reverie Quality Utilities
 *
 * Re-exports quality utilities from @codex-native/sdk for consistency.
 */

import {
  isValidReverieExcerpt as sdkIsValidReverieExcerpt,
  deduplicateReverieInsights as sdkDeduplicateReverieInsights,
  type ReverieInsight,
} from "@codex-native/sdk";
import type { ReverieResult } from "./types.js";

/**
 * Validates whether a reverie excerpt contains meaningful content worth indexing.
 *
 * @param excerpt - The text excerpt to validate
 * @returns true if the excerpt contains meaningful content, false otherwise
 */
export function isValidReverieExcerpt(excerpt: string): boolean {
  return sdkIsValidReverieExcerpt(excerpt);
}

/**
 * Removes duplicate or highly similar reverie insights based on content fingerprinting.
 *
 * @param insights - Array of reverie results to deduplicate
 * @returns Deduplicated array of reverie results, preserving highest relevance
 */
export function deduplicateReverieInsights(insights: ReverieResult[]): ReverieResult[] {
  // Convert ReverieResult to ReverieInsight (they have the same shape)
  const asInsights = insights as unknown as ReverieInsight[];
  const deduplicated = sdkDeduplicateReverieInsights(asInsights);
  // Convert back to ReverieResult
  return deduplicated as unknown as ReverieResult[];
}
