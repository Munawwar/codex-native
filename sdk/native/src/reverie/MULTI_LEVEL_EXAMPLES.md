# Multi-Level Reverie Search Examples

This document provides comprehensive examples of using the new multi-level search functionality in the reverie system.

## Overview

The reverie module now supports three levels of search hierarchy:

1. **Project Level**: Repository-wide patterns, architecture, and conventions
2. **Branch Level**: Feature-specific work, branch intent, and changed files
3. **File Level**: Individual file changes with symbol extraction

## Quick Start

```typescript
import {
  buildProjectContext,
  buildBranchContext,
  buildFileContext,
  searchMultiLevel,
  searchProjectLevel,
  searchBranchLevel,
  searchFileLevel,
} from '@codex-native/sdk/reverie';

const codexHome = "/Users/me/.codex";
const repoPath = "/Users/me/my-project";
```

## Example 1: Single-Level Searches

### Project-Level Search

Search for repository-wide patterns and architectural decisions:

```typescript
const projectContext = buildProjectContext(
  "How we handle authentication in this repository",
  {
    repoPath,
    filePatterns: ["src/**/*.ts", "lib/**/*.ts"]
  }
);

const result = await searchProjectLevel(
  codexHome,
  projectContext,
  runner,
  {
    limit: 8,
    useReranker: true,
    minRelevanceForGrading: 0.7
  }
);

console.log(`Found ${result.insights.length} project-wide insights`);
result.insights.forEach(insight => {
  console.log(`[${insight.relevance.toFixed(2)}] ${insight.excerpt.slice(0, 100)}`);
});
```

### Branch-Level Search

Search for work done in a specific feature branch:

```typescript
const branchContext = buildBranchContext(
  "feat/oauth2-integration",
  [
    "src/auth/oauth.ts",
    "src/auth/tokens.ts",
    "src/middleware/auth.ts",
    "test/auth/oauth.test.ts"
  ],
  {
    baseBranch: "main",
    recentCommits: `Add OAuth2 provider support
Implement token refresh mechanism
Add OAuth2 integration tests`,
    repoPath
  }
);

const result = await searchBranchLevel(
  codexHome,
  branchContext,
  runner,
  {
    limit: 6,
    useReranker: true
  }
);

console.log(`Branch insights for feat/oauth2-integration:`);
console.log(`- Total found: ${result.insights.length}`);
console.log(`- Filtered: ${result.stats.total} → ${result.stats.final}`);
```

### File-Level Search

Search for insights related to a specific file change:

```typescript
const diff = `
+export function validateOAuthToken(token: string): boolean {
+  const decoded = jwt.verify(token, process.env.OAUTH_SECRET);
+  return decoded && !isTokenExpired(decoded);
+}
+
+export function refreshOAuthToken(refreshToken: string): Promise<string> {
+  return oauth2Client.refreshAccessToken(refreshToken);
+}
`;

const fileContext = buildFileContext(
  "src/auth/oauth.ts",
  {
    diff,
    extractSymbols: true,  // Automatically extracts: validateOAuthToken, refreshOAuthToken
    repoPath
  }
);

const result = await searchFileLevel(
  codexHome,
  fileContext,
  runner,
  {
    limit: 3,
    minRelevanceForGrading: 0.6
  }
);

console.log(`File-specific insights for src/auth/oauth.ts:`);
console.log(`Symbols: ${fileContext.symbols?.join(', ')}`);
result.insights.forEach(insight => {
  console.log(`- ${insight.insights[0] || insight.excerpt.slice(0, 80)}`);
});
```

## Example 2: Multi-Level Search

Perform searches at all three levels in a single operation:

```typescript
const contexts = [
  // Level 1: Project-wide authentication patterns
  buildProjectContext(
    "Authentication and authorization patterns in this codebase",
    { repoPath }
  ),

  // Level 2: This specific feature branch
  buildBranchContext(
    "feat/oauth2-integration",
    ["src/auth/oauth.ts", "src/auth/tokens.ts", "test/auth/oauth.test.ts"],
    {
      baseBranch: "main",
      recentCommits: "Add OAuth2 support with token refresh",
      repoPath
    }
  ),

  // Level 3: Specific file being modified
  buildFileContext(
    "src/auth/oauth.ts",
    {
      diff: "... git diff content ...",
      extractSymbols: true,
      repoPath
    }
  )
];

const results = await searchMultiLevel(
  codexHome,
  contexts,
  runner,
  {
    limit: 5,
    useReranker: true,
    minRelevanceForGrading: 0.7
  }
);

// Access results by level
const projectInsights = results.get('project')?.insights || [];
const branchInsights = results.get('branch')?.insights || [];
const fileInsights = results.get('file')?.insights || [];

console.log(`\nMulti-level search results:`);
console.log(`- Project level: ${projectInsights.length} insights`);
console.log(`- Branch level: ${branchInsights.length} insights`);
console.log(`- File level: ${fileInsights.length} insights`);

// Log summary
import { logMultiLevelSummary } from '@codex-native/sdk/reverie';
logMultiLevelSummary(results);
```

## Example 3: Context Building Utilities

### Using contextToQuery

Convert structured contexts to search query strings:

```typescript
import { contextToQuery } from '@codex-native/sdk/reverie';

const projectCtx = buildProjectContext("Testing conventions");
const projectQuery = contextToQuery(projectCtx);
// Returns: "Project-wide: Testing conventions"

const branchCtx = buildBranchContext(
  "feat/auth",
  ["auth.ts", "login.ts"],
  { baseBranch: "main" }
);
const branchQuery = contextToQuery(branchCtx);
// Returns:
// "Branch: feat/auth (base: main)
//  Files changed: auth.ts, login.ts"

const fileCtx = buildFileContext(
  "src/auth.ts",
  { symbols: ["validateToken", "refreshToken"] }
);
const fileQuery = contextToQuery(fileCtx);
// Returns:
// "File: src/auth.ts
//  Symbols: validateToken, refreshToken"
```

### Formatting File Lists

```typescript
import { formatFileList } from '@codex-native/sdk/reverie';

const files = [
  "src/auth/oauth.ts",
  "src/auth/tokens.ts",
  "src/middleware/auth.ts",
  "test/auth/oauth.test.ts",
  "test/auth/tokens.test.ts"
];

const formatted = formatFileList(files, 3);
// Returns: "src/auth/oauth.ts, src/auth/tokens.ts, src/middleware/auth.ts ... and 2 more"
```

## Example 4: Integration with Git

Using multi-level search with git information:

```typescript
import { execSync } from 'child_process';

// Get current branch
const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();

// Get changed files
const changedFilesOutput = execSync(
  'git diff --name-only main...HEAD',
  { encoding: 'utf-8' }
);
const changedFiles = changedFilesOutput.trim().split('\n').filter(Boolean);

// Get recent commits
const recentCommits = execSync(
  'git log main..HEAD --oneline --no-merges',
  { encoding: 'utf-8' }
).trim();

// Build branch context from git
const branchContext = buildBranchContext(
  currentBranch,
  changedFiles,
  {
    baseBranch: 'main',
    recentCommits,
    repoPath: process.cwd()
  }
);

// Search for relevant context
const result = await searchBranchLevel(
  codexHome,
  branchContext,
  runner,
  { limit: 6, useReranker: true }
);

console.log(`Found ${result.insights.length} insights for branch ${currentBranch}`);
```

## Example 5: Custom Pipeline Options

Fine-tuning search parameters for each level:

```typescript
// Project level: broader search, more candidates
const projectResult = await searchProjectLevel(
  codexHome,
  buildProjectContext("Database migration patterns", { repoPath }),
  runner,
  {
    limit: 10,
    maxCandidates: 60,  // More candidates for broad search
    useReranker: true,
    minRelevanceForGrading: 0.65,  // Lower threshold for project-wide
    parallel: true
  }
);

// Branch level: balanced search
const branchResult = await searchBranchLevel(
  codexHome,
  buildBranchContext("feat/db-migration", changedFiles, { repoPath }),
  runner,
  {
    limit: 6,
    maxCandidates: 36,  // Default 3x multiplier
    useReranker: true,
    minRelevanceForGrading: 0.7
  }
);

// File level: focused search, fewer candidates
const fileResult = await searchFileLevel(
  codexHome,
  buildFileContext("src/db/migrate.ts", { diff, extractSymbols: true, repoPath }),
  runner,
  {
    limit: 3,
    maxCandidates: 18,  // Halved for file-specific
    useReranker: false,  // Skip reranker for speed
    minRelevanceForGrading: 0.75  // Higher threshold for precision
  }
);
```

## Example 6: Skipping LLM Grading

For faster searches without LLM-based relevance grading:

```typescript
const contexts = [
  buildProjectContext("Error handling patterns", { repoPath }),
  buildBranchContext("fix/error-boundary", changedFiles, { repoPath }),
  buildFileContext("src/ErrorBoundary.tsx", { diff, repoPath })
];

const results = await searchMultiLevel(
  codexHome,
  contexts,
  null,  // No runner needed when skipping LLM grading
  {
    limit: 5,
    useReranker: true,
    skipLLMGrading: true  // Faster but lower quality
  }
);

// Results will be based on semantic search + reranking only
// No LLM-based filtering applied
```

## Example 7: Logging and Monitoring

The multi-level search includes comprehensive logging:

```typescript
import {
  logMultiLevelSearch,
  logLevelResults,
  logMultiLevelSummary
} from '@codex-native/sdk/reverie';

// Automatic logging during searchMultiLevel
const results = await searchMultiLevel(codexHome, contexts, runner);

// Output example:
// 🔍 Multi-level reverie search: 🌐 project → 🌿 branch → 📄 file
//   🌐 Project level: 8 insights (50 → 8, 84% filtered)
//     ↳ Quality: -12, Score: -22, Dedup: -8
//   🌿 Branch level: 6 insights (36 → 6, 83% filtered)
//     ↳ Quality: -8, Score: -16, Dedup: -6
//   📄 File level: 3 insights (18 → 3, 83% filtered)
//     ↳ Quality: -4, Score: -8, Dedup: -3
//
// ✨ Multi-level search complete: 17 total insights
//    (processed 104 candidates across 3 levels)
//    Breakdown: project: 8, branch: 6, file: 3
```

## Type Safety

All context builders and search functions are fully typed:

```typescript
import type {
  ReverieContext,
  ProjectLevelContext,
  BranchLevelContext,
  FileLevelContext,
  ReverieSearchLevel,
  ReveriePipelineResult
} from '@codex-native/sdk/reverie';

// Type-safe context building
const context: ProjectLevelContext = buildProjectContext("...");
const level: ReverieSearchLevel = context.level;  // 'project'

// Type-safe results
const results: Map<ReverieSearchLevel, ReveriePipelineResult> =
  await searchMultiLevel(...);

// Type narrowing
function processContext(ctx: ReverieContext) {
  switch (ctx.level) {
    case 'project':
      console.log(ctx.query);  // Type: ProjectLevelContext
      console.log(ctx.filePatterns);  // OK
      break;
    case 'branch':
      console.log(ctx.branch);  // Type: BranchLevelContext
      console.log(ctx.changedFiles);  // OK
      break;
    case 'file':
      console.log(ctx.filePath);  // Type: FileLevelContext
      console.log(ctx.symbols);  // OK
      break;
  }
}
```

## Best Practices

1. **Use appropriate search levels**:
   - Project level for architecture and conventions
   - Branch level for feature context
   - File level for specific implementations

2. **Optimize candidate counts**:
   - Project: 1.5x default (broader search)
   - Branch: 1x default (standard)
   - File: 0.5x default (focused)

3. **Set relevance thresholds appropriately**:
   - Project: 0.65-0.70 (cast wider net)
   - Branch: 0.70-0.75 (balanced)
   - File: 0.75-0.80 (high precision)

4. **Use symbol extraction for file-level searches**:
   - Automatically extracts function/class names
   - Improves search targeting
   - Reduces false positives

5. **Enable reranker for better quality**:
   - Improves precision significantly
   - Worth the extra latency for important searches
   - Can skip for file-level if speed is critical

6. **Monitor statistics**:
   - Check filter rates (should be 70-90%)
   - Review LLM approval rates
   - Adjust thresholds if needed
