import {
  Codex,
  DEFAULT_SERVERS,
  LspDiagnosticsBridge,
  LspManager,
  Thread,
  attachLspDiagnostics,
  collectRepoDiffSummary,
  encodeToToon,
  fastEmbedEmbed,
  fastEmbedInit,
  findServerForFile,
  getNativeBinding,
  resolveWorkspaceRoot,
  reverieGetConversationInsights,
  reverieIndexSemantic,
  reverieListConversations,
  reverieSearchConversations,
  reverieSearchSemantic,
  runTui,
  startTui,
  tokenizerCount,
  tokenizerDecode,
  tokenizerEncode
} from "./chunk-Z6HCOJN5.mjs";

// src/agents/toolRegistry.ts
var executors = /* @__PURE__ */ new Map();
function registerCodexToolExecutor(name, executor) {
  executors.set(name, executor);
}
function getCodexToolExecutor(name) {
  return executors.get(name);
}

// src/agents/CodexProvider.ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// src/agents/types.ts
import { Usage } from "@openai/agents-core";

// src/agents/CodexProvider.ts
var CodexProvider = class {
  codex = null;
  options;
  constructor(options = {}) {
    this.options = {
      workingDirectory: options.workingDirectory || process.cwd(),
      skipGitRepoCheck: options.skipGitRepoCheck ?? false,
      ...options
    };
  }
  /**
   * Lazy initialization of Codex instance
   */
  getCodex() {
    if (!this.codex) {
      try {
        this.codex = new Codex({
          apiKey: this.options.apiKey,
          baseUrl: this.options.baseUrl
        });
      } catch (error) {
        throw new Error(
          `Failed to initialize Codex: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    return this.codex;
  }
  getModel(modelName) {
    const model = modelName || this.options.defaultModel;
    return new CodexModel(this.getCodex(), model, this.options);
  }
};
var CodexModel = class {
  codex;
  modelName;
  thread = null;
  options;
  registeredTools = /* @__PURE__ */ new Set();
  toolExecutors = /* @__PURE__ */ new Map();
  tempImageFiles = /* @__PURE__ */ new Set();
  streamedTurnItems = [];
  lastStreamedMessage = null;
  detachDiagnostics;
  diagnosticsThread;
  constructor(codex, modelName, options) {
    this.codex = codex;
    this.modelName = modelName;
    this.options = options;
  }
  /**
   * Cleanup temporary image files created during request processing
   */
  async cleanupTempFiles() {
    for (const filepath of this.tempImageFiles) {
      try {
        await fs.promises.unlink(filepath);
      } catch (error) {
      }
    }
    this.tempImageFiles.clear();
  }
  /**
   * Get or create the thread for this model instance
   */
  getThread(conversationId) {
    if (conversationId) {
      if (!this.thread || this.thread.id !== conversationId) {
        this.detachDiagnostics?.();
        this.thread = this.codex.resumeThread(conversationId, this.getThreadOptions());
        this.diagnosticsThread = null;
      }
    } else if (!this.thread) {
      this.detachDiagnostics?.();
      this.thread = this.codex.startThread(this.getThreadOptions());
      this.diagnosticsThread = null;
    }
    const thread = this.thread;
    if (!thread) {
      throw new Error("Thread initialization failed");
    }
    this.ensureDiagnosticsBridge(thread);
    return thread;
  }
  ensureDiagnosticsBridge(thread) {
    if (this.diagnosticsThread === thread && this.detachDiagnostics) {
      return;
    }
    this.detachDiagnostics?.();
    this.diagnosticsThread = thread;
    this.detachDiagnostics = attachLspDiagnostics(thread, {
      workingDirectory: this.options.workingDirectory ?? process.cwd(),
      waitForDiagnostics: true
    });
  }
  getThreadOptions() {
    return {
      model: this.modelName,
      // When a custom baseUrl is provided (e.g., test proxy), do not enable OSS mode,
      // since the backend is not Ollama in that case.
      oss: this.options.baseUrl ? false : this.options.oss,
      workingDirectory: this.options.workingDirectory,
      skipGitRepoCheck: this.options.skipGitRepoCheck,
      sandboxMode: this.options.sandboxMode ?? "danger-full-access",
      approvalMode: this.options.approvalMode
    };
  }
  async getResponse(request) {
    try {
      const thread = this.getThread(request.conversationId || request.previousResponseId);
      if (request.tools && request.tools.length > 0) {
        this.registerRequestTools(request.tools);
      }
      const input = await this.convertRequestToInput(request);
      const turn = await thread.run(input, {
        outputSchema: normalizeAgentsOutputType(request.outputType),
        oss: this.options.oss
      });
      const planItem = turn.items.filter((item) => item.type === "todo_list").slice(-1)[0];
      const response = {
        usage: this.convertUsage(turn.usage),
        output: this.convertItemsToOutput(turn.items, turn.finalResponse),
        responseId: thread.id || void 0
      };
      if (planItem) {
        response.plan = { items: planItem.items };
      }
      return response;
    } finally {
      await this.cleanupTempFiles();
    }
  }
  async *getStreamedResponse(request) {
    const MAX_ACCUMULATED_SIZE = 1e7;
    try {
      const thread = this.getThread(request.conversationId || request.previousResponseId);
      if (request.tools && request.tools.length > 0) {
        this.registerRequestTools(request.tools);
      }
      const input = await this.convertRequestToInput(request);
      const { events } = await thread.runStreamed(input, {
        outputSchema: normalizeAgentsOutputType(request.outputType),
        oss: this.options.oss
      });
      const textAccumulator = /* @__PURE__ */ new Map();
      for await (const event of events) {
        let totalSize = 0;
        for (const text of textAccumulator.values()) {
          totalSize += text.length;
        }
        if (totalSize > MAX_ACCUMULATED_SIZE) {
          throw new Error(`Accumulated text exceeded maximum size limit (${MAX_ACCUMULATED_SIZE} bytes)`);
        }
        const streamEvents = this.convertCodexEventToStreamEvent(event, textAccumulator);
        for (const streamEvent of streamEvents) {
          yield streamEvent;
        }
      }
    } finally {
      await this.cleanupTempFiles();
    }
  }
  /**
   * Register tools from ModelRequest with the Codex instance
   *
   * Converts SerializedTool format (OpenAI Agents) to NativeToolDefinition format (Codex)
   * and registers them with the Codex instance for bidirectional tool execution.
   */
  registerRequestTools(tools) {
    this.toolExecutors.clear();
    for (const tool2 of tools) {
      if (tool2.type !== "function") {
        continue;
      }
      if (this.registeredTools.has(tool2.name)) {
        const executor = this.resolveToolExecutor(tool2.name);
        if (executor) {
          this.toolExecutors.set(tool2.name, executor);
        }
        continue;
      }
      try {
        const executor = this.resolveToolExecutor(tool2.name);
        if (executor) {
          this.toolExecutors.set(tool2.name, executor);
        }
        const nativeToolDef = {
          name: tool2.name,
          description: tool2.description,
          parameters: tool2.parameters,
          // The handler is called when Codex wants to execute this tool
          handler: async (invocation) => {
            return await this.executeToolViaFramework(invocation);
          }
        };
        this.codex.registerTool(nativeToolDef);
        this.registeredTools.add(tool2.name);
        console.log(`Registered tool with Codex: ${tool2.name}`);
      } catch (error) {
        const errorMessage = `Failed to register tool ${tool2.name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMessage);
      }
    }
  }
  resolveToolExecutor(toolName) {
    return getCodexToolExecutor(toolName);
  }
  /**
   * Execute a tool via the OpenAI Agents framework
   *
   * This is the bridge between Codex's tool execution and the framework's tool handlers.
   *
   * FRAMEWORK INTEGRATION NOTE:
   * This method currently returns a placeholder result because the actual execution
   * requires integration with the OpenAI Agents framework's tool execution loop.
   *
   * In a full implementation, this would:
   * 1. Emit a "tool_call_requested" event that the framework can listen to
   * 2. Wait for the framework to execute the tool and provide the result
   * 3. Return that result to Codex
   *
   * For now, this creates a promise that could be resolved by framework code,
   * but the framework integration is not yet complete.
   */
  async executeToolViaFramework(invocation) {
    if (!invocation) {
      console.warn("Codex requested a tool execution without invocation data.");
      return {
        output: JSON.stringify({
          message: "Tool invocation payload missing",
          note: "Codex returned null invocation data so the tool was not executed."
        }),
        success: false,
        error: "Missing tool invocation data from Codex"
      };
    }
    console.log(
      `Tool execution requested by Codex: ${invocation.toolName} (callId: ${invocation.callId})`
    );
    const executor = this.toolExecutors.get(invocation.toolName) ?? getCodexToolExecutor(invocation.toolName);
    if (!executor) {
      const message = `No Codex executor registered for tool '${invocation.toolName}'. Use codexTool() or provide a codexExecute handler.`;
      console.warn(message);
      return {
        success: false,
        error: message,
        output: void 0
      };
    }
    let parsedArguments = {};
    if (invocation.arguments) {
      try {
        parsedArguments = JSON.parse(invocation.arguments);
      } catch (error) {
        return {
          success: false,
          error: `Failed to parse tool arguments: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
    const context = {
      name: invocation.toolName,
      callId: invocation.callId,
      arguments: parsedArguments,
      rawInvocation: invocation
    };
    try {
      const result = await executor(context);
      return this.normalizeToolResult(result);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  /**
   * Handle image input by converting to local file path
   * Supports: base64 data URLs, HTTP(S) URLs, and file IDs (not yet implemented)
   */
  normalizeToolResult(result) {
    if (result === void 0 || result === null) {
      return { success: true };
    }
    if (typeof result === "string") {
      return { success: true, output: result };
    }
    if (typeof result === "object" && ("output" in result || "error" in result || "success" in result)) {
      return {
        success: result.success ?? !result.error,
        output: result.output,
        error: result.error
      };
    }
    return {
      success: true,
      output: JSON.stringify(result)
    };
  }
  async handleImageInput(item) {
    const imageValue = item.image;
    if (typeof imageValue === "string") {
      if (imageValue.startsWith("data:image/")) {
        return await this.saveBase64Image(imageValue);
      } else if (imageValue.startsWith("http://") || imageValue.startsWith("https://")) {
        return await this.downloadImage(imageValue);
      } else if (fs.existsSync(imageValue)) {
        return imageValue;
      } else {
        throw new Error(`Invalid image format: ${imageValue.substring(0, 50)}...`);
      }
    } else if (typeof imageValue === "object" && "url" in imageValue) {
      return await this.downloadImage(imageValue.url);
    } else if (typeof imageValue === "object" && "fileId" in imageValue) {
      throw new Error(
        `Image fileId references are not yet supported. File IDs would need to be downloaded from the service first.`
      );
    }
    return null;
  }
  /**
   * Save base64-encoded image to temporary file
   */
  async saveBase64Image(dataUrl) {
    const matches = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error("Invalid base64 image data URL");
    }
    const mediaType = matches[1];
    const base64Data = matches[2];
    if (!base64Data) {
      throw new Error("Invalid base64 data in image URL");
    }
    const sanitizedBase64 = base64Data.replace(/\s/g, "");
    if (sanitizedBase64.length === 0) {
      throw new Error("Invalid base64 data in image URL");
    }
    if (!/^[A-Za-z0-9+/=_-]+$/.test(sanitizedBase64)) {
      throw new Error("Invalid base64 data in image URL");
    }
    const normalizedBase64 = sanitizedBase64.replace(/-/g, "+").replace(/_/g, "/");
    let buffer;
    try {
      buffer = Buffer.from(normalizedBase64, "base64");
    } catch {
      throw new Error("Invalid base64 data in image URL");
    }
    if (buffer.length === 0) {
      throw new Error("Invalid base64 data in image URL");
    }
    const reencoded = buffer.toString("base64").replace(/=+$/, "");
    const normalizedInput = normalizedBase64.replace(/=+$/, "");
    if (reencoded !== normalizedInput) {
      throw new Error("Invalid base64 data in image URL");
    }
    const extension = this.getExtensionFromMediaType(mediaType, "png");
    const tempDir = os.tmpdir();
    const filename = `codex-image-${Date.now()}.${extension}`;
    const filepath = path.join(tempDir, filename);
    await fs.promises.writeFile(filepath, buffer);
    this.tempImageFiles.add(filepath);
    return filepath;
  }
  /**
   * Download image from URL to temporary file
   */
  async downloadImage(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image from ${url}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/png";
    const mediaTypePart = contentType.split(";")[0]?.trim() || "image/png";
    const mediaType = mediaTypePart.split("/")[1] || "png";
    const extension = this.getExtensionFromMediaType(mediaType, "png");
    const tempDir = os.tmpdir();
    const filename = `codex-image-${Date.now()}.${extension}`;
    const filepath = path.join(tempDir, filename);
    await fs.promises.writeFile(filepath, Buffer.from(buffer));
    this.tempImageFiles.add(filepath);
    return filepath;
  }
  /**
   * Convert media type to file extension
   * Handles special cases like "jpeg" -> "jpg", "svg+xml" -> "svg"
   */
  getExtensionFromMediaType(mediaType, defaultExt) {
    if (!mediaType) {
      return defaultExt;
    }
    const normalized = mediaType.toLowerCase().trim();
    const extensionMap = {
      "jpeg": "jpg",
      "svg+xml": "svg",
      "vnd.microsoft.icon": "ico",
      "x-icon": "ico"
    };
    if (extensionMap[normalized]) {
      return extensionMap[normalized];
    }
    const simpleExtension = normalized.split("+")[0];
    if (simpleExtension && /^[a-z0-9]+$/.test(simpleExtension)) {
      return simpleExtension;
    }
    return defaultExt;
  }
  async convertRequestToInput(request) {
    const parts = [];
    if (request.systemInstructions) {
      parts.push({
        type: "text",
        text: `<system>
${request.systemInstructions}
</system>

`
      });
    }
    if (typeof request.input === "string") {
      parts.push({ type: "text", text: request.input });
    } else {
      for (const item of request.input) {
        if ("file" in item && "type" in item) {
          throw new Error(
            `CodexProvider does not yet support input_file type. File handling needs to be implemented based on file type and format.`
          );
        }
        if ("audio" in item && "type" in item) {
          throw new Error(
            `CodexProvider does not yet support input_audio type. Audio handling needs to be implemented.`
          );
        }
        if ("image" in item && "type" in item && item.type !== "message") {
          const imageItem = item;
          const imagePath = await this.handleImageInput(imageItem);
          if (imagePath) {
            parts.push({ type: "local_image", path: imagePath });
          }
          continue;
        }
        if (item.type === "function_call_result") {
          if ("name" in item && "result" in item) {
            parts.push({
              type: "text",
              text: `[Tool ${item.name} returned: ${item.result}]`
            });
          }
        } else if (item.type === "reasoning") {
          let text = "";
          if ("content" in item && typeof item.content === "string") {
            text = item.content;
          } else if ("reasoning" in item && typeof item.reasoning === "string") {
            text = item.reasoning;
          }
          if (text) {
            parts.push({
              type: "text",
              text: `[Reasoning: ${text}]`
            });
          }
        } else if ((item.type === "message" || item.type === void 0) && "role" in item) {
          if (!("content" in item)) continue;
          const content = item.content;
          if (typeof content === "string") {
            parts.push({ type: "text", text: content });
          } else if (Array.isArray(content)) {
            for (const contentItem of content) {
              if (contentItem.type === "input_text") {
                parts.push({ type: "text", text: contentItem.text });
              } else if (contentItem.type === "input_image") {
                const imagePath = await this.handleImageInput(contentItem);
                if (imagePath) {
                  parts.push({ type: "local_image", path: imagePath });
                }
              } else if (contentItem.type === "input_file") {
                throw new Error(
                  `CodexProvider does not yet support input_file type. File handling needs to be implemented based on file type and format.`
                );
              } else if (contentItem.type === "audio") {
                throw new Error(
                  `CodexProvider does not yet support audio type. Audio handling needs to be implemented.`
                );
              } else if (contentItem.type === "refusal") {
                parts.push({
                  type: "text",
                  text: `[Refusal: ${contentItem.refusal}]`
                });
              } else if (contentItem.type === "output_text") {
                parts.push({ type: "text", text: contentItem.text });
              }
            }
          }
        }
      }
    }
    if (parts.length === 1 && parts[0].type === "text") {
      return parts[0].text;
    }
    return parts;
  }
  /**
   * Convert Codex Usage to ModelResponse Usage
   */
  convertUsage(usage) {
    if (!usage) {
      return new Usage();
    }
    const converted = new Usage({
      requests: 1,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens
    });
    if (usage.cached_input_tokens) {
      converted.inputTokensDetails = [{ cachedTokens: usage.cached_input_tokens }];
    }
    return converted;
  }
  /**
   * Convert Codex ThreadItems to AgentOutputItems
   */
  convertItemsToOutput(items, finalResponse) {
    const output = [];
    for (const item of items) {
      switch (item.type) {
        case "agent_message": {
          const content = [
            {
              type: "output_text",
              text: item.text
            }
          ];
          output.push({
            type: "message",
            role: "assistant",
            status: "completed",
            content
          });
          break;
        }
        // For final output, omit internal "reasoning" items. Streaming already surfaces reasoning events.
        case "reasoning":
          break;
        // Codex handles tools internally, so we don't expose them as function calls
        // The results are already incorporated into the agent_message
        case "command_execution":
        case "file_change":
        case "mcp_tool_call":
          break;
        default:
          break;
      }
    }
    if (output.length === 0 && finalResponse) {
      output.push({
        type: "message",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: finalResponse
          }
        ]
      });
    }
    return output;
  }
  buildStreamResponse(usage, responseId, items, lastMessage) {
    const messageItems = items.filter(
      (item) => item.type === "agent_message"
    );
    const output = this.convertItemsToOutput(messageItems, lastMessage ?? "");
    const usageData = {
      requests: usage.requests,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      inputTokensDetails: usage.inputTokensDetails?.[0],
      outputTokensDetails: usage.outputTokensDetails?.[0]
    };
    const latestPlan = items.filter((item) => item.type === "todo_list").slice(-1)[0];
    const response = {
      id: responseId,
      responseId,
      usage: usageData,
      output
    };
    if (latestPlan) {
      response.plan = { items: latestPlan.items };
    }
    return response;
  }
  /**
   * Convert Codex ThreadEvent to OpenAI Agents StreamEvent
   */
  convertCodexEventToStreamEvent(event, textAccumulator) {
    const events = [];
    switch (event.type) {
      case "thread.started": {
        events.push({ type: "response_started" });
        const responseId = this.thread?.id ?? "codex-stream-response";
        events.push({
          type: "response.created",
          response: { id: responseId }
        });
        break;
      }
      case "turn.started":
        this.streamedTurnItems = [];
        this.lastStreamedMessage = null;
        break;
      case "item.started":
        if (event.item.type === "agent_message" || event.item.type === "reasoning") {
          const itemKey = `${event.item.type}`;
          textAccumulator.set(itemKey, "");
        }
        break;
      case "background_event":
        events.push({
          type: "model",
          event: {
            type: "background_event",
            message: event.message
          }
        });
        break;
      case "item.updated":
        if (event.item.type === "agent_message") {
          const itemKey = "agent_message";
          const previousText = textAccumulator.get(itemKey) || "";
          const currentText = event.item.text;
          if (currentText.length < previousText.length) {
            console.warn("Received backwards update for text - ignoring delta");
            break;
          }
          if (currentText.length > previousText.length) {
            const delta = currentText.slice(previousText.length);
            textAccumulator.set(itemKey, currentText);
            events.push({
              type: "output_text_delta",
              delta
            });
            events.push({
              type: "response.output_text.delta",
              delta
            });
          }
        } else if (event.item.type === "reasoning") {
          const itemKey = "reasoning";
          const previousText = textAccumulator.get(itemKey) || "";
          const currentText = event.item.text;
          if (currentText.length > previousText.length) {
            const delta = currentText.slice(previousText.length);
            textAccumulator.set(itemKey, currentText);
            events.push({
              type: "model",
              event: {
                type: "reasoning_delta",
                delta
              }
            });
          }
        }
        break;
      case "item.completed":
        this.streamedTurnItems.push(event.item);
        if (event.item.type === "agent_message") {
          textAccumulator.delete("agent_message");
          this.lastStreamedMessage = event.item.text;
        } else if (event.item.type === "reasoning") {
          events.push({
            type: "model",
            event: {
              type: "reasoning_done",
              reasoning: event.item.text
            }
          });
          textAccumulator.delete("reasoning");
        } else if (event.item.type === "todo_list") {
          events.push({
            type: "model",
            event: {
              type: "plan_update",
              items: event.item.items
            }
          });
        }
        break;
      case "turn.completed": {
        const usage = this.convertUsage(event.usage);
        const responseId = this.thread?.id ?? "codex-stream-response";
        const response = this.buildStreamResponse(
          usage,
          responseId,
          this.streamedTurnItems,
          this.lastStreamedMessage
        );
        this.streamedTurnItems = [];
        this.lastStreamedMessage = null;
        events.push({
          type: "response.completed",
          response: {
            id: response.id,
            usage: {
              input_tokens: usage.inputTokens,
              input_tokens_details: usage.inputTokensDetails?.[0] ?? null,
              output_tokens: usage.outputTokens,
              output_tokens_details: usage.outputTokensDetails?.[0] ?? null,
              total_tokens: usage.totalTokens
            },
            ...response.output && response.output.length > 0 ? {
              output: response.output.map((item) => {
                if (item.type === "message" && item.role === "assistant") {
                  return {
                    id: item.id ?? "msg_1",
                    role: item.role,
                    content: item.content
                  };
                }
                return item;
              }),
              output_text: response.output.filter(
                (item) => item.type === "message" && item.role === "assistant"
              )[0]?.content?.find(
                (c) => c.type === "output_text"
              )?.text ?? (this.lastStreamedMessage ?? "")
            } : {}
          }
        });
        events.push({
          type: "response_done",
          response
        });
        break;
      }
      case "turn.failed":
        events.push({
          type: "model",
          event: {
            type: "error",
            error: {
              message: event.error.message
            }
          }
        });
        break;
      case "error":
        events.push({
          type: "model",
          event: {
            type: "error",
            error: {
              message: event.message
            }
          }
        });
        break;
      case "raw_event":
        break;
      default:
        break;
    }
    if (event?.type !== "raw_event") {
      const rawEvent = {
        type: "raw_event",
        raw: event
      };
      if (events.length === 0) {
        return [rawEvent];
      }
      const result = [...events];
      const insertIndex = Math.min(1, result.length);
      result.splice(insertIndex, 0, rawEvent);
      return result;
    }
    return events;
  }
};
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeAgentsOutputType(outputType) {
  if (!isObject(outputType)) return void 0;
  const outType = outputType;
  const t = typeof outType.type === "string" ? outType.type : void 0;
  if (t === "json_schema" || t === "json-schema") {
    const topLevelSchema = outType.schema;
    if (isObject(topLevelSchema)) {
      return topLevelSchema;
    }
    const nested = outType.json_schema;
    if (isObject(nested)) {
      const nestedSchema = nested.schema;
      if (isObject(nestedSchema)) {
        return nestedSchema;
      }
    }
    return void 0;
  }
  if ("schema" in outType && isObject(outType.schema)) {
    return outType.schema;
  }
  if ("type" in outType && outType.type === "object" || "properties" in outType || "required" in outType) {
    return outType;
  }
  return void 0;
}

// src/agents/codexTool.ts
import { tool } from "@openai/agents";
function codexTool(options) {
  const { codexExecute, ...delegate } = options;
  const agentTool = tool(delegate);
  const executor = createCodexExecutor(agentTool.name, codexExecute);
  registerCodexToolExecutor(agentTool.name, executor);
  return agentTool;
}
function createCodexExecutor(toolName, customExecutor) {
  return async ({ arguments: args }) => {
    const parsedArgs = args ?? {};
    try {
      const result = await customExecutor(parsedArgs);
      return result;
    } catch (error) {
      throw new Error(`Codex tool '${toolName}' failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

// src/agents/streamFormatter.ts
async function formatStream(stream, options = {}) {
  const state = {
    text: "",
    reasoning: "",
    toolCalls: [],
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    },
    errors: []
  };
  for await (const event of stream) {
    switch (event.type) {
      case "response_started":
        options.onUpdate?.({ usage: state.usage });
        break;
      case "output_text_delta":
        state.text += event.delta;
        options.onUpdate?.({ text: state.text });
        break;
      case "model": {
        const e = event.event;
        if (e && typeof e === "object") {
          if (e.type === "reasoning_delta" && typeof e.delta === "string") {
            state.reasoning += e.delta;
            options.onUpdate?.({ reasoning: state.reasoning });
          } else if (e.type === "reasoning_done" && typeof e.reasoning === "string") {
            state.reasoning = e.reasoning || state.reasoning;
            options.onUpdate?.({ reasoning: state.reasoning });
          } else if (e.type === "error" && e.error && typeof e.error.message === "string") {
            state.errors.push({ message: e.error.message });
            options.onUpdate?.({ errors: state.errors.slice() });
          } else if (typeof e.type === "string" && e.type.startsWith("tool_")) {
            state.toolCalls.push({
              name: e.name,
              input: e.input,
              output: e.output,
              status: e.status === "started" || e.status === "completed" ? e.status : void 0
            });
            options.onUpdate?.({ toolCalls: state.toolCalls.slice() });
          }
        }
        break;
      }
      case "response_done":
        state.responseId = event.response.id;
        {
          const u = event.response.usage;
          const mergeDetails = (arr) => {
            if (!arr || arr.length === 0) return void 0;
            const out = {};
            for (const rec of arr) {
              for (const [k, v] of Object.entries(rec)) {
                out[k] = (out[k] ?? 0) + (typeof v === "number" ? v : 0);
              }
            }
            return out;
          };
          const inputDetails = mergeDetails(u.inputTokensDetails);
          const outputDetails = mergeDetails(u.outputTokensDetails);
          state.usage = {
            requests: u.requests,
            inputTokens: u.inputTokens ?? 0,
            outputTokens: u.outputTokens ?? 0,
            totalTokens: u.totalTokens ?? 0,
            inputTokensDetails: inputDetails,
            outputTokensDetails: outputDetails
          };
          state.cachedTokens = inputDetails?.cachedTokens ?? state.cachedTokens;
        }
        if (event.response.providerData && typeof event.response.providerData === "object") {
          state.providerData = event.response.providerData;
          options.onUpdate?.({ providerData: state.providerData });
        }
        options.onUpdate?.({ responseId: state.responseId, usage: state.usage, cachedTokens: state.cachedTokens });
        break;
      default:
        break;
    }
  }
  return state;
}

// src/agents/OpenCodeAgent.ts
import net from "net";
var DEFAULT_MODEL = "anthropic/claude-sonnet-4-5-20250929";
var DEFAULT_HOSTNAME = "127.0.0.1";
var DEFAULT_PORT = 4096;
var opencodeModulePromise = null;
async function loadOpencodeModule() {
  if (!opencodeModulePromise) {
    opencodeModulePromise = import("@opencode-ai/sdk");
  }
  return opencodeModulePromise;
}
async function isPortAvailable(port, host) {
  return new Promise((resolve) => {
    const tester = net.createServer().once("error", () => resolve(false)).once("listening", () => tester.close(() => resolve(true))).listen(port, host);
  });
}
async function findAvailablePort(host, preferred) {
  if (preferred !== void 0 && await isPortAvailable(preferred, host)) {
    return preferred;
  }
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to determine available port")));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}
var OpenCodeAgent = class {
  options;
  approvalHandler;
  clientPromise;
  constructor(options = {}) {
    this.options = options;
    this.approvalHandler = options.onApprovalRequest;
  }
  async delegate(task) {
    return this.executeTask(task);
  }
  async delegateStreaming(task, onEvent, sessionId) {
    return this.executeTask(task, { sessionId, onEvent });
  }
  async resume(sessionId, task) {
    return this.executeTask(task, { sessionId });
  }
  async workflow(steps) {
    const results = [];
    let sessionId;
    for (const step of steps) {
      const result = await this.executeTask(step, { sessionId });
      results.push(result);
      if (!result.success) {
        break;
      }
      sessionId = result.sessionId;
    }
    return results;
  }
  async executeTask(prompt, options) {
    let sessionId = options?.sessionId;
    try {
      const client = await this.ensureClient();
      sessionId = await this.ensureSession(client, sessionId, prompt);
      const shouldStream = Boolean(this.approvalHandler || options?.onEvent);
      const controller = new AbortController();
      const watcher = shouldStream ? this.watchEvents(client, sessionId, options?.onEvent, controller.signal).catch((error) => {
        if (!controller.signal.aborted) {
          throw error;
        }
      }) : null;
      try {
        const promptBody = {
          parts: [{ type: "text", text: prompt }]
        };
        const parsedModel = this.parseModel(this.options.model ?? DEFAULT_MODEL);
        if (parsedModel) {
          promptBody.model = parsedModel;
        }
        const response = await client.session.prompt({
          path: { id: sessionId },
          body: promptBody,
          query: { directory: this.getWorkingDirectory() }
        });
        const data = this.extractData(response);
        return {
          sessionId,
          threadId: sessionId,
          output: this.collectText(data),
          success: true,
          usage: this.toUsage(data)
        };
      } finally {
        if (watcher) {
          controller.abort();
          await watcher;
        }
      }
    } catch (error) {
      return {
        sessionId: sessionId ?? "",
        threadId: sessionId,
        output: "",
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  async ensureClient() {
    if (this.clientPromise) {
      return this.clientPromise;
    }
    if (this.options.clientFactory) {
      this.clientPromise = this.options.clientFactory().then(({ client }) => client);
      return this.clientPromise;
    }
    if (this.options.baseUrl) {
      this.clientPromise = loadOpencodeModule().then(
        ({ createOpencodeClient }) => createOpencodeClient({
          baseUrl: this.options.baseUrl
        })
      );
      return this.clientPromise;
    }
    this.clientPromise = loadOpencodeModule().then(async ({ createOpencode }) => {
      const hostname = this.options.hostname ?? DEFAULT_HOSTNAME;
      const port = await findAvailablePort(hostname, this.options.port ?? DEFAULT_PORT);
      const { client } = await createOpencode({ hostname, port, config: this.options.config });
      return client;
    });
    return this.clientPromise;
  }
  async ensureSession(client, existingId, prompt) {
    if (existingId) {
      return existingId;
    }
    const result = await client.session.create({
      body: {
        title: this.options.title ?? this.createSessionTitle(prompt)
      },
      query: { directory: this.getWorkingDirectory() }
    });
    const session = this.extractData(result);
    return session.id;
  }
  createSessionTitle(prompt) {
    const [firstLineRaw = ""] = prompt.trim().split(/\r?\n/);
    const firstLine = firstLineRaw || "OpenCode Session";
    return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
  }
  parseModel(model) {
    if (!model) {
      return void 0;
    }
    if (model.includes("/")) {
      const [providerPart, modelPart] = model.split("/", 2);
      const providerID = providerPart || "anthropic";
      const modelID = modelPart || providerPart || model;
      return { providerID, modelID };
    }
    return { providerID: "anthropic", modelID: model };
  }
  collectText(response) {
    const texts = response.parts?.filter((part) => part.type === "text") ?? [];
    return texts.map((part) => part.text).join("\n").trim();
  }
  toUsage(response) {
    const tokens = response.info?.tokens;
    if (!tokens) {
      return null;
    }
    return {
      input_tokens: tokens.input ?? 0,
      output_tokens: tokens.output ?? 0,
      cached_input_tokens: tokens.cache?.read ?? 0
    };
  }
  extractData(result) {
    if (result && typeof result === "object" && "data" in result) {
      const record = result;
      if (record.data !== void 0) {
        return record.data;
      }
      throw new Error(this.describeError(record.error));
    }
    return result;
  }
  describeError(error) {
    if (!error) {
      return "Unknown OpenCode error";
    }
    if (typeof error === "string") {
      return error;
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "object" && "message" in error && typeof error.message === "string") {
      return error.message;
    }
    return JSON.stringify(error);
  }
  async watchEvents(client, sessionId, onEvent, signal) {
    const { stream } = await client.event.subscribe({
      signal,
      query: { directory: this.getWorkingDirectory() }
    });
    const handledPermissions = /* @__PURE__ */ new Set();
    for await (const event of stream) {
      if (signal.aborted) {
        break;
      }
      const targetSessionId = this.extractSessionId(event);
      if (this.approvalHandler && event.type === "permission.updated") {
        const permission = event.properties;
        if (permission.sessionID === sessionId && !handledPermissions.has(permission.id)) {
          handledPermissions.add(permission.id);
          await this.respondToPermission(client, permission);
        }
      }
      if (onEvent && targetSessionId === sessionId) {
        onEvent(event);
      }
    }
  }
  extractSessionId(event) {
    const properties = event.properties;
    if (!properties) {
      return void 0;
    }
    if (typeof properties.sessionID === "string") {
      return properties.sessionID;
    }
    if (typeof properties.info === "object" && properties.info !== null && "sessionID" in properties.info) {
      const value = properties.info.sessionID;
      return typeof value === "string" ? value : void 0;
    }
    return void 0;
  }
  async respondToPermission(client, permission) {
    if (!this.approvalHandler) {
      return;
    }
    const decision = await this.approvalHandler({
      id: permission.id,
      type: permission.type,
      title: permission.title,
      sessionId: permission.sessionID,
      metadata: permission.metadata ?? {},
      pattern: Array.isArray(permission.pattern) ? permission.pattern.slice() : permission.pattern
    });
    const response = this.normalizeDecision(decision);
    await client.postSessionIdPermissionsPermissionId({
      path: {
        id: permission.sessionID,
        permissionID: permission.id
      },
      body: { response }
    });
  }
  normalizeDecision(decision) {
    if (typeof decision === "boolean") {
      return decision ? "once" : "reject";
    }
    if (typeof decision === "string") {
      return decision;
    }
    return decision.response;
  }
  getWorkingDirectory() {
    return this.options.workingDirectory ?? process.cwd();
  }
};

// src/cloudTasks.ts
var CloudTasks = class {
  constructor(options = {}) {
    this.options = options;
  }
  binding() {
    const b = getNativeBinding();
    if (!b) throw new Error("Native binding not available");
    return b;
  }
  async list(env) {
    const b = this.binding();
    if (!b.cloudTasksList) throw new Error("cloudTasksList is not available in this build");
    const json = await b.cloudTasksList(env, this.options.baseUrl, this.options.apiKey);
    return JSON.parse(json);
  }
  async getDiff(taskId) {
    const b = this.binding();
    if (!b.cloudTasksGetDiff) throw new Error("cloudTasksGetDiff is not available in this build");
    const json = await b.cloudTasksGetDiff(taskId, this.options.baseUrl, this.options.apiKey);
    const parsed = JSON.parse(json);
    return parsed.diff ?? null;
  }
  async applyPreflight(taskId, diffOverride) {
    const b = this.binding();
    if (!b.cloudTasksApplyPreflight) {
      throw new Error("cloudTasksApplyPreflight is not available in this build");
    }
    const json = await b.cloudTasksApplyPreflight(
      taskId,
      diffOverride,
      this.options.baseUrl,
      this.options.apiKey
    );
    return JSON.parse(json);
  }
  async apply(taskId, diffOverride) {
    const b = this.binding();
    if (!b.cloudTasksApply) throw new Error("cloudTasksApply is not available in this build");
    const json = await b.cloudTasksApply(
      taskId,
      diffOverride,
      this.options.baseUrl,
      this.options.apiKey
    );
    return JSON.parse(json);
  }
  async create(envId, prompt, opts) {
    const b = this.binding();
    if (!b.cloudTasksCreate) throw new Error("cloudTasksCreate is not available in this build");
    const json = await b.cloudTasksCreate(
      envId,
      prompt,
      opts?.gitRef,
      opts?.qaMode,
      opts?.bestOfN,
      this.options.baseUrl,
      this.options.apiKey
    );
    return JSON.parse(json);
  }
};

// src/logging/types.ts
var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
  LogLevel2[LogLevel2["INFO"] = 1] = "INFO";
  LogLevel2[LogLevel2["WARN"] = 2] = "WARN";
  LogLevel2[LogLevel2["ERROR"] = 3] = "ERROR";
  LogLevel2[LogLevel2["SILENT"] = 4] = "SILENT";
  return LogLevel2;
})(LogLevel || {});

// src/logging/logger.ts
var COLORS = {
  reset: "\x1B[0m",
  // Log levels
  debug: "\x1B[90m",
  // Gray
  info: "\x1B[36m",
  // Cyan
  warn: "\x1B[33m",
  // Yellow
  error: "\x1B[31m",
  // Red
  // Scopes
  thread: "\x1B[94m",
  // Bright blue
  merge: "\x1B[35m",
  // Magenta
  git: "\x1B[34m",
  // Blue
  coordinator: "\x1B[36m",
  // Cyan
  worker: "\x1B[33m",
  // Yellow
  supervisor: "\x1B[95m",
  // Bright magenta
  reviewer: "\x1B[32m",
  // Green
  validation: "\x1B[92m",
  // Bright green
  lsp: "\x1B[96m",
  // Bright cyan
  agent: "\x1B[93m",
  // Bright yellow
  provider: "\x1B[91m",
  // Bright red
  ci: "\x1B[35m",
  // Magenta
  test: "\x1B[32m",
  // Green
  system: "\x1B[37m"
  // White
};
var consoleOutput = {
  debug: (msg) => console.debug(msg),
  info: (msg) => console.log(msg),
  warn: (msg) => console.warn(msg),
  error: (msg) => console.error(msg)
};
var Logger = class _Logger {
  level;
  colors;
  timestamps;
  prefix;
  json;
  output;
  constructor(config = {}) {
    this.level = config.level ?? 1 /* INFO */;
    this.colors = config.colors ?? (typeof process !== "undefined" && process.stdout?.isTTY === true);
    this.timestamps = config.timestamps ?? false;
    this.prefix = config.prefix ?? "";
    this.json = config.json ?? false;
    this.output = config.output ?? consoleOutput;
  }
  /**
   * Create a new logger with modified configuration
   */
  configure(config) {
    return new _Logger({
      level: config.level ?? this.level,
      colors: config.colors ?? this.colors,
      timestamps: config.timestamps ?? this.timestamps,
      prefix: config.prefix ?? this.prefix,
      json: config.json ?? this.json,
      output: config.output ?? this.output
    });
  }
  /**
   * Create a scoped logger
   */
  scope(scope, subject) {
    return new ScopedLogger(this, scope, subject);
  }
  /**
   * Log a debug message
   */
  debug(message, data) {
    this.log(0 /* DEBUG */, message, data);
  }
  /**
   * Log an info message
   */
  info(message, data) {
    this.log(1 /* INFO */, message, data);
  }
  /**
   * Log a warning message
   */
  warn(message, data) {
    this.log(2 /* WARN */, message, data);
  }
  /**
   * Log an error message
   */
  error(message, data) {
    this.log(3 /* ERROR */, message, data);
  }
  /**
   * Internal log method
   */
  log(level, message, data, scope, subject) {
    if (level < this.level) {
      return;
    }
    if (this.json) {
      this.logJson(level, message, data, scope, subject);
    } else {
      this.logFormatted(level, message, scope, subject);
    }
  }
  /**
   * Log in JSON format
   */
  logJson(level, message, data, scope, subject) {
    const entry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level: LogLevel[level],
      message,
      ...scope && { scope },
      ...subject && { subject },
      ...data && { data }
    };
    const output = JSON.stringify(entry);
    this.output.info(output);
  }
  /**
   * Log in formatted text
   */
  logFormatted(level, message, scope, subject) {
    const parts = [];
    if (this.timestamps) {
      const ts = (/* @__PURE__ */ new Date()).toISOString();
      parts.push(this.colors ? `\x1B[90m[${ts}]\x1B[0m` : `[${ts}]`);
    }
    const levelName = LogLevel[level];
    if (this.colors) {
      const color = COLORS[levelName.toLowerCase()] ?? COLORS.reset;
      parts.push(`${color}[${levelName}]${COLORS.reset}`);
    } else {
      parts.push(`[${levelName}]`);
    }
    if (scope) {
      const label = subject ? `${scope}:${subject}` : scope;
      if (this.colors) {
        const color = COLORS[scope] ?? COLORS.reset;
        parts.push(`${color}[${label}]${COLORS.reset}`);
      } else {
        parts.push(`[${label}]`);
      }
    }
    if (this.prefix) {
      parts.push(this.prefix);
    }
    parts.push(message);
    const formatted = parts.join(" ");
    switch (level) {
      case 0 /* DEBUG */:
        this.output.debug(formatted);
        break;
      case 1 /* INFO */:
        this.output.info(formatted);
        break;
      case 2 /* WARN */:
        this.output.warn(formatted);
        break;
      case 3 /* ERROR */:
        this.output.error(formatted);
        break;
    }
  }
  /**
   * Internal scoped log method (used by ScopedLogger)
   */
  logScoped(level, message, scope, subject, data) {
    this.log(level, message, data, scope, subject);
  }
};
var ScopedLogger = class {
  constructor(logger2, scope, subject) {
    this.logger = logger2;
    this.scope = scope;
    this.subject = subject;
  }
  /**
   * Log a debug message
   */
  debug(message, data) {
    this.logger.logScoped(0 /* DEBUG */, message, this.scope, this.subject, data);
  }
  /**
   * Log an info message
   */
  info(message, data) {
    this.logger.logScoped(1 /* INFO */, message, this.scope, this.subject, data);
  }
  /**
   * Log a warning message
   */
  warn(message, data) {
    this.logger.logScoped(2 /* WARN */, message, this.scope, this.subject, data);
  }
  /**
   * Log an error message
   */
  error(message, data) {
    this.logger.logScoped(3 /* ERROR */, message, this.scope, this.subject, data);
  }
  /**
   * Create a ThreadLoggingSink adapter
   */
  asThreadSink() {
    return {
      info: (message) => this.info(message),
      warn: (message) => this.warn(message)
    };
  }
};
var logger = new Logger({
  level: process.env.CODEX_LOG_LEVEL ? LogLevel[process.env.CODEX_LOG_LEVEL] ?? 1 /* INFO */ : 1 /* INFO */,
  colors: process.env.CODEX_LOG_COLORS !== "false",
  timestamps: process.env.CODEX_LOG_TIMESTAMPS === "true",
  json: process.env.CODEX_LOG_JSON === "true"
});

// src/logging/threadLogger.ts
var THREAD_EVENT_TEXT_LIMIT = 400;
function createThreadLogger(scopedLogger, onUsage) {
  return {
    info: (message) => scopedLogger.info(message),
    warn: (message) => scopedLogger.warn(message),
    recordUsage: onUsage
  };
}
async function runThreadTurnWithLogs(thread, sink, prompt, turnOptions) {
  const unsubscribe = thread.onEvent((event) => logThreadEvent(event, sink));
  try {
    if (turnOptions) {
      return await thread.run(prompt, turnOptions);
    }
    return await thread.run(prompt);
  } finally {
    unsubscribe();
  }
}
function logThreadEvent(event, sink) {
  switch (event.type) {
    case "thread.started":
      sink.info(`Thread started (id: ${event.thread_id})`);
      return;
    case "turn.started":
      sink.info("Turn started");
      return;
    case "turn.completed":
      sink.info(
        `Turn completed (input ${event.usage.input_tokens}, cached ${event.usage.cached_input_tokens}, output ${event.usage.output_tokens})`
      );
      if ("recordUsage" in sink && sink.recordUsage) {
        sink.recordUsage(event.usage);
      }
      return;
    case "turn.failed":
      sink.warn(`Turn failed: ${event.error.message}`);
      return;
    case "item.started":
      sink.info(`Item started: ${describeThreadItemForLog(event.item)}`);
      return;
    case "item.updated":
      sink.info(`Item updated: ${describeThreadItemForLog(event.item)}`);
      return;
    case "item.completed": {
      const message = `Item completed: ${describeThreadItemForLog(event.item)}`;
      if (event.item.type === "error") {
        sink.warn(message);
      } else {
        sink.info(message);
      }
      return;
    }
    case "background_event":
      sink.info(`Background: ${summarizeLogText(event.message)}`);
      return;
    case "exited_review_mode":
      sink.info("Exited review mode");
      return;
    case "error":
      sink.warn(`Stream error: ${event.message}`);
      return;
    case "raw_event":
      return;
    default:
      return;
  }
}
function describeThreadItemForLog(item) {
  switch (item.type) {
    case "agent_message":
      return `agent message \u2192 ${summarizeLogText(item.text)}`;
    case "reasoning":
      return `reasoning \u2192 ${summarizeLogText(item.text)}`;
    case "command_execution": {
      const exit = item.exit_code !== void 0 ? ` exit=${item.exit_code}` : "";
      return `command "${summarizeLogText(item.command)}" [${item.status}${exit}]`;
    }
    case "file_change": {
      const changeList = item.changes.map((change) => `${change.kind}:${change.path}`).join(", ");
      return `file change [${item.status}] ${summarizeLogText(changeList)}`;
    }
    case "mcp_tool_call":
      return `mcp ${item.server}.${item.tool} [${item.status}]`;
    case "web_search":
      return `web search "${summarizeLogText(item.query)}"`;
    case "todo_list": {
      const completed = item.items.filter((todo) => todo.completed).length;
      return `todo list ${completed}/${item.items.length}`;
    }
    case "error":
      return `error \u2192 ${summarizeLogText(item.message)}`;
    default: {
      const _exhaustive = item;
      return "unknown event";
    }
  }
}
function summarizeLogText(text, limit = THREAD_EVENT_TEXT_LIMIT) {
  if (!text) {
    return "";
  }
  const flattened = text.replace(/\s+/g, " ").trim();
  if (flattened.length <= limit) {
    return flattened;
  }
  return `${flattened.slice(0, limit)}\u2026`;
}

// src/reverie/constants.ts
var DEFAULT_REVERIE_LIMIT = 6;
var DEFAULT_REVERIE_MAX_CANDIDATES = 80;
var REVERIE_EMBED_MODEL = "BAAI/bge-large-en-v1.5";
var REVERIE_RERANKER_MODEL = "rozgo/bge-reranker-v2-m3";
var REVERIE_CANDIDATE_MULTIPLIER = 3;
var REVERIE_LLM_GRADE_THRESHOLD = 0.7;
var DEFAULT_RERANKER_TOP_K = 20;
var DEFAULT_RERANKER_BATCH_SIZE = 8;

// src/reverie/quality.ts
function isValidReverieExcerpt(excerpt) {
  if (!excerpt || excerpt.trim().length < 20) {
    return false;
  }
  const trimmed = excerpt.trim();
  const normalized = trimmed.toLowerCase();
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rawTokens = trimmed.split(/\s+/).filter(Boolean);
  const tokens = rawTokens.map((token) => token.toLowerCase());
  if (rawTokens.length === 0) {
    return false;
  }
  const uppercaseTokens = rawTokens.filter((token) => {
    const alphabetic = token.replace(/[^a-z]/gi, "");
    return alphabetic.length >= 3 && alphabetic === alphabetic.toUpperCase();
  });
  const uppercaseRatio = uppercaseTokens.length / rawTokens.length;
  const snakeTokens = rawTokens.filter((token) => token.includes("_"));
  const underscoreRatio = snakeTokens.length / rawTokens.length;
  const headingLines = lines.filter((line) => /^#{1,6}\s/.test(line));
  const bulletLines = lines.filter((line) => /^\s*[\-\*]\s/.test(line));
  const numericBulletLines = lines.filter((line) => /^\s*\d+[\).]/.test(line));
  const colonLabelLines = lines.filter((line) => /^[A-Za-z0-9 _-]{1,24}:/.test(line));
  const headingRatio = headingLines.length / Math.max(lines.length, 1);
  const bulletRatio = bulletLines.length / Math.max(lines.length, 1);
  const colonLabelRatio = colonLabelLines.length / Math.max(lines.length, 1);
  const numericRatio = numericBulletLines.length / Math.max(lines.length, 1);
  const enumeratedRatio = (bulletLines.length + numericBulletLines.length) / Math.max(lines.length, 1);
  const initialTitleCaseRun = (() => {
    let run = 0;
    for (const token of rawTokens) {
      const cleaned = token.replace(/[^a-z]/gi, "");
      if (cleaned.length === 0) {
        break;
      }
      const rest = cleaned.slice(1);
      const isTitleCase = cleaned[0]?.toUpperCase() === cleaned[0] && rest === rest.toLowerCase();
      const isAllCaps = cleaned.length >= 2 && cleaned === cleaned.toUpperCase();
      if (isTitleCase || isAllCaps) {
        run += 1;
      } else {
        break;
      }
    }
    return run;
  })();
  const tokenFrequencies = tokens.reduce((map, token) => map.set(token, (map.get(token) ?? 0) + 1), /* @__PURE__ */ new Map());
  const frequencyValues = Array.from(tokenFrequencies.values());
  const mostCommonTokenCount = Math.max(...frequencyValues);
  const repeatedWordRatio = mostCommonTokenCount / tokens.length;
  if (snakeTokens.length >= 2 && underscoreRatio > 0.15) {
    return false;
  }
  if (headingRatio > 0.6 && lines.length <= 4) {
    return false;
  }
  if (initialTitleCaseRun >= 3 && rawTokens.length <= 20) {
    return false;
  }
  if (enumeratedRatio > 0.6 && lines.length >= 3) {
    return false;
  }
  const metadataScore = [
    uppercaseRatio > 0.45,
    underscoreRatio > 0.2,
    bulletRatio > 0.7,
    colonLabelRatio > 0.6 || lines.length <= 2 && colonLabelRatio > 0,
    initialTitleCaseRun >= 3,
    repeatedWordRatio > 0.45 && tokens.length > 15,
    rawTokens.length < 12 && colonLabelRatio > 0,
    numericRatio > 0.5
  ].filter(Boolean).length;
  if (metadataScore >= 2) {
    return false;
  }
  const tagMatches = trimmed.match(/<[^>]+>/g) || [];
  if (tagMatches.length > 3) {
    return false;
  }
  const blockTagMatch = trimmed.match(/^<([a-z0-9_\-]+)>[\s\S]*<\/\1>$/i);
  if (blockTagMatch) {
    const tagName = blockTagMatch[1]?.toLowerCase() ?? "";
    const looksLikeSystem = tagName.includes("system") || tagName.includes("context") || tagName.includes("env");
    if (tagName.includes("_") || looksLikeSystem) {
      return false;
    }
  }
  if (/\(\d{2,3}%\)\s*$/.test(trimmed)) {
    return false;
  }
  const looksJsonLike = (/^\{[\s\S]*\}$/.test(trimmed) || /^\[[\s\S]*\]$/.test(trimmed)) && /"\w+"\s*:/.test(trimmed);
  if (looksJsonLike) {
    return false;
  }
  return true;
}
function deduplicateReverieInsights(insights) {
  const fingerprintMap = /* @__PURE__ */ new Map();
  for (const insight of insights) {
    const fingerprint = insight.excerpt.slice(0, 100).toLowerCase().replace(/\s+/g, " ");
    const existing = fingerprintMap.get(fingerprint);
    if (!existing || insight.relevance > existing.relevance) {
      fingerprintMap.set(fingerprint, insight);
    }
  }
  return Array.from(fingerprintMap.values()).sort((a, b) => b.relevance - a.relevance);
}
function applyQualityPipeline(insights, limit = 10) {
  const stats = {
    initial: insights.length,
    afterValidityFilter: 0,
    afterDeduplication: 0,
    final: 0
  };
  const validInsights = insights.filter((insight) => isValidReverieExcerpt(insight.excerpt));
  stats.afterValidityFilter = validInsights.length;
  const deduplicated = deduplicateReverieInsights(validInsights);
  stats.afterDeduplication = deduplicated.length;
  const final = deduplicated.slice(0, limit);
  stats.final = final.length;
  return { insights: final, stats };
}

// src/reverie/boilerplate.ts
var DEFAULT_THRESHOLD = 0.8;
var DEFAULT_MAX_EXCERPT_LENGTH = 512;
var BOILERPLATE_SEEDS = [
  "<system>Focus on summarizing repo context and keep instructions short.",
  "<environment_context>Working directory: /repo/codex sandbox_mode: workspace-write network_access: disabled</environment_context>",
  "# AGENTS.md instructions for this task require you to enumerate files before running commands.",
  "Tool output: command completed successfully with exit code 0.",
  "You are coordinating multiple agents. Respond with JSON describing the plan.",
  "Sandbox env vars: CODEX_SANDBOX=seatbelt CODEX_SANDBOX_NETWORK_DISABLED=1",
  "1. Inspect repository status; 2. List directories; 3. Review README/AGENTS instructions before acting.",
  "1. Inventory tooling - run `just --list` for recipes. 2. Verify Rust toolchain. 3. Read AGENTS.md for repo-specific guidance before editing."
];
var seedVectorsPromise = null;
var embeddingDisabled = false;
var dot = (a, b) => a.reduce((sum, value, idx) => sum + value * (b[idx] ?? 0), 0);
function truncateExcerpt(text, maxLength) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength);
}
async function embedTexts(inputs, projectRoot) {
  if (embeddingDisabled || inputs.length === 0) {
    return null;
  }
  try {
    const embeddings = await fastEmbedEmbed({
      inputs,
      projectRoot,
      normalize: true
    });
    return embeddings;
  } catch (error) {
    embeddingDisabled = true;
    console.warn(`\u26A0\uFE0F  Reverie boilerplate filter disabled (fastEmbedEmbed unavailable: ${error.message ?? error})`);
    return null;
  }
}
async function getSeedVectors(projectRoot) {
  if (seedVectorsPromise) {
    return seedVectorsPromise;
  }
  seedVectorsPromise = embedTexts(BOILERPLATE_SEEDS, projectRoot);
  return seedVectorsPromise;
}
async function filterBoilerplateInsights(insights, options) {
  if (insights.length === 0) {
    return { kept: [], removed: 0 };
  }
  const projectRoot = options?.projectRoot;
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const maxExcerpt = options?.maxExcerptLength ?? DEFAULT_MAX_EXCERPT_LENGTH;
  const seeds = await getSeedVectors(projectRoot);
  if (!seeds || seeds.length === 0) {
    return { kept: insights, removed: 0 };
  }
  const excerptBatch = insights.map((insight) => truncateExcerpt(insight.excerpt, maxExcerpt));
  const excerptVectors = await embedTexts(excerptBatch, projectRoot);
  if (!excerptVectors) {
    return { kept: insights, removed: 0 };
  }
  const kept = [];
  let removed = 0;
  for (let i = 0; i < insights.length; i += 1) {
    const vector = excerptVectors[i];
    if (!vector) {
      kept.push(insights[i]);
      continue;
    }
    const maxSimilarity = seeds.reduce((currentMax, seedVec) => {
      const similarity = dot(vector, seedVec);
      return similarity > currentMax ? similarity : currentMax;
    }, -Infinity);
    if (Number.isFinite(maxSimilarity) && maxSimilarity >= threshold) {
      removed += 1;
    } else {
      kept.push(insights[i]);
    }
  }
  if (removed > 0) {
    console.log(`\u{1F9F9} Reverie boilerplate filter removed ${removed}/${insights.length} excerpts (threshold ${threshold.toFixed(2)})`);
  }
  return { kept, removed };
}

// src/reverie/logger.ts
function logReverieSearch(query, context) {
  const contextStr = context ? ` (${context})` : "";
  console.log(`\u{1F50D} Reverie search${contextStr}: "${query}"`);
}
function logReverieFiltering(stats) {
  const { total, afterQuality, afterBoilerplate, afterScore, afterDedup, minScore = 0.7 } = stats;
  const qualityFiltered = total - afterQuality;
  const boilerplateStage = afterBoilerplate ?? afterQuality;
  const boilerplateFiltered = afterQuality - boilerplateStage;
  const scoreFiltered = boilerplateStage - afterScore;
  const duplicatesFiltered = afterScore - afterDedup;
  console.log(
    `\u{1F4CA} Reverie filtering: ${total} raw \u2192 ${afterQuality} valid \u2192 ${boilerplateStage} conversational \u2192 ${afterScore} high-scoring (\u2265${minScore}) \u2192 ${afterDedup} unique (filtered: ${qualityFiltered} low-quality, ${boilerplateFiltered} boilerplate, ${scoreFiltered} low-score, ${duplicatesFiltered} duplicates)`
  );
}
function logReverieInsights(insights, limit = 3) {
  if (insights.length === 0) {
    console.log("\u{1F4ED} No reverie insights found");
    return;
  }
  console.log(`\u2728 Top ${Math.min(limit, insights.length)} reverie insights:`);
  const topInsights = insights.slice(0, limit);
  for (let i = 0; i < topInsights.length; i++) {
    const insight = topInsights[i];
    if (!insight) continue;
    const score = `${Math.round(insight.relevance * 100)}%`;
    const excerpt = truncate(insight.excerpt, 150);
    const insightText = insight.insights.length > 0 ? truncate(insight.insights[0] ?? "", 100) : "";
    console.log(`  ${i + 1}. [${score}] ${excerpt}`);
    if (insightText) {
      console.log(`     \u2192 ${insightText}`);
    }
  }
}
function logReverieHintQuality(stats) {
  const { totalRaw, afterQuality, afterDedup } = stats;
  const qualityFiltered = totalRaw - afterQuality;
  const duplicatesFiltered = afterQuality - afterDedup;
  if (totalRaw > 0) {
    console.log(
      `\u{1FA84} Reverie hint quality: ${totalRaw} raw \u2192 ${afterQuality} valid \u2192 ${afterDedup} unique (filtered ${qualityFiltered} low-quality, ${duplicatesFiltered} duplicates)`
    );
  }
}
function logLLMGrading(stats) {
  const { total, approved, rejected, minScore = 0.7 } = stats;
  const approvalRate = total > 0 ? Math.round(approved / total * 100) : 0;
  console.log(
    `\u{1F916} LLM grading: ${approved}/${total} approved (${approvalRate}%) [high-scoring \u2265${minScore}, rejected ${rejected}]`
  );
}
function logApprovedReveries(insights, maxToShow = 5) {
  if (insights.length === 0) {
    console.log("  No reveries passed LLM grading");
    return;
  }
  console.log(`  ${insights.length} reveries approved by LLM:`);
  const toShow = insights.slice(0, maxToShow);
  for (let i = 0; i < toShow.length; i++) {
    const insight = toShow[i];
    if (!insight) continue;
    const score = insight.relevance.toFixed(2);
    const preview = truncate(insight.excerpt.replace(/\s+/g, " ").trim(), 200);
    const insightText = insight.insights[0] || "Context from past work";
    console.log(`    ${i + 1}. [${score}] ${insightText}`);
    console.log(`       "${preview}"`);
  }
  if (insights.length > maxToShow) {
    console.log(`  ... and ${insights.length - maxToShow} more`);
  }
}
function truncate(text, maxLength) {
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}\u2026` : text;
}
function logMultiLevelSearch(levels) {
  if (levels.length === 0) {
    console.log("\u{1F50D} Multi-level reverie search: (no levels specified)");
    return;
  }
  const levelIcons = {
    project: "\u{1F310}",
    branch: "\u{1F33F}",
    file: "\u{1F4C4}"
  };
  const levelLabels = levels.map((level) => `${levelIcons[level]} ${level}`).join(" \u2192 ");
  console.log(`\u{1F50D} Multi-level reverie search: ${levelLabels}`);
}
function logLevelResults(level, result) {
  const levelIcons = {
    project: "\u{1F310}",
    branch: "\u{1F33F}",
    file: "\u{1F4C4}"
  };
  const icon = levelIcons[level];
  const { stats, insights } = result;
  const filterRate = stats.total > 0 ? Math.round((stats.total - stats.final) / stats.total * 100) : 0;
  const levelName = level.charAt(0).toUpperCase() + level.slice(1);
  console.log(
    `  ${icon} ${levelName} level: ${insights.length} insights (${stats.total} \u2192 ${stats.final}, ${filterRate}% filtered)`
  );
  if (stats.total > 0) {
    const qualityFiltered = stats.total - stats.afterQuality;
    const scoreFiltered = stats.afterQuality - stats.afterScore;
    const dedupFiltered = stats.afterScore - (stats.afterDedup || stats.afterScore);
    if (qualityFiltered > 0 || scoreFiltered > 0 || dedupFiltered > 0) {
      console.log(
        `    \u21B3 Quality: -${qualityFiltered}, Score: -${scoreFiltered}, Dedup: -${dedupFiltered}`
      );
    }
  }
}
function logMultiLevelSummary(results) {
  const totalInsights = Array.from(results.values()).reduce((sum, result) => sum + result.insights.length, 0);
  const totalProcessed = Array.from(results.values()).reduce((sum, result) => sum + result.stats.total, 0);
  console.log(
    `
\u2728 Multi-level search complete: ${totalInsights} total insights (processed ${totalProcessed} candidates across ${results.size} levels)`
  );
  const levelCounts = [];
  for (const [level, result] of results) {
    levelCounts.push(`${level}: ${result.insights.length}`);
  }
  console.log(`   Breakdown: ${levelCounts.join(", ")}`);
}

// src/reverie/symbols.ts
function extractKeySymbols(diff) {
  const symbols = /* @__PURE__ */ new Set();
  const functionMatch = diff.match(/(?:function|class|const|let|var|export|interface|type)\s+(\w+)/g);
  if (functionMatch) {
    for (const match of functionMatch) {
      const name = match.split(/\s+/).pop();
      if (name && name.length > 2 && !name.match(/^(true|false|null|undefined|const|let|var)$/)) {
        symbols.add(name);
      }
    }
  }
  if (symbols.size === 0) {
    return "code changes";
  }
  return Array.from(symbols).slice(0, 5).join(", ");
}

// src/reverie/episodes.ts
import fs2 from "fs/promises";
import path2 from "path";
var EPISODES_FILENAME = "reverie_episodes.json";
async function readEpisodesFile(codexHome) {
  try {
    const file = await fs2.readFile(path2.join(codexHome, EPISODES_FILENAME), "utf8");
    const parsed = JSON.parse(file);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
async function searchEpisodeSummaries(codexHome, query, repo, limit = 20) {
  const summaries = await readEpisodesFile(codexHome);
  if (!summaries.length || !query.trim()) {
    return [];
  }
  const documents = summaries.map(
    (episode) => [episode.summary, ...episode.keyDecisions ?? []].join("\n")
  );
  const inputs = [query, ...documents];
  const embeddings = await fastEmbedEmbed({
    inputs,
    projectRoot: repo,
    normalize: true,
    cache: true
  });
  if (embeddings.length !== inputs.length) {
    return [];
  }
  const [queryVector, ...docVectors] = embeddings;
  if (!queryVector) {
    return [];
  }
  const scored = summaries.map((episode, idx) => {
    const vector = docVectors[idx] ?? [];
    return {
      episode,
      score: cosineSimilarity(queryVector, vector)
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ episode }) => episode);
}
function cosineSimilarity(a, b) {
  const length = Math.min(a.length, b.length);
  if (length === 0) {
    return 0;
  }
  let dot2 = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot2 += av * bv;
    magA += av * av;
    magB += bv * bv;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot2 / denom;
}

// src/reverie/search.ts
async function searchReveries(codexHome, text, repo, options) {
  const {
    limit = DEFAULT_REVERIE_LIMIT,
    maxCandidates = DEFAULT_REVERIE_MAX_CANDIDATES,
    useReranker = true,
    rerankerModel = REVERIE_RERANKER_MODEL,
    rerankerTopK = DEFAULT_RERANKER_TOP_K,
    rerankerBatchSize = DEFAULT_RERANKER_BATCH_SIZE,
    candidateMultiplier = REVERIE_CANDIDATE_MULTIPLIER
  } = options || {};
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }
  const searchOptions = {
    projectRoot: repo,
    limit: maxCandidates * candidateMultiplier,
    // Get 3x candidates for heavy filtering
    maxCandidates: maxCandidates * candidateMultiplier,
    normalize: true,
    cache: true
  };
  if (useReranker) {
    searchOptions.rerankerModel = rerankerModel;
    searchOptions.rerankerTopK = rerankerTopK;
    searchOptions.rerankerBatchSize = rerankerBatchSize;
  }
  try {
    const regexMatches = looksLikeStructuredQuery(normalized) ? await reverieSearchConversations(codexHome, normalized, limit).catch(() => []) : [];
    const matches = await reverieSearchSemantic(codexHome, normalized, searchOptions);
    const combinedMatches = mergeSearchResults(regexMatches, matches);
    const insights = convertSearchResultsToInsights(combinedMatches);
    const validInsights = insights.filter((insight) => isValidReverieExcerpt(insight.excerpt));
    const { kept: conversational } = await filterBoilerplateInsights(validInsights, {
      projectRoot: repo
    });
    const deduplicated = deduplicateReverieInsights(conversational);
    const episodeMatches = await searchEpisodeSummaries(codexHome, normalized, repo, limit * 4).catch(() => []);
    const episodeBoost = /* @__PURE__ */ new Map();
    for (const episode of episodeMatches) {
      episodeBoost.set(episode.conversationId, Math.max(episodeBoost.get(episode.conversationId) ?? 0, episode.importance ?? 0));
    }
    const ranked = deduplicated.map((insight) => {
      const bonus = episodeBoost.get(insight.conversationId) ?? 0;
      return {
        insight,
        score: insight.relevance + bonus / 10
      };
    }).sort((a, b) => b.score - a.score).slice(0, limit).map(({ insight }) => insight);
    return ranked;
  } catch (error) {
    console.warn(
      `Reverie search failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}
function convertSearchResultsToInsights(results) {
  const flattened = [];
  for (const match of results) {
    const base = {
      conversationId: match.conversation?.id || "unknown",
      timestamp: match.conversation?.createdAt || match.conversation?.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
      relevance: typeof match.relevanceScore === "number" ? match.relevanceScore : 0,
      excerpt: "",
      insights: Array.isArray(match.insights) ? match.insights : []
    };
    const excerpts = match.matchingExcerpts?.length ? match.matchingExcerpts : [""];
    for (const excerpt of excerpts) {
      if (!excerpt.trim()) {
        continue;
      }
      flattened.push({ ...base, excerpt });
    }
  }
  return flattened;
}
function mergeSearchResults(primary, secondary) {
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  for (const list of [primary, secondary]) {
    for (const match of list) {
      const convoId = match.conversation?.id || "unknown";
      const excerptKey = match.matchingExcerpts?.[0] || String(match.relevanceScore ?? 0);
      const key = `${convoId}:${excerptKey}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(match);
    }
  }
  return merged;
}
function looksLikeStructuredQuery(text) {
  if (!text) {
    return false;
  }
  const structuredPatterns = [
    /traceback \(most recent call last\)/i,
    // Python
    /exception in thread/i,
    /java\.lang\./i,
    /org\.junit/i,
    /at\s+org\./i,
    /AssertionError:/i,
    /panic!|thread '.+' panicked/i,
    /FAIL\s+\S+\s+\(/i,
    // Jest/Vitest
    /(?:error|fail|fatal):/i,
    /Caused by:/i,
    /\bundefined reference to\b/i
  ];
  for (const pattern of structuredPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  const hashPattern = /\b[0-9a-f]{32,}\b/i;
  if (hashPattern.test(text)) {
    return true;
  }
  const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
  if (uuidPattern.test(text)) {
    return true;
  }
  const stackFrameMatches = text.match(/\bat\s+[^\s]+\s*\(|\b\S+\.\w+:\d+/gi);
  if ((stackFrameMatches?.length ?? 0) >= 2) {
    return true;
  }
  const severityTokens = text.match(/\b(?:fail|error|panic|assert|fatal)\b/gi)?.length ?? 0;
  if (severityTokens >= 3 && text.length > 50) {
    return true;
  }
  return false;
}

// src/reverie/grader.ts
import { Agent } from "@openai/agents";
var REVERIE_GRADING_SCHEMA = {
  type: "object",
  properties: {
    is_relevant: {
      type: "boolean",
      description: "True if excerpt contains specific technical details relevant to the work context"
    },
    reasoning: {
      type: "string",
      description: "Brief explanation (1-2 sentences) of why the excerpt was approved or rejected"
    }
  },
  required: ["is_relevant", "reasoning"],
  additionalProperties: false
};
async function gradeReverieRelevance(runner, searchContext, insight) {
  const graderAgent = new Agent({
    name: "ReverieGrader",
    instructions: `You are a STRICT filter for conversation excerpts. Only approve excerpts with SPECIFIC technical details.

REJECT excerpts containing:
- Greetings and pleasantries
- Thinking markers (**, ##, <thinking>)
- JSON objects or structured data dumps
- Generic phrases ("Context from past work", "working on this", etc.)
- Metadata and system information
- Boilerplate text
- Task or checklist instructions ("1.", "2.", "Plan:")
- AGENTS.md guidance, sandbox instructions, or environment descriptions
- Tool output summaries or command transcript blocks

APPROVE ONLY excerpts with:
- Specific code/file references (file paths, function names, variable names)
- Technical decisions and rationale
- Error messages and debugging details
- Implementation specifics and algorithms
- Architecture patterns and design choices

Return a JSON object with:
- is_relevant: boolean indicating if this excerpt should be kept
- reasoning: brief 1-2 sentence explanation of your decision`,
    outputType: {
      type: "json_schema",
      schema: REVERIE_GRADING_SCHEMA,
      name: "ReverieGrading",
      strict: true
    }
  });
  const prompt = `Context: ${searchContext}

Excerpt to grade:
"""
${insight.excerpt.slice(0, 400)}
"""

Evaluate whether this excerpt contains specific technical details relevant to the work context.`;
  const result = await runner.run(graderAgent, prompt);
  if (result.finalOutput && typeof result.finalOutput === "object") {
    const grading = result.finalOutput;
    return grading.is_relevant;
  }
  console.warn("Reverie grading failed to return structured output, defaulting to reject");
  return false;
}
async function gradeReveriesInParallel(runner, context, insights, options) {
  const { minRelevanceForGrading = 0.7, parallel = true } = options || {};
  const highScoring = insights.filter((insight) => insight.relevance >= minRelevanceForGrading);
  const lowScoring = insights.filter((insight) => insight.relevance < minRelevanceForGrading);
  if (highScoring.length === 0) {
    return [];
  }
  if (parallel) {
    const gradingPromises = highScoring.map(
      (insight) => gradeReverieRelevance(runner, context, insight).then((isRelevant) => ({
        insight,
        isRelevant
      }))
    );
    const gradedResults = await Promise.all(gradingPromises);
    return gradedResults.filter((r) => r.isRelevant).map((r) => r.insight);
  } else {
    const approved = [];
    for (const insight of highScoring) {
      const isRelevant = await gradeReverieRelevance(runner, context, insight);
      if (isRelevant) {
        approved.push(insight);
      }
    }
    return approved;
  }
}

// src/reverie/context.ts
function buildProjectContext(query, options) {
  return {
    level: "project",
    repoPath: options?.repoPath || process.cwd(),
    query,
    filePatterns: options?.filePatterns
  };
}
function buildBranchContext(branch, changedFiles, options) {
  return {
    level: "branch",
    repoPath: options?.repoPath || process.cwd(),
    branch,
    baseBranch: options?.baseBranch,
    changedFiles,
    recentCommits: options?.recentCommits
  };
}
function buildFileContext(filePath, options) {
  const context = {
    level: "file",
    repoPath: options?.repoPath || process.cwd(),
    filePath,
    diff: options?.diff
  };
  if (options?.extractSymbols && options?.diff) {
    const symbolsText = extractKeySymbols(options.diff);
    if (symbolsText) {
      context.symbols = symbolsText.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return context;
}
function contextToQuery(context) {
  switch (context.level) {
    case "project": {
      let query = `Project-wide: ${context.query}`;
      if (context.filePatterns && context.filePatterns.length > 0) {
        query += `
Scope: ${context.filePatterns.join(", ")}`;
      }
      return query;
    }
    case "branch": {
      let query = `Branch: ${context.branch}`;
      if (context.baseBranch) {
        query += ` (base: ${context.baseBranch})`;
      }
      query += `
Files changed: ${context.changedFiles.join(", ")}`;
      if (context.recentCommits) {
        query += `
Recent commits: ${context.recentCommits}`;
      }
      return query;
    }
    case "file": {
      let query = `File: ${context.filePath}`;
      if (context.symbols && context.symbols.length > 0) {
        query += `
Symbols: ${context.symbols.join(", ")}`;
      }
      if (context.diff) {
        const truncatedDiff = context.diff.length > 500 ? context.diff.slice(0, 500) + "..." : context.diff;
        query += `
Changes:
${truncatedDiff}`;
      }
      return query;
    }
  }
}
function formatFileList(files, maxFiles = 10) {
  if (files.length === 0) {
    return "(no files)";
  }
  if (files.length <= maxFiles) {
    return files.join(", ");
  }
  const shown = files.slice(0, maxFiles);
  const remaining = files.length - maxFiles;
  return `${shown.join(", ")} ... and ${remaining} more`;
}

// src/reverie/pipeline.ts
async function applyReveriePipeline(codexHome, searchText, repo, runner, options) {
  const {
    limit = DEFAULT_REVERIE_LIMIT,
    maxCandidates = DEFAULT_REVERIE_MAX_CANDIDATES,
    minRelevanceForGrading = REVERIE_LLM_GRADE_THRESHOLD,
    skipLLMGrading = false,
    ...searchOptions
  } = options || {};
  logReverieSearch(searchText, `repo: ${repo}`);
  const rawInsights = await searchReveries(codexHome, searchText, repo, {
    limit,
    maxCandidates,
    ...searchOptions
  });
  const stats = {
    total: rawInsights.length,
    afterQuality: 0,
    afterBoilerplate: 0,
    afterScore: 0,
    afterDedup: 0,
    final: 0
  };
  const validInsights = rawInsights.filter((insight) => isValidReverieExcerpt(insight.excerpt));
  stats.afterQuality = validInsights.length;
  const { kept: conversationalInsights } = await filterBoilerplateInsights(validInsights, {
    projectRoot: repo
  });
  stats.afterBoilerplate = conversationalInsights.length;
  const highScoring = conversationalInsights.filter((insight) => insight.relevance >= minRelevanceForGrading);
  const lowScoring = conversationalInsights.filter((insight) => insight.relevance < minRelevanceForGrading);
  stats.afterScore = highScoring.length;
  let gradedInsights;
  if (skipLLMGrading || !runner) {
    gradedInsights = highScoring;
    stats.afterLLMGrade = highScoring.length;
  } else {
    gradedInsights = await gradeReveriesInParallel(runner, searchText, highScoring, {
      minRelevanceForGrading,
      parallel: true
    });
    stats.afterLLMGrade = gradedInsights.length;
    logLLMGrading({
      total: highScoring.length,
      approved: gradedInsights.length,
      rejected: highScoring.length - gradedInsights.length,
      minScore: minRelevanceForGrading
    });
    if (gradedInsights.length > 0) {
      logApprovedReveries(gradedInsights);
    }
  }
  const deduplicated = deduplicateReverieInsights(gradedInsights);
  stats.afterDedup = deduplicated.length;
  const finalInsights = deduplicated.slice(0, limit);
  stats.final = finalInsights.length;
  logReverieFiltering({
    total: stats.total,
    afterQuality: stats.afterQuality,
    afterBoilerplate: stats.afterBoilerplate,
    afterScore: stats.afterScore,
    afterDedup: stats.afterDedup,
    minScore: minRelevanceForGrading
  });
  return {
    insights: finalInsights,
    stats
  };
}
async function applyFileReveriePipeline(codexHome, filePath, fileContext, repo, runner, options) {
  const {
    maxCandidates = DEFAULT_REVERIE_MAX_CANDIDATES,
    limit = DEFAULT_REVERIE_LIMIT,
    ...restOptions
  } = options || {};
  const fileOptions = {
    ...restOptions,
    maxCandidates: Math.floor(maxCandidates / 2),
    limit
  };
  return applyReveriePipeline(codexHome, fileContext, repo, runner, fileOptions);
}
async function searchMultiLevel(codexHome, contexts, runner, options) {
  const levels = contexts.map((ctx) => ctx.level);
  logMultiLevelSearch(levels);
  const results = /* @__PURE__ */ new Map();
  for (const context of contexts) {
    let result;
    switch (context.level) {
      case "project":
        result = await searchProjectLevel(codexHome, context, runner, options);
        break;
      case "branch":
        result = await searchBranchLevel(codexHome, context, runner, options);
        break;
      case "file":
        result = await searchFileLevel(codexHome, context, runner, options);
        break;
    }
    results.set(context.level, result);
    logLevelResults(context.level, result);
  }
  return results;
}
async function searchProjectLevel(codexHome, context, runner, options) {
  const searchQuery = contextToQuery(context);
  const projectOptions = {
    ...options,
    maxCandidates: (options?.maxCandidates || DEFAULT_REVERIE_MAX_CANDIDATES) * 1.5
  };
  return applyReveriePipeline(
    codexHome,
    searchQuery,
    context.repoPath,
    runner,
    projectOptions
  );
}
async function searchBranchLevel(codexHome, context, runner, options) {
  const searchQuery = contextToQuery(context);
  return applyReveriePipeline(
    codexHome,
    searchQuery,
    context.repoPath,
    runner,
    options
  );
}
async function searchFileLevel(codexHome, context, runner, options) {
  const searchQuery = contextToQuery(context);
  return applyFileReveriePipeline(
    codexHome,
    context.filePath,
    searchQuery,
    context.repoPath,
    runner,
    options
  );
}

// src/index.ts
function evCompleted(id) {
  const binding = getNativeBinding();
  if (!binding) throw new Error("Native binding not available");
  return binding.evCompleted(id);
}
function evResponseCreated(id) {
  const binding = getNativeBinding();
  if (!binding) throw new Error("Native binding not available");
  return binding.evResponseCreated(id);
}
function evAssistantMessage(id, text) {
  const binding = getNativeBinding();
  if (!binding) throw new Error("Native binding not available");
  return binding.evAssistantMessage(id, text);
}
function evFunctionCall(callId, name, args) {
  const binding = getNativeBinding();
  if (!binding) throw new Error("Native binding not available");
  return binding.evFunctionCall(callId, name, args);
}
function sse(events) {
  const binding = getNativeBinding();
  if (!binding) throw new Error("Native binding not available");
  return binding.sse(events);
}
export {
  CloudTasks,
  Codex,
  CodexProvider,
  DEFAULT_RERANKER_BATCH_SIZE,
  DEFAULT_RERANKER_TOP_K,
  DEFAULT_REVERIE_LIMIT,
  DEFAULT_REVERIE_MAX_CANDIDATES,
  DEFAULT_SERVERS,
  LogLevel,
  Logger,
  LspDiagnosticsBridge,
  LspManager,
  OpenCodeAgent,
  REVERIE_CANDIDATE_MULTIPLIER,
  REVERIE_EMBED_MODEL,
  REVERIE_LLM_GRADE_THRESHOLD,
  REVERIE_RERANKER_MODEL,
  ScopedLogger,
  Thread,
  applyFileReveriePipeline,
  applyQualityPipeline,
  applyReveriePipeline,
  attachLspDiagnostics,
  buildBranchContext,
  buildFileContext,
  buildProjectContext,
  codexTool,
  collectRepoDiffSummary,
  contextToQuery,
  createThreadLogger,
  deduplicateReverieInsights,
  encodeToToon,
  evAssistantMessage,
  evCompleted,
  evFunctionCall,
  evResponseCreated,
  extractKeySymbols,
  fastEmbedEmbed,
  fastEmbedInit,
  findServerForFile,
  formatFileList,
  formatStream,
  gradeReverieRelevance,
  gradeReveriesInParallel,
  isValidReverieExcerpt,
  logApprovedReveries,
  logLLMGrading,
  logLevelResults,
  logMultiLevelSearch,
  logMultiLevelSummary,
  logReverieFiltering,
  logReverieHintQuality,
  logReverieInsights,
  logReverieSearch,
  logger,
  resolveWorkspaceRoot,
  reverieGetConversationInsights,
  reverieIndexSemantic,
  reverieListConversations,
  reverieSearchConversations,
  reverieSearchSemantic,
  runThreadTurnWithLogs,
  runTui,
  searchBranchLevel,
  searchFileLevel,
  searchMultiLevel,
  searchProjectLevel,
  searchReveries,
  sse,
  startTui,
  tokenizerCount,
  tokenizerDecode,
  tokenizerEncode,
  truncate as truncateText
};
//# sourceMappingURL=index.mjs.map
