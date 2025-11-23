"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  CloudTasks: () => CloudTasks,
  Codex: () => Codex,
  CodexProvider: () => CodexProvider,
  DEFAULT_RERANKER_BATCH_SIZE: () => DEFAULT_RERANKER_BATCH_SIZE,
  DEFAULT_RERANKER_TOP_K: () => DEFAULT_RERANKER_TOP_K,
  DEFAULT_REVERIE_LIMIT: () => DEFAULT_REVERIE_LIMIT,
  DEFAULT_REVERIE_MAX_CANDIDATES: () => DEFAULT_REVERIE_MAX_CANDIDATES,
  DEFAULT_SERVERS: () => DEFAULT_SERVERS,
  LogLevel: () => LogLevel,
  Logger: () => Logger,
  LspDiagnosticsBridge: () => LspDiagnosticsBridge,
  LspManager: () => LspManager,
  OpenCodeAgent: () => OpenCodeAgent,
  REVERIE_CANDIDATE_MULTIPLIER: () => REVERIE_CANDIDATE_MULTIPLIER,
  REVERIE_EMBED_MODEL: () => REVERIE_EMBED_MODEL,
  REVERIE_LLM_GRADE_THRESHOLD: () => REVERIE_LLM_GRADE_THRESHOLD,
  REVERIE_RERANKER_MODEL: () => REVERIE_RERANKER_MODEL,
  ScopedLogger: () => ScopedLogger,
  Thread: () => Thread,
  applyFileReveriePipeline: () => applyFileReveriePipeline,
  applyQualityPipeline: () => applyQualityPipeline,
  applyReveriePipeline: () => applyReveriePipeline,
  attachLspDiagnostics: () => attachLspDiagnostics,
  buildBranchContext: () => buildBranchContext,
  buildFileContext: () => buildFileContext,
  buildProjectContext: () => buildProjectContext,
  codexTool: () => codexTool,
  collectRepoDiffSummary: () => collectRepoDiffSummary,
  contextToQuery: () => contextToQuery,
  createThreadLogger: () => createThreadLogger,
  deduplicateReverieInsights: () => deduplicateReverieInsights,
  encodeToToon: () => encodeToToon,
  evAssistantMessage: () => evAssistantMessage,
  evCompleted: () => evCompleted,
  evFunctionCall: () => evFunctionCall,
  evResponseCreated: () => evResponseCreated,
  extractKeySymbols: () => extractKeySymbols,
  fastEmbedEmbed: () => fastEmbedEmbed,
  fastEmbedInit: () => fastEmbedInit,
  findServerForFile: () => findServerForFile,
  formatFileList: () => formatFileList,
  formatStream: () => formatStream,
  gradeReverieRelevance: () => gradeReverieRelevance,
  gradeReveriesInParallel: () => gradeReveriesInParallel,
  isValidReverieExcerpt: () => isValidReverieExcerpt,
  logApprovedReveries: () => logApprovedReveries,
  logLLMGrading: () => logLLMGrading,
  logLevelResults: () => logLevelResults,
  logMultiLevelSearch: () => logMultiLevelSearch,
  logMultiLevelSummary: () => logMultiLevelSummary,
  logReverieFiltering: () => logReverieFiltering,
  logReverieHintQuality: () => logReverieHintQuality,
  logReverieInsights: () => logReverieInsights,
  logReverieSearch: () => logReverieSearch,
  logger: () => logger,
  resolveWorkspaceRoot: () => resolveWorkspaceRoot,
  reverieGetConversationInsights: () => reverieGetConversationInsights,
  reverieIndexSemantic: () => reverieIndexSemantic,
  reverieListConversations: () => reverieListConversations,
  reverieSearchConversations: () => reverieSearchConversations,
  reverieSearchSemantic: () => reverieSearchSemantic,
  runThreadTurnWithLogs: () => runThreadTurnWithLogs,
  runTui: () => runTui,
  searchBranchLevel: () => searchBranchLevel,
  searchFileLevel: () => searchFileLevel,
  searchMultiLevel: () => searchMultiLevel,
  searchProjectLevel: () => searchProjectLevel,
  searchReveries: () => searchReveries,
  sse: () => sse,
  startTui: () => startTui,
  tokenizerCount: () => tokenizerCount,
  tokenizerDecode: () => tokenizerDecode,
  tokenizerEncode: () => tokenizerEncode,
  truncateText: () => truncate
});
module.exports = __toCommonJS(src_exports);

// node_modules/tsup/assets/cjs_shims.js
var getImportMetaUrl = () => typeof document === "undefined" ? new URL(`file:${__filename}`).href : document.currentScript && document.currentScript.src || new URL("main.js", document.baseURI).href;
var importMetaUrl = /* @__PURE__ */ getImportMetaUrl();

// src/thread.ts
var fs5 = __toESM(require("fs"));
var path8 = __toESM(require("path"));

// src/events/convert.ts
function convertRustEventToThreadEvent(rustEvent) {
  if (rustEvent?.ThreadStarted) {
    return {
      type: "thread.started",
      thread_id: rustEvent.ThreadStarted.thread_id
    };
  }
  if (rustEvent?.TurnStarted) {
    return { type: "turn.started" };
  }
  if (rustEvent?.TurnCompleted) {
    return {
      type: "turn.completed",
      usage: rustEvent.TurnCompleted.usage
    };
  }
  if (rustEvent?.TurnFailed) {
    return {
      type: "turn.failed",
      error: rustEvent.TurnFailed.error
    };
  }
  if (rustEvent?.ItemStarted) {
    return {
      type: "item.started",
      item: rustEvent.ItemStarted.item
    };
  }
  if (rustEvent?.ItemUpdated) {
    return {
      type: "item.updated",
      item: rustEvent.ItemUpdated.item
    };
  }
  if (rustEvent?.ItemCompleted) {
    return {
      type: "item.completed",
      item: rustEvent.ItemCompleted.item
    };
  }
  if (rustEvent?.Error) {
    return {
      type: "error",
      message: rustEvent.Error.message
    };
  }
  if (rustEvent?.BackgroundEvent) {
    return {
      type: "background_event",
      message: rustEvent.BackgroundEvent.message
    };
  }
  if (rustEvent?.type === "background_event" && typeof rustEvent.message === "string") {
    return {
      type: "background_event",
      message: rustEvent.message
    };
  }
  if (rustEvent?.type === "plan_update_scheduled" && rustEvent.plan) {
    const planData = rustEvent.plan;
    const planItems = planData.plan || [];
    return {
      type: "item.completed",
      item: {
        id: `plan-${Date.now()}`,
        type: "todo_list",
        items: planItems.map((item) => ({
          text: item.step,
          completed: item.status === "completed"
        }))
      }
    };
  }
  if (rustEvent?.type) {
    return rustEvent;
  }
  return rustEvent;
}

// src/outputSchemaFile.ts
var import_node_fs = require("fs");
var import_node_os = __toESM(require("os"));
var import_node_path = __toESM(require("path"));
function normalizeOutputSchema(schema) {
  if (schema === void 0) {
    return void 0;
  }
  if (isJsonObject(schema) && (schema.type === "json_schema" || schema.type === "json-schema") && isJsonObject(schema.json_schema) && isJsonObject(schema.json_schema.schema)) {
    const strict = typeof schema.json_schema.strict === "boolean" ? schema.json_schema.strict : true;
    return normalizeJsonSchemaObject(schema.json_schema.schema, strict);
  }
  if (isJsonObject(schema) && isJsonObject(schema.schema)) {
    const strict = typeof schema.strict === "boolean" ? schema.strict : true;
    return normalizeJsonSchemaObject(schema.schema, strict);
  }
  if (!isJsonObject(schema)) {
    throw new Error(
      "outputSchema must be a plain JSON object or an OpenAI-style json_schema wrapper"
    );
  }
  return normalizeJsonSchemaObject(schema, true);
}
async function createOutputSchemaFile(schema) {
  const normalizedSchema = normalizeOutputSchema(schema);
  if (!normalizedSchema) {
    return { cleanup: async () => {
    } };
  }
  const schemaDir = await import_node_fs.promises.mkdtemp(import_node_path.default.join(import_node_os.default.tmpdir(), "codex-output-schema-"));
  const schemaPath = import_node_path.default.join(schemaDir, "schema.json");
  const cleanup = async () => {
    try {
      await import_node_fs.promises.rm(schemaDir, { recursive: true, force: true });
    } catch {
    }
  };
  try {
    await import_node_fs.promises.writeFile(schemaPath, JSON.stringify(normalizedSchema), "utf8");
    return { schemaPath, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeJsonSchemaObject(schema, strict) {
  const record = { ...schema };
  const hasExplicitAdditional = typeof record.additionalProperties === "boolean" || typeof record.additionalProperties === "object";
  const additionalProperties = hasExplicitAdditional ? record.additionalProperties : strict ? false : record.additionalProperties;
  return {
    ...record,
    ...hasExplicitAdditional || strict ? { additionalProperties } : {}
  };
}

// src/nativeBinding.ts
var import_node_fs2 = __toESM(require("fs"));
var import_node_module = require("module");
var import_node_path2 = __toESM(require("path"));
var import_node_url = require("url");
var CLI_ENTRYPOINT_ENV = "CODEX_NODE_CLI_ENTRYPOINT";
function ensureCliEntrypointEnv() {
  if (process.env[CLI_ENTRYPOINT_ENV]) {
    return;
  }
  const filename = (0, import_node_url.fileURLToPath)(importMetaUrl);
  const dirname3 = import_node_path2.default.dirname(filename);
  const candidates = [
    import_node_path2.default.resolve(dirname3, "cli.cjs"),
    import_node_path2.default.resolve(dirname3, "../cli.cjs"),
    import_node_path2.default.resolve(dirname3, "../dist/cli.cjs")
  ];
  for (const candidate of candidates) {
    if (import_node_fs2.default.existsSync(candidate)) {
      process.env[CLI_ENTRYPOINT_ENV] = candidate;
      break;
    }
  }
}
ensureCliEntrypointEnv();
var cachedBinding;
function getImportMetaUrl2() {
  try {
    return Function(
      "return typeof import.meta !== 'undefined' && import.meta.url ? import.meta.url : undefined;"
    )();
  } catch {
    return void 0;
  }
}
function resolveBindingEntryPath() {
  if (typeof __dirname === "string") {
    return import_node_path2.default.resolve(__dirname, "..", "index.js");
  }
  const importMetaUrl2 = getImportMetaUrl2();
  if (importMetaUrl2) {
    try {
      const filePath = (0, import_node_url.fileURLToPath)(importMetaUrl2);
      return import_node_path2.default.resolve(import_node_path2.default.dirname(filePath), "..", "index.js");
    } catch {
    }
  }
  return import_node_path2.default.resolve(process.cwd(), "index.js");
}
function resolveRequire() {
  const globalRequire = globalThis.require;
  if (typeof globalRequire === "function") {
    return globalRequire;
  }
  if (typeof __filename === "string") {
    try {
      return (0, import_node_module.createRequire)(__filename);
    } catch {
    }
  }
  const importMetaUrl2 = getImportMetaUrl2();
  if (importMetaUrl2) {
    try {
      return (0, import_node_module.createRequire)(importMetaUrl2);
    } catch {
    }
  }
  const fallbackBase = typeof __dirname === "string" ? __dirname : process.cwd();
  const fallbackPath = import_node_path2.default.join(fallbackBase, "noop.js");
  return (0, import_node_module.createRequire)(fallbackPath);
}
function getNativeBinding() {
  if (cachedBinding !== void 0) {
    return cachedBinding;
  }
  const requireFn = resolveRequire();
  const envPath = process.env.CODEX_NATIVE_BINDING;
  if (envPath && envPath.length > 0) {
    process.env.NAPI_RS_NATIVE_LIBRARY_PATH = envPath;
  }
  const bindingEntryPath = resolveBindingEntryPath();
  try {
    const binding = requireFn(bindingEntryPath);
    cachedBinding = binding;
    return cachedBinding;
  } catch (error) {
    console.warn("Failed to load native NAPI binding:", error);
    cachedBinding = null;
    return cachedBinding;
  }
}
async function reverieListConversations(codexHomePath, limit, offset) {
  const binding = getNativeBinding();
  if (!binding?.reverieListConversations) throw new Error("Native binding not available or reverie functions not supported");
  return binding.reverieListConversations(codexHomePath, limit, offset);
}
async function reverieSearchConversations(codexHomePath, query, limit) {
  const binding = getNativeBinding();
  if (!binding?.reverieSearchConversations) throw new Error("Native binding not available or reverie functions not supported");
  return binding.reverieSearchConversations(codexHomePath, query, limit);
}
async function reverieSearchSemantic(codexHomePath, context, options) {
  const binding = getNativeBinding();
  if (!binding?.reverieSearchSemantic) throw new Error("Native binding not available or reverie functions not supported");
  return binding.reverieSearchSemantic(codexHomePath, context, options);
}
async function reverieIndexSemantic(codexHomePath, options) {
  const binding = getNativeBinding();
  if (!binding?.reverieIndexSemantic) throw new Error("Native binding not available or reverie functions not supported");
  return binding.reverieIndexSemantic(codexHomePath, options);
}
async function reverieGetConversationInsights(conversationPath, query) {
  const binding = getNativeBinding();
  if (!binding?.reverieGetConversationInsights) throw new Error("Native binding not available or reverie functions not supported");
  return binding.reverieGetConversationInsights(conversationPath, query);
}
function encodeToToon(value) {
  const binding = getNativeBinding();
  if (!binding?.toonEncode) throw new Error("Native binding not available or toon encoder not supported");
  return binding.toonEncode(value);
}
async function fastEmbedInit(options) {
  const binding = getNativeBinding();
  if (!binding?.fastEmbedInit) throw new Error("Native binding not available or FastEmbed functions not supported");
  await binding.fastEmbedInit(options);
}
async function fastEmbedEmbed(request) {
  const binding = getNativeBinding();
  if (!binding?.fastEmbedEmbed) throw new Error("Native binding not available or FastEmbed functions not supported");
  return binding.fastEmbedEmbed(request);
}
function tokenizerCount(text, options) {
  const binding = getNativeBinding();
  if (!binding?.tokenizerCount) throw new Error("Native binding not available or tokenizer functions not supported");
  return binding.tokenizerCount(text, options);
}
function tokenizerEncode(text, options) {
  const binding = getNativeBinding();
  if (!binding?.tokenizerEncode) throw new Error("Native binding not available or tokenizer functions not supported");
  return binding.tokenizerEncode(text, options);
}
function tokenizerDecode(tokens, options) {
  const binding = getNativeBinding();
  if (!binding?.tokenizerDecode) throw new Error("Native binding not available or tokenizer functions not supported");
  return binding.tokenizerDecode(tokens, options);
}
async function collectRepoDiffSummary(options) {
  const binding = getNativeBinding();
  if (!binding?.collectRepoDiffSummary) {
    throw new Error("Native binding not available or repo diff helpers not supported");
  }
  const cwd = options?.cwd ?? process.cwd();
  const nativeOptions = options && (options.maxFiles !== void 0 || options.diffContextLines !== void 0 || options.diffCharLimit !== void 0) ? {
    maxFiles: options.maxFiles,
    diffContextLines: options.diffContextLines,
    diffCharLimit: options.diffCharLimit
  } : void 0;
  return binding.collectRepoDiffSummary(cwd, options?.baseBranchOverride, nativeOptions);
}

// src/tui.ts
function startTui(request) {
  const binding = getNativeBinding();
  if (!binding) {
    throw new Error("Native binding is not available");
  }
  if (typeof binding.startTui === "function") {
    const nativeSession = binding.startTui(request);
    return wrapNativeSession(nativeSession);
  }
  if (typeof binding.runTui === "function") {
    return createLegacySession(binding, request);
  }
  throw new Error("Native binding does not expose startTui or runTui");
}
async function runTui(request, options = {}) {
  const session = startTui(request);
  const { signal } = options;
  let abortListener;
  try {
    if (signal) {
      if (signal.aborted) {
        session.shutdown();
      } else {
        abortListener = () => session.shutdown();
        signal.addEventListener("abort", abortListener, { once: true });
      }
    }
    return await session.wait();
  } finally {
    if (abortListener && signal) {
      signal.removeEventListener("abort", abortListener);
    }
  }
}
function wrapNativeSession(nativeSession) {
  return {
    wait: () => nativeSession.wait(),
    shutdown: () => nativeSession.shutdown(),
    get closed() {
      return nativeSession.closed;
    }
  };
}
function createLegacySession(binding, request) {
  if (typeof binding.runTui !== "function") {
    throw new Error("Native binding does not expose runTui");
  }
  let closed = false;
  const promise = binding.runTui(request).then(
    (result) => {
      closed = true;
      return result;
    },
    (error) => {
      closed = true;
      throw error;
    }
  );
  return {
    wait: () => promise,
    shutdown() {
      throw new Error(
        "Programmatic shutdown is not supported by this native binding build. Rebuild the SDK to enable startTui()."
      );
    },
    get closed() {
      return closed;
    }
  };
}

// src/lsp/bridge.ts
var path7 = __toESM(require("path"));

// src/lsp/manager.ts
var path5 = __toESM(require("path"));

// src/lsp/servers.ts
var fs3 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var MARKERS_NODE = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock"];
var MARKERS_PY = ["pyproject.toml", "requirements.txt", "Pipfile", "setup.py", "setup.cfg", "poetry.lock"];
var MARKERS_RUST = ["Cargo.toml"];
var DEFAULT_SERVERS = [
  {
    id: "typescript",
    displayName: "TypeScript Language Server",
    command: ["typescript-language-server", "--stdio"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    workspace: { type: "markers", include: MARKERS_NODE }
  },
  {
    id: "pyright",
    displayName: "Pyright",
    command: ["pyright-langserver", "--stdio"],
    extensions: [".py", ".pyi"],
    workspace: { type: "markers", include: MARKERS_PY }
  },
  {
    id: "rust-analyzer",
    displayName: "rust-analyzer",
    command: ["rust-analyzer"],
    extensions: [".rs"],
    workspace: { type: "markers", include: MARKERS_RUST }
  }
];
function findServerForFile(filePath) {
  const lower = filePath.toLowerCase();
  return DEFAULT_SERVERS.find((server) => server.extensions.some((ext) => lower.endsWith(ext)));
}
function resolveWorkspaceRoot(filePath, locator, fallbackDir) {
  if (!locator) {
    return fallbackDir;
  }
  if (locator.type === "fixed") {
    return locator.path;
  }
  const include = locator.include ?? [];
  const exclude = locator.exclude ?? [];
  let current = fs3.statSync(filePath, { throwIfNoEntry: false })?.isDirectory() ? filePath : path3.dirname(filePath);
  const root = path3.parse(current).root;
  while (true) {
    if (exclude.some((pattern) => fs3.existsSync(path3.join(current, pattern)))) {
      break;
    }
    if (include.some((pattern) => fs3.existsSync(path3.join(current, pattern)))) {
      return current;
    }
    if (current === root) {
      break;
    }
    const parent = path3.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return fallbackDir;
}

// src/lsp/client.ts
var import_node_child_process = require("child_process");
var fs4 = __toESM(require("fs/promises"));
var path4 = __toESM(require("path"));
var import_node_url2 = require("url");
var import_node_events = require("events");
var import_vscode_jsonrpc = require("vscode-jsonrpc");
var import_main = require("vscode-jsonrpc/lib/node/main.js");
var import_vscode_languageserver_types = require("vscode-languageserver-types");
var DEFAULT_TIMEOUT_MS = 3e3;
var LspClient = class _LspClient {
  constructor(config, root) {
    this.config = config;
    this.root = root;
  }
  connection = null;
  process = null;
  diagnostics = /* @__PURE__ */ new Map();
  versions = /* @__PURE__ */ new Map();
  emitter = new import_node_events.EventEmitter();
  static async start(server, root) {
    const client = new _LspClient(server, root);
    await client.initialize();
    return client;
  }
  async initialize() {
    const [command, ...args] = this.config.command;
    if (!command) {
      throw new Error(`LSP server ${this.config.id} is missing a command executable`);
    }
    try {
      this.process = (0, import_node_child_process.spawn)(command, args, {
        cwd: this.root,
        env: { ...process.env, ...this.config.env },
        stdio: "pipe"
      });
    } catch (error) {
      throw new Error(`Failed to spawn ${this.config.displayName} (${command}): ${String(error)}`);
    }
    const child = this.process;
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.trim().length > 0) {
        console.debug(`[lsp:${this.config.id}] ${text.trim()}`);
      }
    });
    const reader = new import_main.StreamMessageReader(child.stdout);
    const writer = new import_main.StreamMessageWriter(child.stdin);
    this.connection = (0, import_vscode_jsonrpc.createMessageConnection)(reader, writer);
    this.connection.onNotification("textDocument/publishDiagnostics", (payload) => {
      const fsPath = (0, import_node_url2.fileURLToPath)(payload.uri);
      this.diagnostics.set(fsPath, payload.diagnostics);
      this.emitter.emit(`diagnostics:${fsPath}`);
    });
    this.connection.onError((err) => {
      console.warn(`[lsp:${this.config.id}] connection error`, err);
    });
    this.connection.listen();
    await this.connection.sendRequest("initialize", {
      rootUri: (0, import_node_url2.pathToFileURL)(this.root).href,
      processId: process.pid,
      initializationOptions: this.config.initializationOptions ?? {},
      capabilities: {
        textDocument: {
          synchronization: {
            didOpen: true,
            didChange: true
          },
          publishDiagnostics: {
            versionSupport: true
          }
        },
        workspace: {
          workspaceFolders: true
        }
      },
      workspaceFolders: [
        {
          name: path4.basename(this.root),
          uri: (0, import_node_url2.pathToFileURL)(this.root).href
        }
      ]
    });
    await this.connection.sendNotification("initialized", {});
  }
  async openFile(filePath, waitForDiagnostics) {
    if (!this.connection) return;
    const absolute = path4.resolve(filePath);
    const text = await fs4.readFile(absolute, "utf8");
    const uri = (0, import_node_url2.pathToFileURL)(absolute).href;
    const languageId = detectLanguageId(absolute);
    const existingVersion = this.versions.get(absolute);
    if (existingVersion === void 0) {
      this.versions.set(absolute, 0);
      await this.connection.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri,
          languageId,
          version: 0,
          text
        }
      });
    } else {
      const next = existingVersion + 1;
      this.versions.set(absolute, next);
      await this.connection.sendNotification("textDocument/didChange", {
        textDocument: {
          uri,
          version: next
        },
        contentChanges: [{ text }]
      });
    }
    if (waitForDiagnostics) {
      await this.waitForDiagnostics(absolute);
    }
  }
  getDiagnostics(filePath) {
    const absolute = path4.resolve(filePath);
    return this.diagnostics.get(absolute) ?? [];
  }
  waitForDiagnostics(filePath, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const absolute = path4.resolve(filePath);
    return new Promise((resolve5) => {
      const timer = setTimeout(resolve5, timeoutMs).unref();
      this.emitter.once(`diagnostics:${absolute}`, () => {
        clearTimeout(timer);
        resolve5();
      });
    });
  }
  async shutdown() {
    try {
      await this.connection?.dispose();
    } catch {
    }
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
  }
};
function detectLanguageId(filePath) {
  const ext = path4.extname(filePath).toLowerCase();
  switch (ext) {
    case ".ts":
    case ".mts":
    case ".cts":
      return "typescript";
    case ".tsx":
      return "typescriptreact";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".jsx":
      return "javascriptreact";
    case ".py":
    case ".pyi":
      return "python";
    case ".rs":
      return "rust";
    default:
      return "plaintext";
  }
}
function normalizeSeverity(severity) {
  switch (severity) {
    case import_vscode_languageserver_types.DiagnosticSeverity.Error:
      return "error";
    case import_vscode_languageserver_types.DiagnosticSeverity.Warning:
      return "warning";
    case import_vscode_languageserver_types.DiagnosticSeverity.Information:
      return "info";
    case import_vscode_languageserver_types.DiagnosticSeverity.Hint:
      return "hint";
    default:
      return "error";
  }
}

// src/lsp/manager.ts
var LspManager = class {
  constructor(options) {
    this.options = options;
  }
  clients = /* @__PURE__ */ new Map();
  async collectDiagnostics(files) {
    const unique = Array.from(new Set(files.map((file) => path5.resolve(file))));
    const results = [];
    for (const filePath of unique) {
      const server = findServerForFile(filePath);
      if (!server) {
        continue;
      }
      const root = resolveWorkspaceRoot(filePath, server.workspace, this.options.workingDirectory);
      const client = await this.getClient(server, root);
      if (!client) {
        continue;
      }
      try {
        await client.openFile(filePath, this.options.waitForDiagnostics !== false);
      } catch (error) {
        console.warn(`[lsp] failed to open ${filePath}:`, error);
        continue;
      }
      const normalized = client.getDiagnostics(filePath).map((diag) => normalizeDiagnostic(diag)).filter((diag) => diag.message.trim().length > 0);
      if (normalized.length > 0) {
        results.push({ path: filePath, diagnostics: normalized });
      }
    }
    return results;
  }
  async dispose() {
    await Promise.all(
      Array.from(this.clients.values()).map(async (promise) => {
        const client = await promise;
        await client?.shutdown();
      })
    );
    this.clients.clear();
  }
  async getClient(server, root) {
    const key = `${server.id}:${root}`;
    let existing = this.clients.get(key);
    if (!existing) {
      existing = this.createClient(server, root);
      this.clients.set(key, existing);
    }
    const client = await existing;
    if (!client) {
      this.clients.delete(key);
    }
    return client;
  }
  async createClient(server, root) {
    try {
      return await LspClient.start(server, root);
    } catch (error) {
      console.warn(`[lsp] unable to start ${server.displayName}:`, error);
      return null;
    }
  }
};
function normalizeDiagnostic(diag) {
  return {
    message: diag.message ?? "",
    severity: normalizeSeverity(diag.severity),
    source: diag.source,
    code: diag.code,
    range: diag.range
  };
}

// src/lsp/format.ts
var path6 = __toESM(require("path"));
var MAX_DIAGNOSTICS_PER_FILE = 5;
function formatDiagnosticsForTool(diagnostics) {
  return diagnostics.map(({ path: filePath, diagnostics: entries }) => {
    const rel = filePath;
    const lines = entries.slice(0, MAX_DIAGNOSTICS_PER_FILE).map((diag) => {
      const { line, character } = diag.range.start;
      const location = `${line + 1}:${character + 1}`;
      const source = diag.source ? ` \xB7 ${diag.source}` : "";
      return `  - [${diag.severity.toUpperCase()}] ${diag.message} (${location}${source})`;
    });
    const trimmed = entries.length > MAX_DIAGNOSTICS_PER_FILE ? "  - \u2026" : "";
    return [`\u2022 ${rel}`, ...lines, trimmed].filter(Boolean).join("\n");
  }).join("\n");
}
function formatDiagnosticsForBackgroundEvent(diagnostics, cwd) {
  return diagnostics.map(({ path: filePath, diagnostics: entries }) => {
    const rel = path6.relative(cwd, filePath) || filePath;
    const lines = entries.slice(0, MAX_DIAGNOSTICS_PER_FILE).map((diag) => {
      const { line, character } = diag.range.start;
      const location = `${line + 1}:${character + 1}`;
      const source = diag.source ? ` \xB7 ${diag.source}` : "";
      return `  - [${diag.severity.toUpperCase()}] ${diag.message} (${location}${source})`;
    });
    const trimmed = entries.length > MAX_DIAGNOSTICS_PER_FILE ? "  - \u2026" : "";
    return [`\u2022 ${rel}`, ...lines, trimmed].filter(Boolean).join("\n");
  }).join("\n");
}

// src/lsp/bridge.ts
var LspDiagnosticsBridge = class {
  constructor(options) {
    this.options = options;
    this.manager = new LspManager(options);
  }
  manager;
  attached = /* @__PURE__ */ new WeakSet();
  attach(thread) {
    if (this.attached.has(thread)) {
      return () => {
      };
    }
    this.attached.add(thread);
    const unsubscribe = thread.onEvent((event) => {
      if (event.type !== "item.completed") {
        return;
      }
      if (event.item.type === "file_change") {
        const targets = event.item.changes.filter((change) => change.kind !== "delete").map((change) => path7.resolve(this.options.workingDirectory, change.path));
        if (targets.length === 0) {
          return;
        }
        void this.processDiagnostics(thread, targets);
        return;
      }
      if (event.item.type === "mcp_tool_call") {
        const targets = extractReadFileTargets(event.item, this.options.workingDirectory);
        if (targets.length === 0) {
          return;
        }
        void this.processDiagnostics(thread, targets);
      }
    });
    return () => {
      this.attached.delete(thread);
      unsubscribe();
    };
  }
  async dispose() {
    await this.manager.dispose();
  }
  async processDiagnostics(thread, files) {
    try {
      const diagnostics = await this.manager.collectDiagnostics(files);
      if (diagnostics.length === 0) {
        return;
      }
      const summary = formatDiagnosticsForBackgroundEvent(
        diagnostics,
        this.options.workingDirectory
      );
      console.log(`
\u{1F4DF} LSP diagnostics detected:
${summary}
`);
      try {
        await thread.sendBackgroundEvent(`LSP diagnostics detected:
${summary}`);
      } catch {
      }
    } catch (error) {
      console.warn("[lsp] failed to collect diagnostics", error);
    }
  }
};
function extractReadFileTargets(item, cwd) {
  if (item.type !== "mcp_tool_call") {
    return [];
  }
  const toolName = item.tool?.toLowerCase?.();
  if (toolName !== "read_file" && toolName !== "read_file_v2") {
    return [];
  }
  let args = item.arguments;
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch {
      return [];
    }
  }
  if (!args || typeof args !== "object") {
    return [];
  }
  const filePath = args.file_path ?? args.path;
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    return [];
  }
  const resolved = path7.isAbsolute(filePath) ? filePath : path7.resolve(cwd, filePath);
  return [resolved];
}

// src/lsp/hooks.ts
function attachLspDiagnostics(thread, options) {
  const bridge = new LspDiagnosticsBridge(options);
  const detach = bridge.attach(thread);
  return () => {
    detach();
    void bridge.dispose().catch((error) => {
      console.warn("Failed to dispose LSP bridge", error);
    });
  };
}

// src/thread.ts
var UNTRUSTED_DIRECTORY_ERROR = "Not inside a trusted directory and --skip-git-repo-check was not specified.";
function findGitRoot(startDir) {
  let current = path8.resolve(startDir);
  while (true) {
    const gitPath = path8.join(current, ".git");
    if (fs5.existsSync(gitPath)) {
      try {
        const stats = fs5.statSync(gitPath);
        if (stats.isDirectory() || stats.isFile()) {
          return current;
        }
      } catch {
      }
    }
    const parent = path8.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}
function assertTrustedDirectory(workingDirectory) {
  const directory = workingDirectory ? path8.resolve(workingDirectory) : process.cwd();
  if (!findGitRoot(directory)) {
    throw new Error(UNTRUSTED_DIRECTORY_ERROR);
  }
}
var Thread = class _Thread {
  _exec;
  _options;
  _id;
  _threadOptions;
  _eventListeners = [];
  _approvalHandler = null;
  /** Returns the ID of the thread. Populated after the first turn starts. */
  get id() {
    return this._id;
  }
  /**
   * Register an event listener for thread events.
   * @param listener Callback function that receives ThreadEvent objects
   * @returns Unsubscribe function to remove the listener
   */
  onEvent(listener) {
    this._eventListeners.push(listener);
    return () => {
      const index = this._eventListeners.indexOf(listener);
      if (index !== -1) {
        this._eventListeners.splice(index, 1);
      }
    };
  }
  /**
   * Remove an event listener.
   * @param listener The listener function to remove
   */
  offEvent(listener) {
    const index = this._eventListeners.indexOf(listener);
    if (index !== -1) {
      this._eventListeners.splice(index, 1);
    }
  }
  /**
   * Register a callback to handle approval requests from the agent.
   * The handler should return true to approve the action, false to deny it.
   *
   * @param handler Callback function that receives ApprovalRequest and returns approval decision
   * @example
   * ```typescript
   * thread.onApprovalRequest(async (request) => {
   *   console.log(`Approval requested for ${request.type}`);
   *   return true; // Auto-approve
   * });
   * ```
   */
  onApprovalRequest(handler) {
    this._approvalHandler = handler;
    const binding = getNativeBinding();
    if (binding && typeof binding.registerApprovalCallback === "function") {
      binding.registerApprovalCallback(handler);
    }
  }
  /**
   * Emit a background notification while the agent is running the current turn.
   * The message is surfaced to event subscribers but does not modify the user input queue.
   *
   * @throws Error if the thread has not been started yet.
   */
  async sendBackgroundEvent(message) {
    const trimmed = message?.toString();
    if (!trimmed || trimmed.trim().length === 0) {
      throw new Error("Background event message must be a non-empty string");
    }
    if (!this._id) {
      throw new Error("Cannot emit a background event before the thread has started");
    }
    const binding = getNativeBinding();
    if (!binding || typeof binding.emitBackgroundEvent !== "function") {
      throw new Error("emitBackgroundEvent is not available in this build");
    }
    await binding.emitBackgroundEvent({ threadId: this._id, message: trimmed });
  }
  /**
   * Programmatically update the agent's plan/todo list.
   * The plan will be applied at the start of the next turn.
   *
   * @param args The plan update arguments
   * @throws Error if no thread ID is available
   */
  updatePlan(args) {
    if (!this._id) {
      throw new Error("Cannot update plan: no active thread");
    }
    const binding = getNativeBinding();
    if (!binding || typeof binding.emitPlanUpdate !== "function") {
      throw new Error("emitPlanUpdate is not available in this build");
    }
    binding.emitPlanUpdate({
      threadId: this._id,
      explanation: args.explanation,
      plan: args.plan
    });
  }
  /**
   * Modify the agent's plan/todo list with granular operations.
   * Changes will be applied at the start of the next turn.
   *
   * @param operations Array of operations to perform on the plan
   * @throws Error if no thread ID is available
   */
  modifyPlan(operations) {
    if (!this._id) {
      throw new Error("Cannot modify plan: no active thread");
    }
    const binding = getNativeBinding();
    if (!binding || typeof binding.modifyPlan !== "function") {
      throw new Error("modifyPlan is not available in this build");
    }
    binding.modifyPlan({
      threadId: this._id,
      operations
    });
  }
  /**
   * Add a new todo item to the agent's plan.
   *
   * @param step The todo step description
   * @param status The initial status (defaults to "pending")
   */
  addTodo(step, status = "pending") {
    this.modifyPlan([{ type: "add", item: { step, status } }]);
  }
  /**
   * Update an existing todo item.
   *
   * @param index The index of the todo item to update
   * @param updates The updates to apply
   */
  updateTodo(index, updates) {
    this.modifyPlan([{ type: "update", index, updates }]);
  }
  /**
   * Remove a todo item from the plan.
   *
   * @param index The index of the todo item to remove
   */
  removeTodo(index) {
    this.modifyPlan([{ type: "remove", index }]);
  }
  /**
   * Reorder the todo items in the plan.
   *
   * @param newOrder Array of indices representing the new order
   */
  reorderTodos(newOrder) {
    this.modifyPlan([{ type: "reorder", newOrder }]);
  }
  /** Compacts the conversation history for this thread using Codex's builtin compaction. */
  async compact() {
    const skipGitRepoCheck = this._threadOptions?.skipGitRepoCheck ?? (typeof process !== "undefined" && process.env && process.env.CODEX_TEST_SKIP_GIT_REPO_CHECK === "1");
    if (!skipGitRepoCheck) {
      assertTrustedDirectory(this._threadOptions?.workingDirectory);
    }
    const events = await this._exec.compact({
      input: "compact",
      threadId: this._id,
      baseUrl: this._options.baseUrl,
      apiKey: this._options.apiKey,
      model: this._threadOptions?.model ?? this._options.defaultModel,
      sandboxMode: this._threadOptions?.sandboxMode,
      approvalMode: this._threadOptions?.approvalMode,
      workspaceWriteOptions: this._threadOptions?.workspaceWriteOptions,
      workingDirectory: this._threadOptions?.workingDirectory,
      skipGitRepoCheck,
      modelProvider: this._options.modelProvider
    });
    if (!Array.isArray(events)) {
      throw new Error("Compact did not return event list");
    }
  }
  /**
   * Fork this thread at the specified user message, returning a new thread that starts
   * from the conversation history prior to that message.
   *
   * @param options Fork configuration including which user message to branch before and optional thread overrides.
   */
  async fork(options) {
    if (!this._id) {
      throw new Error("Cannot fork: no active thread");
    }
    const nthUserMessage = options?.nthUserMessage;
    if (typeof nthUserMessage !== "number" || !Number.isInteger(nthUserMessage) || nthUserMessage < 0) {
      throw new Error("nthUserMessage must be a non-negative integer");
    }
    const overrides = options.threadOptions ?? {};
    const nextThreadOptions = {
      ...this._threadOptions,
      ...overrides
    };
    const skipGitRepoCheck = nextThreadOptions.skipGitRepoCheck ?? (typeof process !== "undefined" && process.env && process.env.CODEX_TEST_SKIP_GIT_REPO_CHECK === "1");
    nextThreadOptions.skipGitRepoCheck = skipGitRepoCheck;
    if (!skipGitRepoCheck) {
      assertTrustedDirectory(nextThreadOptions.workingDirectory);
    }
    const forkArgs = {
      threadId: this._id,
      nthUserMessage,
      baseUrl: this._options.baseUrl,
      apiKey: this._options.apiKey,
      model: nextThreadOptions.model ?? this._options.defaultModel,
      oss: nextThreadOptions.oss,
      sandboxMode: nextThreadOptions.sandboxMode,
      approvalMode: nextThreadOptions.approvalMode,
      workspaceWriteOptions: nextThreadOptions.workspaceWriteOptions,
      workingDirectory: nextThreadOptions.workingDirectory,
      skipGitRepoCheck,
      fullAuto: nextThreadOptions.fullAuto,
      modelProvider: this._options.modelProvider
    };
    const result = await this._exec.fork(forkArgs);
    return new _Thread(
      this._exec,
      this._options,
      nextThreadOptions,
      result.threadId
    );
  }
  /* @internal */
  constructor(exec, options, threadOptions, id = null) {
    this._exec = exec;
    this._options = options;
    this._id = id;
    this._threadOptions = threadOptions;
  }
  /** Provides the input to the agent and streams events as they are produced during the turn. */
  async runStreamed(input, turnOptions = {}) {
    return { events: this.runStreamedInternal(input, turnOptions, false) };
  }
  async *runStreamedInternal(input, turnOptions = {}, emitRawEvents = true) {
    const normalizedSchema = normalizeOutputSchema(turnOptions.outputSchema);
    const needsSchemaFile = this._exec.requiresOutputSchemaFile();
    const schemaFile = needsSchemaFile ? await createOutputSchemaFile(normalizedSchema) : { schemaPath: void 0, cleanup: async () => {
    } };
    const options = this._threadOptions;
    const { prompt, images } = normalizeInput(input);
    const skipGitRepoCheck = options?.skipGitRepoCheck ?? (typeof process !== "undefined" && process.env && process.env.CODEX_TEST_SKIP_GIT_REPO_CHECK === "1");
    if (!skipGitRepoCheck) {
      assertTrustedDirectory(options?.workingDirectory);
    }
    const generator = this._exec.run({
      input: prompt,
      baseUrl: this._options.baseUrl,
      apiKey: this._options.apiKey,
      threadId: this._id,
      images,
      model: options?.model,
      oss: turnOptions?.oss ?? options?.oss,
      sandboxMode: options?.sandboxMode,
      approvalMode: options?.approvalMode,
      workspaceWriteOptions: options?.workspaceWriteOptions,
      workingDirectory: options?.workingDirectory,
      skipGitRepoCheck,
      outputSchemaFile: schemaFile.schemaPath,
      outputSchema: normalizedSchema,
      fullAuto: options?.fullAuto
    });
    try {
      for await (const item of generator) {
        let parsed;
        try {
          parsed = JSON.parse(item);
        } catch (error) {
          throw new Error(`Failed to parse item: ${item}. Parse error: ${error}`);
        }
        if (parsed === null) {
          continue;
        }
        if (emitRawEvents) {
          yield { type: "raw_event", raw: parsed };
        }
        const threadEvent = convertRustEventToThreadEvent(parsed);
        if (threadEvent.type === "thread.started") {
          this._id = threadEvent.thread_id;
        }
        for (const listener of this._eventListeners) {
          try {
            listener(threadEvent);
          } catch (error) {
            console.warn("Thread event listener threw error:", error);
          }
        }
        yield threadEvent;
      }
    } finally {
      await schemaFile.cleanup();
    }
  }
  /** Provides the input to the agent and returns the completed turn. */
  async run(input, turnOptions = {}) {
    const generator = this.runStreamedInternal(input, turnOptions, true);
    const items = [];
    let finalResponse = "";
    let usage = null;
    let turnFailure = null;
    for await (const event of generator) {
      if (event.type === "item.completed") {
        if (event.item.type === "agent_message") {
          finalResponse = event.item.text;
        }
        items.push(event.item);
      } else if (event.type === "turn.completed") {
        usage = event.usage;
      } else if (event.type === "turn.failed") {
        turnFailure = event.error;
        break;
      }
    }
    if (turnFailure) {
      throw new Error(turnFailure.message);
    }
    return { items, finalResponse, usage };
  }
  buildTuiRequest(overrides = {}) {
    const skipGitRepoCheck = this._threadOptions?.skipGitRepoCheck ?? (typeof process !== "undefined" && process.env && process.env.CODEX_TEST_SKIP_GIT_REPO_CHECK === "1");
    if (!skipGitRepoCheck) {
      assertTrustedDirectory(this._threadOptions?.workingDirectory);
    }
    const request = { ...overrides };
    const assignIfUndefined = (key, value) => {
      if (request[key] === void 0 && value !== void 0) {
        request[key] = value;
      }
    };
    assignIfUndefined("model", this._threadOptions?.model ?? this._options.defaultModel);
    assignIfUndefined("oss", this._threadOptions?.oss);
    assignIfUndefined("sandboxMode", this._threadOptions?.sandboxMode);
    assignIfUndefined("approvalMode", this._threadOptions?.approvalMode);
    assignIfUndefined("fullAuto", this._threadOptions?.fullAuto);
    assignIfUndefined("workingDirectory", this._threadOptions?.workingDirectory);
    assignIfUndefined("baseUrl", this._options.baseUrl);
    assignIfUndefined("apiKey", this._options.apiKey);
    if (request.resumeSessionId === void 0 && request.resumePicker !== true && request.resumeLast !== true && this._id) {
      request.resumeSessionId = this._id;
    }
    return request;
  }
  /**
   * Launches the interactive Codex TUI (Terminal User Interface) for this thread and returns a session handle.
   *
   * The handle allows advanced workflows where the TUI can be started and stopped programmatically,
   * while preserving the underlying conversation state.
   */
  launchTui(overrides = {}) {
    const request = this.buildTuiRequest(overrides);
    const detachLsp = this.attachDefaultLspBridge(request);
    const session = startTui(request);
    return this.wrapTuiSession(session, detachLsp);
  }
  /**
   * Launches the interactive Codex TUI (Terminal User Interface) for this thread.
   *
   * This method enables seamless transition from programmatic agent interaction to
   * interactive terminal chat within the same session. The TUI takes over the terminal
   * and allows you to continue the conversation interactively.
   *
   * @param overrides - Optional configuration to override thread defaults. Supports all TUI options
   *                    including prompt, sandbox mode, approval mode, and resume options.
   * @param options - Optional run options including an AbortSignal to request shutdown.
   * @returns A Promise that resolves to TUI exit information including:
   *          - tokenUsage: Token consumption statistics
   *          - conversationId: Session ID for resuming later
   *          - updateAction: Optional suggested update command
   * @throws {Error} If not in a trusted git repository (unless skipGitRepoCheck is set)
   * @throws {Error} If the terminal is not interactive (TTY required)
   */
  async tui(overrides = {}, options = {}) {
    const request = this.buildTuiRequest(overrides);
    const detachLsp = this.attachDefaultLspBridge(request);
    try {
      return await runTui(request, options);
    } finally {
      detachLsp();
    }
  }
  wrapTuiSession(session, cleanup) {
    let released = false;
    const release = () => {
      if (released) {
        return;
      }
      released = true;
      cleanup();
    };
    return {
      wait: async () => {
        try {
          return await session.wait();
        } finally {
          release();
        }
      },
      shutdown: () => {
        release();
        session.shutdown();
      },
      get closed() {
        return session.closed;
      }
    };
  }
  attachDefaultLspBridge(request) {
    const workingDirectory = request.workingDirectory ?? this._threadOptions?.workingDirectory ?? (typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ".");
    return attachLspDiagnostics(this, {
      workingDirectory,
      waitForDiagnostics: true
    });
  }
};
function normalizeInput(input) {
  if (typeof input === "string") {
    return { prompt: input, images: [] };
  }
  const promptParts = [];
  const images = [];
  for (const item of input) {
    if (item.type === "text") {
      promptParts.push(item.text);
    } else if (item.type === "local_image") {
      images.push(item.path);
    }
  }
  return { prompt: promptParts.join("\n\n"), images };
}

// src/exec.ts
var CodexExec = class {
  native;
  constructor() {
    const nativeBinding = getNativeBinding();
    if (!nativeBinding) {
      throw new Error(
        "Native NAPI binding not available. Make sure @openai/codex-native is properly installed and built."
      );
    }
    this.native = nativeBinding;
  }
  requiresOutputSchemaFile() {
    return false;
  }
  async *run(args) {
    const binding = this.native;
    const queue = new AsyncQueue();
    validateModel(args.model, args.oss === true);
    const request = {
      prompt: args.input,
      threadId: args.threadId ?? void 0,
      images: args.images && args.images.length > 0 ? args.images : void 0,
      model: args.model,
      oss: args.oss,
      approvalMode: args.approvalMode,
      workspaceWriteOptions: args.workspaceWriteOptions,
      sandboxMode: args.sandboxMode,
      workingDirectory: args.workingDirectory,
      skipGitRepoCheck: args.skipGitRepoCheck,
      outputSchema: args.outputSchema,
      baseUrl: args.baseUrl,
      apiKey: args.apiKey,
      modelProvider: args.modelProvider,
      fullAuto: args.fullAuto,
      reviewMode: args.review ? true : void 0,
      reviewHint: args.review?.userFacingHint
    };
    let runPromise = Promise.resolve();
    try {
      runPromise = binding.runThreadStream(request, (err, eventJson) => {
        if (err) {
          queue.fail(err);
          return;
        }
        try {
          queue.push(eventJson ?? "null");
        } catch (error) {
          queue.fail(error);
        }
      }).then(
        () => {
          queue.end();
        },
        (error) => {
          queue.fail(error);
        }
      );
    } catch (error) {
      queue.fail(error);
      throw error;
    }
    let loopError;
    try {
      for await (const value of queue) {
        yield value;
      }
      await runPromise;
    } catch (error) {
      loopError = error;
      throw error;
    } finally {
      queue.end();
      if (loopError) {
        await runPromise.catch(() => {
        });
      }
    }
  }
  async compact(args) {
    validateModel(args.model, args.oss === true);
    const request = {
      prompt: args.input,
      threadId: args.threadId ?? void 0,
      images: args.images && args.images.length > 0 ? args.images : void 0,
      model: args.model,
      modelProvider: args.modelProvider,
      oss: args.oss,
      sandboxMode: args.sandboxMode,
      approvalMode: args.approvalMode,
      workspaceWriteOptions: args.workspaceWriteOptions,
      workingDirectory: args.workingDirectory,
      skipGitRepoCheck: args.skipGitRepoCheck,
      outputSchema: args.outputSchema,
      baseUrl: args.baseUrl,
      apiKey: args.apiKey,
      fullAuto: args.fullAuto,
      reviewMode: args.review ? true : void 0,
      reviewHint: args.review?.userFacingHint
    };
    return this.native.compactThread(request);
  }
  async fork(args) {
    if (!args.threadId) {
      throw new Error("threadId is required to fork a conversation");
    }
    const request = {
      threadId: args.threadId,
      nthUserMessage: args.nthUserMessage,
      model: args.model,
      oss: args.oss,
      sandboxMode: args.sandboxMode,
      approvalMode: args.approvalMode,
      workspaceWriteOptions: args.workspaceWriteOptions,
      workingDirectory: args.workingDirectory,
      skipGitRepoCheck: args.skipGitRepoCheck,
      baseUrl: args.baseUrl,
      apiKey: args.apiKey,
      modelProvider: args.modelProvider,
      linuxSandboxPath: args.linuxSandboxPath,
      fullAuto: args.fullAuto
    };
    return this.native.forkThread(request);
  }
  async listConversations(request) {
    return this.native.listConversations(request);
  }
  async deleteConversation(request) {
    return this.native.deleteConversation(request);
  }
  async resumeConversationFromRollout(request) {
    return this.native.resumeConversationFromRollout(request);
  }
};
var AsyncQueue = class {
  buffer = [];
  waiters = [];
  ended = false;
  error;
  push(value) {
    if (this.ended) return;
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter.resolve({ value, done: false });
      return;
    }
    this.buffer.push(value);
  }
  end() {
    if (this.ended) return;
    this.ended = true;
    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) {
      waiter.resolve({ value: void 0, done: true });
    }
  }
  fail(error) {
    if (this.ended) return;
    this.error = error;
    this.ended = true;
    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) {
      waiter.reject(error);
    }
  }
  async next() {
    if (this.buffer.length > 0) {
      const value = this.buffer.shift();
      return { value, done: false };
    }
    if (this.error) {
      return Promise.reject(this.error);
    }
    if (this.ended) {
      return { value: void 0, done: true };
    }
    return new Promise((resolve5, reject) => {
      this.waiters.push({ resolve: resolve5, reject });
    });
  }
  [Symbol.asyncIterator]() {
    return this;
  }
};
function validateModel(model, oss) {
  if (!model) return;
  const trimmed = String(model).trim();
  if (oss) {
    if (!trimmed.startsWith("gpt-oss:")) {
      throw new Error(
        `Invalid model "${trimmed}" for OSS mode. Use models prefixed with "gpt-oss:", e.g. "gpt-oss:20b".`
      );
    }
    return;
  }
  const allowed = /* @__PURE__ */ new Set([
    // GPT models
    "gpt-5",
    "gpt-5-codex",
    "gpt-5-codex-mini",
    "gpt-5.1",
    "gpt-5.1-codex",
    "gpt-5.1-codex-mini",
    // Claude models
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514"
  ]);
  if (!allowed.has(trimmed) && !trimmed.startsWith("claude-") && !trimmed.startsWith("gpt-")) {
    throw new Error(
      `Invalid model "${trimmed}". Supported models: ${Array.from(allowed).map((m) => `"${m}"`).join(", ")}, or any model starting with "claude-" or "gpt-".`
    );
  }
}

// src/reviewOptions.ts
function buildReviewPrompt(target) {
  switch (target.type) {
    case "current_changes":
      return {
        prompt: "Review the current code changes (staged, unstaged, and untracked files) and provide prioritized findings.",
        hint: "current changes"
      };
    case "branch": {
      const branch = target.baseBranch;
      const prompt = `Review the code changes against the base branch '${branch}'. Start by finding the merge diff between the current branch and ${branch}'s upstream e.g. (\`git merge-base HEAD "$(git rev-parse --abbrev-ref "${branch}@{upstream}")"\`), then run \`git diff\` against that SHA to see what changes we would merge into the ${branch} branch. Provide prioritized, actionable findings.`;
      return {
        prompt,
        hint: `changes against '${branch}'`
      };
    }
    case "commit": {
      const shortSha = target.sha.slice(0, 7);
      const subject = target.subject ?? target.sha;
      return {
        prompt: `Review the code changes introduced by commit ${target.sha} ("${subject}"). Provide prioritized, actionable findings.`,
        hint: `commit ${shortSha}`
      };
    }
    case "custom": {
      const hint = target.hint ?? "custom review";
      return {
        prompt: target.prompt,
        hint
      };
    }
    default: {
      const exhaustive = target;
      throw new Error(`Unsupported review target: ${String(exhaustive)}`);
    }
  }
}

// src/codex.ts
var Codex = class {
  exec;
  options;
  nativeBinding;
  lspForTools;
  constructor(options = {}) {
    const predefinedTools = options.tools ? [...options.tools] : [];
    this.nativeBinding = getNativeBinding();
    this.options = { ...options, tools: [] };
    if (this.nativeBinding) {
      if (typeof this.nativeBinding.clearRegisteredTools === "function") {
        this.nativeBinding.clearRegisteredTools();
      }
      for (const tool2 of predefinedTools) {
        this.registerTool(tool2);
      }
    }
    this.lspForTools = this.createLspManagerForTools();
    if (this.lspForTools && this.nativeBinding) {
      this.registerDefaultReadFileInterceptor();
    }
    this.exec = new CodexExec();
  }
  /**
   * Register a tool for Codex. When `tool.name` matches a built-in Codex tool,
   * the native implementation is replaced for this Codex instance.
   */
  registerTool(tool2) {
    if (!this.nativeBinding) {
      throw new Error("Native tool registration requires the NAPI binding");
    }
    if (typeof this.nativeBinding.registerTool !== "function") {
      console.warn("registerTool is not available in this build - tools feature may be incomplete");
      return;
    }
    const { handler, ...info } = tool2;
    this.nativeBinding.registerTool(info, handler);
    if (!this.options.tools) {
      this.options.tools = [];
    }
    this.options.tools.push(tool2);
  }
  /**
   * Register a tool interceptor for Codex. Interceptors can modify tool invocations
   * and results, and can call the built-in implementation.
   */
  registerToolInterceptor(toolName, handler) {
    if (!this.nativeBinding) {
      throw new Error("Native tool interceptor registration requires the NAPI binding");
    }
    if (typeof this.nativeBinding.registerToolInterceptor !== "function" || typeof this.nativeBinding.callToolBuiltin !== "function") {
      console.warn("registerToolInterceptor is not available in this build - interceptor feature may be incomplete");
      return;
    }
    this.nativeBinding.registerToolInterceptor(toolName, async (...args) => {
      const context = args.length === 1 ? args[0] : args[1];
      if (!context || typeof context !== "object") {
        throw new Error("Native interceptor callback did not receive a context object");
      }
      const { invocation, token } = context;
      const callBuiltin = (override) => this.nativeBinding.callToolBuiltin(token, override ?? invocation);
      return handler({ invocation, callBuiltin });
    });
  }
  /**
   * Clear all registered tools, restoring built-in defaults.
   */
  clearTools() {
    if (!this.nativeBinding) {
      throw new Error("Native tool management requires the NAPI binding");
    }
    if (typeof this.nativeBinding.clearRegisteredTools === "function") {
      this.nativeBinding.clearRegisteredTools();
    }
    if (this.options.tools) {
      this.options.tools = [];
    }
  }
  buildConversationConfig(options = {}) {
    return {
      model: options.model ?? this.options.defaultModel,
      modelProvider: options.modelProvider ?? this.options.modelProvider,
      oss: options.oss,
      sandboxMode: options.sandboxMode,
      approvalMode: options.approvalMode,
      workspaceWriteOptions: options.workspaceWriteOptions,
      workingDirectory: options.workingDirectory,
      skipGitRepoCheck: options.skipGitRepoCheck,
      reasoningEffort: options.reasoningEffort,
      reasoningSummary: options.reasoningSummary,
      fullAuto: options.fullAuto,
      baseUrl: this.options.baseUrl,
      apiKey: this.options.apiKey
    };
  }
  createLspManagerForTools() {
    const cwd = typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ".";
    const options = {
      workingDirectory: cwd,
      waitForDiagnostics: true
    };
    try {
      return new LspManager(options);
    } catch {
      return null;
    }
  }
  registerDefaultReadFileInterceptor() {
    if (!this.lspForTools) {
      return;
    }
    try {
      this.registerToolInterceptor("read_file", async ({ invocation, callBuiltin }) => {
        const base = await callBuiltin();
        if (!base.output || base.success === false) {
          return base;
        }
        let filePath;
        if (invocation.arguments) {
          try {
            const args = JSON.parse(invocation.arguments);
            const candidate = typeof args.file_path === "string" && args.file_path || typeof args.path === "string" && args.path || void 0;
            if (candidate && candidate.trim().length > 0) {
              filePath = candidate;
            }
          } catch {
          }
        }
        if (!filePath) {
          return base;
        }
        let diagnosticsText = "";
        try {
          const results = await this.lspForTools.collectDiagnostics([filePath]);
          if (!results.length) {
            return base;
          }
          diagnosticsText = formatDiagnosticsForTool(results);
        } catch {
          return base;
        }
        if (!diagnosticsText) {
          return base;
        }
        const header = `LSP diagnostics for ${filePath}:
${diagnosticsText}`;
        return prependSystemHintToToolResult(base, header);
      });
    } catch {
    }
  }
  /**
   * Register a programmatic approval callback that Codex will call before executing
   * sensitive operations (e.g., shell commands, file writes).
   */
  setApprovalCallback(handler) {
    if (!this.nativeBinding || typeof this.nativeBinding.registerApprovalCallback !== "function") {
      console.warn("Approval callback is not available in this build");
      return;
    }
    this.nativeBinding.registerApprovalCallback(handler);
  }
  /**
   * Starts a new conversation with an agent.
   * @returns A new thread instance.
   */
  startThread(options = {}) {
    const threadOptions = {
      ...options,
      model: options.model ?? this.options.defaultModel
    };
    return new Thread(this.exec, this.options, threadOptions);
  }
  /**
   * Resumes a conversation with an agent based on the thread id.
   * Threads are persisted in ~/.codex/sessions.
   *
   * @param id The id of the thread to resume.
   * @returns A new thread instance.
   */
  resumeThread(id, options = {}) {
    const threadOptions = {
      ...options,
      model: options.model ?? this.options.defaultModel
    };
    return new Thread(this.exec, this.options, threadOptions, id);
  }
  async listConversations(options = {}) {
    const request = {
      config: this.buildConversationConfig(options),
      pageSize: options.pageSize,
      cursor: options.cursor,
      modelProviders: options.modelProviders
    };
    return this.exec.listConversations(request);
  }
  async deleteConversation(id, options = {}) {
    const result = await this.exec.deleteConversation({
      id,
      config: this.buildConversationConfig(options)
    });
    return result.deleted;
  }
  async resumeConversationFromRollout(rolloutPath, options = {}) {
    const result = await this.exec.resumeConversationFromRollout({
      rolloutPath,
      config: this.buildConversationConfig(options)
    });
    const threadOptions = {
      ...options,
      model: options.model ?? this.options.defaultModel
    };
    return new Thread(this.exec, this.options, threadOptions, result.threadId);
  }
  /**
   * Starts a review task using the built-in Codex review flow.
   */
  async review(options) {
    const generator = this.reviewStreamedInternal(options);
    const items = [];
    let finalResponse = "";
    let usage = null;
    let turnFailure = null;
    for await (const event of generator) {
      if (event === null) continue;
      if (event.type === "item.completed") {
        if (event.item.type === "agent_message") {
          finalResponse = event.item.text;
        }
        items.push(event.item);
      } else if (event.type === "exited_review_mode") {
        if (event.review_output) {
          const reviewOutput = event.review_output;
          let reviewText = "";
          if (reviewOutput.overall_explanation) {
            reviewText += reviewOutput.overall_explanation;
          }
          if (reviewOutput.findings && reviewOutput.findings.length > 0) {
            if (reviewText) reviewText += "\n\n";
            reviewText += "## Review Findings\n\n";
            reviewOutput.findings.forEach((finding, index) => {
              reviewText += `### ${index + 1}. ${finding.title}
`;
              reviewText += `${finding.body}
`;
              reviewText += `**Priority:** ${finding.priority} | **Confidence:** ${finding.confidence_score}
`;
              reviewText += `**Location:** ${finding.code_location.absolute_file_path}:${finding.code_location.line_range.start}-${finding.code_location.line_range.end}

`;
            });
          }
          finalResponse = reviewText;
        }
      } else if (event.type === "turn.completed") {
        usage = event.usage;
      } else if (event.type === "turn.failed") {
        turnFailure = event.error;
        break;
      }
    }
    if (turnFailure) {
      throw new Error(turnFailure.message);
    }
    return { items, finalResponse, usage };
  }
  /**
   * Starts a review task and returns the event stream.
   */
  async reviewStreamed(options) {
    return { events: this.reviewStreamedInternal(options) };
  }
  async *reviewStreamedInternal(options) {
    const { target, threadOptions = {}, turnOptions = {} } = options;
    const { prompt, hint } = buildReviewPrompt(target);
    const normalizedSchema = normalizeOutputSchema(turnOptions.outputSchema);
    const needsSchemaFile = this.exec.requiresOutputSchemaFile();
    const schemaFile = needsSchemaFile ? await createOutputSchemaFile(normalizedSchema) : { schemaPath: void 0, cleanup: async () => {
    } };
    const generator = this.exec.run({
      input: prompt,
      baseUrl: this.options.baseUrl,
      apiKey: this.options.apiKey,
      model: threadOptions.model,
      modelProvider: threadOptions.modelProvider ?? this.options.modelProvider,
      oss: threadOptions.oss,
      sandboxMode: threadOptions.sandboxMode,
      approvalMode: threadOptions.approvalMode,
      workspaceWriteOptions: threadOptions.workspaceWriteOptions,
      workingDirectory: threadOptions.workingDirectory,
      skipGitRepoCheck: threadOptions.skipGitRepoCheck,
      outputSchemaFile: schemaFile.schemaPath,
      outputSchema: normalizedSchema,
      fullAuto: threadOptions.fullAuto,
      review: {
        userFacingHint: hint
      }
    });
    try {
      for await (const item of generator) {
        let parsed;
        try {
          parsed = JSON.parse(item);
        } catch (error) {
          throw new Error(`Failed to parse item: ${item}`, { cause: error });
        }
        yield parsed;
      }
    } finally {
      await schemaFile.cleanup();
    }
  }
};
function prependSystemHintToToolResult(base, hint) {
  const trimmedHint = hint.trim();
  if (!trimmedHint) {
    return base;
  }
  const existing = base.output ?? "";
  const separator = existing.length === 0 || existing.startsWith("\n") ? "\n\n" : "\n\n";
  const output = existing.length === 0 ? `[SYSTEM_HINT]
${trimmedHint}` : `[SYSTEM_HINT]
${trimmedHint}${separator}${existing}`;
  return {
    ...base,
    output
  };
}

// src/agents/toolRegistry.ts
var executors = /* @__PURE__ */ new Map();
function registerCodexToolExecutor(name, executor) {
  executors.set(name, executor);
}
function getCodexToolExecutor(name) {
  return executors.get(name);
}

// src/agents/CodexProvider.ts
var fs6 = __toESM(require("fs"));
var path9 = __toESM(require("path"));
var os2 = __toESM(require("os"));

// src/agents/types.ts
var import_agents_core = require("@openai/agents-core");

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
        await fs6.promises.unlink(filepath);
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
      } else if (fs6.existsSync(imageValue)) {
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
    const tempDir = os2.tmpdir();
    const filename = `codex-image-${Date.now()}.${extension}`;
    const filepath = path9.join(tempDir, filename);
    await fs6.promises.writeFile(filepath, buffer);
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
    const tempDir = os2.tmpdir();
    const filename = `codex-image-${Date.now()}.${extension}`;
    const filepath = path9.join(tempDir, filename);
    await fs6.promises.writeFile(filepath, Buffer.from(buffer));
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
      return new import_agents_core.Usage();
    }
    const converted = new import_agents_core.Usage({
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
var import_agents = require("@openai/agents");
function codexTool(options) {
  const { codexExecute, ...delegate } = options;
  const agentTool = (0, import_agents.tool)(delegate);
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
var import_node_net = __toESM(require("net"));
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
  return new Promise((resolve5) => {
    const tester = import_node_net.default.createServer().once("error", () => resolve5(false)).once("listening", () => tester.close(() => resolve5(true))).listen(port, host);
  });
}
async function findAvailablePort(host, preferred) {
  if (preferred !== void 0 && await isPortAvailable(preferred, host)) {
    return preferred;
  }
  return new Promise((resolve5, reject) => {
    const server = import_node_net.default.createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to determine available port")));
        return;
      }
      const { port } = address;
      server.close(() => resolve5(port));
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
var import_promises = __toESM(require("fs/promises"));
var import_node_path3 = __toESM(require("path"));
var EPISODES_FILENAME = "reverie_episodes.json";
async function readEpisodesFile(codexHome) {
  try {
    const file = await import_promises.default.readFile(import_node_path3.default.join(codexHome, EPISODES_FILENAME), "utf8");
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
var import_agents2 = require("@openai/agents");
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
  const graderAgent = new import_agents2.Agent({
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
  truncateText
});
//# sourceMappingURL=index.cjs.map
