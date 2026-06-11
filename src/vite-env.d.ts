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
  bestFor: string[];
  toolCallStyle: string;
  createdAt?: string;
};

type FiitxModelProfile = Omit<FiitxModelPayload, "apiKey"> & {
  id: string;
  apiKeyRef: string;
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
  channelType: "desktop-ui" | "wechat-miniprogram-ai";
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
};

type FiitxAgentSessionResult = {
  ok: boolean;
  message?: string;
  queued?: boolean;
  aborted?: boolean;
  summary?: string;
  errorMessage?: string;
  messageCount?: number;
};

type FiitxAgentProgress = {
  id: string;
  taskId: string;
  threadId?: string;
  title: string;
  detail: string;
  status: "running" | "success" | "warn" | "info";
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

type FiitxWechatChannelStatus = {
  running: boolean;
  host: string;
  port: number;
  baseUrl: string;
  messageEndpoint: string;
  healthEndpoint: string;
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
  apiCalls?: unknown[];
  toolEvents?: unknown[];
};

interface Window {
  fiitx?: {
    getPlatform: () => Promise<{
      platform: string;
      version: string;
      encryptionAvailable: boolean;
      defaultWorkspace?: string;
    }>;
    chooseWorkspace: () => Promise<{
      canceled: boolean;
      filePaths: string[];
    }>;
    chooseFiles: () => Promise<{
      canceled: boolean;
      filePaths: string[];
    }>;
    inspectPath: (path: string, basePath?: string) => Promise<FiitxPathInfo>;
    openPath: (path: string, basePath?: string) => Promise<{
      ok: boolean;
      message: string;
    }>;
    previewPath: (path: string, basePath?: string) => Promise<FiitxPathPreview>;
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
    getWechatChannelStatus: () => Promise<FiitxWechatChannelStatus>;
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
    onAgentProgress: (callback: (payload: FiitxAgentProgress) => void) => () => void;
  };
}
