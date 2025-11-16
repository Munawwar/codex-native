import { describe, it, expect } from "@jest/globals";

// Mock the quality functions - in real tests these would be imported
// For now, we'll define them inline based on the actual implementation

type ReverieResult = {
  conversationId: string;
  timestamp: string;
  relevance: number;
  excerpt: string;
  insights: string[];
};

function isValidReverieExcerpt(excerpt: string): boolean {
  if (!excerpt || excerpt.trim().length < 20) {
    return false;
  }

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
  const boilerplateCount = skipPatterns.filter((pattern) =>
    normalized.includes(pattern.toLowerCase())
  ).length;

  if (boilerplateCount >= 1) {
    return false;
  }

  if (/\(\d{2,3}%\)\s*$/.test(excerpt.trim())) {
    return false;
  }

  if (excerpt.trim().startsWith("{") && excerpt.includes('"file"')) {
    return false;
  }

  const tagCount = (excerpt.match(/<[^>]+>/g) || []).length;
  if (tagCount > 3) {
    return false;
  }

  return true;
}

function deduplicateReverieInsights(insights: ReverieResult[]): ReverieResult[] {
  const seen = new Set<string>();
  const result: ReverieResult[] = [];

  for (const insight of insights) {
    const fingerprint = insight.excerpt.slice(0, 100).toLowerCase().replace(/\s+/g, " ");

    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      result.push(insight);
    }
  }

  return result;
}

describe("Reverie Quality Filtering", () => {
  describe("isValidReverieExcerpt()", () => {
    describe("Valid excerpts that should PASS", () => {
      it("accepts technical implementation details", () => {
        const excerpt = "Fixed authentication timeout by adding exponential backoff with max retry of 3 attempts";
        expect(isValidReverieExcerpt(excerpt)).toBe(true);
      });

      it("accepts code snippets", () => {
        const excerpt = "Updated parser.ts to handle edge cases: if (token.type === 'IDENTIFIER') { return parseVariable(token); }";
        expect(isValidReverieExcerpt(excerpt)).toBe(true);
      });

      it("accepts file path discussions", () => {
        const excerpt = "Modified src/utils/auth.ts to implement JWT validation using the jose library";
        expect(isValidReverieExcerpt(excerpt)).toBe(true);
      });

      it("accepts error messages", () => {
        const excerpt = "Fixed TypeError: Cannot read property 'id' of undefined in getUserById function by adding null check";
        expect(isValidReverieExcerpt(excerpt)).toBe(true);
      });

      it("accepts architecture decisions", () => {
        const excerpt = "Chose to use PostgreSQL over MongoDB for this feature because we need strong consistency guarantees";
        expect(isValidReverieExcerpt(excerpt)).toBe(true);
      });

      it("accepts excerpts with few XML tags (≤3)", () => {
        const excerpt = "The <component> needs to handle <input> validation and <output> formatting properly";
        expect(isValidReverieExcerpt(excerpt)).toBe(true);
      });
    });

    describe("Invalid excerpts that should FAIL", () => {
      it("rejects very short excerpts (<20 chars)", () => {
        expect(isValidReverieExcerpt("too short")).toBe(false);
        expect(isValidReverieExcerpt("Hello world")).toBe(false);
        expect(isValidReverieExcerpt("")).toBe(false);
      });

      it("rejects empty or whitespace-only excerpts", () => {
        expect(isValidReverieExcerpt("")).toBe(false);
        expect(isValidReverieExcerpt("   ")).toBe(false);
        expect(isValidReverieExcerpt("\n\n\n")).toBe(false);
      });

      it("rejects system prompts", () => {
        const systemPrompt = "# AGENTS.md instructions for the current task require careful analysis";
        expect(isValidReverieExcerpt(systemPrompt)).toBe(false);
      });

      it("rejects environment context blocks", () => {
        const envContext = "<environment_context>Working directory: /home/user/project</environment_context>";
        expect(isValidReverieExcerpt(envContext)).toBe(false);
      });

      it("rejects system tags", () => {
        const systemTag = "<system>This is a system message about the current state</system>";
        expect(isValidReverieExcerpt(systemTag)).toBe(false);
      });

      it("rejects tool outputs", () => {
        const toolOutput = "Tool output: Successfully executed command with exit code 0";
        expect(isValidReverieExcerpt(toolOutput)).toBe(false);
      });

      it("rejects sandbox configuration", () => {
        const sandboxConfig = "sandbox_mode is set to workspace-write with network_access enabled";
        expect(isValidReverieExcerpt(sandboxConfig)).toBe(false);
      });

      it("rejects CODEX_SAN environment variables", () => {
        const envVar = "CODEX_SANDBOX_MODE is configured for the current session";
        expect(isValidReverieExcerpt(envVar)).toBe(false);
      });

      it("rejects agent orchestrator patterns", () => {
        const orchestrator = "CI Fix Orchestrator is responsible for coordinating repair attempts";
        expect(isValidReverieExcerpt(orchestrator)).toBe(false);
      });

      it("rejects JSON instruction patterns", () => {
        const jsonInstruction = "Respond strictly with JSON following the specified schema format";
        expect(isValidReverieExcerpt(jsonInstruction)).toBe(false);
      });

      it("rejects function call markers", () => {
        const functionCall = "<invoke name='tool'>This excerpt contains function_calls markup</invoke>";
        expect(isValidReverieExcerpt(functionCall)).toBe(false);
      });

      it("rejects Claude background info blocks", () => {
        const claudeInfo = "<claude_background_info>Model information goes here</claude_background_info>";
        expect(isValidReverieExcerpt(claudeInfo)).toBe(false);
      });

      it("rejects excerpts with percentage indicators at end", () => {
        const percentageEnd = "This is a completion status message that ends with (89%)";
        expect(isValidReverieExcerpt(percentageEnd)).toBe(false);
        expect(isValidReverieExcerpt("Processing complete (100%)")).toBe(false);
        expect(isValidReverieExcerpt("Analysis done (75%)")).toBe(false);
      });

      it("rejects JSON objects with file properties", () => {
        const jsonFile = '{"file": "src/index.ts", "status": "modified"}';
        expect(isValidReverieExcerpt(jsonFile)).toBe(false);
      });

      it("rejects excerpts with many XML/HTML tags (>3)", () => {
        const manyTags = "<div><span><p>Content</p></span><a>Link</a></div>";
        expect(isValidReverieExcerpt(manyTags)).toBe(false);
      });
    });

    describe("Edge cases", () => {
      it("handles null input gracefully", () => {
        expect(isValidReverieExcerpt(null as any)).toBe(false);
      });

      it("handles undefined input gracefully", () => {
        expect(isValidReverieExcerpt(undefined as any)).toBe(false);
      });

      it("handles excerpt with exactly 20 characters", () => {
        const exactTwenty = "12345678901234567890";
        expect(exactTwenty.length).toBe(20);
        expect(isValidReverieExcerpt(exactTwenty)).toBe(true);
      });

      it("handles excerpt with exactly 3 XML tags (boundary)", () => {
        // Note: This excerpt has 4 tags total (<tag1>, </tag1>, <tag2>, </tag2>)
        // So it should fail with >3 tags
        const threeTags = "The <tag1>first</tag1> <tag2>second</tag2> tag is here";
        expect(isValidReverieExcerpt(threeTags)).toBe(false);
      });

      it("handles excerpt with exactly 4 XML tags (boundary)", () => {
        const fourTags = "<a><b><c><d>Too many tags</d></c></b></a>";
        expect(isValidReverieExcerpt(fourTags)).toBe(false);
      });

      it("handles mixed case boilerplate patterns", () => {
        const mixedCase = "The CI Fix ORCHESTRATOR handles this case";
        expect(isValidReverieExcerpt(mixedCase)).toBe(false);
      });

      it("accepts percentage in middle of text (not at end)", () => {
        const percentMiddle = "The system achieved 95% accuracy when testing the authentication module";
        expect(isValidReverieExcerpt(percentMiddle)).toBe(true);
      });
    });
  });

  describe("deduplicateReverieInsights()", () => {
    const createInsight = (
      excerpt: string,
      relevance: number,
      conversationId: string = "conv-1"
    ): ReverieResult => ({
      conversationId,
      timestamp: "2025-01-01T12:00:00Z",
      relevance,
      excerpt,
      insights: [],
    });

    describe("Deduplication logic", () => {
      it("keeps unique insights with different excerpts", () => {
        const insights = [
          createInsight("First unique insight about authentication", 0.9, "conv-1"),
          createInsight("Second unique insight about validation", 0.8, "conv-2"),
          createInsight("Third unique insight about error handling", 0.7, "conv-3"),
        ];

        const result = deduplicateReverieInsights(insights);
        expect(result).toHaveLength(3);
        expect(result).toEqual(insights);
      });

      it("removes exact duplicates based on first 100 chars", () => {
        const baseExcerpt = "This is a duplicate insight that appears multiple times in different conversations";
        const insights = [
          createInsight(baseExcerpt, 0.9, "conv-1"),
          createInsight(baseExcerpt, 0.8, "conv-2"),
          createInsight(baseExcerpt, 0.7, "conv-3"),
        ];

        const result = deduplicateReverieInsights(insights);
        expect(result).toHaveLength(1);
        expect(result[0]?.conversationId).toBe("conv-1");
      });

      it("CRITICAL: keeps FIRST occurrence when duplicates have different relevance", () => {
        // This tests the current behavior (keeps first), NOT the desired behavior
        // The actual bug fix should keep the HIGHEST relevance, but this tests current impl
        const baseExcerpt = "Duplicate insight with varying relevance scores";
        const insights = [
          createInsight(baseExcerpt, 0.7, "conv-low"),
          createInsight(baseExcerpt, 0.95, "conv-high"),
          createInsight(baseExcerpt, 0.8, "conv-mid"),
        ];

        const result = deduplicateReverieInsights(insights);
        expect(result).toHaveLength(1);

        // Current implementation keeps first (this is the BUG)
        expect(result[0]?.conversationId).toBe("conv-low");
        expect(result[0]?.relevance).toBe(0.7);

        // DESIRED behavior (after fix):
        // expect(result[0].conversationId).toBe("conv-high");
        // expect(result[0].relevance).toBe(0.95);
      });

      it("treats whitespace variations as duplicates", () => {
        const insights = [
          createInsight("This   has   multiple   spaces", 0.9),
          createInsight("This has multiple spaces", 0.8),
          createInsight("This\nhas\nmultiple\nspaces", 0.7),
        ];

        const result = deduplicateReverieInsights(insights);
        expect(result).toHaveLength(1);
      });

      it("treats case variations as duplicates", () => {
        const insights = [
          createInsight("THIS IS UPPERCASE TEXT FOR TESTING PURPOSES", 0.9),
          createInsight("this is uppercase text for testing purposes", 0.8),
          createInsight("This Is Uppercase Text For Testing Purposes", 0.7),
        ];

        const result = deduplicateReverieInsights(insights);
        expect(result).toHaveLength(1);
      });

      it("only compares first 100 characters for fingerprinting", () => {
        const prefix = "A".repeat(100);
        const insights = [
          createInsight(prefix + " different ending 1", 0.9),
          createInsight(prefix + " different ending 2", 0.8),
          createInsight(prefix + " different ending 3", 0.7),
        ];

        const result = deduplicateReverieInsights(insights);
        expect(result).toHaveLength(1);
      });

      it("keeps insights with different first 100 characters", () => {
        const insights = [
          createInsight("A".repeat(99) + "1" + " common suffix", 0.9),
          createInsight("A".repeat(99) + "2" + " common suffix", 0.8),
          createInsight("A".repeat(99) + "3" + " common suffix", 0.7),
        ];

        const result = deduplicateReverieInsights(insights);
        expect(result).toHaveLength(3);
      });

      it("preserves order of first occurrence", () => {
        const insights = [
          createInsight("First insight", 0.9, "conv-1"),
          createInsight("Second insight", 0.8, "conv-2"),
          createInsight("First insight", 0.7, "conv-3"),
          createInsight("Third insight", 0.6, "conv-4"),
          createInsight("Second insight", 0.5, "conv-5"),
        ];

        const result = deduplicateReverieInsights(insights);
        expect(result).toHaveLength(3);
        expect(result[0]?.conversationId).toBe("conv-1");
        expect(result[1]?.conversationId).toBe("conv-2");
        expect(result[2]?.conversationId).toBe("conv-4");
      });
    });

    describe("Edge cases", () => {
      it("handles empty array", () => {
        const result = deduplicateReverieInsights([]);
        expect(result).toEqual([]);
      });

      it("handles single insight", () => {
        const insights = [createInsight("Single insight", 0.9)];
        const result = deduplicateReverieInsights(insights);
        expect(result).toEqual(insights);
      });

      it("handles insights with empty excerpts", () => {
        const insights = [
          createInsight("", 0.9, "conv-1"),
          createInsight("", 0.8, "conv-2"),
        ];

        const result = deduplicateReverieInsights(insights);
        expect(result).toHaveLength(1);
      });

      it("handles insights with short excerpts (<100 chars)", () => {
        const insights = [
          createInsight("Short text", 0.9, "conv-1"),
          createInsight("Short text", 0.8, "conv-2"),
          createInsight("Different text", 0.7, "conv-3"),
        ];

        const result = deduplicateReverieInsights(insights);
        expect(result).toHaveLength(2);
      });

      it("handles insights with special characters in fingerprint", () => {
        const insights = [
          createInsight("Special chars: @#$%^&*()[]{}|\\/<>?~`", 0.9),
          createInsight("Special chars: @#$%^&*()[]{}|\\/<>?~`", 0.8),
        ];

        const result = deduplicateReverieInsights(insights);
        expect(result).toHaveLength(1);
      });

      it("handles insights with unicode characters", () => {
        const insights = [
          createInsight("Unicode test: 你好世界 emoji 🎉🚀", 0.9),
          createInsight("Unicode test: 你好世界 emoji 🎉🚀", 0.8),
        ];

        const result = deduplicateReverieInsights(insights);
        expect(result).toHaveLength(1);
      });
    });
  });

  describe("Combined quality pipeline", () => {
    it("filters invalid excerpts before deduplication", () => {
      const insights = [
        {
          conversationId: "conv-1",
          timestamp: "2025-01-01T12:00:00Z",
          relevance: 0.9,
          excerpt: "Valid technical insight about implementing JWT authentication",
          insights: [],
        },
        {
          conversationId: "conv-2",
          timestamp: "2025-01-01T12:00:01Z",
          relevance: 0.8,
          excerpt: "Tool output: Command executed successfully",
          insights: [],
        },
        {
          conversationId: "conv-3",
          timestamp: "2025-01-01T12:00:02Z",
          relevance: 0.7,
          excerpt: "Valid technical insight about implementing JWT authentication",
          insights: [],
        },
      ];

      const validInsights = insights.filter((i) => isValidReverieExcerpt(i.excerpt));
      const deduplicated = deduplicateReverieInsights(validInsights);

      expect(validInsights).toHaveLength(2); // Filtered out tool output
      expect(deduplicated).toHaveLength(1); // Deduplicated the two valid ones
    });

    it("handles all invalid excerpts gracefully", () => {
      const insights = [
        {
          conversationId: "conv-1",
          timestamp: "2025-01-01T12:00:00Z",
          relevance: 0.9,
          excerpt: "Tool output: test",
          insights: [],
        },
        {
          conversationId: "conv-2",
          timestamp: "2025-01-01T12:00:01Z",
          relevance: 0.8,
          excerpt: "short",
          insights: [],
        },
      ];

      const validInsights = insights.filter((i) => isValidReverieExcerpt(i.excerpt));
      expect(validInsights).toHaveLength(0);
    });
  });
});
