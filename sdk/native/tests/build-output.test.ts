import { describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

function isMusl(): boolean {
  if (process.platform !== "linux") {
    return false;
  }

  if (process.env.MUSL) {
    return true;
  }

  try {
    const report = process.report?.getReport?.() as {
      header?: { glibcVersionRuntime?: string };
      sharedObjects?: string[];
    } | null;
    if (report?.header?.glibcVersionRuntime) {
      return false;
    }
    if (Array.isArray(report?.sharedObjects)) {
      return report.sharedObjects.some((entry: string) =>
        entry.includes("libc.musl-") || entry.includes("ld-musl-")
      );
    }
  } catch {
    // fall through
  }

  return false;
}

function getPlatformDir(): string | null {
  const { platform, arch } = process;

  if (platform === "darwin") {
    return arch === "arm64" ? "darwin-arm64" : arch === "x64" ? "darwin-x64" : null;
  }

  if (platform === "linux") {
    const suffix = isMusl() ? "musl" : "gnu";
    if (arch === "arm64") return `linux-arm64-${suffix}`;
    if (arch === "x64") return `linux-x64-${suffix}`;
    return null;
  }

  if (platform === "win32") {
    return arch === "arm64" ? "win32-arm64-msvc" : arch === "x64" ? "win32-x64-msvc" : null;
  }

  return null;
}

describe("build output layout", () => {
  it("keeps native binary under npm/<platform>", () => {
    const platformDir = getPlatformDir();
    expect(platformDir).not.toBeNull();

    const expected = path.join(
      process.cwd(),
      "npm",
      platformDir!,
      `codex_native.${platformDir}.node`
    );
    expect(fs.existsSync(expected)).toBe(true);

    const rootNodes = fs.readdirSync(process.cwd()).filter((entry) => entry.endsWith(".node"));
    expect(rootNodes).toHaveLength(0);

    const distDir = path.join(process.cwd(), "dist");
    if (fs.existsSync(distDir)) {
      const distNodes = fs.readdirSync(distDir).filter((entry) => entry.endsWith(".node"));
      expect(distNodes).toHaveLength(0);
    }
  });

  it("preserves TypeScript exports in dist typings", () => {
    const dtsPath = path.join(process.cwd(), "dist", "index.d.ts");
    expect(fs.existsSync(dtsPath)).toBe(true);
    const contents = fs.readFileSync(dtsPath, "utf8");
    expect(contents).toContain("declare class Codex");
    expect(contents).toContain("declare class CodexProvider");
  });
});
