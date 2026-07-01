/// <reference types="vite/client" />

type FiitxModelPayload = {
  id?: string;
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  contextWindow?: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsJsonMode: boolean;
  inputModalities?: string[];
  outputModalities?: string[];
  capabilities?: {
    chat?: boolean;
    tools?: boolean;
    streaming?: boolean;
    jsonMode?: boolean;
    imageInput?: boolean;
    imageGeneration?: boolean;
    videoGeneration?: boolean;
    audioGeneration?: boolean;
  };
  bestFor: string[];
  toolCallStyle: string;
  inputCostPer1M?: number;
  outputCostPer1M?: number;
  expectedLatencyMs?: number;
  priority?: number;
  createdAt?: string;
};

type FiitxModelProfile = Omit<FiitxModelPayload, "apiKey"> & {
  id: string;
  apiKeyRef: string;
  hasApiKey?: boolean;
  hasStoredApiKey?: boolean;
  keyStatus?: "available" | "locked" | "missing";
  routeScore?: number;
  routeReasons?: string[];
  routeStats?: {
    successCount: number;
    failureCount: number;
    consecutiveFailures: number;
    totalLatencyMs: number;
    lastLatencyMs: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    estimatedCostUsd: number;
    lastSuccessAt: string;
    lastFailureAt: string;
    lastError: string;
    circuitOpenUntil: number;
    successRate: number | null;
    averageLatencyMs: number;
    circuitOpen: boolean;
  };
  updatedAt: string;
};

type FiitxFileArtifact = {
  path: string;
  title: string;
  language: string;
  status: "modified" | "added";
  additions: number;
  deletions: number;
  preview: string;
};

type FiitxAgentToolEvent = {
  actor: string;
  event: string;
  target: string;
  level: "info" | "success" | "warn";
};

type FiitxApprovalRequest = {
  id: string;
  title: string;
  detail: string;
  command: string;
  requester: string;
  risk: "low" | "medium" | "high";
  action: string;
};

type FiitxRuntimeAgentStage = {
  name: string;
  owner: string;
  trigger: string;
  action: string;
  output: string;
};

type FiitxRuntimeAgentSpec = {
  id: string;
  name: string;
  scope: string;
  objective?: string;
  systemPrompt?: string;
  model?: string;
  status?: "ready" | "active" | "draft";
  tools?: string[];
  skills?: string[];
  triggers?: string[];
  systems?: string[];
  stages?: FiitxRuntimeAgentStage[];
  metrics?: string[];
  channels?: string[];
  policy?: "ask" | "auto" | "full";
};

type FiitxChannelContext = {
  channelId?: string;
  conversationId?: string;
  messageId?: string;
  senderId?: string;
  senderName?: string;
  tenantId?: string;
  appId?: string;
  pagePath?: string;
  scene?: string;
  eventType?: string;
  replyStyle?: string;
  metadata?: Record<string, string | number | boolean>;
};

type FiitxChannelAdapterSpec = {
  id: string;
  name: string;
  channelType: "desktop-ui" | "wechat-miniprogram-ai" | "vscode-extension";
  description?: string;
  transport?: string;
  entrypoint?: string;
  sessionKeyStrategy?: string;
  status?: "active" | "ready" | "draft";
  capabilities?: string[];
  contextSources?: string[];
  outputModes?: string[];
  followUpPolicy?: string;
  agentBindings?: string[];
  systemPrompt?: string;
  sampleEvent?: string;
};

type FiitxRuntimeChannel = FiitxChannelAdapterSpec & {
  runtimeStatus?: "running" | "available" | "blocked" | "stopped" | string;
  configured?: boolean;
  endpoints?: string[];
  requirements?: string[];
  warnings?: string[];
  docs?: string[];
  packageStatus?: unknown;
  configuredAdapter?: FiitxChannelAdapterSpec | null;
  binding?: FiitxWechatBindStatus;
};

type FiitxAgentTaskPayload = {
  taskId: string;
  prompt: string;
  workspacePath: string;
  model: string;
  permissionMode: "ask" | "auto" | "full";
  policySettings?: {
    toolExecution?: "sequential" | "parallel";
    sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
    defaultPermissionMode?: "ask" | "auto" | "full";
    actionModes?: Record<string, "ask" | "auto" | "full" | "block">;
  };
  attachments: string[];
  threadId: string;
  currentDate?: string;
  timeZone?: string;
  wechatSkillRoot?: string;
  wechatSkillsRoot?: string;
  channelId?: string;
  channelContext?: FiitxChannelContext;
  agentRegistry?: FiitxRuntimeAgentSpec[];
  channelRegistry?: FiitxChannelAdapterSpec[];
  contextMessages?: Array<{
    role: "user" | "assistant";
    content: string;
    time?: string;
  }>;
  threadContext?: {
    activeThread?: {
      id: string;
      title: string;
      kind: string;
      status: string;
      workspacePath?: string;
    };
    selectedProjectFolder?: {
      id: string;
      name: string;
      path?: string;
    } | null;
    currentTarget?: FiitxFileArtifact | null;
    selectedFile?: FiitxFileArtifact | null;
    lastArtifact?: FiitxFileArtifact | null;
    artifacts?: FiitxFileArtifact[];
    executionArtifacts?: FiitxFileArtifact[];
    recentMessages?: Array<{
      role: "user" | "assistant";
      author?: string;
      content: string;
      time?: string;
    }>;
  };
};

type FiitxAgentTaskResult = {
  ok: boolean;
  summary: string;
  mode?: "chat" | "coding";
  model?: string;
  provider?: string;
  title?: string;
  agentId?: string;
  agentName?: string;
  channelId?: string;
  channelName?: string;
  artifact: FiitxFileArtifact | null;
  toolEvents: FiitxAgentToolEvent[];
  approvalRequests?: FiitxApprovalRequest[];
};

type FiitxAgentSessionCommand = {
  threadId: string;
  taskId?: string;
  text?: string;
  prompt?: string;
  instructions?: string;
  approvalId?: string;
  approved?: boolean;
  permissionMode?: "ask" | "auto" | "full";
};

type FiitxAgentSessionResult = {
  ok: boolean;
  message?: string;
  queued?: boolean;
  aborted?: boolean;
  summary?: string;
  errorMessage?: string;
  messageCount?: number;
  mode?: "chat" | "coding";
  model?: string;
  provider?: string;
  title?: string;
  agentId?: string;
  agentName?: string;
  channelId?: string;
  channelName?: string;
  artifact?: FiitxFileArtifact | null;
  toolEvents?: FiitxAgentToolEvent[];
  approvalRequests?: FiitxApprovalRequest[];
};

type FiitxAgentRouteInspection = {
  prompt: string;
  channelAdapter: unknown;
  intent: {
    mode: "chat" | "coding";
    modality: string;
    taskKind?: string;
    confidence?: number;
    reason?: string;
    requiresExternalContext?: boolean;
    externalUrls?: string[];
  };
  selectedAgent: null | {
    id: string;
    name: string;
    policy?: string;
    score?: number;
    reason?: string;
  };
  agentCandidates: Array<{
    id: string;
    name: string;
    score: number;
    matched: string[];
  }>;
  selectedModel: unknown;
  modelCandidates: unknown[];
  toolPlan: string[];
  policyPlan: unknown[];
  contextPlan: unknown;
  deepseekHarnessChecks: string[];
};

type FiitxAgentEvalResult = {
  ok: boolean;
  passed: number;
  total: number;
  results: Array<{
    id: string;
    prompt: string;
    ok: boolean;
    route: FiitxAgentRouteInspection;
  }>;
};

type FiitxAgentHarnessSnapshot = {
  tools: unknown[];
  toolCount: number;
  skills: unknown[];
  skillMarketplace?: unknown[];
  connectors: unknown[];
  mcp?: FiitxMcpSnapshot | null;
  telemetry: unknown;
  sessions: unknown[];
  models: unknown[];
};

type FiitxAgentHistoryThread = {
  id: string;
  title: string;
  kind: string;
  status: string;
  model: string;
  updatedAt: string;
  createdAt: number;
  workspacePath?: string;
  messageCount: number;
  progressCount: number;
  artifactCount: number;
  sessionEntryCount: number;
  lastProgressStatus?: string;
  lastProgressTitle?: string;
};

type FiitxAgentVersionSnapshot = {
  id: string;
  type: string;
  name: string;
  version: string;
  updatedAt: string;
  observedAt?: string;
  body: string;
  metadata: Record<string, unknown>;
};

type FiitxAgentTraceTimelineItem = {
  id: string;
  time: string;
  source: string;
  status: "running" | "success" | "warn" | "info" | string;
  title: string;
  detail: string;
  raw?: unknown;
};

type FiitxAgentTrace = {
  threadId: string;
  generatedAt: string;
  thread: unknown;
  record: {
    messages?: unknown[];
    progressEvents?: unknown[];
    artifacts?: unknown[];
    executionArtifacts?: unknown[];
    sessionEntries?: unknown[];
  };
  sessionLog: unknown[];
  telemetry: unknown[];
  timeline: FiitxAgentTraceTimelineItem[];
  toolNames: string[];
  promptVersions: FiitxAgentVersionSnapshot[];
  policyVersions: FiitxAgentVersionSnapshot[];
  analysis: {
    status: "complete" | "needs-review" | string;
    headline: string;
    findings: string[];
    nextActions: string[];
    metrics: Record<string, number>;
  };
};

type FiitxAgentHistorySnapshot = {
  generatedAt: string;
  workspacePath: string;
  activeThreadId: string;
  threads: FiitxAgentHistoryThread[];
  sessions: unknown[];
  telemetrySummary: unknown;
  recentRuns: Array<{
    runId: string;
    threadId: string;
    taskId: string;
    ok: boolean;
    mode: string;
    provider: string;
    model: string;
    startedAt: string;
    endedAt: string;
    durationMs: number;
    artifactPath: string;
    errorMessage: string;
  }>;
  failedRuns: number;
  promptVersions: FiitxAgentVersionSnapshot[];
  policyVersions: FiitxAgentVersionSnapshot[];
};

type FiitxRunCompare = {
  generatedAt: string;
  left: FiitxAgentTrace;
  right: FiitxAgentTrace;
  diff: {
    summary: string[];
    metrics: Array<{
      key: string;
      left: number;
      right: number;
      delta: number;
    }>;
    tools: {
      leftOnly: string[];
      rightOnly: string[];
      shared: string[];
    };
    artifacts: {
      leftOnly: string[];
      rightOnly: string[];
      shared: string[];
    };
    failures: {
      left: string[];
      right: string[];
    };
  };
};

type FiitxAuditPackageExport = {
  ok: boolean;
  path: string;
  files: string[];
  generatedAt: string;
};

type FiitxAgentProgress = {
  id: string;
  taskId: string;
  threadId?: string;
  threadTitle?: string;
  threadKind?: string;
  threadModel?: string;
  threadWorkspacePath?: string;
  cronJobId?: string;
  cronSource?: string;
  title: string;
  detail: string;
  status: "running" | "success" | "warn" | "info" | "finished" | "error";
  time: string;
};

type FiitxThreadState = {
  version?: number;
  activeThreadId?: string;
  workspacePath?: string;
  autoModelRouting?: boolean;
  threads?: Array<{
    id: string;
    title: string;
    kind: string;
    model: string;
    status: "running" | "waiting" | "done";
    updatedAt: string;
    createdAt: number;
  }>;
  projectFolders?: Array<{
    id: string;
    name: string;
    path?: string;
    threads: string[];
  }>;
  rootThreadIds?: string[];
  threadRecords?: Record<string, unknown>;
  agentSpecs?: unknown[];
  selectedAgentId?: string;
  channelAdapters?: unknown[];
  selectedChannelAdapterId?: string;
  activeChannelAdapterId?: string;
  approvals?: unknown[];
  auditLogs?: unknown[];
  policySettings?: {
    toolExecution?: "sequential" | "parallel";
    sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
    defaultPermissionMode?: "ask" | "auto" | "full";
    actionModes?: Record<string, "ask" | "auto" | "full" | "block">;
  };
};

type FiitxPathInfo = {
  exists: boolean;
  path: string;
  name: string;
  kind: "file" | "directory" | "other" | "missing";
  size?: number;
  extension?: string;
  previewable?: boolean;
  resolvedFromWorkspace?: boolean;
};

type FiitxPathPreview = FiitxPathInfo & {
  content: string;
  truncated: boolean;
};

type FiitxWorkspaceFile = {
  path: string;
  size: number;
  text: boolean;
};

type FiitxWorkspaceFileList = {
  root: string;
  files: FiitxWorkspaceFile[];
  truncated: boolean;
};

type FiitxWorkspaceFileRead = {
  root: string;
  path: string;
  content: string;
  truncated: boolean;
};

type FiitxWorkspaceDiffBase = {
  ok: boolean;
  root: string;
  path: string;
  source: "git-head" | "git-missing" | "none";
  content: string;
  repoRelativePath?: string;
  message?: string;
};

type FiitxWorkspaceFileWrite = {
  root: string;
  path: string;
  bytes: number;
};

type FiitxWechatAiGatewayPayload = {
  prompt: string;
  sessionId?: string;
  skillRoot?: string;
  skillsRoot?: string;
  channelContext?: FiitxChannelContext;
};

type FiitxWechatAiSkillInvokePayload = {
  skillRoot?: string;
  sessionId?: string;
  apiName: string;
  arguments?: Record<string, unknown>;
};

type FiitxMcpServerConfig = {
  id: string;
  name?: string;
  type?: "stdio" | "sse" | "streamable-http";
  enabled?: boolean;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  risk?: "low" | "medium" | "high";
  timeoutMs?: number;
  description?: string;
};

type FiitxMcpConfig = {
  version?: number;
  path?: string;
  mcpServers: Record<string, FiitxMcpServerConfig>;
};

type FiitxMcpSnapshot = {
  servers: unknown[];
  tools: unknown[];
  resources: unknown[];
  resourceTemplates?: unknown[];
  prompts: unknown[];
  errors?: unknown[];
};

type FiitxSkillInstallPayload = {
  root: string;
  id?: string;
  enabled?: boolean;
};

type FiitxWechatChannelStatus = {
  running: boolean;
  host: string;
  port: number;
  baseUrl: string;
  lanBaseUrl?: string;
  messageEndpoint: string;
  actionEndpoint?: string;
  healthEndpoint: string;
  deliveryEndpoint?: string;
  bindStartEndpoint?: string;
  bindStatusEndpoint?: string;
  bindConfirmEndpoint?: string;
  binding?: FiitxWechatBindStatus;
};

type FiitxWechatBindStatus = {
  ok: boolean;
  channelId: string;
  bound: boolean;
  status: "idle" | "pending" | "bound" | "expired" | "cancelled" | string;
  localBaseUrl?: string;
  lanBaseUrl?: string;
  binding?: {
    bound: boolean;
    channelId: string;
    accountId?: string;
    displayName?: string;
    openId?: string;
    boundAt?: string;
    lastSeenAt?: string;
    endpoint?: string;
  } | null;
  session?: {
    id: string;
    status: "pending" | "bound" | "expired" | "cancelled" | string;
    createdAt: string;
    expiresAt: string;
    bindUrl: string;
    qrDataUrl: string;
    instructions?: string[];
    binding?: unknown;
  } | null;
};

type FiitxWechatChannelInbound = {
  ok: boolean;
  channel: {
    id: string;
    type: string;
    transport: string;
    sessionKey: string;
  };
  inbound: {
    text: string;
    appId: string;
    openId: string;
    conversationId: string;
    messageId: string;
    tenantId?: string;
    pagePath?: string;
    scene?: string;
    raw?: unknown;
  };
  reply: {
    text: string;
    primaryCard?: unknown;
    cards?: unknown[];
  };
  gateway?: unknown;
  approvalRequests?: FiitxApprovalRequest[];
  approvalResumePayload?: FiitxAgentTaskPayload | null;
  apiCalls?: unknown[];
  toolEvents?: unknown[];
};

type FiitxTerminalCommandPayload = {
  command: string;
  workspacePath?: string;
  timeoutMs?: number;
};

type FiitxTerminalCommandResult = {
  ok: boolean;
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

type FiitxPlatformSnapshot = {
  path?: string;
  daemon?: {
    running?: boolean;
    enabled?: boolean;
    autoStart?: boolean;
    keepChannelsWarm?: boolean;
    startedAt?: string | null;
    uptimeMs?: number;
    cronTickMs?: number;
    events?: unknown[];
  };
  cronJobs?: unknown[];
  learnedSkills?: unknown[];
  profileIsolation?: unknown;
  sessionIndex?: {
    sessionCount?: number;
  };
};

type FiitxCronJobPayload = {
  id?: string;
  name?: string;
  prompt?: string;
  channelId?: string;
  model?: string;
  enabled?: boolean;
  everyMinutes?: number;
  nextRunAt?: string;
  workspacePath?: string;
  permissionMode?: "ask" | "auto" | "full";
};

type FiitxSessionSearchResult = {
  threadId: string;
  title: string;
  updatedAt?: string;
  entryCount?: number;
  score?: number;
  snippet?: string;
};

type FiitxMemoryEntry = {
  id: string;
  dedupeKey?: string;
  kind: string;
  scope: string;
  text: string;
  workspacePath?: string;
  channelId?: string;
  threadId?: string;
  source?: string;
  tags?: string[];
  confidence?: number;
  createdAt?: string;
  updatedAt?: string;
  lastSeenAt?: string;
  lastUsedAt?: string;
  useCount?: number;
  score?: number;
};

type FiitxMemoryProvider = {
  id: string;
  name: string;
  status?: string;
  type?: string;
  description?: string;
};

type FiitxMemorySnapshot = {
  storePath: string;
  memoryPath?: string;
  userProfilePath?: string;
  count: number;
  byKind: Record<string, number>;
  byScope: Record<string, number>;
  latest: FiitxMemoryEntry[];
  layers?: {
    curatedMemory?: {
      enabled?: boolean;
      memoryPath?: string;
      userProfilePath?: string;
      memoryChars?: number;
      memoryLimit?: number;
      userProfileChars?: number;
      userProfileLimit?: number;
    };
    sessionSearch?: {
      enabled?: boolean;
      sessionCount?: number;
      engine?: string;
      storePath?: string;
    };
    provider?: {
      activeProvider?: string;
      providers?: FiitxMemoryProvider[];
    };
  };
};

interface Window {
  fiitx?: {
    getPlatform: () => Promise<{
      platform: string;
      version: string;
      encryptionAvailable: boolean;
      defaultWorkspace?: string;
      locale?: string;
    }>;
    chooseWorkspace: () => Promise<{
      canceled: boolean;
      filePaths: string[];
    }>;
    chooseFiles: () => Promise<{
      canceled: boolean;
      filePaths: string[];
    }>;
    importAttachment: (payload: {
      sourcePath: string;
      workspacePath?: string;
    }) => Promise<{
      ok: boolean;
      path: string;
      absolutePath?: string;
      sourcePath?: string;
      bytes: number;
      imported?: boolean;
      name?: string;
    }>;
    savePastedAttachment: (payload: {
      name: string;
      mimeType?: string;
      buffer: ArrayBuffer;
      workspacePath?: string;
    }) => Promise<{
      ok: boolean;
      path: string;
      absolutePath?: string;
      bytes: number;
      imported?: boolean;
      name?: string;
    }>;
    listWorkspaceFiles: (payload?: {
      workspacePath?: string;
      limit?: number;
    }) => Promise<FiitxWorkspaceFileList>;
    readWorkspaceFile: (payload: {
      workspacePath?: string;
      path: string;
      maxBytes?: number;
    }) => Promise<FiitxWorkspaceFileRead>;
    readWorkspaceDiffBase: (payload: {
      workspacePath?: string;
      path: string;
    }) => Promise<FiitxWorkspaceDiffBase>;
    writeWorkspaceFile: (payload: {
      workspacePath?: string;
      path: string;
      content: string;
    }) => Promise<FiitxWorkspaceFileWrite>;
    inspectPath: (path: string, basePath?: string) => Promise<FiitxPathInfo>;
    openPath: (path: string, basePath?: string) => Promise<{
      ok: boolean;
      message: string;
    }>;
    openContainingFolder: (path: string, basePath?: string) => Promise<{
      ok: boolean;
      message: string;
    }>;
    previewPath: (path: string, basePath?: string) => Promise<FiitxPathPreview>;
    getMediaDataUrl: (path: string, basePath?: string) => Promise<FiitxPathInfo & {
      mimeType: string;
      dataUrl: string;
    }>;
    listModelProfiles: () => Promise<FiitxModelProfile[]>;
    saveModelProfile: (payload: FiitxModelPayload) => Promise<FiitxModelProfile>;
    testModelConnection: (payload: FiitxModelPayload) => Promise<{
      ok: boolean;
      message: string;
    }>;
    loadThreadState: () => Promise<FiitxThreadState>;
    saveThreadState: (payload: FiitxThreadState) => Promise<{
      ok: boolean;
      path: string;
      savedAt: string;
    }>;
    discoverWechatAiSkills: () => Promise<unknown[]>;
    routeWechatAiPrompt: (payload: FiitxWechatAiGatewayPayload) => Promise<unknown>;
    invokeWechatAiSkill: (payload: FiitxWechatAiSkillInvokePayload) => Promise<unknown>;
    getMcpConfig: () => Promise<FiitxMcpConfig>;
    saveMcpConfig: (payload: FiitxMcpConfig) => Promise<FiitxMcpConfig>;
    upsertMcpServer: (payload: FiitxMcpServerConfig) => Promise<FiitxMcpConfig>;
    removeMcpServer: (payload: { id: string }) => Promise<FiitxMcpConfig>;
    refreshMcpRegistry: (payload?: { extraServers?: FiitxMcpServerConfig[] }) => Promise<FiitxMcpSnapshot>;
    callMcpTool: (payload: { serverId: string; toolName: string; arguments?: Record<string, unknown> }) => Promise<unknown>;
    listMcpResources: (payload?: { serverId?: string }) => Promise<unknown>;
    readMcpResource: (payload: { serverId: string; uri: string }) => Promise<unknown>;
    listMcpPrompts: (payload?: { serverId?: string }) => Promise<unknown>;
    getMcpPrompt: (payload: { serverId: string; name: string; arguments?: Record<string, unknown> }) => Promise<unknown>;
    listSkillCatalog: (payload?: { roots?: string[] }) => Promise<unknown[]>;
    listInstalledSkills: () => Promise<unknown[]>;
    installLocalSkill: (payload: FiitxSkillInstallPayload) => Promise<unknown>;
    uninstallSkill: (payload: { id: string }) => Promise<unknown>;
    setSkillEnabled: (payload: { id: string; enabled: boolean }) => Promise<unknown>;
    getWechatChannelStatus: () => Promise<FiitxWechatChannelStatus>;
    getWechatChannelBindStatus: () => Promise<FiitxWechatBindStatus>;
    startWechatChannelBind: (payload?: Record<string, unknown>) => Promise<FiitxWechatBindStatus>;
    cancelWechatChannelBind: () => Promise<FiitxWechatBindStatus>;
    listChannels: (payload?: { adapters?: FiitxChannelAdapterSpec[]; channelAdapters?: FiitxChannelAdapterSpec[] }) => Promise<FiitxRuntimeChannel[]>;
    getChatSdkStatus: () => Promise<unknown>;
    getWeixinIlinkStatus: () => Promise<unknown>;
    startWeixinIlink: (payload?: Record<string, unknown>) => Promise<unknown>;
    stopWeixinIlink: () => Promise<unknown>;
    getAgentPlatformSnapshot: () => Promise<FiitxPlatformSnapshot>;
    startAgentDaemon: () => Promise<FiitxPlatformSnapshot>;
    stopAgentDaemon: () => Promise<FiitxPlatformSnapshot>;
    upsertCronJob: (payload: FiitxCronJobPayload) => Promise<unknown>;
    removeCronJob: (payload: { id: string }) => Promise<unknown[]>;
    runCronJobNow: (payload: { id: string }) => Promise<unknown>;
    searchSessions: (payload?: { query?: string; limit?: number }) => Promise<FiitxSessionSearchResult[]>;
    learnSkillFromThread: (payload: { threadId: string; name?: string }) => Promise<unknown>;
    installLearnedSkill: (payload: { id: string }) => Promise<unknown>;
    removeLearnedSkill: (payload: { id: string }) => Promise<unknown[]>;
    saveProfileIsolation: (payload: { profileIsolation: unknown }) => Promise<unknown>;
    getMemorySnapshot: () => Promise<FiitxMemorySnapshot>;
    listMemory: (payload?: { kind?: string; workspacePath?: string; channelId?: string; limit?: number }) => Promise<FiitxMemoryEntry[]>;
    recallMemory: (payload?: { query?: string; workspacePath?: string; channelId?: string; threadId?: string; limit?: number }) => Promise<FiitxMemoryEntry[]>;
    rememberMemory: (payload: Partial<FiitxMemoryEntry> & { text: string }) => Promise<FiitxMemoryEntry | null>;
    removeMemory: (payload: { id: string }) => Promise<{ ok: boolean; removed: number }>;
    listMemoryProviders: () => Promise<FiitxMemoryProvider[]>;
    setMemoryProvider: (payload: { providerId?: string; id?: string }) => Promise<unknown>;
    extractThreadMemory: (payload: { threadId: string; workspacePath?: string; channelId?: string; limit?: number }) => Promise<FiitxMemoryEntry[]>;
    runTerminalCommand: (payload: FiitxTerminalCommandPayload) => Promise<FiitxTerminalCommandResult>;
    onWechatChannelInbound: (callback: (payload: FiitxWechatChannelInbound) => void) => () => void;
    runAgentTask: (payload: FiitxAgentTaskPayload) => Promise<FiitxAgentTaskResult>;
    promptAgent: (payload: FiitxAgentTaskPayload) => Promise<FiitxAgentTaskResult>;
    steerAgent: (payload: FiitxAgentSessionCommand) => Promise<FiitxAgentSessionResult>;
    followUpAgent: (payload: FiitxAgentSessionCommand) => Promise<FiitxAgentSessionResult>;
    abortAgent: (payload: FiitxAgentSessionCommand) => Promise<FiitxAgentSessionResult>;
    continueAgent: (payload: FiitxAgentSessionCommand) => Promise<FiitxAgentSessionResult>;
    compactAgent: (payload: FiitxAgentSessionCommand) => Promise<FiitxAgentSessionResult>;
    getAgentSessionTree: (payload: FiitxAgentSessionCommand) => Promise<unknown>;
    replayAgentSession: (payload: FiitxAgentSessionCommand) => Promise<unknown[]>;
    getAgentTelemetrySummary: (payload?: { limit?: number }) => Promise<unknown>;
    inspectAgentRoute: (payload: FiitxAgentTaskPayload) => Promise<FiitxAgentRouteInspection>;
    runAgentEval: (payload: FiitxAgentTaskPayload & { cases?: unknown[] }) => Promise<FiitxAgentEvalResult>;
    getAgentHarnessSnapshot: (payload?: { limit?: number }) => Promise<FiitxAgentHarnessSnapshot>;
    getAgentHistorySnapshot: (payload?: { limit?: number }) => Promise<FiitxAgentHistorySnapshot>;
    getAgentTrace: (payload: { threadId: string; limit?: number }) => Promise<FiitxAgentTrace>;
    compareAgentRuns: (payload: { leftThreadId: string; rightThreadId: string; limit?: number }) => Promise<FiitxRunCompare>;
    exportAgentAuditPackage: (payload: { threadId: string; limit?: number }) => Promise<FiitxAuditPackageExport>;
    onAgentProgress: (callback: (payload: FiitxAgentProgress) => void) => () => void;
  };
}
