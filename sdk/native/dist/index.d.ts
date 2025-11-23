import { ContentBlock } from '@modelcontextprotocol/sdk/types.js';
import { Diagnostic } from 'vscode-languageserver-types';
import { ModelProvider, Model, StreamEvent } from '@openai/agents-core';
import { tool } from '@openai/agents';
import { OpencodeClient, Event } from '@opencode-ai/sdk';

/** The status of a command execution. */
type CommandExecutionStatus = "in_progress" | "completed" | "failed";
/** A command executed by the agent. */
type CommandExecutionItem = {
    id: string;
    type: "command_execution";
    /** The command line executed by the agent. */
    command: string;
    /** Aggregated stdout and stderr captured while the command was running. */
    aggregated_output: string;
    /** Set when the command exits; omitted while still running. */
    exit_code?: number;
    /** Current status of the command execution. */
    status: CommandExecutionStatus;
};
/** Indicates the type of the file change. */
type PatchChangeKind = "add" | "delete" | "update";
/** A set of file changes by the agent. */
type FileUpdateChange = {
    path: string;
    kind: PatchChangeKind;
};
/** The status of a file change. */
type PatchApplyStatus = "completed" | "failed";
/** A set of file changes by the agent. Emitted once the patch succeeds or fails. */
type FileChangeItem = {
    id: string;
    type: "file_change";
    /** Individual file changes that comprise the patch. */
    changes: FileUpdateChange[];
    /** Whether the patch ultimately succeeded or failed. */
    status: PatchApplyStatus;
};
/** The status of an MCP tool call. */
type McpToolCallStatus = "in_progress" | "completed" | "failed";
/**
 * Represents a call to an MCP tool. The item starts when the invocation is dispatched
 * and completes when the MCP server reports success or failure.
 */
type McpToolCallItem = {
    id: string;
    type: "mcp_tool_call";
    /** Name of the MCP server handling the request. */
    server: string;
    /** The tool invoked on the MCP server. */
    tool: string;
    /** Arguments forwarded to the tool invocation. */
    arguments: unknown;
    /** Result payload returned by the MCP server for successful calls. */
    result?: {
        content: ContentBlock[];
        structured_content: unknown;
    };
    /** Error message reported for failed calls. */
    error?: {
        message: string;
    };
    /** Current status of the tool invocation. */
    status: McpToolCallStatus;
};
/** Response from the agent. Either natural-language text or JSON when structured output is requested. */
type AgentMessageItem = {
    id: string;
    type: "agent_message";
    /** Either natural-language text or JSON when structured output is requested. */
    text: string;
};
/** Agent's reasoning summary. */
type ReasoningItem = {
    id: string;
    type: "reasoning";
    text: string;
};
/** Captures a web search request. Completes when results are returned to the agent. */
type WebSearchItem = {
    id: string;
    type: "web_search";
    query: string;
};
/** Describes a non-fatal error surfaced as an item. */
type ErrorItem = {
    id: string;
    type: "error";
    message: string;
};
/** An item in the agent's to-do list. */
type TodoItem = {
    text: string;
    completed: boolean;
};
/**
 * Tracks the agent's running to-do list. Starts when the plan is issued, updates as steps change,
 * and completes when the turn ends.
 */
type TodoListItem = {
    id: string;
    type: "todo_list";
    items: TodoItem[];
};
/** Canonical union of thread items and their type-specific payloads. */
type ThreadItem = AgentMessageItem | ReasoningItem | CommandExecutionItem | FileChangeItem | McpToolCallItem | WebSearchItem | TodoListItem | ErrorItem;

/** Emitted when a new thread is started as the first event. */
type ThreadStartedEvent = {
    type: "thread.started";
    /** The identifier of the new thread. Can be used to resume the thread later. */
    thread_id: string;
};
/**
 * Emitted when a turn is started by sending a new prompt to the model.
 * A turn encompasses all events that happen while the agent is processing the prompt.
 */
type TurnStartedEvent = {
    type: "turn.started";
};
/** Describes the usage of tokens during a turn. */
type Usage = {
    /** The number of input tokens used during the turn. */
    input_tokens: number;
    /** The number of cached input tokens used during the turn. */
    cached_input_tokens: number;
    /** The number of output tokens used during the turn. */
    output_tokens: number;
};
/** Emitted when a turn is completed. Typically right after the assistant's response. */
type TurnCompletedEvent = {
    type: "turn.completed";
    usage: Usage;
};
/** Indicates that a turn failed with an error. */
type TurnFailedEvent = {
    type: "turn.failed";
    error: ThreadError;
};
/** Background notification emitted during an active turn. */
type BackgroundEvent = {
    type: "background_event";
    message: string;
};
/** Emitted when a new item is added to the thread. Typically the item is initially "in progress". */
type ItemStartedEvent = {
    type: "item.started";
    item: ThreadItem;
};
/** Emitted when an item is updated. */
type ItemUpdatedEvent = {
    type: "item.updated";
    item: ThreadItem;
};
/** Signals that an item has reached a terminal state—either success or failure. */
type ItemCompletedEvent = {
    type: "item.completed";
    item: ThreadItem;
};
/** Fatal error emitted by the stream. */
type ThreadError = {
    message: string;
};
/** Represents an unrecoverable error emitted directly by the event stream. */
type ThreadErrorEvent = {
    type: "error";
    message: string;
};
/** Review finding with code location */
type ReviewFinding = {
    title: string;
    body: string;
    confidence_score: number;
    priority: number;
    code_location: {
        absolute_file_path: string;
        line_range: {
            start: number;
            end: number;
        };
    };
};
/** Structured review output */
type ReviewOutputEvent = {
    findings: ReviewFinding[];
    overall_correctness: string;
    overall_explanation: string;
    overall_confidence_score: number;
};
/** Emitted when exiting review mode with optional structured results */
type ExitedReviewModeEvent = {
    type: "exited_review_mode";
    review_output: ReviewOutputEvent | null;
};
/** Top-level JSONL events emitted by codex exec. */
type ThreadEvent = ThreadStartedEvent | TurnStartedEvent | TurnCompletedEvent | TurnFailedEvent | BackgroundEvent | ItemStartedEvent | ItemUpdatedEvent | ItemCompletedEvent | ExitedReviewModeEvent | ThreadErrorEvent | RawThreadEvent;
/** Raw protocol event forwarded without transformation. */
type RawThreadEvent = {
    type: "raw_event";
    raw: unknown;
};

type ApprovalMode = "never" | "on-request" | "on-failure" | "untrusted";
type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";
/**
 * Reasoning effort level for reasoning-capable models (e.g., o1, o3).
 * See https://platform.openai.com/docs/guides/reasoning
 *
 * @default "medium" - When undefined, codex uses "medium" as the default
 */
type ReasoningEffort = "minimal" | "low" | "medium" | "high";
/**
 * Controls whether reasoning summaries are included for reasoning-capable models.
 * See https://platform.openai.com/docs/guides/reasoning#reasoning-summaries
 *
 * @default "auto" - When undefined, codex uses "auto" as the default
 */
type ReasoningSummary = "auto" | "concise" | "detailed" | "none";
type WorkspaceWriteOptions = {
    /** Enable network access in workspace-write mode. Default: false */
    networkAccess?: boolean;
    /** Additional directories that should be writable */
    writableRoots?: string[];
    /** Exclude the TMPDIR environment variable from writable roots. Default: false */
    excludeTmpdirEnvVar?: boolean;
    /** Exclude /tmp from writable roots on Unix. Default: false */
    excludeSlashTmp?: boolean;
};
type ThreadOptions = {
    model?: string;
    /** Override the model provider declared in config.toml */
    modelProvider?: string;
    /** Use local OSS provider via Ollama (pulls models as needed) */
    oss?: boolean;
    sandboxMode?: SandboxMode;
    /** Approval policy for command execution */
    approvalMode?: ApprovalMode;
    /** Options for workspace-write sandbox mode */
    workspaceWriteOptions?: WorkspaceWriteOptions;
    workingDirectory?: string;
    skipGitRepoCheck?: boolean;
    /** Reasoning effort level (only honored for reasoning-capable models). Defaults to "medium" when undefined. */
    reasoningEffort?: ReasoningEffort;
    /** Reasoning summary preference (only honored for reasoning-capable models). Defaults to "auto" when undefined. */
    reasoningSummary?: ReasoningSummary;
    /** @deprecated Use sandboxMode and approvalMode instead */
    fullAuto?: boolean;
};

type TurnOptions = {
    /** JSON schema describing the expected agent output. */
    outputSchema?: unknown;
    /** Whether to use OSS mode with Ollama models */
    oss?: boolean;
};

type NativeConversationSummary = {
    id: string;
    path: string;
    createdAt?: string;
    updatedAt?: string;
};
type NativeConversationListPage = {
    conversations: NativeConversationSummary[];
    nextCursor?: string;
    numScannedFiles: number;
    reachedScanCap: boolean;
};
type NativeTuiRequest = {
    prompt?: string;
    images?: string[];
    model?: string;
    oss?: boolean;
    sandboxMode?: SandboxMode;
    approvalMode?: ApprovalMode;
    resumeSessionId?: string;
    resumeLast?: boolean;
    resumePicker?: boolean;
    fullAuto?: boolean;
    dangerouslyBypassApprovalsAndSandbox?: boolean;
    workingDirectory?: string;
    configProfile?: string;
    configOverrides?: string[];
    addDir?: string[];
    webSearch?: boolean;
    linuxSandboxPath?: string;
    baseUrl?: string;
    apiKey?: string;
    reasoningEffort?: ReasoningEffort;
    reasoningSummary?: ReasoningSummary;
};
type NativeTokenUsage = {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningOutputTokens: number;
    totalTokens: number;
};
type NativeUpdateActionKind = "npmGlobalLatest" | "bunGlobalLatest" | "brewUpgrade";
type NativeUpdateActionInfo = {
    kind: NativeUpdateActionKind;
    command: string;
};
type NativeTuiExitInfo = {
    tokenUsage: NativeTokenUsage;
    conversationId?: string;
    updateAction?: NativeUpdateActionInfo;
};
type RepoDiffFileChange = {
    path: string;
    status: string;
    diff: string;
    truncated: boolean;
    previousPath?: string | null;
};
type RepoDiffSummary = {
    repoPath: string;
    branch: string;
    baseBranch: string;
    upstreamRef?: string | null;
    mergeBase: string;
    statusSummary: string;
    diffStat: string;
    recentCommits: string;
    changedFiles: RepoDiffFileChange[];
    totalChangedFiles: number;
};
type RepoDiffSummaryOptions = {
    cwd?: string;
    baseBranchOverride?: string;
    maxFiles?: number;
    diffContextLines?: number;
    diffCharLimit?: number;
};
type ReverieConversation = {
    id: string;
    path: string;
    createdAt?: string;
    updatedAt?: string;
    headRecords: string[];
    tailRecords: string[];
    headRecordsToon: string[];
    tailRecordsToon: string[];
};
type ReverieSearchResult = {
    conversation: ReverieConversation;
    relevanceScore: number;
    matchingExcerpts: string[];
    insights: string[];
    rerankerScore?: number;
};
type FastEmbedRerankerModelCode = "BAAI/bge-reranker-base" | "rozgo/bge-reranker-v2-m3" | "jinaai/jina-reranker-v1-turbo-en" | "jinaai/jina-reranker-v2-base-multilingual";
type ReverieSemanticSearchOptions = {
    limit?: number;
    maxCandidates?: number;
    projectRoot?: string;
    batchSize?: number;
    normalize?: boolean;
    cache?: boolean;
    rerankerModel?: FastEmbedRerankerModelCode;
    rerankerCacheDir?: string;
    rerankerMaxLength?: number;
    rerankerShowProgress?: boolean;
    rerankerBatchSize?: number;
    rerankerTopK?: number;
};
type ReverieSemanticIndexStats = {
    conversationsIndexed: number;
    documentsEmbedded: number;
    batches: number;
};
type FastEmbedInitOptions = {
    model?: string;
    cacheDir?: string;
    maxLength?: number;
    showDownloadProgress?: boolean;
};
type FastEmbedEmbedRequest = {
    inputs: string[];
    batchSize?: number;
    normalize?: boolean;
    projectRoot?: string;
    cache?: boolean;
};
type TokenizerOptions = {
    model?: string;
    encoding?: "o200k_base" | "cl100k_base";
};
type TokenizerEncodeOptions = TokenizerOptions & {
    withSpecialTokens?: boolean;
};
type NativeToolInfo = {
    name: string;
    description?: string;
    parameters?: unknown;
    strict?: boolean;
    supportsParallel?: boolean;
};
type NativeToolInvocation = {
    toolName: string;
    callId: string;
    arguments?: string;
    input?: string;
};
type NativeToolResult = {
    output?: string;
    success?: boolean;
    error?: string;
};
type NativeForkResult = {
    threadId: string;
    rolloutPath: string;
};
type ApprovalRequest = {
    type: "shell" | "file_write" | "network_access";
    details?: unknown;
    context?: string;
};
declare function reverieListConversations(codexHomePath: string, limit?: number, offset?: number): Promise<ReverieConversation[]>;
declare function reverieSearchConversations(codexHomePath: string, query: string, limit?: number): Promise<ReverieSearchResult[]>;
declare function reverieSearchSemantic(codexHomePath: string, context: string, options?: ReverieSemanticSearchOptions): Promise<ReverieSearchResult[]>;
declare function reverieIndexSemantic(codexHomePath: string, options?: ReverieSemanticSearchOptions): Promise<ReverieSemanticIndexStats>;
declare function reverieGetConversationInsights(conversationPath: string, query?: string): Promise<string[]>;
declare function encodeToToon(value: unknown): string;
declare function fastEmbedInit(options: FastEmbedInitOptions): Promise<void>;
declare function fastEmbedEmbed(request: FastEmbedEmbedRequest): Promise<number[][]>;
declare function tokenizerCount(text: string, options?: TokenizerOptions): number;
declare function tokenizerEncode(text: string, options?: TokenizerEncodeOptions): number[];
declare function tokenizerDecode(tokens: number[], options?: TokenizerOptions): string;
declare function collectRepoDiffSummary(options?: RepoDiffSummaryOptions): Promise<RepoDiffSummary>;

interface TuiSession {
    wait(): Promise<NativeTuiExitInfo>;
    shutdown(): void;
    readonly closed: boolean;
}
interface RunTuiOptions {
    signal?: AbortSignal;
}
/**
 * Starts the Codex TUI (Terminal User Interface) and returns a controllable session handle.
 *
 * Use {@link TuiSession.wait} to await completion or {@link TuiSession.shutdown} to
 * request a graceful exit from another part of your program.
 */
declare function startTui(request: NativeTuiRequest): TuiSession;
/**
 * Launches the Codex TUI and waits for it to exit. Supports optional cancellation via AbortSignal.
 */
declare function runTui(request: NativeTuiRequest, options?: RunTuiOptions): Promise<NativeTuiExitInfo>;

/** Completed turn. */
type Turn = {
    items: ThreadItem[];
    finalResponse: string;
    usage: Usage | null;
};
/** Alias for `Turn` to describe the result of `run()`. */
type RunResult = Turn;
/** The result of the `runStreamed` method. */
type StreamedTurn = {
    events: AsyncGenerator<ThreadEvent>;
};
/** Alias for `StreamedTurn` to describe the result of `runStreamed()`. */
type RunStreamedResult = StreamedTurn;
/** An input to send to the agent. */
type UserInput = {
    type: "text";
    text: string;
} | {
    type: "local_image";
    path: string;
};
type Input = string | UserInput[];
type ForkOptions = {
    nthUserMessage: number;
    threadOptions?: Partial<ThreadOptions>;
};
/** Respesent a thread of conversation with the agent. One thread can have multiple consecutive turns. */
declare class Thread {
    private _exec;
    private _options;
    private _id;
    private _threadOptions;
    private _eventListeners;
    private _approvalHandler;
    /** Returns the ID of the thread. Populated after the first turn starts. */
    get id(): string | null;
    /**
     * Register an event listener for thread events.
     * @param listener Callback function that receives ThreadEvent objects
     * @returns Unsubscribe function to remove the listener
     */
    onEvent(listener: (event: ThreadEvent) => void): () => void;
    /**
     * Remove an event listener.
     * @param listener The listener function to remove
     */
    offEvent(listener: (event: ThreadEvent) => void): void;
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
    onApprovalRequest(handler: (request: ApprovalRequest) => boolean | Promise<boolean>): void;
    /**
     * Emit a background notification while the agent is running the current turn.
     * The message is surfaced to event subscribers but does not modify the user input queue.
     *
     * @throws Error if the thread has not been started yet.
     */
    sendBackgroundEvent(message: string): Promise<void>;
    /**
     * Programmatically update the agent's plan/todo list.
     * The plan will be applied at the start of the next turn.
     *
     * @param args The plan update arguments
     * @throws Error if no thread ID is available
     */
    updatePlan(args: {
        explanation?: string;
        plan: Array<{
            step: string;
            status: "pending" | "in_progress" | "completed";
        }>;
    }): void;
    /**
     * Modify the agent's plan/todo list with granular operations.
     * Changes will be applied at the start of the next turn.
     *
     * @param operations Array of operations to perform on the plan
     * @throws Error if no thread ID is available
     */
    modifyPlan(operations: Array<{
        type: "add";
        item: {
            step: string;
            status?: "pending" | "in_progress" | "completed";
        };
    } | {
        type: "update";
        index: number;
        updates: Partial<{
            step: string;
            status: "pending" | "in_progress" | "completed";
        }>;
    } | {
        type: "remove";
        index: number;
    } | {
        type: "reorder";
        newOrder: number[];
    }>): void;
    /**
     * Add a new todo item to the agent's plan.
     *
     * @param step The todo step description
     * @param status The initial status (defaults to "pending")
     */
    addTodo(step: string, status?: "pending" | "in_progress" | "completed"): void;
    /**
     * Update an existing todo item.
     *
     * @param index The index of the todo item to update
     * @param updates The updates to apply
     */
    updateTodo(index: number, updates: Partial<{
        step: string;
        status: "pending" | "in_progress" | "completed";
    }>): void;
    /**
     * Remove a todo item from the plan.
     *
     * @param index The index of the todo item to remove
     */
    removeTodo(index: number): void;
    /**
     * Reorder the todo items in the plan.
     *
     * @param newOrder Array of indices representing the new order
     */
    reorderTodos(newOrder: number[]): void;
    /** Compacts the conversation history for this thread using Codex's builtin compaction. */
    compact(): Promise<void>;
    /**
     * Fork this thread at the specified user message, returning a new thread that starts
     * from the conversation history prior to that message.
     *
     * @param options Fork configuration including which user message to branch before and optional thread overrides.
     */
    fork(options: ForkOptions): Promise<Thread>;
    /** Provides the input to the agent and streams events as they are produced during the turn. */
    runStreamed(input: Input, turnOptions?: TurnOptions): Promise<StreamedTurn>;
    private runStreamedInternal;
    /** Provides the input to the agent and returns the completed turn. */
    run(input: Input, turnOptions?: TurnOptions): Promise<Turn>;
    private buildTuiRequest;
    /**
     * Launches the interactive Codex TUI (Terminal User Interface) for this thread and returns a session handle.
     *
     * The handle allows advanced workflows where the TUI can be started and stopped programmatically,
     * while preserving the underlying conversation state.
     */
    launchTui(overrides?: Partial<NativeTuiRequest>): TuiSession;
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
    tui(overrides?: Partial<NativeTuiRequest>, options?: RunTuiOptions): Promise<NativeTuiExitInfo>;
    private wrapTuiSession;
    private attachDefaultLspBridge;
}

type NativeToolDefinition = NativeToolInfo & {
    handler: (call: NativeToolInvocation) => Promise<NativeToolResult> | NativeToolResult;
};
type CodexOptions = {
    codexPathOverride?: string;
    baseUrl?: string;
    apiKey?: string;
    /** Optional model provider override to use instead of the default */
    modelProvider?: string;
    /** Default model to use when a thread omits an explicit choice */
    defaultModel?: string;
    tools?: NativeToolDefinition[];
};

type CurrentChangesReview = {
    type: "current_changes";
};
type BranchReview = {
    type: "branch";
    baseBranch: string;
};
type CommitReview = {
    type: "commit";
    sha: string;
    subject?: string;
};
type CustomReview = {
    type: "custom";
    prompt: string;
    hint?: string;
};
type ReviewTarget = CurrentChangesReview | BranchReview | CommitReview | CustomReview;
type ReviewInvocationOptions = {
    target: ReviewTarget;
    threadOptions?: ThreadOptions;
    turnOptions?: TurnOptions;
};

type NativeToolInterceptorContext = {
    invocation: NativeToolInvocation;
    callBuiltin: (invocation?: NativeToolInvocation) => Promise<NativeToolResult>;
};
type ConversationSummary = NativeConversationSummary;
type ConversationListPage = NativeConversationListPage;
type ConversationListOptions = ThreadOptions & {
    pageSize?: number;
    cursor?: string;
    modelProviders?: string[];
};
/**
 * Codex is the main class for interacting with the Codex agent.
 *
 * This is the native NAPI-based implementation that uses Rust bindings directly.
 *
 * Use the `startThread()` method to start a new thread or `resumeThread()` to resume a previously started thread.
 */
declare class Codex {
    private exec;
    private options;
    private readonly nativeBinding;
    private readonly lspForTools;
    constructor(options?: CodexOptions);
    /**
     * Register a tool for Codex. When `tool.name` matches a built-in Codex tool,
     * the native implementation is replaced for this Codex instance.
     */
    registerTool(tool: NativeToolDefinition): void;
    /**
     * Register a tool interceptor for Codex. Interceptors can modify tool invocations
     * and results, and can call the built-in implementation.
     */
    registerToolInterceptor(toolName: string, handler: (context: NativeToolInterceptorContext) => Promise<NativeToolResult> | NativeToolResult): void;
    /**
     * Clear all registered tools, restoring built-in defaults.
     */
    clearTools(): void;
    private buildConversationConfig;
    private createLspManagerForTools;
    private registerDefaultReadFileInterceptor;
    /**
     * Register a programmatic approval callback that Codex will call before executing
     * sensitive operations (e.g., shell commands, file writes).
     */
    setApprovalCallback(handler: (request: ApprovalRequest) => boolean | Promise<boolean>): void;
    /**
     * Starts a new conversation with an agent.
     * @returns A new thread instance.
     */
    startThread(options?: ThreadOptions): Thread;
    /**
     * Resumes a conversation with an agent based on the thread id.
     * Threads are persisted in ~/.codex/sessions.
     *
     * @param id The id of the thread to resume.
     * @returns A new thread instance.
     */
    resumeThread(id: string, options?: ThreadOptions): Thread;
    listConversations(options?: ConversationListOptions): Promise<ConversationListPage>;
    deleteConversation(id: string, options?: ThreadOptions): Promise<boolean>;
    resumeConversationFromRollout(rolloutPath: string, options?: ThreadOptions): Promise<Thread>;
    /**
     * Starts a review task using the built-in Codex review flow.
     */
    review(options: ReviewInvocationOptions): Promise<Turn>;
    /**
     * Starts a review task and returns the event stream.
     */
    reviewStreamed(options: ReviewInvocationOptions): Promise<StreamedTurn>;
    private reviewStreamedInternal;
}

type LspDiagnosticSeverity = "error" | "warning" | "info" | "hint";
type NormalizedDiagnostic = {
    message: string;
    severity: LspDiagnosticSeverity;
    source?: string;
    code?: string | number;
    range: Diagnostic["range"];
};
type FileDiagnostics = {
    path: string;
    diagnostics: NormalizedDiagnostic[];
};
type WorkspaceLocator = {
    type: "markers";
    include: string[];
    exclude?: string[];
} | {
    type: "fixed";
    path: string;
};
type LspServerConfig = {
    id: string;
    displayName: string;
    command: string[];
    extensions: string[];
    env?: NodeJS.ProcessEnv;
    initializationOptions?: Record<string, unknown>;
    workspace?: WorkspaceLocator;
};
type LspManagerOptions = {
    workingDirectory: string;
    waitForDiagnostics?: boolean;
};

declare class LspDiagnosticsBridge {
    private readonly options;
    private readonly manager;
    private readonly attached;
    constructor(options: LspManagerOptions);
    attach(thread: Thread): () => void;
    dispose(): Promise<void>;
    private processDiagnostics;
}

/**
 * Attaches the LSP diagnostics bridge to a thread.
 * Returns a cleanup function that detaches the bridge and disposes shared resources.
 */
declare function attachLspDiagnostics(thread: Thread, options: LspManagerOptions): () => void;

declare class LspManager {
    private readonly options;
    private clients;
    constructor(options: LspManagerOptions);
    collectDiagnostics(files: string[]): Promise<FileDiagnostics[]>;
    dispose(): Promise<void>;
    private getClient;
    private createClient;
}

declare const DEFAULT_SERVERS: LspServerConfig[];
declare function findServerForFile(filePath: string): LspServerConfig | undefined;
declare function resolveWorkspaceRoot(filePath: string, locator: WorkspaceLocator | undefined, fallbackDir: string): string;

/**
 * Options for creating a CodexProvider
 */
interface CodexProviderOptions extends CodexOptions {
    /**
     * Default model to use when none is specified
     */
    defaultModel?: string;
    /**
     * Use local OSS provider via Ollama (pulls models as needed)
     */
    oss?: boolean;
    /**
     * Working directory for Codex operations
     * @default process.cwd()
     */
    workingDirectory?: string;
    /**
     * Skip git repository check
     * @default false
     */
    skipGitRepoCheck?: boolean;
    /**
     * Sandbox policy to use when executing shell commands
     * @default "danger-full-access"
     */
    sandboxMode?: ThreadOptions["sandboxMode"];
    /**
     * Approval policy forwarded to threads created by this provider.
     */
    approvalMode?: ThreadOptions["approvalMode"];
}
/**
 * Provider implementation that uses Codex as the backend for OpenAI Agents
 *
 * @example
 * ```typescript
 * import { CodexProvider } from '@openai/codex-native/agents';
 * import { Agent, Runner } from '@openai/agents';
 *
 *   defaultModel: 'gpt-5-codex'
 * });
 *
 * const agent = new Agent({
 *   name: 'CodeAssistant',
 *   instructions: 'You are a helpful coding assistant'
 * });
 *
 * const runner = new Runner({ modelProvider: provider });
 * const result = await runner.run(agent, 'Fix the failing tests');
 * ```
 */
declare class CodexProvider implements ModelProvider {
    private codex;
    private options;
    constructor(options?: CodexProviderOptions);
    /**
     * Lazy initialization of Codex instance
     */
    private getCodex;
    getModel(modelName?: string): Model;
}

type BaseToolOptions = Parameters<typeof tool>[0];
type AgentTool = ReturnType<typeof tool>;
type CodexToolOptions = BaseToolOptions & {
    codexExecute: (input: unknown) => Promise<unknown> | unknown;
};
declare function codexTool(options: CodexToolOptions): AgentTool;

type ToolCallEvent = {
    name?: string;
    input?: unknown;
    output?: unknown;
    status?: "started" | "completed";
};
type FormattedStream = {
    text: string;
    reasoning: string;
    toolCalls: ToolCallEvent[];
    usage?: {
        requests?: number;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        inputTokensDetails?: Record<string, number>;
        outputTokensDetails?: Record<string, number>;
    };
    /**
     * Convenience field when providers report cached tokens (e.g. via inputTokensDetails.cachedTokens)
     */
    cachedTokens?: number;
    responseId?: string;
    /**
     * Raw provider-specific data (e.g., costs, cache hit ratios, rate limit info)
     */
    providerData?: Record<string, unknown>;
    errors: {
        message: string;
    }[];
};
type FormatStreamOptions = {
    onUpdate?: (partial: Partial<FormattedStream>) => void;
};
/**
 * Consume a stream of StreamEvent and aggregate into a coherent object:
 * - Concatenates output_text deltas into `text`
 * - Concatenates reasoning deltas into `reasoning`
 * - Captures usage and responseId on response_done
 * - Prepares space for tool call events (future-friendly; empty for now)
 *
 * Optionally invokes `onUpdate` with partial snapshots as data arrives.
 */
declare function formatStream(stream: AsyncIterable<StreamEvent>, options?: FormatStreamOptions): Promise<FormattedStream>;

type PermissionDecision = boolean | "once" | "always" | "reject" | {
    response: "once" | "always" | "reject";
};
interface PermissionRequest {
    id: string;
    type: string;
    title: string;
    sessionId: string;
    metadata: Record<string, unknown>;
    pattern?: string | string[];
}
interface OpenCodeAgentOptions {
    /** Fully qualified base URL for an existing opencode server. When omitted the agent will start its own server. */
    baseUrl?: string;
    /** Hostname passed to `createOpencode` when auto-starting the server. */
    hostname?: string;
    /** Port passed to `createOpencode` when auto-starting the server. */
    port?: number;
    /** Additional configuration forwarded to `createOpencode`. */
    config?: Record<string, unknown>;
    /** Preferred model string in the form `provider/model`. */
    model?: string;
    /** Directory the OpenCode session should operate within. Defaults to the current working directory. */
    workingDirectory?: string;
    /** Optional user-friendly session title. */
    title?: string;
    /** Callback invoked whenever opencode asks for a permission decision. */
    onApprovalRequest?: (request: PermissionRequest) => PermissionDecision | Promise<PermissionDecision>;
    /** Override for tests – returns a hydrated opencode client. */
    clientFactory?: () => Promise<{
        client: OpencodeClient;
        close?: () => void;
    }>;
}
interface DelegationResult {
    sessionId: string;
    /** Deprecated alias retained for backwards compatibility. */
    threadId?: string;
    output: string;
    success: boolean;
    error?: string;
    usage?: Usage | null;
}
declare class OpenCodeAgent {
    private readonly options;
    private readonly approvalHandler?;
    private clientPromise?;
    constructor(options?: OpenCodeAgentOptions);
    delegate(task: string): Promise<DelegationResult>;
    delegateStreaming(task: string, onEvent?: (event: Event) => void, sessionId?: string): Promise<DelegationResult>;
    resume(sessionId: string, task: string): Promise<DelegationResult>;
    workflow(steps: string[]): Promise<DelegationResult[]>;
    private executeTask;
    private ensureClient;
    private ensureSession;
    private createSessionTitle;
    private parseModel;
    private collectText;
    private toUsage;
    private extractData;
    private describeError;
    private watchEvents;
    private extractSessionId;
    private respondToPermission;
    private normalizeDecision;
    private getWorkingDirectory;
}

type CloudTaskStatus = "pending" | "ready" | "applied" | "error";
type DiffSummary = {
    files_changed: number;
    lines_added: number;
    lines_removed: number;
};
type CloudTaskSummary = {
    id: string;
    title: string;
    status: CloudTaskStatus;
    updated_at: string;
    environment_id?: string | null;
    environment_label?: string | null;
    summary: DiffSummary;
    is_review?: boolean;
    attempt_total?: number | null;
};
type CloudApplyStatus = "success" | "partial" | "error";
type CloudApplyOutcome = {
    applied: boolean;
    status: CloudApplyStatus;
    message: string;
    skipped_paths: string[];
    conflict_paths: string[];
};
type CloudTaskCreateResult = {
    id: string;
};
type CloudTasksOptions = {
    baseUrl?: string;
    apiKey?: string;
};
declare class CloudTasks {
    private readonly options;
    constructor(options?: CloudTasksOptions);
    private binding;
    list(env?: string): Promise<CloudTaskSummary[]>;
    getDiff(taskId: string): Promise<string | null>;
    applyPreflight(taskId: string, diffOverride?: string): Promise<CloudApplyOutcome>;
    apply(taskId: string, diffOverride?: string): Promise<CloudApplyOutcome>;
    create(envId: string, prompt: string, opts?: {
        gitRef?: string;
        qaMode?: boolean;
        bestOfN?: number;
    }): Promise<CloudTaskCreateResult>;
}

/**
 * Log level enumeration
 */
declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SILENT = 4
}
/**
 * Log scopes for different subsystems
 */
type LogScope = "thread" | "merge" | "git" | "coordinator" | "worker" | "supervisor" | "reviewer" | "validation" | "lsp" | "agent" | "provider" | "ci" | "test" | "system";
/**
 * Configuration for logger instances
 */
interface LoggerConfig {
    /** Minimum log level to output */
    level?: LogLevel;
    /** Enable colored output (default: true for TTY) */
    colors?: boolean;
    /** Include timestamps in output (default: false) */
    timestamps?: boolean;
    /** Prefix for all log messages */
    prefix?: string;
    /** Enable structured JSON output instead of formatted text */
    json?: boolean;
    /** Custom output stream (default: console) */
    output?: LogOutput;
}
/**
 * Output interface for log messages
 */
interface LogOutput {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}
/**
 * Thread logging sink interface
 */
interface ThreadLoggingSink {
    info(message: string): void;
    warn(message: string): void;
    recordUsage?(usage: Usage): void;
}
/**
 * Structured log entry for JSON output
 */
interface LogEntry {
    timestamp: string;
    level: string;
    scope?: string;
    subject?: string;
    message: string;
    data?: Record<string, unknown>;
}

/**
 * Centralized logger with support for scopes, levels, and structured output
 */
declare class Logger {
    private level;
    private colors;
    private timestamps;
    private prefix;
    private json;
    private output;
    constructor(config?: LoggerConfig);
    /**
     * Create a new logger with modified configuration
     */
    configure(config: Partial<LoggerConfig>): Logger;
    /**
     * Create a scoped logger
     */
    scope(scope: LogScope, subject?: string): ScopedLogger;
    /**
     * Log a debug message
     */
    debug(message: string, data?: Record<string, unknown>): void;
    /**
     * Log an info message
     */
    info(message: string, data?: Record<string, unknown>): void;
    /**
     * Log a warning message
     */
    warn(message: string, data?: Record<string, unknown>): void;
    /**
     * Log an error message
     */
    error(message: string, data?: Record<string, unknown>): void;
    /**
     * Internal log method
     */
    private log;
    /**
     * Log in JSON format
     */
    private logJson;
    /**
     * Log in formatted text
     */
    private logFormatted;
    /**
     * Internal scoped log method (used by ScopedLogger)
     */
    logScoped(level: LogLevel, message: string, scope: LogScope, subject?: string, data?: Record<string, unknown>): void;
}
/**
 * Scoped logger for a specific subsystem
 */
declare class ScopedLogger {
    private logger;
    private scope;
    private subject?;
    constructor(logger: Logger, scope: LogScope, subject?: string | undefined);
    /**
     * Log a debug message
     */
    debug(message: string, data?: Record<string, unknown>): void;
    /**
     * Log an info message
     */
    info(message: string, data?: Record<string, unknown>): void;
    /**
     * Log a warning message
     */
    warn(message: string, data?: Record<string, unknown>): void;
    /**
     * Log an error message
     */
    error(message: string, data?: Record<string, unknown>): void;
    /**
     * Create a ThreadLoggingSink adapter
     */
    asThreadSink(): ThreadLoggingSink;
}
/**
 * Global default logger instance
 */
declare const logger: Logger;

/**
 * Create a thread logging sink from a scoped logger
 */
declare function createThreadLogger(scopedLogger: ScopedLogger, onUsage?: (usage: Usage) => void): ThreadLoggingSink;
/**
 * Run a thread turn with automatic event logging
 */
declare function runThreadTurnWithLogs(thread: Thread, sink: ThreadLoggingSink, prompt: string, turnOptions?: TurnOptions): Promise<Turn>;

/**
 * Reverie System Constants
 *
 * Configuration constants for reverie search, filtering, and grading.
 * These values are tuned for optimal balance between result quality and performance.
 */
/**
 * Default number of final reverie insights to return.
 * After all filtering and grading, this is the target result count.
 */
declare const DEFAULT_REVERIE_LIMIT = 6;
/**
 * Maximum number of candidate insights to fetch initially.
 * We fetch many candidates upfront and then filter aggressively.
 */
declare const DEFAULT_REVERIE_MAX_CANDIDATES = 80;
/**
 * Embedding model for semantic search.
 * Large model provides better semantic understanding at cost of memory/speed.
 */
declare const REVERIE_EMBED_MODEL = "BAAI/bge-large-en-v1.5";
/**
 * Reranker model for improving search precision.
 * Applied after initial embedding search to rerank top candidates.
 */
declare const REVERIE_RERANKER_MODEL = "rozgo/bge-reranker-v2-m3";
/**
 * Candidate multiplier for aggressive filtering.
 * Fetch 3x candidates since we'll filter heavily for quality.
 */
declare const REVERIE_CANDIDATE_MULTIPLIER = 3;
/**
 * Minimum relevance score threshold for LLM grading.
 * Only insights scoring >= 0.7 are sent for expensive LLM evaluation.
 * This optimizes API costs by skipping obvious low-quality candidates.
 */
declare const REVERIE_LLM_GRADE_THRESHOLD = 0.7;
/**
 * Default reranker top-k value.
 * Number of results to rerank after initial retrieval.
 */
declare const DEFAULT_RERANKER_TOP_K = 20;
/**
 * Default reranker batch size.
 * Number of candidates to process per reranker batch.
 */
declare const DEFAULT_RERANKER_BATCH_SIZE = 8;

/**
 * Reverie Type Definitions
 *
 * Core types used throughout the reverie system.
 */
/**
 * Represents a single reverie insight from past conversations.
 */
interface ReverieInsight$1 {
    /** Unique identifier for the conversation */
    conversationId: string;
    /** ISO timestamp of when the conversation occurred */
    timestamp: string;
    /** Relevance score from semantic search (0-1) */
    relevance: number;
    /** Text excerpt from the conversation */
    excerpt: string;
    /** Extracted insights or key points from the excerpt */
    insights: string[];
}
interface ReverieEpisodeSummary {
    conversationId: string;
    episodeId: string;
    timestamp: string;
    summary: string;
    keyDecisions?: string[];
    importance?: number;
}
/**
 * Options for reverie semantic search.
 */
interface ReverieSearchOptions {
    /** Maximum number of final results to return (after all filtering) */
    limit?: number;
    /** Maximum number of candidates to fetch initially */
    maxCandidates?: number;
    /** Whether to use reranker for improving precision */
    useReranker?: boolean;
    /** Reranker model identifier */
    rerankerModel?: string;
    /** Number of results to rerank */
    rerankerTopK?: number;
    /** Batch size for reranking operations */
    rerankerBatchSize?: number;
    /** Multiplier for candidate fetching (fetch N × limit candidates) */
    candidateMultiplier?: number;
}
/**
 * Options for LLM-based relevance grading.
 */
interface GradingOptions {
    /** Minimum relevance score to trigger LLM grading (default: 0.7) */
    minRelevanceForGrading?: number;
    /** Whether to grade insights in parallel (default: true) */
    parallel?: boolean;
}
/**
 * Statistics from reverie filtering pipeline.
 */
interface ReverieFilterStats {
    /** Total raw results from search */
    total: number;
    /** Results after basic quality filtering */
    afterQuality: number;
    /** Results after embedding-based boilerplate filtering */
    afterBoilerplate?: number;
    /** Results after relevance score threshold */
    afterScore: number;
    /** Results after deduplication */
    afterDedup: number;
    /** Results after LLM grading */
    afterLLMGrade?: number;
    /** Final result count */
    final: number;
}
/**
 * Complete pipeline options combining search, filtering, and grading.
 */
interface ReveriePipelineOptions extends ReverieSearchOptions, GradingOptions {
    /** Whether to skip LLM grading entirely (default: false) */
    skipLLMGrading?: boolean;
}
/**
 * Reverie search level types for multi-level search hierarchy.
 */
type ReverieSearchLevel = 'project' | 'branch' | 'file';
/**
 * Project-level search context for repository-wide patterns.
 */
interface ProjectLevelContext {
    /** Search level identifier */
    level: 'project';
    /** Repository root path */
    repoPath: string;
    /** Search query describing what to find */
    query: string;
    /** Optional file patterns to filter search scope (e.g., ["*.ts", "src/**"]) */
    filePatterns?: string[];
}
/**
 * Branch-level search context for feature/branch-specific work.
 */
interface BranchLevelContext {
    /** Search level identifier */
    level: 'branch';
    /** Repository root path */
    repoPath: string;
    /** Current branch name */
    branch: string;
    /** Base branch for comparison (e.g., "main") */
    baseBranch?: string;
    /** List of changed file paths in this branch */
    changedFiles: string[];
    /** Recent commit messages or summaries */
    recentCommits?: string;
}
/**
 * File-level search context for individual file changes.
 */
interface FileLevelContext {
    /** Search level identifier */
    level: 'file';
    /** Repository root path */
    repoPath: string;
    /** Path to the file being analyzed */
    filePath: string;
    /** Git diff or change content */
    diff?: string;
    /** Extracted symbols from the file (functions, classes, etc.) */
    symbols?: string[];
}
/**
 * Union type representing any level of search context.
 */
type ReverieContext = ProjectLevelContext | BranchLevelContext | FileLevelContext;

/**
 * Reverie Quality Utilities
 *
 * Provides filtering, deduplication, and quality assessment for reverie search results.
 * Ensures that only meaningful conversation excerpts are surfaced to agents and users.
 */
/**
 * Represents a single reverie insight from past conversations.
 * This is a generic interface that can be extended with additional metadata.
 */
interface ReverieInsight {
    /** Unique identifier for the conversation */
    conversationId: string;
    /** ISO timestamp of when the conversation occurred */
    timestamp: string;
    /** Relevance score from semantic search (0-1) */
    relevance: number;
    /** Text excerpt from the conversation */
    excerpt: string;
    /** Extracted insights or key points from the excerpt */
    insights: string[];
}
/**
 * Type alias for reverie results (used for logging compatibility).
 */
type ReverieResult = ReverieInsight;
/**
 * Statistics from the quality filtering pipeline.
 */
interface QualityFilterStats {
    /** Number of insights before filtering */
    initial: number;
    /** Number after validity filtering */
    afterValidityFilter: number;
    /** Number after deduplication */
    afterDeduplication: number;
    /** Final number of insights */
    final: number;
}
/**
 * Validates whether a reverie excerpt contains meaningful content worth indexing.
 *
 * Filters out:
 * - Very short excerpts (< 20 chars)
 * - System prompts and boilerplate text
 * - Tool outputs and structured data
 * - Excerpts with excessive XML/HTML tags
 * - JSON objects and configuration snippets
 *
 * @param excerpt - The text excerpt to validate
 * @returns true if the excerpt contains meaningful content, false otherwise
 *
 * @example
 * ```typescript
 * const excerpt = "Let's refactor the auth module to use async/await";
 * isValidReverieExcerpt(excerpt); // true
 *
 * const systemPrompt = "<INSTRUCTIONS>You are a coding assistant</INSTRUCTIONS>";
 * isValidReverieExcerpt(systemPrompt); // false
 * ```
 */
declare function isValidReverieExcerpt(excerpt: string): boolean;
/**
 * Removes duplicate or highly similar reverie insights based on content fingerprinting.
 *
 * CRITICAL FIX: Groups by fingerprint and keeps the insight with the HIGHEST relevance score.
 * Previous implementations incorrectly kept the first occurrence, which could discard
 * higher-quality duplicates found later in the list.
 *
 * Uses the first 100 characters of each excerpt (normalized) as a fingerprint
 * to identify duplicates. This prevents redundant insights from being shown
 * to the user while preserving the most relevant unique insights.
 *
 * @param insights - Array of reverie insights to deduplicate
 * @returns Deduplicated array of reverie insights, sorted by relevance (highest first)
 *
 * @example
 * ```typescript
 * const insights = [
 *   { excerpt: "We refactored the auth module...", relevance: 0.7, ... },
 *   { excerpt: "We refactored the auth module to use async/await", relevance: 0.9, ... },
 *   { excerpt: "Updated the database schema", relevance: 0.8, ... }
 * ];
 *
 * const deduplicated = deduplicateReverieInsights(insights);
 * // Returns 2 insights: the higher-scoring auth one (0.9) and the database one (0.8)
 * ```
 */
declare function deduplicateReverieInsights<T extends ReverieInsight>(insights: T[]): T[];
/**
 * Applies the complete quality pipeline to reverie insights.
 *
 * Pipeline steps:
 * 1. Filter out invalid excerpts (system prompts, boilerplate, etc.)
 * 2. Deduplicate similar insights, keeping highest relevance
 * 3. Sort by relevance score (highest first)
 * 4. Limit to top N results
 *
 * @param insights - Raw reverie insights from search
 * @param limit - Maximum number of insights to return (default: 10)
 * @returns Filtered, deduplicated, and sorted insights with statistics
 *
 * @example
 * ```typescript
 * const rawInsights = await reverieSearchSemantic(codexHome, query, options);
 * const { insights, stats } = applyQualityPipeline(rawInsights, 5);
 *
 * console.log(`Filtered ${stats.initial} → ${stats.final} insights`);
 * insights.forEach(insight => {
 *   console.log(`[${insight.relevance.toFixed(2)}] ${insight.excerpt.slice(0, 100)}`);
 * });
 * ```
 */
declare function applyQualityPipeline<T extends ReverieInsight>(insights: T[], limit?: number): {
    insights: T[];
    stats: QualityFilterStats;
};

/**
 * LLM-Based Relevance Grading for Reverie Insights
 *
 * Uses an LLM to evaluate whether reverie excerpts contain specific technical details
 * relevant to the current work context. This provides a more sophisticated filter than
 * simple keyword matching or relevance scores.
 *
 * Key optimizations:
 * - Only grades high-scoring candidates (relevance >= 0.7) to minimize API costs
 * - Parallel grading for performance
 * - Strict filtering to reject boilerplate and generic content
 */

/**
 * Minimal interface for an agent runner that can execute prompts.
 * Compatible with @openai/agents Runner and similar implementations.
 */
interface AgentRunner {
    run(agent: {
        name: string;
        instructions: string | ((...args: any[]) => any);
        outputType?: unknown;
        getEnabledHandoffs?: (...args: any[]) => Promise<unknown> | unknown;
        getAllTools?: (...args: any[]) => Promise<unknown> | unknown;
    }, prompt: string): Promise<{
        finalOutput?: unknown;
    }>;
}
/**
 * Uses LLM to evaluate if a reverie excerpt contains specific technical details
 * relevant to the search context.
 *
 * The grader is extremely strict and only approves excerpts with:
 * - Specific code/file references
 * - Technical decisions and rationale
 * - Error messages and debugging details
 * - Implementation specifics
 *
 * It rejects:
 * - Greetings and pleasantries
 * - Thinking markers (**, ##)
 * - JSON objects and structured data
 * - Generic phrases ("Context from past work")
 * - Metadata and system information
 *
 * @param runner - Agent runner capable of executing LLM prompts
 * @param searchContext - Context describing what we're searching for
 * @param insight - Reverie insight to evaluate
 * @returns true if the excerpt contains valuable technical details, false otherwise
 *
 * @example
 * ```typescript
 * const context = "Implementing authentication with JWT tokens";
 * const insight = {
 *   excerpt: "We decided to use RS256 for JWT signing because...",
 *   relevance: 0.85,
 *   // ...
 * };
 *
 * const isRelevant = await gradeReverieRelevance(runner, context, insight);
 * // Returns: true (contains specific technical decision)
 * ```
 */
declare function gradeReverieRelevance(runner: AgentRunner, searchContext: string, insight: ReverieInsight$1): Promise<boolean>;
/**
 * Grades multiple reverie insights in parallel using LLM evaluation.
 *
 * Pipeline:
 * 1. Filter insights by minimum relevance threshold (default: 0.7)
 * 2. Send high-scoring insights to LLM grader in parallel
 * 3. Return only insights that pass LLM evaluation
 *
 * This approach optimizes API costs by:
 * - Skipping low-scoring candidates entirely
 * - Running high-scoring evaluations in parallel for speed
 * - Using strict filtering to minimize false positives
 *
 * @param runner - Agent runner capable of executing LLM prompts
 * @param context - Search context describing what we're looking for
 * @param insights - Array of insights to grade
 * @param options - Grading configuration options
 * @returns Filtered array containing only LLM-approved insights
 *
 * @example
 * ```typescript
 * const allInsights = await searchReveries("authentication bug", repo);
 * const approved = await gradeReveriesInParallel(
 *   runner,
 *   "Fix authentication token validation",
 *   allInsights,
 *   { minRelevanceForGrading: 0.75, parallel: true }
 * );
 *
 * console.log(`${approved.length}/${allInsights.length} insights approved`);
 * ```
 */
declare function gradeReveriesInParallel(runner: AgentRunner, context: string, insights: ReverieInsight$1[], options?: GradingOptions): Promise<ReverieInsight$1[]>;

/**
 * Complete Reverie Pipeline
 *
 * Orchestrates the full reverie search and filtering process:
 * 1. Search with 3x candidates for aggressive filtering headroom
 * 2. Basic quality filter (remove boilerplate and system prompts)
 * 3. Split by relevance threshold (high vs low scoring)
 * 4. LLM grade high-scoring candidates only (cost optimization)
 * 5. Deduplicate results (keep highest relevance)
 * 6. Log statistics at every stage (transparent operation)
 *
 * This pipeline matches diff-agent's sophistication while being fully generic
 * and reusable across different contexts.
 */

/**
 * Result from the complete reverie pipeline.
 */
interface ReveriePipelineResult {
    /** Final filtered and graded insights */
    insights: ReverieInsight$1[];
    /** Statistics from each pipeline stage */
    stats: ReverieFilterStats;
}
/**
 * Applies the complete reverie pipeline with all sophisticated features from diff-agent.
 *
 * Pipeline stages:
 * 1. **Search** - Fetch 3x candidates with optional reranking
 * 2. **Quality Filter** - Remove system prompts, boilerplate, JSON objects
 * 3. **Score Split** - Separate high-scoring (≥0.7) from low-scoring candidates
 * 4. **LLM Grading** - Grade only high-scoring candidates (cost optimization)
 * 5. **Deduplication** - Remove similar excerpts, keeping highest relevance
 * 6. **Logging** - Transparent statistics at each stage
 *
 * Key optimizations:
 * - 3x candidate multiplier provides headroom for aggressive filtering
 * - LLM grading only applied to high-scoring candidates (≥0.7)
 * - Parallel grading for performance
 * - Deduplication preserves highest-relevance duplicates
 * - Comprehensive logging for debugging and monitoring
 *
 * @param codexHome - Path to .codex directory containing conversation data
 * @param searchText - Search query describing what to look for
 * @param repo - Repository root path for filtering conversations
 * @param runner - Agent runner for LLM-based relevance grading (required unless skipLLMGrading is true)
 * @param options - Pipeline configuration options
 * @returns Pipeline result with filtered insights and statistics
 *
 * @example
 * ```typescript
 * // Full pipeline with LLM grading
 * const result = await applyReveriePipeline(
 *   "/Users/me/.codex",
 *   "authentication bug with JWT tokens",
 *   "/Users/me/my-project",
 *   runner,
 *   {
 *     limit: 6,
 *     useReranker: true,
 *     minRelevanceForGrading: 0.7
 *   }
 * );
 *
 * console.log(`Found ${result.insights.length} relevant insights`);
 * console.log(`Filtered: ${result.stats.total} → ${result.stats.final}`);
 *
 * // Without LLM grading (faster, lower quality)
 * const fastResult = await applyReveriePipeline(
 *   codexHome,
 *   query,
 *   repo,
 *   null,
 *   { skipLLMGrading: true }
 * );
 * ```
 */
declare function applyReveriePipeline(codexHome: string, searchText: string, repo: string, runner: AgentRunner | null, options?: ReveriePipelineOptions): Promise<ReveriePipelineResult>;
/**
 * Simplified pipeline for file-specific searches.
 *
 * Similar to main pipeline but optimized for individual file contexts:
 * - Uses fewer candidates (maxCandidates / 2)
 * - Same filtering and grading logic
 * - Transparent logging
 *
 * @param codexHome - Path to .codex directory
 * @param filePath - File path being analyzed
 * @param fileContext - Contextual information about the file (symbols, changes, etc.)
 * @param repo - Repository root path
 * @param runner - Agent runner for LLM grading
 * @param options - Pipeline options
 * @returns Pipeline result with file-specific insights
 *
 * @example
 * ```typescript
 * const fileInsights = await applyFileReveriePipeline(
 *   codexHome,
 *   "src/auth/jwt.ts",
 *   "File: src/auth/jwt.ts\nImplementing: validateToken, generateToken",
 *   repo,
 *   runner,
 *   { limit: 3 }
 * );
 * ```
 */
declare function applyFileReveriePipeline(codexHome: string, filePath: string, fileContext: string, repo: string, runner: AgentRunner | null, options?: ReveriePipelineOptions): Promise<ReveriePipelineResult>;
/**
 * Multi-level reverie search pipeline.
 *
 * Executes searches at multiple levels (project, branch, file) and returns
 * results organized by level. This enables comprehensive context gathering
 * from different scopes in a single operation.
 *
 * @param codexHome - Path to .codex directory
 * @param contexts - Array of search contexts at different levels
 * @param runner - Agent runner for LLM grading (optional if skipLLMGrading is true)
 * @param options - Pipeline options
 * @returns Map of search level to pipeline results
 *
 * @example
 * ```typescript
 * import { buildProjectContext, buildBranchContext, buildFileContext } from './context.js';
 *
 * const contexts = [
 *   buildProjectContext("Testing conventions in this codebase"),
 *   buildBranchContext("feat/auth", ["src/auth.ts", "src/login.ts"]),
 *   buildFileContext("src/auth.ts", { extractSymbols: true })
 * ];
 *
 * const results = await searchMultiLevel(codexHome, contexts, runner, {
 *   limit: 5,
 *   useReranker: true
 * });
 *
 * // Access results by level
 * const projectInsights = results.get('project')?.insights || [];
 * const branchInsights = results.get('branch')?.insights || [];
 * const fileInsights = results.get('file')?.insights || [];
 * ```
 */
declare function searchMultiLevel(codexHome: string, contexts: ReverieContext[], runner: AgentRunner | null, options?: ReveriePipelineOptions): Promise<Map<ReverieSearchLevel, ReveriePipelineResult>>;
/**
 * Search at project level for repository-wide patterns.
 *
 * Optimized for broad searches across the entire codebase to find
 * architectural decisions, common practices, and project conventions.
 *
 * @param codexHome - Path to .codex directory
 * @param context - Project-level search context
 * @param runner - Agent runner for LLM grading
 * @param options - Pipeline options
 * @returns Pipeline result with project-wide insights
 *
 * @example
 * ```typescript
 * const context = buildProjectContext(
 *   "How we handle database migrations",
 *   { repoPath: "/Users/me/my-project" }
 * );
 *
 * const result = await searchProjectLevel(codexHome, context, runner, {
 *   limit: 8,
 *   useReranker: true
 * });
 *
 * console.log(`Found ${result.insights.length} project-wide insights`);
 * ```
 */
declare function searchProjectLevel(codexHome: string, context: ProjectLevelContext, runner: AgentRunner | null, options?: ReveriePipelineOptions): Promise<ReveriePipelineResult>;
/**
 * Search at branch level for feature-specific context.
 *
 * Optimized for understanding work done in a specific branch,
 * including intent, changed files, and commit history.
 *
 * @param codexHome - Path to .codex directory
 * @param context - Branch-level search context
 * @param runner - Agent runner for LLM grading
 * @param options - Pipeline options
 * @returns Pipeline result with branch-specific insights
 *
 * @example
 * ```typescript
 * const context = buildBranchContext(
 *   "feat/oauth2",
 *   ["src/auth.ts", "src/login.ts"],
 *   {
 *     baseBranch: "main",
 *     recentCommits: "Add OAuth2 support\nImplement token refresh"
 *   }
 * );
 *
 * const result = await searchBranchLevel(codexHome, context, runner, {
 *   limit: 6
 * });
 *
 * console.log(`Found ${result.insights.length} branch insights`);
 * ```
 */
declare function searchBranchLevel(codexHome: string, context: BranchLevelContext, runner: AgentRunner | null, options?: ReveriePipelineOptions): Promise<ReveriePipelineResult>;
/**
 * Search at file level for specific file changes.
 *
 * Optimized for focused searches on individual file modifications,
 * using extracted symbols for better targeting.
 *
 * @param codexHome - Path to .codex directory
 * @param context - File-level search context
 * @param runner - Agent runner for LLM grading
 * @param options - Pipeline options
 * @returns Pipeline result with file-specific insights
 *
 * @example
 * ```typescript
 * const context = buildFileContext(
 *   "src/auth/jwt.ts",
 *   {
 *     diff: "+function validateToken(...)\n+function refreshToken(...)",
 *     extractSymbols: true
 *   }
 * );
 *
 * const result = await searchFileLevel(codexHome, context, runner, {
 *   limit: 3
 * });
 *
 * console.log(`Found ${result.insights.length} file-specific insights`);
 * ```
 */
declare function searchFileLevel(codexHome: string, context: FileLevelContext, runner: AgentRunner | null, options?: ReveriePipelineOptions): Promise<ReveriePipelineResult>;

/**
 * Reverie logging utilities.
 * Provides transparent logging for reverie search and filtering operations.
 */

/**
 * Logs reverie search operation details.
 *
 * @param query - The search query
 * @param context - Optional context about the search
 */
declare function logReverieSearch(query: string, context?: string): void;
/**
 * Logs reverie filtering pipeline statistics.
 *
 * @param stats - Filtering statistics
 */
declare function logReverieFiltering(stats: {
    total: number;
    afterQuality: number;
    afterBoilerplate?: number;
    afterScore: number;
    afterDedup: number;
    minScore?: number;
}): void;
/**
 * Logs top reverie insights for debugging.
 *
 * @param insights - Filtered reverie insights
 * @param limit - Maximum number of insights to log (default: 3)
 */
declare function logReverieInsights(insights: ReverieResult[], limit?: number): void;
/**
 * Logs quality filtering statistics for hint collection.
 *
 * @param stats - Hint collection statistics
 */
declare function logReverieHintQuality(stats: {
    totalRaw: number;
    afterQuality: number;
    afterDedup: number;
}): void;
/**
 * Logs LLM grading statistics showing approved vs rejected counts.
 *
 * @param stats - LLM grading statistics
 */
declare function logLLMGrading(stats: {
    total: number;
    approved: number;
    rejected: number;
    minScore?: number;
}): void;
/**
 * Logs approved reverie excerpts with relevance scores (verbose mode).
 *
 * @param insights - Approved reverie insights to log
 * @param maxToShow - Maximum number of insights to display (default: 5)
 */
declare function logApprovedReveries(insights: ReverieResult[], maxToShow?: number): void;
/**
 * Truncates a string to a maximum length, adding ellipsis if needed.
 */
declare function truncate(text: string, maxLength: number): string;

/**
 * Logs multi-level search initiation.
 *
 * @param levels - Array of search levels being executed
 *
 * @example
 * ```typescript
 * logMultiLevelSearch(['project', 'branch', 'file']);
 * // Output: "🔍 Multi-level reverie search: project → branch → file"
 * ```
 */
declare function logMultiLevelSearch(levels: ReverieSearchLevel[]): void;
/**
 * Logs results for a specific search level.
 *
 * @param level - The search level
 * @param result - Pipeline result for this level
 *
 * @example
 * ```typescript
 * logLevelResults('project', {
 *   insights: [...],
 *   stats: { total: 50, final: 8, ... }
 * });
 * // Output: "  🌐 Project level: 8 insights (50 → 8, 84% filtered)"
 * ```
 */
declare function logLevelResults(level: ReverieSearchLevel, result: ReveriePipelineResult): void;
/**
 * Logs a summary of multi-level search results.
 *
 * @param results - Map of level to pipeline results
 *
 * @example
 * ```typescript
 * const results = new Map([
 *   ['project', { insights: [...], stats: {...} }],
 *   ['branch', { insights: [...], stats: {...} }],
 *   ['file', { insights: [...], stats: {...} }]
 * ]);
 *
 * logMultiLevelSummary(results);
 * // Output summary of all levels with total counts
 * ```
 */
declare function logMultiLevelSummary(results: Map<ReverieSearchLevel, ReveriePipelineResult>): void;

/**
 * Symbol Extraction for Reverie Search
 *
 * Extracts key code symbols from diffs to create more focused search queries.
 * This improves search precision by targeting specific functions, classes, and variables.
 */
/**
 * Extracts key symbols and terms from a diff to make search queries more targeted.
 *
 * Focuses on:
 * - Function and class definitions
 * - Variable declarations (const, let, var)
 * - Exported symbols
 * - Interface and type definitions
 *
 * Avoids:
 * - Language keywords (true, false, null, etc.)
 * - Very short symbols (< 3 chars)
 * - Boilerplate patterns
 *
 * @param diff - Git diff content to extract symbols from
 * @returns Comma-separated string of top 5 symbols, or "code changes" if none found
 *
 * @example
 * ```typescript
 * const diff = `
 * +function processUser(user: User) {
 * +  const userName = user.name;
 * +  return userName;
 * +}
 * `;
 *
 * extractKeySymbols(diff); // "processUser, userName"
 * ```
 */
declare function extractKeySymbols(diff: string): string;

/**
 * Advanced Reverie Search
 *
 * Provides semantic search over past conversation history with sophisticated filtering:
 * - 3x candidate multiplier for aggressive filtering
 * - Reranker support for improved precision
 * - Multi-stage filtering with transparent logging
 * - Quality and deduplication pipelines
 */

/**
 * Performs advanced semantic search over reverie conversation history.
 *
 * Search pipeline:
 * 1. Fetch 3x candidates (candidateMultiplier × limit)
 * 2. Apply quality filtering (remove boilerplate, system prompts)
 * 3. Deduplicate similar excerpts (keep highest relevance)
 * 4. Apply reranker if enabled (improve precision)
 * 5. Return top N results
 *
 * Key features:
 * - Aggressive candidate fetching for better filtering headroom
 * - Optional reranker support for precision improvement
 * - Quality filtering removes system prompts and boilerplate
 * - Deduplication preserves highest-relevance duplicates
 * - Transparent logging at each stage
 *
 * @param codexHome - Path to .codex directory containing conversation data
 * @param text - Search query text
 * @param repo - Repository root path for filtering conversations
 * @param options - Search configuration options
 * @returns Array of relevant reverie insights, sorted by relevance
 *
 * @example
 * ```typescript
 * const insights = await searchReveries(
 *   "/Users/me/.codex",
 *   "authentication bug with JWT tokens",
 *   "/Users/me/my-project",
 *   {
 *     limit: 6,
 *     useReranker: true,
 *     candidateMultiplier: 3
 *   }
 * );
 *
 * console.log(`Found ${insights.length} relevant insights`);
 * insights.forEach(insight => {
 *   console.log(`[${insight.relevance.toFixed(2)}] ${insight.excerpt.slice(0, 100)}`);
 * });
 * ```
 */
declare function searchReveries(codexHome: string, text: string, repo: string, options?: ReverieSearchOptions): Promise<ReverieInsight$1[]>;

/**
 * Reverie Context Builders
 *
 * Utilities for building search contexts at different levels:
 * - Project level: Repository-wide patterns and architecture
 * - Branch level: Feature/branch-specific work and intent
 * - File level: Individual file changes and symbols
 */

/**
 * Builds project-level search context for repository-wide patterns.
 *
 * Use this for searching architectural decisions, common practices,
 * and project-wide patterns across the entire codebase.
 *
 * @param query - Natural language query describing what to find
 * @param options - Optional configuration
 * @returns Project-level context ready for search
 *
 * @example
 * ```typescript
 * const context = buildProjectContext(
 *   "How we handle database migrations in this repository",
 *   { repoPath: "/Users/me/my-project" }
 * );
 *
 * const results = await searchProjectLevel(codexHome, context, runner);
 * ```
 */
declare function buildProjectContext(query: string, options?: {
    repoPath?: string;
    filePatterns?: string[];
}): ProjectLevelContext;
/**
 * Builds branch-level search context for feature/branch-specific work.
 *
 * Use this for understanding branch intent, feature context, and changes
 * made across multiple files in a feature branch.
 *
 * @param branch - Current branch name
 * @param changedFiles - List of files modified in this branch
 * @param options - Optional configuration
 * @returns Branch-level context ready for search
 *
 * @example
 * ```typescript
 * const context = buildBranchContext(
 *   "feat/oauth2",
 *   ["src/auth.ts", "src/login.ts", "test/auth.test.ts"],
 *   {
 *     baseBranch: "main",
 *     recentCommits: "Add OAuth2 support\nImplement token refresh",
 *     repoPath: "/Users/me/my-project"
 *   }
 * );
 *
 * const results = await searchBranchLevel(codexHome, context, runner);
 * ```
 */
declare function buildBranchContext(branch: string, changedFiles: string[], options?: {
    baseBranch?: string;
    recentCommits?: string;
    repoPath?: string;
}): BranchLevelContext;
/**
 * Builds file-level search context for individual file changes.
 *
 * Use this for focused searches on specific file modifications,
 * with optional symbol extraction for better targeting.
 *
 * @param filePath - Path to the file being analyzed
 * @param options - Optional configuration
 * @returns File-level context ready for search
 *
 * @example
 * ```typescript
 * // Without symbol extraction
 * const context = buildFileContext(
 *   "src/auth/jwt.ts",
 *   {
 *     diff: "... git diff content ...",
 *     repoPath: "/Users/me/my-project"
 *   }
 * );
 *
 * // With automatic symbol extraction
 * const context = buildFileContext(
 *   "src/auth/jwt.ts",
 *   {
 *     diff: "+function validateToken(...)\n+function refreshToken(...)",
 *     extractSymbols: true,
 *     repoPath: "/Users/me/my-project"
 *   }
 * );
 * // context.symbols will be: ["validateToken", "refreshToken"]
 *
 * const results = await searchFileLevel(codexHome, context, runner);
 * ```
 */
declare function buildFileContext(filePath: string, options?: {
    diff?: string;
    extractSymbols?: boolean;
    repoPath?: string;
}): FileLevelContext;
/**
 * Converts a ReverieContext to a search query string.
 *
 * Transforms structured context objects into natural language queries
 * suitable for semantic search.
 *
 * @param context - Any level of reverie context
 * @returns Formatted search query string
 *
 * @example
 * ```typescript
 * const projectCtx = buildProjectContext("Authentication patterns");
 * const query = contextToQuery(projectCtx);
 * // Returns: "Project-wide: Authentication patterns"
 *
 * const branchCtx = buildBranchContext("feat/auth", ["auth.ts", "login.ts"]);
 * const query = contextToQuery(branchCtx);
 * // Returns: "Branch: feat/auth\nFiles: auth.ts, login.ts"
 *
 * const fileCtx = buildFileContext("auth.ts", {
 *   symbols: ["validateToken", "refreshToken"]
 * });
 * const query = contextToQuery(fileCtx);
 * // Returns: "File: auth.ts\nSymbols: validateToken, refreshToken"
 * ```
 */
declare function contextToQuery(context: ReverieContext): string;
/**
 * Helper to format file paths for display in contexts.
 *
 * @param files - Array of file paths
 * @param maxFiles - Maximum number of files to show before truncating
 * @returns Formatted file list string
 */
declare function formatFileList(files: string[], maxFiles?: number): string;

declare function evCompleted(id: string): string;
declare function evResponseCreated(id: string): string;
declare function evAssistantMessage(id: string, text: string): string;
declare function evFunctionCall(callId: string, name: string, args: string): string;
declare function sse(events: string[]): string;

export { type AgentMessageItem, type AgentRunner, type ApprovalMode, type ApprovalRequest, type BranchLevelContext, type BranchReview, type CloudApplyOutcome, type CloudApplyStatus, type DiffSummary as CloudDiffSummary, type CloudTaskStatus, type CloudTaskSummary, CloudTasks, type CloudTasksOptions, Codex, type CodexOptions, CodexProvider, type CodexProviderOptions, type CodexToolOptions, type CommandExecutionItem, type CommandExecutionStatus, type CommitReview, type ConversationListOptions, type ConversationListPage, type ConversationSummary, type CurrentChangesReview, type CustomReview, DEFAULT_RERANKER_BATCH_SIZE, DEFAULT_RERANKER_TOP_K, DEFAULT_REVERIE_LIMIT, DEFAULT_REVERIE_MAX_CANDIDATES, DEFAULT_SERVERS, type DelegationResult, type ErrorItem, type FastEmbedEmbedRequest, type FastEmbedInitOptions, type FastEmbedRerankerModelCode, type FileChangeItem, type FileDiagnostics, type FileLevelContext, type FileUpdateChange, type ForkOptions, type FormatStreamOptions, type FormattedStream, type GradingOptions, type Input, type ItemCompletedEvent, type ItemStartedEvent, type ItemUpdatedEvent, type LogEntry, LogLevel, type LogOutput, type LogScope, Logger, type LoggerConfig, type LspDiagnosticSeverity, LspDiagnosticsBridge, LspManager, type LspManagerOptions, type LspServerConfig, type McpToolCallItem, type McpToolCallStatus, type NativeForkResult, type NativeTokenUsage, type NativeToolDefinition, type NativeToolInterceptorContext, type NativeToolInvocation, type NativeToolResult, type NativeTuiExitInfo, type NativeTuiRequest, type NativeUpdateActionInfo, type NativeUpdateActionKind, type NormalizedDiagnostic, OpenCodeAgent, type OpenCodeAgentOptions, type PatchApplyStatus, type PatchChangeKind, type PermissionDecision, type PermissionRequest, type ProjectLevelContext, type QualityFilterStats, REVERIE_CANDIDATE_MULTIPLIER, REVERIE_EMBED_MODEL, REVERIE_LLM_GRADE_THRESHOLD, REVERIE_RERANKER_MODEL, type ReasoningItem, type RepoDiffFileChange, type RepoDiffSummary, type RepoDiffSummaryOptions, type ReverieContext, type ReverieEpisodeSummary, type ReverieFilterStats, type ReverieInsight$1 as ReverieInsight, type ReveriePipelineOptions, type ReveriePipelineResult, type ReverieResult, type ReverieSearchLevel, type ReverieSearchOptions, type ReverieSemanticIndexStats, type ReverieSemanticSearchOptions, type ReviewInvocationOptions, type ReviewTarget, type RunResult, type RunStreamedResult, type RunTuiOptions, type SandboxMode, ScopedLogger, Thread, type ThreadError, type ThreadErrorEvent, type ThreadEvent, type ThreadItem, type ThreadLoggingSink, type ThreadOptions, type ThreadStartedEvent, type TodoItem, type TodoListItem, type TokenizerEncodeOptions, type TokenizerOptions, type ToolCallEvent, type TuiSession, type TurnCompletedEvent, type TurnFailedEvent, type TurnOptions, type TurnStartedEvent, type Usage, type UserInput, type WebSearchItem, type WorkspaceLocator, applyFileReveriePipeline, applyQualityPipeline, applyReveriePipeline, attachLspDiagnostics, buildBranchContext, buildFileContext, buildProjectContext, codexTool, collectRepoDiffSummary, contextToQuery, createThreadLogger, deduplicateReverieInsights, encodeToToon, evAssistantMessage, evCompleted, evFunctionCall, evResponseCreated, extractKeySymbols, fastEmbedEmbed, fastEmbedInit, findServerForFile, formatFileList, formatStream, gradeReverieRelevance, gradeReveriesInParallel, isValidReverieExcerpt, logApprovedReveries, logLLMGrading, logLevelResults, logMultiLevelSearch, logMultiLevelSummary, logReverieFiltering, logReverieHintQuality, logReverieInsights, logReverieSearch, logger, resolveWorkspaceRoot, reverieGetConversationInsights, reverieIndexSemantic, reverieListConversations, reverieSearchConversations, reverieSearchSemantic, runThreadTurnWithLogs, runTui, searchBranchLevel, searchFileLevel, searchMultiLevel, searchProjectLevel, searchReveries, sse, startTui, tokenizerCount, tokenizerDecode, tokenizerEncode, truncate as truncateText };
