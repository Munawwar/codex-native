import type { ReverieResult } from "./types.js";

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
 * Uses the first 100 characters of each excerpt (normalized) as a fingerprint
 * to identify duplicates. This prevents redundant insights from being shown
 * to the user while preserving the most relevant unique insights.
 *
 * @param insights - Array of reverie results to deduplicate
 * @returns Deduplicated array of reverie results, preserving original order
 */
export function deduplicateReverieInsights(insights: ReverieResult[]): ReverieResult[] {
  const seen = new Set<string>();
  const result: ReverieResult[] = [];

  for (const insight of insights) {
    // Create a fingerprint based on first 100 chars
    const fingerprint = insight.excerpt.slice(0, 100).toLowerCase().replace(/\s+/g, " ");

    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      result.push(insight);
    }
  }

  return result;
}
