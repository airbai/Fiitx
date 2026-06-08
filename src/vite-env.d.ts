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
  contextMessages?: Array<{
    role: "user" | "assistant";
    content: string;
    time?: string;
  }>;
};

type FiitxAgentTaskResult = {
  ok: boolean;
  summary: string;
  mode?: "chat" | "coding";
  model?: string;
  provider?: string;
  title?: string;
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
    runAgentTask: (payload: FiitxAgentTaskPayload) => Promise<FiitxAgentTaskResult>;
    promptAgent: (payload: FiitxAgentTaskPayload) => Promise<FiitxAgentTaskResult>;
    steerAgent: (payload: FiitxAgentSessionCommand) => Promise<FiitxAgentSessionResult>;
    followUpAgent: (payload: FiitxAgentSessionCommand) => Promise<FiitxAgentSessionResult>;
    abortAgent: (payload: FiitxAgentSessionCommand) => Promise<FiitxAgentSessionResult>;
    continueAgent: (payload: FiitxAgentSessionCommand) => Promise<FiitxAgentSessionResult>;
    compactAgent: (payload: FiitxAgentSessionCommand) => Promise<FiitxAgentSessionResult>;
    onAgentProgress: (callback: (payload: FiitxAgentProgress) => void) => () => void;
  };
}
