import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import { setupNativeBinding } from "./testHelpers";

// Ensure the native binding points at the locally-built binary
setupNativeBinding();

jest.setTimeout(20_000);

let Codex: any;

beforeAll(async () => {
  ({ Codex } = await import("../src/index"));
});

describe("listRegisteredTools()", () => {
  it("returns metadata for tools registered via codex.registerTool", () => {
    const codex = new Codex({ skipGitRepoCheck: true });

    codex.registerTool({
      name: "echo",
      description: "Echo input",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
        required: ["text"],
      },
      strict: true,
      supportsParallel: false,
      handler: () => ({ output: "ok" }),
    });

    const tools = codex.listRegisteredTools();

    const echo = tools.find((t: any) => t.name === "echo");
    expect(echo).toBeDefined();
    expect(echo).toMatchObject({
      name: "echo",
      description: "Echo input",
      strict: true,
      supportsParallel: false,
    });
    expect(echo?.parameters?.type).toBe("object");
    expect(echo?.parameters?.properties?.text?.type).toBe("string");
  });

  it("returns empty array when no tools are registered", () => {
    const codex = new Codex({ skipGitRepoCheck: true });
    const tools = codex.listRegisteredTools();
    expect(tools).toEqual([]);
  });

  it("returns latest metadata when a tool is re-registered", () => {
    const codex = new Codex({ skipGitRepoCheck: true });

    codex.registerTool({
      name: "echo",
      description: "v1",
      parameters: { type: "object", properties: {} },
      handler: () => ({ output: "v1" }),
    });

    codex.registerTool({
      name: "echo",
      description: "v2",
      parameters: {
        type: "object",
        properties: { text: { type: "string" } },
      },
      strict: true,
      supportsParallel: true,
      handler: () => ({ output: "v2" }),
    });

    const echo = codex.listRegisteredTools().find((t: any) => t.name === "echo");
    expect(echo).toBeDefined();
    expect(echo?.description).toBe("v2");
    expect(echo?.strict).toBe(true);
    expect(echo?.supportsParallel).toBe(true);
    expect(echo?.parameters?.properties?.text?.type).toBe("string");
  });

  it("clears mirrored registrations when clearTools is called", () => {
    const codex = new Codex({ skipGitRepoCheck: true });

    codex.registerTool({
      name: "echo",
      parameters: { type: "object", properties: {} },
      handler: () => ({ output: "ok" }),
    });
    expect(codex.listRegisteredTools().length).toBe(1);

    codex.clearTools();
    expect(codex.listRegisteredTools()).toEqual([]);
  });

  it("does not let callers mutate stored schemas", () => {
    const codex = new Codex({ skipGitRepoCheck: true });
    codex.registerTool({
      name: "immutable",
      parameters: {
        type: "object",
        properties: {
          foo: { type: "string" },
        },
      },
      handler: () => ({ output: "ok" }),
    });

    const first = codex.listRegisteredTools();
    first[0].parameters!.properties!.foo.type = "number";

    const second = codex.listRegisteredTools();
    expect(second[0].parameters!.properties!.foo.type).toBe("string");
  });
});
