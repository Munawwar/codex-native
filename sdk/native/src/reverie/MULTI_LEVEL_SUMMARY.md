# Multi-Level Search Enhancement Summary

## Overview

Enhanced the reverie module to support a three-level search hierarchy, enabling more sophisticated and targeted context gathering from conversation history.

## Enhancement Goals

Transform the reverie system from a single-level search to a multi-level hierarchy that supports:

1. **Project Level**: Repository-wide patterns, architecture, and conventions
2. **Branch Level**: Feature-specific work, branch intent, and changes
3. **File Level**: Individual file modifications with symbol extraction

## Files Modified

### 1. `/Volumes/sandisk/codex/sdk/native/src/reverie/types.ts`

**Changes**: Added multi-level search type definitions

**New Types**:
- `ReverieSearchLevel`: Union type for search levels ('project' | 'branch' | 'file')
- `ProjectLevelContext`: Context for project-wide searches
- `BranchLevelContext`: Context for branch-specific searches
- `FileLevelContext`: Context for file-specific searches
- `ReverieContext`: Union type of all context types

**Lines Added**: ~60 lines of new type definitions

### 2. `/Volumes/sandisk/codex/sdk/native/src/reverie/context.ts` (NEW)

**Purpose**: Context builder utilities for creating structured search contexts

**Exported Functions**:
- `buildProjectContext()`: Build project-level search context
- `buildBranchContext()`: Build branch-level search context
- `buildFileContext()`: Build file-level search context with optional symbol extraction
- `contextToQuery()`: Convert structured contexts to search query strings
- `formatFileList()`: Helper for formatting file lists in contexts

**Features**:
- Automatic symbol extraction from diffs
- Flexible context building with sensible defaults
- Natural language query generation from structured data

**Lines**: ~240 lines

### 3. `/Volumes/sandisk/codex/sdk/native/src/reverie/pipeline.ts`

**Changes**: Added multi-level search orchestration functions

**New Functions**:
- `searchMultiLevel()`: Execute searches at multiple levels
- `searchProjectLevel()`: Project-wide pattern search (1.5x candidates)
- `searchBranchLevel()`: Branch-specific context search (1x candidates)
- `searchFileLevel()`: File-specific change search (0.5x candidates)

**Optimizations**:
- Project searches use 1.5x candidate multiplier for broader coverage
- Branch searches use standard 1x multiplier
- File searches use 0.5x multiplier for focused results
- Sequential execution to avoid overwhelming the system

**Lines Added**: ~220 lines

### 4. `/Volumes/sandisk/codex/sdk/native/src/reverie/logger.ts`

**Changes**: Added level-specific logging utilities

**New Functions**:
- `logMultiLevelSearch()`: Log search initiation with level icons
- `logLevelResults()`: Log results for specific search level
- `logMultiLevelSummary()`: Log comprehensive summary of all levels

**Features**:
- Visual level indicators (🌐 project, 🌿 branch, 📄 file)
- Detailed statistics per level
- Quality breakdown logging
- Multi-level summary with totals

**Lines Added**: ~95 lines

### 5. `/Volumes/sandisk/codex/sdk/native/src/reverie/index.ts`

**Changes**: Updated exports to include new multi-level functionality

**New Exports**:
- Types: `ReverieSearchLevel`, `ReverieContext`, `ProjectLevelContext`, `BranchLevelContext`, `FileLevelContext`
- Functions: `searchMultiLevel`, `searchProjectLevel`, `searchBranchLevel`, `searchFileLevel`
- Context builders: `buildProjectContext`, `buildBranchContext`, `buildFileContext`, `contextToQuery`, `formatFileList`
- Loggers: `logMultiLevelSearch`, `logLevelResults`, `logMultiLevelSummary`

### 6. `/Volumes/sandisk/codex/sdk/native/src/reverie/README.md`

**Changes**: Updated documentation with multi-level search sections

**Additions**:
- Multi-level search feature description
- Multi-level pipeline architecture diagram
- Comprehensive usage examples
- Type definitions for new interfaces
- Updated module structure

### 7. `/Volumes/sandisk/codex/sdk/native/src/reverie/MULTI_LEVEL_EXAMPLES.md` (NEW)

**Purpose**: Comprehensive examples and best practices

**Contents**:
- 7 detailed examples covering all use cases
- Integration with git workflows
- Custom pipeline options per level
- Type safety demonstrations
- Best practices guide

**Lines**: ~450 lines

## Key Features

### 1. Three-Level Search Hierarchy

```typescript
// Project level: Architecture and patterns
const projectContext = buildProjectContext(
  "Authentication patterns in this repository"
);

// Branch level: Feature work and intent
const branchContext = buildBranchContext(
  "feat/oauth2",
  ["src/auth.ts", "src/login.ts"],
  { recentCommits: "Add OAuth2 support" }
);

// File level: Specific changes
const fileContext = buildFileContext(
  "src/auth.ts",
  { diff: "...", extractSymbols: true }
);
```

### 2. Optimized Candidate Counts

Each level uses optimized candidate counts:
- **Project**: 1.5x base (broader search for patterns)
- **Branch**: 1.0x base (balanced for feature context)
- **File**: 0.5x base (focused for specific changes)

### 3. Context Builder Pattern

Structured context building with sensible defaults:

```typescript
const context = buildBranchContext(
  "feat/auth",
  ["auth.ts", "login.ts"],
  {
    baseBranch: "main",           // Optional
    recentCommits: "...",         // Optional
    repoPath: "/path/to/repo"     // Optional, defaults to cwd
  }
);
```

### 4. Automatic Symbol Extraction

File contexts can automatically extract symbols from diffs:

```typescript
const context = buildFileContext(
  "src/auth.ts",
  {
    diff: "+function validateToken(...)\n+function refreshToken(...)",
    extractSymbols: true  // Automatically extracts: ["validateToken", "refreshToken"]
  }
);
```

### 5. Comprehensive Logging

Multi-level searches provide detailed logging:

```
🔍 Multi-level reverie search: 🌐 project → 🌿 branch → 📄 file
  🌐 Project level: 8 insights (50 → 8, 84% filtered)
    ↳ Quality: -12, Score: -22, Dedup: -8
  🌿 Branch level: 6 insights (36 → 6, 83% filtered)
    ↳ Quality: -8, Score: -16, Dedup: -6
  📄 File level: 3 insights (18 → 3, 83% filtered)
    ↳ Quality: -4, Score: -8, Dedup: -3

✨ Multi-level search complete: 17 total insights
   (processed 104 candidates across 3 levels)
   Breakdown: project: 8, branch: 6, file: 3
```

### 6. Type Safety

Full TypeScript support with discriminated unions:

```typescript
type ReverieContext =
  | ProjectLevelContext
  | BranchLevelContext
  | FileLevelContext;

function processContext(ctx: ReverieContext) {
  switch (ctx.level) {
    case 'project':
      // ctx is ProjectLevelContext
      console.log(ctx.query, ctx.filePatterns);
      break;
    case 'branch':
      // ctx is BranchLevelContext
      console.log(ctx.branch, ctx.changedFiles);
      break;
    case 'file':
      // ctx is FileLevelContext
      console.log(ctx.filePath, ctx.symbols);
      break;
  }
}
```

## Usage Patterns

### Single-Level Search

```typescript
// Search at one level
const result = await searchProjectLevel(
  codexHome,
  buildProjectContext("Testing conventions"),
  runner,
  { limit: 8 }
);
```

### Multi-Level Search

```typescript
// Search at multiple levels
const results = await searchMultiLevel(
  codexHome,
  [
    buildProjectContext("Auth patterns"),
    buildBranchContext("feat/oauth", files),
    buildFileContext("auth.ts", { diff })
  ],
  runner,
  { limit: 5 }
);

// Access by level
const projectInsights = results.get('project')?.insights || [];
const branchInsights = results.get('branch')?.insights || [];
const fileInsights = results.get('file')?.insights || [];
```

### Context to Query Conversion

```typescript
// Convert structured context to search string
const context = buildBranchContext("feat/auth", ["auth.ts"]);
const query = contextToQuery(context);
// Returns: "Branch: feat/auth\nFiles changed: auth.ts"

// Use directly with existing search
const insights = await searchReveries(codexHome, query, repo);
```

## Backward Compatibility

All enhancements are **fully backward compatible**:

- Existing `applyReveriePipeline()` unchanged
- Existing `applyFileReveriePipeline()` unchanged
- All existing types and interfaces preserved
- New functionality is additive only

## Integration Points

### With Git

```typescript
const branch = execSync('git branch --show-current').trim();
const files = execSync('git diff --name-only main...HEAD')
  .trim().split('\n');
const commits = execSync('git log main..HEAD --oneline').trim();

const context = buildBranchContext(branch, files, {
  baseBranch: 'main',
  recentCommits: commits
});
```

### With diff-agent Pattern

The multi-level approach matches the sophisticated pattern from diff-agent:

1. Branch-level search for overall feature context
2. File-level searches for specific implementations
3. (NEW) Project-level search for architectural patterns

## Performance Characteristics

- **Project searches**: Slower, broader (1.5x candidates)
- **Branch searches**: Balanced, standard (1x candidates)
- **File searches**: Faster, focused (0.5x candidates)

Total candidates processed in multi-level search example:
- Project: 60 candidates (40 base × 1.5)
- Branch: 36 candidates (36 base × 1.0)
- File: 18 candidates (36 base × 0.5)
- **Total**: 114 candidates across 3 levels

## Testing Recommendations

1. **Unit tests** for context builders
2. **Integration tests** for each search level
3. **End-to-end tests** for multi-level orchestration
4. **Performance tests** for candidate multipliers
5. **Type tests** for context discrimination

## Future Enhancements

Potential future additions:
- Parallel multi-level execution (currently sequential)
- Custom candidate multipliers per context
- Level-specific reranker strategies
- Caching of project-level results
- Workspace/monorepo-level searches

## Documentation

Complete documentation provided in:
- `README.md`: Updated with multi-level sections
- `MULTI_LEVEL_EXAMPLES.md`: Comprehensive examples (450+ lines)
- `MULTI_LEVEL_SUMMARY.md`: This summary document
- Inline JSDoc comments on all new functions

## Summary Statistics

- **Files Modified**: 5
- **Files Created**: 3
- **Total Lines Added**: ~1,100 lines
- **New Functions**: 8 major functions
- **New Types**: 5 type definitions
- **Documentation**: 700+ lines

All changes maintain the sophisticated filtering and grading features from the original reverie system while adding powerful new multi-level search capabilities.
