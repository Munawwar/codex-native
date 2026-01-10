import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, jest } from "@jest/globals";

import { setupNativeBinding } from "./testHelpers";

setupNativeBinding();

jest.setTimeout(120000);

function findOpenCodeAuthPath(): string | null {
  const candidates: string[] = [];
  const xdg = process.env.XDG_DATA_HOME;
  if (xdg && xdg.trim()) {
    candidates.push(path.join(xdg, "opencode", "auth.json"));
  }
  candidates.push(
    path.join(os.homedir(), "Library", "Application Support", "opencode", "auth.json"),
  );
  candidates.push(path.join(os.homedir(), ".local", "share", "opencode", "auth.json"));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

describe("GitHub Copilot provider (live)", () => {
  it("can run gpt-4.1 via modelProvider='github' using OpenCode auth.json", async () => {
    const authPath = findOpenCodeAuthPath();
    if (!authPath) {
      throw new Error(
        [
          "OpenCode auth.json not found. This live test requires GitHub Copilot login via OpenCode.",
          "Expected one of:",
          "- ${XDG_DATA_HOME}/opencode/auth.json",
          "- ~/Library/Application Support/opencode/auth.json",
          "- ~/.local/share/opencode/auth.json",
        ].join("\n"),
      );
    }

    try {
      const raw = JSON.parse(fs.readFileSync(authPath, "utf8")) as Record<string, unknown>;
      if (!raw["github-copilot"] && !raw["github-copilot-enterprise"]) {
        throw new Error(
          "OpenCode auth.json does not contain github-copilot entries. Log in to GitHub Copilot via OpenCode first.",
        );
      }
    } catch (err: unknown) {
      throw new Error(
        `Failed to parse OpenCode auth.json at ${authPath}: ${(err as Error).message}`,
      );
    }

    const { Codex } = await import("../src/index");
    const codex = new Codex({
      defaultModel: "gpt-4.1",
      modelProvider: "github",
    });

    const thread = codex.startThread({
      model: "gpt-4.1",
      modelProvider: "github",
      skipGitRepoCheck: true,
    });
    const result = await thread.run("Reply with exactly: OK");
    expect(result.finalResponse).toContain("OK");
  });
});
