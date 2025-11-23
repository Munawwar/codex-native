import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectWorkerModel } from "../worker-agent.js";

const DEFAULT = "worker-default";
const HIGH = "worker-high";
const LOW = "worker-low";

describe("selectWorkerModel", () => {
  it("chooses high reasoning for severe conflicts", () => {
    const model = selectWorkerModel(
      {
        path: "src/core/heavy.rs",
        conflictMarkers: 20,
        lineCount: 500,
        language: "Rust",
        diffExcerpt: null,
        workingExcerpt: null,
        baseExcerpt: null,
        oursExcerpt: null,
        theirsExcerpt: null,
        originRefContent: null,
        upstreamRefContent: null,
        originVsUpstreamDiff: null,
        baseVsOursDiff: null,
        baseVsTheirsDiff: null,
        oursVsTheirsDiff: null,
        recentHistory: null,
        localIntentLog: null,
      },
      { defaultModel: DEFAULT, highReasoningModel: HIGH, lowReasoningModel: LOW },
    );

    assert.equal(model, HIGH);
  });

  it("chooses low reasoning for docs", () => {
    const model = selectWorkerModel(
      {
        path: "docs/guide.md",
        conflictMarkers: 1,
        lineCount: 20,
        language: "Markdown",
        diffExcerpt: null,
        workingExcerpt: null,
        baseExcerpt: null,
        oursExcerpt: null,
        theirsExcerpt: null,
        originRefContent: null,
        upstreamRefContent: null,
        originVsUpstreamDiff: null,
        baseVsOursDiff: null,
        baseVsTheirsDiff: null,
        oursVsTheirsDiff: null,
        recentHistory: null,
        localIntentLog: null,
      },
      { defaultModel: DEFAULT, highReasoningModel: HIGH, lowReasoningModel: LOW },
    );

    assert.equal(model, LOW);
  });

  it("falls back to default when no matcher fits", () => {
    const model = selectWorkerModel(
      {
        path: "src/ui/view.tsx",
        conflictMarkers: 1,
        lineCount: 50,
        language: "TypeScript",
        diffExcerpt: null,
        workingExcerpt: null,
        baseExcerpt: null,
        oursExcerpt: null,
        theirsExcerpt: null,
        originRefContent: null,
        upstreamRefContent: null,
        originVsUpstreamDiff: null,
        baseVsOursDiff: null,
        baseVsTheirsDiff: null,
        oursVsTheirsDiff: null,
        recentHistory: null,
        localIntentLog: null,
      },
      { defaultModel: DEFAULT, highReasoningModel: HIGH, lowReasoningModel: LOW },
    );

    assert.equal(model, DEFAULT);
  });
});
