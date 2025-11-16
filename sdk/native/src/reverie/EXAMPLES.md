# Reverie Module Examples

Complete examples demonstrating all features preserved from diff-agent.

## Table of Contents

1. [Quality Filtering](#quality-filtering)
2. [Deduplication](#deduplication)
3. [Symbol Extraction](#symbol-extraction)
4. [Semantic Search](#semantic-search)
5. [LLM Grading](#llm-grading)
6. [Complete Pipeline](#complete-pipeline)
7. [File-Specific Search](#file-specific-search)
8. [Custom Logging](#custom-logging)

---

## Quality Filtering

Filters out system prompts, boilerplate, and low-value content.

```typescript
import { isValidReverieExcerpt } from '@codex-native/sdk/reverie';

// Test various excerpt types
const excerpts = [
  // VALID - Contains meaningful technical content
  {
    text: "We refactored the authentication module to use async/await instead of callbacks",
    expected: true
  },
  {
    text: "Fixed the JWT validation bug by adding token expiration checks",
    expected: true
  },

  // INVALID - System prompts
  {
    text: "# AGENTS.md instructions for the coding assistant",
    expected: false
  },
  {
    text: "<INSTRUCTIONS>You are a helpful coding assistant</INSTRUCTIONS>",
    expected: false
  },

  // INVALID - Tool output
  {
    text: "Tool output: (89%) completed",
    expected: false
  },

  // INVALID - JSON objects
  {
    text: '{ "file": "test.ts", "status": "modified" }',
    expected: false
  },

  // INVALID - Too short
  {
    text: "Fixed bug",
    expected: false
  },

  // INVALID - Excessive tags
  {
    text: "<system><context>Working on <file>test.ts</file></context></system>",
    expected: false
  }
];

excerpts.forEach(({ text, expected }) => {
  const result = isValidReverieExcerpt(text);
  console.log(`✓ "${text.slice(0, 50)}..." → ${result} (expected: ${expected})`);
});
```

---

## Deduplication

Removes duplicate excerpts while preserving the highest relevance scores.

**Critical Fix**: The original diff-agent kept the first occurrence. This module correctly keeps the highest-scoring duplicate.

```typescript
import { deduplicateReverieInsights } from '@codex-native/sdk/reverie';

const insights = [
  {
    conversationId: "conv1",
    timestamp: "2024-01-01T10:00:00Z",
    relevance: 0.7,
    excerpt: "We refactored the auth module to use JWT tokens",
    insights: ["Authentication refactoring"]
  },
  {
    conversationId: "conv2",
    timestamp: "2024-01-02T11:00:00Z",
    relevance: 0.9,  // HIGHER SCORE - Should be kept
    excerpt: "We refactored the auth module to use JWT tokens for better security",
    insights: ["Authentication improvement"]
  },
  {
    conversationId: "conv3",
    timestamp: "2024-01-03T12:00:00Z",
    relevance: 0.85,
    excerpt: "Updated database schema to support new user roles",
    insights: ["Database migration"]
  }
];

const deduplicated = deduplicateReverieInsights(insights);

console.log(`Original: ${insights.length} insights`);
console.log(`Deduplicated: ${deduplicated.length} insights`);
console.log(`\nResults (sorted by relevance):`);

deduplicated.forEach((insight, idx) => {
  console.log(`${idx + 1}. [${insight.relevance.toFixed(2)}] ${insight.excerpt.slice(0, 60)}...`);
});

// Output:
// Original: 3 insights
// Deduplicated: 2 insights
//
// Results (sorted by relevance):
// 1. [0.90] We refactored the auth module to use JWT tokens for better...
// 2. [0.85] Updated database schema to support new user roles...
```

---

## Symbol Extraction

Extracts key code symbols from diffs to create focused search queries.

```typescript
import { extractKeySymbols } from '@codex-native/sdk/reverie';

// Example 1: Function definitions
const diff1 = `
+function validateToken(token: string): boolean {
+  const decoded = jwt.verify(token, SECRET);
+  return decoded !== null;
+}
+
+function refreshToken(userId: string): string {
+  const newToken = generateJWT(userId);
+  return newToken;
+}
`;

const symbols1 = extractKeySymbols(diff1);
console.log(`Symbols: ${symbols1}`);
// Output: "validateToken, decoded, refreshToken, newToken, generateJWT"

// Example 2: Class and interface definitions
const diff2 = `
+export class AuthService {
+  constructor(private config: AuthConfig) {}
+
+  async authenticate(credentials: UserCredentials): Promise<User> {
+    const user = await this.verifyCredentials(credentials);
+    return user;
+  }
+}
+
+interface AuthConfig {
+  secret: string;
+}
`;

const symbols2 = extractKeySymbols(diff2);
console.log(`Symbols: ${symbols2}`);
// Output: "AuthService, config, authenticate, user, AuthConfig"

// Example 3: No symbols found
const diff3 = `
+// Just a comment
+const x = 1;
`;

const symbols3 = extractKeySymbols(diff3);
console.log(`Symbols: ${symbols3}`);
// Output: "code changes"

// Use in search query
const filePath = "src/auth/jwt.ts";
const query = `File: ${filePath}\nImplementing: ${symbols1}`;
console.log(`\nSearch query:\n${query}`);
```

---

## Semantic Search

Advanced search with 3x candidate multiplier and optional reranking.

```typescript
import { searchReveries } from '@codex-native/sdk/reverie';

const codexHome = process.env.CODEX_HOME || "~/.codex";
const repo = "/path/to/my/project";

// Example 1: Basic search
const basicInsights = await searchReveries(
  codexHome,
  "authentication bug with JWT tokens",
  repo
);

console.log(`Found ${basicInsights.length} insights`);
basicInsights.forEach((insight, idx) => {
  console.log(`${idx + 1}. [${insight.relevance.toFixed(2)}] ${insight.excerpt.slice(0, 80)}`);
});

// Example 2: Advanced search with reranking
const advancedInsights = await searchReveries(
  codexHome,
  "fix database connection timeout errors",
  repo,
  {
    limit: 6,
    maxCandidates: 80,
    useReranker: true,
    candidateMultiplier: 3,  // Fetch 240 candidates total
    rerankerTopK: 20,
    rerankerBatchSize: 8
  }
);

console.log(`\nAdvanced search results: ${advancedInsights.length}`);

// Example 3: Custom configuration
const customInsights = await searchReveries(
  codexHome,
  "performance optimization for large datasets",
  repo,
  {
    limit: 10,
    maxCandidates: 100,
    useReranker: false,  // Skip reranker for speed
    candidateMultiplier: 2
  }
);

console.log(`\nCustom search results: ${customInsights.length}`);
```

---

## LLM Grading

Uses LLM to filter out generic content and keep only specific technical details.

```typescript
import { gradeReverieRelevance, gradeReveriesInParallel } from '@codex-native/sdk/reverie';
import type { ReverieInsight } from '@codex-native/sdk/reverie';

// Mock runner for demonstration (use real CodexProvider in production)
const runner = {
  async run(agent: any, prompt: string) {
    // Simulate LLM evaluation
    const lowQualityPatterns = ['greeting', 'thank you', '**thinking**'];
    const isLowQuality = lowQualityPatterns.some(p => prompt.toLowerCase().includes(p));
    return { finalOutput: isLowQuality ? "no" : "yes" };
  }
};

// Example 1: Grade single insight
const context = "Fixing authentication token validation bug";

const insight1: ReverieInsight = {
  conversationId: "conv1",
  timestamp: "2024-01-01T10:00:00Z",
  relevance: 0.85,
  excerpt: "We fixed the JWT validation by adding proper expiration checks in the middleware",
  insights: ["JWT fix"]
};

const isRelevant = await gradeReverieRelevance(runner, context, insight1);
console.log(`Insight 1 relevant: ${isRelevant}`); // true

// Example 2: Grade multiple insights in parallel
const insights: ReverieInsight[] = [
  {
    conversationId: "conv1",
    timestamp: "2024-01-01T10:00:00Z",
    relevance: 0.9,
    excerpt: "Added token expiration validation in authMiddleware.ts using jwt.verify()",
    insights: ["Token validation"]
  },
  {
    conversationId: "conv2",
    timestamp: "2024-01-02T11:00:00Z",
    relevance: 0.85,
    excerpt: "Updated the authentication flow to handle edge cases",
    insights: ["Auth improvement"]
  },
  {
    conversationId: "conv3",
    timestamp: "2024-01-03T12:00:00Z",
    relevance: 0.75,
    excerpt: "**Thinking about** the best approach for this problem",
    insights: ["Thinking"]
  },
  {
    conversationId: "conv4",
    timestamp: "2024-01-04T13:00:00Z",
    relevance: 0.6,  // Below threshold
    excerpt: "Some generic context from past work",
    insights: ["Context"]
  }
];

const approved = await gradeReveriesInParallel(
  runner,
  context,
  insights,
  {
    minRelevanceForGrading: 0.7,  // Only grade ≥0.7
    parallel: true
  }
);

console.log(`\nGraded ${insights.length} insights:`);
console.log(`High-scoring (≥0.7): ${insights.filter(i => i.relevance >= 0.7).length}`);
console.log(`Low-scoring (<0.7): ${insights.filter(i => i.relevance < 0.7).length}`);
console.log(`Approved by LLM: ${approved.length}`);

approved.forEach((insight, idx) => {
  console.log(`${idx + 1}. [${insight.relevance.toFixed(2)}] ${insight.excerpt.slice(0, 60)}...`);
});
```

---

## Complete Pipeline

Orchestrates the full search and filtering process.

```typescript
import { applyReveriePipeline } from '@codex-native/sdk/reverie';
import { CodexProvider } from '@codex-native/sdk';
import { Runner } from '@openai/agents';

const codexHome = process.env.CODEX_HOME || "~/.codex";
const repo = "/path/to/my/project";

// Create runner for LLM grading
const provider = new CodexProvider({
  workingDirectory: repo,
  defaultModel: "gpt-5.1-codex-mini"
});
const runner = new Runner({ modelProvider: provider });

// Example 1: Full pipeline with all features
const result = await applyReveriePipeline(
  codexHome,
  "Fix authentication token validation in JWT middleware",
  repo,
  runner,
  {
    limit: 6,
    maxCandidates: 80,
    useReranker: true,
    candidateMultiplier: 3,
    minRelevanceForGrading: 0.7,
    parallel: true
  }
);

console.log('Pipeline Statistics:');
console.log(`  Raw candidates: ${result.stats.total}`);
console.log(`  After quality filter: ${result.stats.afterQuality}`);
console.log(`  High-scoring (≥0.7): ${result.stats.afterScore}`);
console.log(`  After LLM grading: ${result.stats.afterLLMGrade}`);
console.log(`  After deduplication: ${result.stats.afterDedup}`);
console.log(`  Final results: ${result.stats.final}`);

console.log('\nApproved Insights:');
result.insights.forEach((insight, idx) => {
  console.log(`${idx + 1}. [${insight.relevance.toFixed(2)}] ${insight.insights[0] || 'Context'}`);
  console.log(`   "${insight.excerpt.slice(0, 100)}..."`);
});

// Example 2: Fast mode without LLM grading
const fastResult = await applyReveriePipeline(
  codexHome,
  "Database connection timeout errors",
  repo,
  null,  // No runner needed
  {
    skipLLMGrading: true,
    limit: 6
  }
);

console.log(`\nFast mode: ${fastResult.stats.total} → ${fastResult.stats.final}`);
```

---

## File-Specific Search

Optimized pipeline for individual file contexts.

```typescript
import { applyFileReveriePipeline, extractKeySymbols } from '@codex-native/sdk/reverie';

const codexHome = process.env.CODEX_HOME || "~/.codex";
const repo = "/path/to/my/project";

// Simulate file change with diff
const filePath = "src/auth/jwt.ts";
const diff = `
+function validateToken(token: string): TokenPayload | null {
+  try {
+    const decoded = jwt.verify(token, process.env.JWT_SECRET);
+    return decoded as TokenPayload;
+  } catch (error) {
+    logger.error('Token validation failed', error);
+    return null;
+  }
+}
`;

// Extract symbols for focused search
const symbols = extractKeySymbols(diff);
console.log(`Extracted symbols: ${symbols}`);

// Build file context
const fileContext = `File: ${filePath}\nImplementing changes related to: ${symbols}`;

// Run file-specific pipeline
const result = await applyFileReveriePipeline(
  codexHome,
  filePath,
  fileContext,
  repo,
  runner,
  {
    limit: 3,  // Fewer results for file-specific
    minRelevanceForGrading: 0.75
  }
);

console.log(`\nFile-specific results for ${filePath}:`);
console.log(`Found ${result.insights.length} relevant insights`);

result.insights.forEach((insight, idx) => {
  console.log(`\n${idx + 1}. [${insight.relevance.toFixed(2)}] ${insight.insights[0] || 'Context'}`);
  console.log(`   From: ${new Date(insight.timestamp).toLocaleDateString()}`);
  console.log(`   "${insight.excerpt.slice(0, 150)}..."`);
});
```

---

## Custom Logging

Transparent logging at every pipeline stage.

```typescript
import {
  logReverieSearch,
  logReverieFiltering,
  logReverieInsights,
  logLLMGrading,
  logApprovedReveries,
  truncateText
} from '@codex-native/sdk/reverie';

// Example 1: Log search operation
logReverieSearch(
  "authentication bug with JWT tokens",
  "repo: /path/to/project"
);
// Output: 🔍 Reverie search (repo: /path/to/project): "authentication bug with JWT tokens"

// Example 2: Log filtering statistics
logReverieFiltering({
  total: 240,           // Raw candidates (80 × 3)
  afterQuality: 180,    // After quality filter
  afterScore: 60,       // High-scoring (≥0.7)
  afterDedup: 50,       // After deduplication
  minScore: 0.7
});
// Output: 📊 Reverie filtering: 240 raw → 180 valid → 60 high-scoring (≥0.7) → 50 unique
//         (filtered: 60 low-quality, 120 low-score, 10 duplicates)

// Example 3: Log LLM grading results
logLLMGrading({
  total: 60,
  approved: 42,
  rejected: 18,
  minScore: 0.7
});
// Output: 🤖 LLM grading: 42/60 approved (70%) [high-scoring ≥0.7, rejected 18]

// Example 4: Log approved reveries with excerpts
const approvedInsights = [
  {
    conversationId: "conv1",
    timestamp: "2024-01-01T10:00:00Z",
    relevance: 0.92,
    excerpt: "We fixed the JWT validation bug by adding proper token expiration checks in the middleware layer",
    insights: ["JWT validation fix"]
  },
  {
    conversationId: "conv2",
    timestamp: "2024-01-02T11:00:00Z",
    relevance: 0.88,
    excerpt: "Updated authentication flow to handle edge cases where tokens expire during request processing",
    insights: ["Auth flow improvement"]
  }
];

logApprovedReveries(approvedInsights, 5);
// Output:
//   2 reveries approved by LLM:
//     1. [0.92] JWT validation fix
//        "We fixed the JWT validation bug by adding proper token expiration checks in the middleware layer"
//     2. [0.88] Auth flow improvement
//        "Updated authentication flow to handle edge cases where tokens expire during request processing"

// Example 5: Log top insights
logReverieInsights(approvedInsights, 3);
// Output:
// ✨ Top 2 reverie insights:
//   1. [92%] We fixed the JWT validation bug by adding proper token expiration checks in the middleware layer
//      → JWT validation fix
//   2. [88%] Updated authentication flow to handle edge cases where tokens expire during request processing
//      → Auth flow improvement

// Example 6: Truncate text utility
const longText = "This is a very long excerpt from a conversation that contains lots of technical details about implementation";
console.log(truncateText(longText, 50));
// Output: "This is a very long excerpt from a conversation…"
```

---

## Integration with diff-agent

Drop-in replacement for diff-agent's reverie logic.

```typescript
// ============================================================================
// BEFORE (diff-agent style - lines 421-514)
// ============================================================================

const branchContext = [
  `Working on branch: ${context.branch}`,
  `Files changed: ${context.changedFiles.map(f => f.path).join(", ")}`,
  `Recent work: ${context.recentCommits.split("\n").slice(0, 3).join(" ")}`,
].join("\n");

log.info(`Searching reverie for branch context...`);
const branchInsights = await searchReveries(branchContext, context.repoPath);

const basicFiltered = branchInsights.filter(match => isValidReverieExcerpt(match.excerpt));
const highScoring = basicFiltered.filter(match => match.relevance >= 0.7);
const lowScoring = basicFiltered.filter(match => match.relevance < 0.7);

log.info(`Found ${branchInsights.length} matches, ${basicFiltered.length} pass basic quality, ${highScoring.length} high-scoring`);
log.info(`Using LLM to grade ${highScoring.length} high-scoring reveries...`);

const gradingPromises = highScoring.map(insight =>
  gradeReverieRelevance(runner, branchContext, insight)
    .then(isRelevant => ({ insight, isRelevant }))
);

const gradedResults = await Promise.all(gradingPromises);
const validBranchInsights = gradedResults
  .filter(r => r.isRelevant)
  .map(r => r.insight);

log.info(`LLM approved ${validBranchInsights.length}/${highScoring.length} high-scoring reveries`);

// ============================================================================
// AFTER (reverie module - cleaner and more maintainable)
// ============================================================================

import { applyReveriePipeline } from '@codex-native/sdk/reverie';

const branchContext = [
  `Working on branch: ${context.branch}`,
  `Files changed: ${context.changedFiles.map(f => f.path).join(", ")}`,
  `Recent work: ${context.recentCommits.split("\n").slice(0, 3).join(" ")}`,
].join("\n");

const result = await applyReveriePipeline(
  codexHome,
  branchContext,
  context.repoPath,
  runner,
  {
    limit: DEFAULT_REVERIE_LIMIT,
    minRelevanceForGrading: 0.7
  }
);

const validBranchInsights = result.insights;

// All logging is handled internally by the pipeline
// Statistics available via result.stats
```

---

## Performance Comparison

```typescript
import { performance } from 'perf_hooks';

// Test 1: Quality filtering performance
const testExcerpts = Array(1000).fill(null).map((_, i) => ({
  excerpt: i % 2 === 0
    ? "We refactored the authentication module"
    : "<INSTRUCTIONS>You are a coding assistant",
  relevance: Math.random(),
  conversationId: `conv${i}`,
  timestamp: new Date().toISOString(),
  insights: []
}));

const start1 = performance.now();
const validExcerpts = testExcerpts.filter(i => isValidReverieExcerpt(i.excerpt));
const end1 = performance.now();

console.log(`Quality filtering: ${testExcerpts.length} excerpts in ${(end1 - start1).toFixed(2)}ms`);
console.log(`Filtered: ${testExcerpts.length - validExcerpts.length} low-quality excerpts`);

// Test 2: Deduplication performance
const start2 = performance.now();
const deduplicated = deduplicateReverieInsights(validExcerpts);
const end2 = performance.now();

console.log(`\nDeduplication: ${validExcerpts.length} insights in ${(end2 - start2).toFixed(2)}ms`);
console.log(`Removed: ${validExcerpts.length - deduplicated.length} duplicates`);

// Test 3: Full pipeline performance (mocked)
const start3 = performance.now();
// ... run full pipeline
const end3 = performance.now();

console.log(`\nFull pipeline: ${(end3 - start3).toFixed(2)}ms`);
```

---

## Error Handling

```typescript
import { searchReveries, applyReveriePipeline } from '@codex-native/sdk/reverie';

// Example 1: Handle missing codex home
try {
  const insights = await searchReveries(
    "/nonexistent/path",
    "test query",
    repo
  );
  console.log(`Found ${insights.length} insights`); // Returns [] on error
} catch (error) {
  console.error('Search failed:', error);
}

// Example 2: Handle runner errors
try {
  const result = await applyReveriePipeline(
    codexHome,
    "test query",
    repo,
    brokenRunner,  // Runner that throws errors
    { skipLLMGrading: false }
  );
} catch (error) {
  console.error('Pipeline failed:', error);
}

// Example 3: Skip LLM grading on errors
const safeResult = await applyReveriePipeline(
  codexHome,
  "test query",
  repo,
  null,  // No runner
  {
    skipLLMGrading: true,  // Fallback to quality filtering only
    limit: 6
  }
);

console.log(`Safe mode: ${safeResult.stats.total} → ${safeResult.stats.final}`);
```

---

## All Features from diff-agent

✅ **Constants** (lines 81-84)
- DEFAULT_REVERIE_LIMIT = 6
- DEFAULT_REVERIE_MAX_CANDIDATES = 80
- REVERIE_EMBED_MODEL = "BAAI/bge-large-en-v1.5"
- REVERIE_RERANKER_MODEL = "rozgo/bge-reranker-v2-m3"

✅ **Quality filtering** (lines 115-178)
- isValidReverieExcerpt() with comprehensive patterns

✅ **Deduplication** (lines 594-609)
- deduplicateInsights() with **BUG FIX**: keeps highest relevance

✅ **LLM Grading** (lines 392-419)
- gradeReverieRelevance() with strict technical detail filter
- Only grades relevance >= 0.7 (cost optimization)

✅ **Symbol extraction** (lines 520-541)
- extractKeySymbols() for focused searches

✅ **Advanced search** (lines 543-589)
- 3x candidate multiplier
- Reranker support
- Multi-stage filtering with logging

✅ **Transparent logging** (lines 432-467, 470-507)
- Search context logging
- Filtering statistics
- Approved excerpts with relevance scores
- Approved/rejected counts
