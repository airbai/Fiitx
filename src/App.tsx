import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  Check,
  ChevronDown,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GitBranch,
  Image,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LucideIcon,
  MessageSquare,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  Presentation,
  RefreshCw,
  Save,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  SquarePlus,
  Store,
  Terminal,
  UserRound,
  Workflow,
  X
} from "lucide-react";
import logoUrl from "../assets/fiitx-logo.png";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("wxml", xml);

type View = "workbench" | "models" | "agents" | "approvals" | "audit" | "settings";
type ThreadStatus = "running" | "waiting" | "done";
type ApprovalStatus = "pending" | "approved" | "denied";
type ArtifactId = "report" | "ppt" | "diff" | "image";
type PanelKey = "sidebar" | "artifact" | "terminal";
type PermissionMode = "ask" | "auto" | "full";
type ToolPolicyMode = PermissionMode | "block";

type NavItem = {
  id: View;
  label: string;
  icon: LucideIcon;
};

type Thread = {
  id: string;
  title: string;
  kind: string;
  model: string;
  status: ThreadStatus;
  updatedAt: string;
  createdAt: number;
  workspacePath?: string;
  projectFolderId?: string | null;
};

type Message = {
  id: string;
  role: "user" | "agent" | "system";
  author: string;
  body: string;
  time: string;
  approvalId?: string;
};

type Approval = {
  id: string;
  title: string;
  detail: string;
  command: string;
  requester: string;
  risk: "low" | "medium" | "high";
  status: ApprovalStatus;
  action?: string;
  resumePayload?: FiitxAgentTaskPayload;
};

type AuditLog = {
  id: string;
  time: string;
  actor: string;
  event: string;
  target: string;
  level: "info" | "success" | "warn";
};

type AgentSpec = {
  name: string;
  scope: string;
  model: string;
  status: "ready" | "active" | "draft";
  tools: string[];
  accent: string;
};

type ModelForm = {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  contextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsJsonMode: boolean;
  bestFor: string[];
  toolCallStyle: string;
};

type FileArtifact = {
  path: string;
  title: string;
  language: string;
  status: "modified" | "added";
  additions: number;
  deletions: number;
  preview: string;
};

type PathInfo = {
  exists: boolean;
  path: string;
  name: string;
  kind: "file" | "directory" | "other" | "missing";
  size?: number;
  extension?: string;
  previewable?: boolean;
  resolvedFromWorkspace?: boolean;
};

type ProjectFolder = {
  id: string;
  name: string;
  path?: string;
  threads: string[];
};

type ThreadRecord = {
  messages: Message[];
  progressEvents: FiitxAgentProgress[];
  artifacts: FileArtifact[];
  lastAgentArtifact: FileArtifact | null;
  executionArtifacts: FileArtifact[];
  activeAgentTaskId: string;
  executionStartedAt: number | null;
  executionFinishedAt: number | null;
  executionExpanded: boolean;
  sessionEntries: SessionEntry[];
  currentEntryId: string | null;
};

type SessionEntry = {
  id: string;
  parentId: string | null;
  kind: "message" | "progress" | "approval" | "artifact" | "tool" | "summary";
  time: string;
  payload: unknown;
};

type PolicySettings = {
  toolExecution: "sequential" | "parallel";
  sandboxMode: "read-only" | "workspace-write" | "danger-full-access";
  defaultPermissionMode: PermissionMode;
  actionModes: Record<string, ToolPolicyMode>;
};

const defaultPolicySettings: PolicySettings = {
  toolExecution: "sequential",
  sandboxMode: "workspace-write",
  defaultPermissionMode: "ask",
  actionModes: {
    "workspace.scan": "ask",
    "workspace.write_manifest": "ask",
    "shell.exec": "ask",
    "network.request": "ask",
    "sensitive.read": "block"
  }
};

const DRAFT_THREAD_ID = "draft-thread";
const AUTO_MODEL = "auto";
const AUTO_MODEL_LABEL = "自动模型路由";

const navItems: NavItem[] = [
  { id: "workbench", label: "工作台", icon: LayoutDashboard },
  { id: "models", label: "模型中心", icon: Brain },
  { id: "agents", label: "Agent", icon: Bot },
  { id: "approvals", label: "审批", icon: ClipboardCheck },
  { id: "audit", label: "审计", icon: Activity },
  { id: "settings", label: "策略", icon: Settings }
];

const initialThreads: Thread[] = [];

const projectFolders: ProjectFolder[] = [];

const initialMessages: Message[] = [];

const initialApprovals: Approval[] = [];

const initialAuditLogs: AuditLog[] = [];

const agents: AgentSpec[] = [];

const providerTemplates = [
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com", tag: "尝试 / 默认模型" },
  { name: "MiniMax", baseUrl: "https://api.minimax.chat/v1", tag: "尝试 / 文本与语音" },
  { name: "Kimi", baseUrl: "https://api.moonshot.cn/v1", tag: "尝试 / 长上下文" },
  { name: "清华智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", tag: "尝试 / GLM" },
  { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", tag: "模型广场 / fallback" },
  { name: "OpenAI-compatible", baseUrl: "https://api.openai.com/v1", tag: "统一兼容入口" },
  { name: "Anthropic", baseUrl: "https://api.anthropic.com", tag: "长文本 / coding" },
  { name: "Gemini", baseUrl: "https://generativelanguage.googleapis.com", tag: "多模态" },
  { name: "Ollama", baseUrl: "http://localhost:11434", tag: "本地模型" },
  { name: "LiteLLM", baseUrl: "http://localhost:4000", tag: "企业网关" },
  { name: "vLLM", baseUrl: "http://localhost:8000/v1", tag: "私有部署" },
  { name: "阿里百炼", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", tag: "国产模型" },
  { name: "火山方舟", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", tag: "国产模型" },
  { name: "硅基流动", baseUrl: "https://api.siliconflow.cn/v1", tag: "国产模型" },
  { name: "Moonshot/Kimi", baseUrl: "https://api.moonshot.cn/v1", tag: "长上下文" }
];

const providerModelDefaults: Record<string, string> = {
  DeepSeek: "deepseek-v4-flash",
  MiniMax: "minimax-text-01",
  Kimi: "moonshot-v1-128k",
  "清华智谱 GLM": "glm-4-flash",
  OpenRouter: "openrouter/auto",
  "OpenAI-compatible": "gpt-4o-mini",
  "硅基流动": "deepseek-ai/DeepSeek-V3",
  "阿里百炼": "qwen-plus",
  "火山方舟": "deepseek-v3-250324"
};

const providerCapabilityDefaults: Record<string, Partial<ModelForm>> = {
  DeepSeek: {
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["coding", "research", "cheap"]
  },
  MiniMax: {
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["writing", "research", "long-context"]
  },
  Kimi: {
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["research", "writing", "long-context"]
  },
  "清华智谱 GLM": {
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["research", "writing", "cheap"]
  },
  OpenRouter: {
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["coding", "research", "vision", "image", "video", "long-context"]
  },
  "硅基流动": {
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["coding", "research", "vision", "image", "cheap"]
  }
};

const defaultProfiles: FiitxModelProfile[] = [
  {
    id: "default-deepseek-v4-flash",
    provider: "DeepSeek",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    apiKeyRef: "keychain:DeepSeek:deepseek-v4-flash",
    contextWindow: 64000,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["coding", "research", "cheap"],
    toolCallStyle: "openai",
    updatedAt: "default"
  },
  {
    id: "default-minimax",
    provider: "MiniMax",
    model: "minimax-text-01",
    baseUrl: "https://api.minimax.chat/v1",
    apiKeyRef: "keychain:MiniMax:minimax-text-01",
    contextWindow: 100000,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["writing", "research", "long-context"],
    toolCallStyle: "openai",
    updatedAt: "default"
  }
];

const artifactTabs: Array<{ id: ArtifactId; label: string; icon: LucideIcon }> = [
  { id: "report", label: "报告", icon: FileText },
  { id: "ppt", label: "PPT", icon: Presentation },
  { id: "diff", label: "Diff", icon: GitBranch },
  { id: "image", label: "预览", icon: Image }
];

const bestForOptions = ["coding", "research", "writing", "ppt", "vision", "image", "video", "audio", "cheap", "long-context"];

const permissionOptions: Array<{ id: PermissionMode; label: string; auditLabel: string }> = [
  { id: "ask", label: "请求批准", auditLabel: "请求用户批准" },
  { id: "auto", label: "替我审批", auditLabel: "自动替用户审批" },
  { id: "full", label: "完全访问权限", auditLabel: "完全访问权限" }
];

const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "heic", "avif"]);
const videoExtensions = new Set(["mp4", "mov", "m4v", "webm", "ogv"]);
const audioExtensions = new Set(["mp3", "m4a", "wav", "ogg", "flac", "aac"]);
const htmlExtensions = new Set(["html", "htm"]);
const pdfExtensions = new Set(["pdf"]);

const fileArtifacts: FileArtifact[] = [];

function emptyThreadRecord(): ThreadRecord {
  return {
    messages: [],
    progressEvents: [],
    artifacts: [],
    lastAgentArtifact: null,
    executionArtifacts: [],
    activeAgentTaskId: "",
    executionStartedAt: null,
    executionFinishedAt: null,
    executionExpanded: false,
    sessionEntries: [],
    currentEntryId: null
  };
}

function normalizeThreadRecord(record?: Partial<ThreadRecord> | null): ThreadRecord {
  return {
    ...emptyThreadRecord(),
    ...(record ?? {}),
    messages: Array.isArray(record?.messages) ? record.messages : [],
    progressEvents: Array.isArray(record?.progressEvents) ? record.progressEvents : [],
    artifacts: Array.isArray(record?.artifacts) ? record.artifacts : [],
    executionArtifacts: Array.isArray(record?.executionArtifacts) ? record.executionArtifacts : [],
    lastAgentArtifact: record?.lastAgentArtifact ?? null,
    activeAgentTaskId: record?.activeAgentTaskId ?? "",
    executionStartedAt: record?.executionStartedAt ?? null,
    executionFinishedAt: record?.executionFinishedAt ?? null,
    executionExpanded: Boolean(record?.executionExpanded),
    sessionEntries: Array.isArray(record?.sessionEntries) ? record.sessionEntries : [],
    currentEntryId: record?.currentEntryId ?? null
  };
}

function applyStateUpdate<T>(current: T, update: T | ((current: T) => T)) {
  return typeof update === "function" ? (update as (current: T) => T)(current) : update;
}

function timeNow() {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function riskLabel(risk: Approval["risk"]) {
  return risk === "high" ? "高风险" : risk === "medium" ? "中风险" : "低风险";
}

function statusLabel(status: ThreadStatus) {
  if (status === "running") {
    return "运行中";
  }
  if (status === "waiting") {
    return "待审批";
  }
  return "已完成";
}

function pathSlug(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace";
}

function folderNameFromPath(value: string) {
  return value.split("/").filter(Boolean).slice(-1)[0] || "项目";
}

function buildFallbackTaskTitle(prompt: string) {
  const clean = prompt
    .replace(/\s+/g, " ")
    .replace(/[，。；;,.!?！？]+$/g, "")
    .trim();
  if (!clean) {
    return "未命名任务";
  }
  return clean.length > 24 ? `${clean.slice(0, 24)}...` : clean;
}

function profileSummary(profile: FiitxModelProfile) {
  const flags = [
    profile.supportsTools ? "tools" : "",
    profile.supportsVision ? "vision" : "",
    profile.supportsStreaming ? "streaming" : "",
    profile.supportsJsonMode ? "json" : ""
  ].filter(Boolean);
  return flags.join(" / ");
}

export default function App() {
  const [activeView, setActiveView] = useState<View>("workbench");
  const [threads, setThreads] = useState(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState(DRAFT_THREAD_ID);
  const [messages, setMessages] = useState(initialMessages);
  const [approvals, setApprovals] = useState(initialApprovals);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactId>("report");
  const [composer, setComposer] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileArtifact | null>(null);
  const [artifacts, setArtifacts] = useState<FileArtifact[]>(fileArtifacts);
  const [activeAgentTaskId, setActiveAgentTaskId] = useState("");
  const [agentProgressEvents, setAgentProgressEvents] = useState<FiitxAgentProgress[]>([]);
  const [lastAgentArtifact, setLastAgentArtifact] = useState<FileArtifact | null>(null);
  const [executionArtifacts, setExecutionArtifacts] = useState<FileArtifact[]>([]);
  const [executionExpanded, setExecutionExpanded] = useState(false);
  const [executionStartedAt, setExecutionStartedAt] = useState<number | null>(null);
  const [executionFinishedAt, setExecutionFinishedAt] = useState<number | null>(null);
  const [statusNow, setStatusNow] = useState(Date.now());
  const [threadRecords, setThreadRecords] = useState<Record<string, ThreadRecord>>({});
  const [pathInfoMap, setPathInfoMap] = useState<Record<string, PathInfo>>({});
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectFoldersState, setProjectFoldersState] = useState(projectFolders);
  const [rootThreadIds, setRootThreadIds] = useState<string[]>([]);
  const [selectedProjectFolderId, setSelectedProjectFolderId] = useState<string | null>(null);
  const [collapsedProjectFolders, setCollapsedProjectFolders] = useState<Record<string, boolean>>({});
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("ask");
  const [policySettings, setPolicySettings] = useState<PolicySettings>(defaultPolicySettings);
  const [agentRunning, setAgentRunning] = useState(false);
  const [visiblePanels, setVisiblePanels] = useState<Record<PanelKey, boolean>>({
    sidebar: true,
    artifact: false,
    terminal: false
  });
  const [workspacePath, setWorkspacePath] = useState("");
  const [profiles, setProfiles] = useState<FiitxModelProfile[]>(defaultProfiles);
  const [platform, setPlatform] = useState("macOS");
  const [encryptionAvailable, setEncryptionAvailable] = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "passed" | "failed">("idle");
  const [testMessage, setTestMessage] = useState("等待连接测试");
  const [savingProfile, setSavingProfile] = useState(false);
  const [modelForm, setModelForm] = useState<ModelForm>({
    provider: "DeepSeek",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    apiKey: "",
    contextWindow: 64000,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["coding", "research", "cheap"],
    toolCallStyle: "openai"
  });
  const [threadStateLoaded, setThreadStateLoaded] = useState(false);

  const activeThread = useMemo<Thread>(
    () =>
      threads.find((thread) => thread.id === activeThreadId) ?? {
        id: DRAFT_THREAD_ID,
        title: "未命名任务",
        kind: "Chat / Coding",
        model: AUTO_MODEL_LABEL,
        status: "waiting",
        updatedAt: "",
        createdAt: 0
      },
    [activeThreadId, threads]
  );

  const pendingApprovalCount = approvals.filter((approval) => approval.status === "pending").length;
  const visibleAgentProgress = activeAgentTaskId
    ? agentProgressEvents.filter((event) => event.taskId === activeAgentTaskId)
    : agentProgressEvents;
  const latestProgress = visibleAgentProgress[visibleAgentProgress.length - 1];
  const taskScrollRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  function isPersistableThread(threadId: string) {
    return Boolean(threadId && threadId !== DRAFT_THREAD_ID);
  }

  function snapshotCurrentThreadRecord(overrides: Partial<ThreadRecord> = {}) {
    return normalizeThreadRecord({
      messages,
      progressEvents: agentProgressEvents,
      artifacts,
      lastAgentArtifact,
      executionArtifacts,
      activeAgentTaskId,
      executionStartedAt,
      executionFinishedAt,
      executionExpanded,
      ...overrides
    });
  }

  function cacheThreadRecord(threadId = activeThreadId, overrides: Partial<ThreadRecord> = {}) {
    if (!isPersistableThread(threadId)) {
      return;
    }

    const nextRecord = snapshotCurrentThreadRecord(overrides);
    setThreadRecords((current) => ({
      ...current,
      [threadId]: nextRecord
    }));
  }

  function updateThreadRecord(threadId: string, updater: (record: ThreadRecord) => ThreadRecord) {
    if (!isPersistableThread(threadId)) {
      return;
    }

    setThreadRecords((current) => {
      const previous = normalizeThreadRecord(current[threadId]);
      return {
        ...current,
        [threadId]: normalizeThreadRecord(updater(previous))
      };
    });
  }

  function appendSessionEntryToRecord(record: ThreadRecord, kind: SessionEntry["kind"], payload: unknown) {
    const entry: SessionEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      parentId: record.currentEntryId,
      kind,
      time: new Date().toISOString(),
      payload
    };

    return normalizeThreadRecord({
      ...record,
      sessionEntries: record.sessionEntries.concat(entry),
      currentEntryId: entry.id
    });
  }

  function appendThreadSessionEntry(threadId: string, kind: SessionEntry["kind"], payload: unknown) {
    updateThreadRecord(threadId, (record) => appendSessionEntryToRecord(record, kind, payload));
  }

  function loadThreadRecordIntoWorkbench(threadId: string, records = threadRecords) {
    const record = normalizeThreadRecord(records[threadId] as Partial<ThreadRecord> | undefined);
    setMessages(record.messages);
    setAgentProgressEvents(record.progressEvents);
    setArtifacts(record.artifacts);
    setLastAgentArtifact(record.lastAgentArtifact);
    setExecutionArtifacts(record.executionArtifacts);
    setActiveAgentTaskId(record.activeAgentTaskId);
    setExecutionStartedAt(record.executionStartedAt);
    setExecutionFinishedAt(record.executionFinishedAt);
    setExecutionExpanded(record.executionExpanded);
    setSelectedFile(null);
  }

  useEffect(() => {
    window.fiitx?.getPlatform().then((result) => {
	      setPlatform(result.platform === "darwin" ? "macOS" : result.platform);
	      setEncryptionAvailable(result.encryptionAvailable);
	      if (result.defaultWorkspace) {
	        setWorkspacePath((current) => current || result.defaultWorkspace || "");
	      }
	    });

    window.fiitx?.listModelProfiles().then((savedProfiles) => {
      if (savedProfiles.length > 0) {
        const savedIds = new Set(savedProfiles.map((profile) => profile.id));
        setProfiles(defaultProfiles.filter((profile) => !savedIds.has(profile.id)).concat(savedProfiles));
      }
    });
	  }, []);

  useEffect(() => {
    let cancelled = false;

    window.fiitx?.loadThreadState?.().then((state) => {
      if (cancelled || !state) {
        return;
      }

      const loadedThreads = Array.isArray(state.threads) ? state.threads as Thread[] : [];
      const loadedFolders = Array.isArray(state.projectFolders) ? state.projectFolders as ProjectFolder[] : [];
      const loadedRootThreadIds = Array.isArray(state.rootThreadIds) ? state.rootThreadIds : [];
      const rawRecords = (state.threadRecords ?? {}) as Record<string, Partial<ThreadRecord>>;
      const loadedRecords = Object.fromEntries(
        Object.entries(rawRecords).map(([threadId, record]) => [threadId, normalizeThreadRecord(record)])
      );
      const targetThreadId =
        state.activeThreadId && loadedThreads.some((thread) => thread.id === state.activeThreadId)
          ? state.activeThreadId
          : DRAFT_THREAD_ID;

      setThreads(loadedThreads);
      setProjectFoldersState(loadedFolders);
      setRootThreadIds(loadedRootThreadIds.filter((threadId) => loadedThreads.some((thread) => thread.id === threadId)));
      setThreadRecords(loadedRecords);
      setApprovals(Array.isArray(state.approvals) ? state.approvals as Approval[] : []);
      setAuditLogs(Array.isArray(state.auditLogs) ? state.auditLogs as AuditLog[] : []);
      if (state.policySettings) {
        const loadedPolicy = state.policySettings as Partial<PolicySettings>;
        setPolicySettings({
          ...defaultPolicySettings,
          ...loadedPolicy,
          actionModes: {
            ...defaultPolicySettings.actionModes,
            ...(loadedPolicy.actionModes ?? {})
          }
        });
        if (loadedPolicy.defaultPermissionMode) {
          setPermissionMode(loadedPolicy.defaultPermissionMode);
        }
      }
      if (state.workspacePath) {
        setWorkspacePath(state.workspacePath as string);
      }
      setActiveThreadId(targetThreadId);

      if (isPersistableThread(targetThreadId)) {
        loadThreadRecordIntoWorkbench(targetThreadId, loadedRecords);
      } else {
        loadThreadRecordIntoWorkbench(DRAFT_THREAD_ID, {});
      }
    }).finally(() => {
      if (!cancelled) {
        setThreadStateLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!threadStateLoaded) {
      return;
    }

    const recordsToSave: Record<string, ThreadRecord> = { ...threadRecords };
    if (isPersistableThread(activeThreadId)) {
      recordsToSave[activeThreadId] = snapshotCurrentThreadRecord();
    }

    const timer = window.setTimeout(() => {
      void window.fiitx?.saveThreadState?.({
        activeThreadId: isPersistableThread(activeThreadId) ? activeThreadId : "",
        workspacePath,
        threads,
        projectFolders: projectFoldersState,
        rootThreadIds,
        threadRecords: recordsToSave,
        approvals,
        auditLogs,
        policySettings
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    activeThreadId,
    agentProgressEvents,
    approvals,
    artifacts,
    auditLogs,
    executionArtifacts,
    executionExpanded,
    executionFinishedAt,
    executionStartedAt,
    lastAgentArtifact,
    messages,
    projectFoldersState,
    policySettings,
    rootThreadIds,
    threadRecords,
    threads,
    threadStateLoaded,
    workspacePath
  ]);

  useEffect(() => {
    const unsubscribe = window.fiitx?.onAgentProgress?.((event) => {
      const targetThreadId = event.threadId || activeThreadId;
      if (targetThreadId === activeThreadId) {
        setAgentProgressEvents((current) => current.concat(event).slice(-64));
      }
      updateThreadRecord(targetThreadId, (record) => ({
        ...record,
        progressEvents: record.progressEvents.concat(event).slice(-64)
      }));
    });

    return () => unsubscribe?.();
  }, [activeThreadId]);

  useEffect(() => {
    if (!agentRunning) {
      return;
    }

    const timer = window.setInterval(() => setStatusNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [agentRunning]);

  useEffect(() => {
    if (activeView !== "workbench") {
      return;
    }

    window.requestAnimationFrame(() => {
      messageEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      const scrollArea = taskScrollRef.current;
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    });
  }, [messages, visibleAgentProgress.length, agentRunning, executionExpanded, activeView]);

  useEffect(() => {
    setPathInfoMap({});
  }, [workspacePath]);

  useEffect(() => {
    if (!window.fiitx?.inspectPath) {
      return;
    }

    const paths = Array.from(new Set(messages.flatMap((message) => extractLocalPaths(message.body))));
    const unchecked = paths.filter((candidate) => !pathInfoMap[candidate]);
    if (unchecked.length === 0) {
      return;
    }

    let cancelled = false;
    Promise.all(
      unchecked.map(async (candidate) => {
        try {
          const info = await window.fiitx?.inspectPath(candidate, workspacePath);
          return info ? [candidate, info] as const : null;
        } catch {
          return null;
        }
      })
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      setPathInfoMap((current) => {
        const next = { ...current };
        for (const entry of entries) {
          if (entry) {
            next[entry[0]] = entry[1];
          }
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [messages, pathInfoMap, workspacePath]);

  function addAudit(actor: string, event: string, target: string, level: AuditLog["level"] = "info") {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      time: timeNow(),
      actor,
      event,
      target,
      level
    };
    setAuditLogs((current) => [log, ...current]);
  }

  function cleanPathCandidate(candidate: string) {
    return candidate
      .trim()
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/[.,，。；;:：）)\]\}*]+$/g, "");
  }

  function isLikelyLocalPath(candidate: string) {
    if (!candidate || candidate.includes("://")) {
      return false;
    }

    if (candidate.startsWith("/") || candidate.startsWith("~/") || candidate.startsWith("./") || candidate.startsWith("../")) {
      return true;
    }

    return /\.[A-Za-z0-9]{1,12}$/.test(candidate) || (candidate.includes("/") && candidate.endsWith("/"));
  }

  function extractLocalPaths(text: string) {
    const paths = new Set<string>();
    const quotedPattern = /[`"']((?:~\/|\/|\.{1,2}\/)?(?:[^`"'\n]+\/)+[^`"'\n]+|(?:~\/|\/)[^`"'\n]+)[`"']/g;
    for (const match of text.matchAll(quotedPattern)) {
      paths.add(cleanPathCandidate(match[1]));
    }

    const quotedSimpleFilePattern = /[`"']([A-Za-z0-9_.@()+ -]+\.[A-Za-z0-9]{1,12})[`"']/g;
    for (const match of text.matchAll(quotedSimpleFilePattern)) {
      paths.add(cleanPathCandidate(match[1]));
    }

    const linePattern = /(^|[\s([{（：:])((?:~\/|\/)(?:Users|Volumes|Applications|tmp|var|private|opt|usr|Library|System)[^\n，。；;]*)/g;
    for (const match of text.matchAll(linePattern)) {
      paths.add(cleanPathCandidate(match[2]));
    }

    const relativeFilePattern = /(^|[\s([{（：:])((?!(?:https?|file):\/\/)(?:\.{1,2}\/)?(?:[A-Za-z0-9_.@+-]+\/)+[A-Za-z0-9_.@()+ -]+\.[A-Za-z0-9]{1,12})(?=$|[\s，。；;,）)\]\}])/g;
    for (const match of text.matchAll(relativeFilePattern)) {
      paths.add(cleanPathCandidate(match[2]));
    }

    const relativeDirectoryPattern = /(^|[\s([{（：:])((?:\.{1,2}\/)?(?:[A-Za-z0-9_.@+-]+\/)+)(?=$|[\s，。；;,）)\]\}])/g;
    for (const match of text.matchAll(relativeDirectoryPattern)) {
      paths.add(cleanPathCandidate(match[2]));
    }

    return Array.from(paths).filter((item) => item.length > 1 && !item.startsWith("//") && isLikelyLocalPath(item));
  }

  function getCurrentDateContext() {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Shanghai"
    }).format(new Date());
  }

  function buildPiContextMessages() {
    const transformed = messages.filter((message) => {
      if (message.approvalId) {
        return false;
      }
      if (message.role === "system" && /已(批准|拒绝)/.test(message.body)) {
        return true;
      }
      return message.role !== "system";
    });

    return transformed
      .slice(-14)
      .map((message) => ({
        role: message.role === "user" ? "user" as const : "assistant" as const,
        content: message.body,
        time: message.time
      }));
  }

  function getArtifactExtension(file: FileArtifact) {
    const basename = file.path.split("?")[0].split("#")[0].split("/").pop() || "";
    const dotIndex = basename.lastIndexOf(".");
    const fromPath = dotIndex > 0 ? basename.slice(dotIndex + 1).toLowerCase() : "";
    const fromLanguage = file.language.replace(/^\./, "").toLowerCase();
    return fromPath || fromLanguage;
  }

  function getMediaKindFromExtension(extension: string) {
    const normalized = extension.replace(/^\./, "").toLowerCase();
    if (imageExtensions.has(normalized)) {
      return "image";
    }
    if (videoExtensions.has(normalized)) {
      return "video";
    }
    if (audioExtensions.has(normalized)) {
      return "audio";
    }
    if (htmlExtensions.has(normalized)) {
      return "html";
    }
    if (pdfExtensions.has(normalized)) {
      return "pdf";
    }
    return "";
  }

  function getMediaKindFromSource(source: string) {
    const dataMatch = /^data:([^;,]+)/i.exec(source);
    if (dataMatch) {
      const mime = dataMatch[1].toLowerCase();
      if (mime.startsWith("image/")) {
        return "image";
      }
      if (mime.startsWith("video/")) {
        return "video";
      }
      if (mime.startsWith("audio/")) {
        return "audio";
      }
      if (mime === "text/html") {
        return "html";
      }
    }

    const extension = source.split("?")[0].split("#")[0].split(".").pop() || "";
    return getMediaKindFromExtension(extension);
  }

  function getFileUrl(path: string) {
    if (/^(data|https?|file):/i.test(path)) {
      return path;
    }
    return encodeURI(`file://${path}`);
  }

  function getArtifactIdForFile(file: FileArtifact): ArtifactId {
    const extension = getArtifactExtension(file);
    if (["ppt", "pptx", "key"].includes(extension)) {
      return "ppt";
    }
    if (getMediaKindFromExtension(extension)) {
      return "image";
    }
    if (["md", "markdown", "txt", "doc", "docx", "pdf", "rtf"].includes(extension)) {
      return "report";
    }
    return "diff";
  }

  function getVisibleArtifactTabs() {
    const target = selectedFile ? getArtifactIdForFile(selectedFile) : activeArtifact;
    return artifactTabs.filter((tab) => tab.id === target);
  }

  function formatFileSize(size = 0) {
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  function getPathFallbackName(candidate: string) {
    return candidate.replace(/\/+$/g, "").split("/").filter(Boolean).slice(-1)[0] || candidate;
  }

  function getPathKindLabel(info?: PathInfo) {
    if (!info) {
      return "检查中";
    }
    if (!info.exists) {
      return "未找到";
    }
    if (info.kind === "directory") {
      return info.resolvedFromWorkspace ? "文件夹 · workspace" : "文件夹";
    }
    if (info.kind === "file") {
      const sizeLabel = typeof info.size === "number" ? `文件 · ${formatFileSize(info.size)}` : "文件";
      return info.resolvedFromWorkspace ? `${sizeLabel} · workspace` : sizeLabel;
    }
    return "路径";
  }

  async function inspectMessagePath(path: string) {
    const cached = pathInfoMap[path];
    if (cached) {
      return cached;
    }

    const info = await window.fiitx?.inspectPath?.(path, workspacePath);
    if (info) {
      setPathInfoMap((current) => ({
        ...current,
        [path]: info
      }));
    }
    return info;
  }

  async function openLocalPath(path: string) {
    const result = await window.fiitx?.openPath?.(path, workspacePath);
    addAudit("Workspace Manager", result?.ok ? "打开路径" : "打开路径失败", path, result?.ok ? "success" : "warn");
  }

  function showLocalFileArtifact(info: PathInfo, previewText?: string) {
    const body = previewText || [
      `# ${info.name}`,
      "",
      `路径：${info.path}`,
      `类型：${info.extension || "文件"}`,
      `大小：${formatFileSize(info.size)}`,
      "",
      "当前文件类型暂不支持文本预览，可在 Finder 中打开。"
    ].join("\n");

    const artifact: FileArtifact = {
      path: info.path,
      title: info.name,
      language: info.extension?.replace(".", "") || "file",
      status: "added",
      additions: body.split("\n").length,
      deletions: 0,
      preview: body
    };
    updateArtifactsForThread(activeThreadId, (current) => [artifact, ...current.filter((item) => item.path !== artifact.path)], true);
    setThreadLastArtifact(activeThreadId, artifact, true);
    selectFileArtifact(artifact);
  }

  async function previewLocalPath(path: string, knownInfo?: PathInfo) {
    try {
      const preview = await window.fiitx?.previewPath?.(path, workspacePath);
      if (!preview) {
        return;
      }

      showLocalFileArtifact(preview, `${preview.content}${preview.truncated ? "\n\n[文件较大，已截断预览]" : ""}`);
      addAudit("Artifact Engine", "预览本地文件", preview.path, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "文件预览失败";
      if (knownInfo?.exists && knownInfo.kind === "file") {
        showLocalFileArtifact(knownInfo, [
          `# ${knownInfo.name}`,
          "",
          `路径：${knownInfo.path}`,
          `大小：${formatFileSize(knownInfo.size)}`,
          "",
          message
        ].join("\n"));
        addAudit("Artifact Engine", "打开文件 artifact", knownInfo.path, "warn");
        return;
      }
      addAudit("Artifact Engine", "预览本地文件失败", `${path}: ${message}`, "warn");
    }
  }

  async function activateLocalPath(path: string) {
    try {
      const info = await inspectMessagePath(path);
      if (!info?.exists) {
        addAudit("Workspace Manager", "路径不存在", path, "warn");
        return;
      }

      if (info.kind === "directory") {
        await openLocalPath(info.path);
        return;
      }

      if (info.kind === "file") {
        if (info.previewable) {
          await previewLocalPath(path, info);
        } else {
          showLocalFileArtifact(info);
        }
        return;
      }

      await openLocalPath(info.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : "打开路径失败";
      addAudit("Workspace Manager", "打开路径失败", `${path}: ${message}`, "warn");
    }
  }

  function renderInlineMessageText(text: string, paths: string[]) {
    if (paths.length === 0) {
      return <p className="message-text">{text}</p>;
    }

    const orderedPaths = paths.slice().sort((a, b) => b.length - a.length);
    const parts: ReactNode[] = [];
    let cursor = 0;

    while (cursor < text.length) {
      let nextIndex = -1;
      let nextPath = "";

      for (const candidate of orderedPaths) {
        const index = text.indexOf(candidate, cursor);
        if (index !== -1 && (nextIndex === -1 || index < nextIndex || (index === nextIndex && candidate.length > nextPath.length))) {
          nextIndex = index;
          nextPath = candidate;
        }
      }

      if (nextIndex === -1) {
        parts.push(text.slice(cursor));
        break;
      }

      if (nextIndex > cursor) {
        parts.push(text.slice(cursor, nextIndex));
      }

      const info = pathInfoMap[nextPath];
      const isDirectory = info?.kind === "directory";
      parts.push(
        <button
          className={`inline-path-link ${info?.exists === false ? "missing" : ""}`}
          key={`${nextPath}-${cursor}`}
          onClick={() => activateLocalPath(nextPath)}
          title={info?.path || nextPath}
          type="button"
        >
          {isDirectory ? <FolderOpen size={13} /> : <FileText size={13} />}
          <span>{nextPath}</span>
        </button>
      );
      cursor = nextIndex + nextPath.length;
    }

    return <p className="message-text">{parts}</p>;
  }

  function renderPathResourceGroup(paths: string[]) {
    if (paths.length === 0) {
      return null;
    }

    const existing = paths.filter((path) => pathInfoMap[path]?.exists);
    const files = paths.filter((path) => pathInfoMap[path]?.kind === "file");
    const directories = paths.filter((path) => pathInfoMap[path]?.kind === "directory");

    return (
      <div className="message-resource-card">
        <div className="resource-card-header">
          <div className="resource-card-icon">
            <FileText size={18} />
          </div>
          <div>
            <strong>本地资源</strong>
            <span>
              已识别 {paths.length} 个路径
              {existing.length > 0 ? ` · ${files.length} 个文件 · ${directories.length} 个文件夹` : ""}
            </span>
          </div>
        </div>
        <div className="resource-list">
          {paths.map((path) => {
            const info = pathInfoMap[path];
            const isDirectory = info?.kind === "directory";
            const rowAction = !info ? "检查中" : info.exists ? (isDirectory ? "打开" : "预览") : "不存在";

            return (
              <button
                className={`resource-row ${info?.exists === false ? "missing" : ""}`}
                disabled={info?.exists === false}
                key={path}
                onClick={() => activateLocalPath(path)}
                title={info?.path || path}
                type="button"
              >
                <span className="resource-row-main">
                  <span className="resource-row-title">
                    {isDirectory ? <FolderOpen size={16} /> : <FileText size={16} />}
                    <strong>{info?.name || getPathFallbackName(path)}</strong>
                  </span>
                  <code>{info?.path || path}</code>
                </span>
                <span className="resource-row-meta">
                  <small>{getPathKindLabel(info)}</small>
                  <b>{rowAction}</b>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function copyText(text: string) {
    void navigator.clipboard?.writeText(text);
    addAudit("Composer", "复制 Markdown", `${text.length} chars`, "info");
  }

  function normalizeCodeLanguage(language: string) {
    const value = language.trim().toLowerCase();
    if (["shell", "zsh", "terminal"].includes(value)) {
      return "bash";
    }
    if (["jsx"].includes(value)) {
      return "javascript";
    }
    return value || "plaintext";
  }

  function getCodeBlockKind(language: string) {
    const normalized = normalizeCodeLanguage(language);
    if (normalized === "diff") {
      return "diff";
    }
    if (["bash", "sh", "shell"].includes(normalized)) {
      return "shell";
    }
    if (normalized === "json") {
      return "json";
    }
    return "code";
  }

  function highlightCode(code: string, language: string) {
    const normalized = normalizeCodeLanguage(language);
    if (normalized !== "plaintext" && hljs.getLanguage(normalized)) {
      return hljs.highlight(code, { language: normalized }).value;
    }
    return hljs.highlightAuto(code).value;
  }

  function renderCodeBlock(code: string, language: string, key: string) {
    const normalizedLanguage = normalizeCodeLanguage(language);
    const kind = getCodeBlockKind(normalizedLanguage);
    return (
      <div className={`code-block code-block-${kind}`} key={key}>
        <div className="code-block-header">
          <span>{normalizedLanguage === "plaintext" ? "code" : normalizedLanguage}</span>
          <button onClick={() => copyText(code)} title="复制代码">
            <Copy size={13} />
            <span>复制</span>
          </button>
        </div>
        <pre>
          <code dangerouslySetInnerHTML={{ __html: highlightCode(code, normalizedLanguage) }} />
        </pre>
      </div>
    );
  }

  function renderMediaPreview(source: string, title: string, key: string, htmlContent = "") {
    const kind = getMediaKindFromSource(source) || (htmlContent ? "html" : "");
    const src = getFileUrl(source);

    if (kind === "image") {
      return (
        <figure className="media-preview media-preview-image" key={key}>
          <img src={src} alt={title || "图片预览"} />
          {title ? <figcaption>{title}</figcaption> : null}
        </figure>
      );
    }

    if (kind === "video") {
      return (
        <figure className="media-preview media-preview-video" key={key}>
          <video src={src} controls playsInline preload="metadata" />
          {title ? <figcaption>{title}</figcaption> : null}
        </figure>
      );
    }

    if (kind === "audio") {
      return (
        <figure className="media-preview media-preview-audio" key={key}>
          <audio src={src} controls preload="metadata" />
          {title ? <figcaption>{title}</figcaption> : null}
        </figure>
      );
    }

    if (kind === "html") {
      return (
        <div className="media-preview media-preview-html" key={key}>
          <div className="media-preview-header">
            <span>{title || "HTML 预览"}</span>
            {source && !htmlContent ? <button onClick={() => openLocalPath(source)}>在浏览器打开</button> : null}
          </div>
          <iframe
            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            src={htmlContent ? undefined : src}
            srcDoc={htmlContent || undefined}
            title={title || "HTML 预览"}
          />
        </div>
      );
    }

    if (kind === "pdf") {
      return (
        <div className="media-preview media-preview-pdf" key={key}>
          <iframe src={src} title={title || "PDF 预览"} />
        </div>
      );
    }

    return null;
  }

  function renderMarkdownMediaLine(line: string, key: string) {
    const trimmed = line.trim();
    const imageMatch = /^!\[([^\]]*)\]\((.+)\)$/.exec(trimmed);
    if (imageMatch) {
      const title = imageMatch[1] || "媒体预览";
      const source = imageMatch[2].trim();
      return renderMediaPreview(source, title, key);
    }

    const dataUriMatch = /^\(?\s*(data:(?:image|video|audio)\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+)\s*\)?$/i.exec(trimmed);
    if (dataUriMatch) {
      return renderMediaPreview(dataUriMatch[1], "内联媒体", key);
    }

    const mediaUrlMatch = /^((?:https?|file):\/\/\S+\.(?:png|jpe?g|gif|webp|svg|mp4|mov|webm|mp3|wav|ogg|m4a)(?:\?\S*)?)$/i.exec(trimmed);
    if (mediaUrlMatch) {
      return renderMediaPreview(mediaUrlMatch[1], mediaUrlMatch[1].split("/").pop() || "媒体预览", key);
    }

    return null;
  }

  function renderMarkdownBlocks(text: string) {
    const blocks: ReactNode[] = [];
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      const splitImageAlt = /^!\[([^\]]*)\]$/.exec(line.trim());
      const splitImageSource = splitImageAlt && lines[index + 1]
        ? /^\((data:(?:image|video|audio)\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+)\)$/i.exec(lines[index + 1].trim())
        : null;
      if (splitImageAlt && splitImageSource) {
        blocks.push(renderMediaPreview(splitImageSource[1], splitImageAlt[1] || "内联媒体", `media-split-${index}`));
        index += 2;
        continue;
      }

      const mediaBlock = renderMarkdownMediaLine(line, `media-${index}`);
      if (mediaBlock) {
        blocks.push(mediaBlock);
        index += 1;
        continue;
      }

      if (line.startsWith("```")) {
        const language = line.replace(/^```/, "").trim();
        const codeLines: string[] = [];
        index += 1;
        while (index < lines.length && !lines[index].startsWith("```")) {
          codeLines.push(lines[index]);
          index += 1;
        }
        index += 1;
        blocks.push(renderCodeBlock(codeLines.join("\n"), language, `code-${index}`));
        continue;
      }

      const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const content = headingMatch[2];
        blocks.push(level === 1 ? <h3 key={`h-${index}`}>{content}</h3> : <h4 key={`h-${index}`}>{content}</h4>);
        index += 1;
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        const items: string[] = [];
        while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
          index += 1;
        }
        blocks.push(
          <ul key={`ul-${index}`}>
            {items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}
          </ul>
        );
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
        const items: string[] = [];
        while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ""));
          index += 1;
        }
        blocks.push(
          <ol key={`ol-${index}`}>
            {items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}
          </ol>
        );
        continue;
      }

      const paragraph: string[] = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        !renderMarkdownMediaLine(lines[index], `media-probe-${index}`) &&
        !lines[index].startsWith("```") &&
        !/^(#{1,3})\s+/.test(lines[index]) &&
        !/^\s*[-*]\s+/.test(lines[index]) &&
        !/^\s*\d+[.)]\s+/.test(lines[index])
      ) {
        paragraph.push(lines[index]);
        index += 1;
      }
      blocks.push(<p key={`p-${index}`}>{paragraph.join(" ")}</p>);
    }

    return blocks;
  }

  function renderApprovalMessage(message: Message) {
    const approval = message.approvalId ? approvals.find((item) => item.id === message.approvalId) : null;
    if (!approval) {
      return null;
    }

    return (
      <div className={`inline-approval-card ${approval.status}`}>
        <div className="approval-risk">
          <ShieldCheck size={16} />
          <span>{riskLabel(approval.risk)}</span>
        </div>
        <div className="inline-approval-content">
          <strong>{approval.title}</strong>
          <p>{approval.detail}</p>
          <code>{approval.command}</code>
        </div>
        <div className="inline-approval-actions">
          <button className="icon-text-button success" disabled={approval.status !== "pending"} onClick={() => resolveApproval(approval.id, "approved")}>
            <Check size={15} />
            <span>同意</span>
          </button>
          <button className="icon-text-button danger" disabled={approval.status !== "pending"} onClick={() => resolveApproval(approval.id, "denied")}>
            <X size={15} />
            <span>拒绝</span>
          </button>
        </div>
      </div>
    );
  }

  function renderMessageBody(message: Message) {
    const paths = extractLocalPaths(message.body);
    const approvalCard = renderApprovalMessage(message);
    if (approvalCard) {
      return approvalCard;
    }

    if (message.role !== "user") {
      return (
        <>
          <div className="markdown-message">
            <button className="markdown-copy-button" onClick={() => copyText(message.body)} title="复制 Markdown">
              <Copy size={14} />
              <span>复制</span>
            </button>
            {renderMarkdownBlocks(message.body)}
          </div>
          {renderPathResourceGroup(paths)}
        </>
      );
    }

    return (
      <>
        {renderInlineMessageText(message.body, paths)}
        {renderPathResourceGroup(paths)}
      </>
    );
  }

  function togglePanel(panel: PanelKey) {
    setVisiblePanels((current) => ({
      ...current,
      [panel]: !current[panel]
    }));
  }

  function selectFileArtifact(file: FileArtifact) {
    setSelectedFile(file);
    setActiveArtifact(getArtifactIdForFile(file));
    setVisiblePanels((current) => ({
      ...current,
      artifact: true
    }));
    addAudit("Artifact Engine", "打开文件 artifact", file.path, "info");
  }

  function openTaskThread(threadId: string, folderId: string | null = null) {
    const thread = threads.find((item) => item.id === threadId);
    cacheThreadRecord();
    setActiveThreadId(threadId);
    setSelectedProjectFolderId(folderId);
    const folderWorkspace = folderId ? projectFoldersState.find((folder) => folder.id === folderId)?.path : "";
    const nextWorkspace = thread?.workspacePath || folderWorkspace || workspacePath;
    if (nextWorkspace) {
      setWorkspacePath(nextWorkspace);
    }
    loadThreadRecordIntoWorkbench(threadId);
    setActiveView("workbench");
    if (thread) {
      addAudit("Workspace Manager", "打开任务线程", thread.title, "info");
    }
  }

  function toggleProjectFolder(folderId: string) {
    setSelectedProjectFolderId(folderId);
    setCollapsedProjectFolders((current) => ({
      ...current,
      [folderId]: !current[folderId]
    }));
  }

  function createBlankProject() {
    const id = `folder-blank-${Date.now()}`;
    setProjectFoldersState((current) =>
      current.concat({
        id,
        name: `空白项目 ${current.length + 1}`,
        threads: []
      })
    );
    setSelectedProjectFolderId(id);
    setProjectMenuOpen(false);
    addAudit("Workspace Manager", "新建空白项目", id, "success");
  }

  async function addExistingFolderProject() {
    const result = await window.fiitx?.chooseWorkspace();
    if (result && !result.canceled && result.filePaths[0]) {
      const selectedPath = result.filePaths[0];
      const folderName = selectedPath.split("/").filter(Boolean).slice(-1)[0] ?? selectedPath;
      const id = `folder-${pathSlug(selectedPath)}-${Date.now()}`;
      setWorkspacePath(selectedPath);
      setProjectFoldersState((current) =>
        current.concat({
          id,
          name: folderName,
          path: selectedPath,
          threads: []
        })
      );
      setSelectedProjectFolderId(id);
      addAudit("Workspace Manager", "使用现有文件夹", selectedPath, "success");
    }
    setProjectMenuOpen(false);
  }

  function selectAttachmentArtifact(path: string) {
    selectFileArtifact({
      path,
      title: path.split("/").pop() ?? path,
      language: "attachment",
      status: "added",
      additions: 1,
      deletions: 0,
      preview: `附件：${path}

Fiitx 可以把附件作为 artifact 输入源处理：
- 摘要
- 提取结构
- 生成 Word/PPT
- 转换为任务上下文`
    });
  }

  async function addAttachments() {
    const result = await window.fiitx?.chooseFiles();
    const selectedFiles = result && !result.canceled ? result.filePaths : [];
    const nextFiles = selectedFiles.length > 0 ? selectedFiles : [];

    if (nextFiles.length > 0) {
      setAttachments((current) => Array.from(new Set(current.concat(nextFiles))));
      addAudit("Composer", "添加附件", `${nextFiles.length} file(s)`, "info");
    }
  }

  function removeAttachment(path: string) {
    setAttachments((current) => current.filter((item) => item !== path));
  }

  function startVoiceInput() {
    setComposer((current) => {
      const nextText = "请根据语音输入整理任务目标，并生成可交付 artifact。";
      return current.trim() ? `${current.trim()}\n${nextText}` : nextText;
    });
    addAudit("Composer", "语音输入", "模拟语音转文字", "info");
  }

  async function chooseWorkspace() {
    const result = await window.fiitx?.chooseWorkspace();
    if (result && !result.canceled && result.filePaths[0]) {
      const selectedPath = result.filePaths[0];
      setWorkspacePath(selectedPath);
      if (isPersistableThread(activeThreadId)) {
        setThreads((current) =>
          current.map((thread) => (thread.id === activeThreadId ? { ...thread, workspacePath: selectedPath } : thread))
        );
      }
      addAudit("Workspace Manager", "选择工作区", selectedPath, "success");
    }
  }

  function createThread() {
    cacheThreadRecord();
    const nextThread = createTaskThread("", selectedProjectFolderId);
    loadThreadRecordIntoWorkbench(nextThread.id, {
      [nextThread.id]: emptyThreadRecord()
    });
    setSelectedFile(null);
    setActiveView("workbench");
    setMessages([]);
    addAudit("Workspace Manager", "创建任务线程", nextThread.title, "success");
  }

  function appendAuditEvents(events: FiitxAgentToolEvent[]) {
    const logs = events.map((event) => ({
      id: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      time: timeNow(),
      actor: event.actor,
      event: event.event,
      target: event.target,
      level: event.level
    }));
    setAuditLogs((current) => logs.concat(current));
  }

  function appendApprovalRequests(requests: FiitxApprovalRequest[], resumePayload: FiitxAgentTaskPayload) {
    const nextApprovals: Approval[] = requests.map((request) => ({
      id: request.id || `approval-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: request.title,
      detail: request.detail,
      command: request.command,
      requester: request.requester,
      risk: request.risk,
      status: "pending" as const,
      action: request.action,
      resumePayload
    }));
    setApprovals((current) => nextApprovals.concat(current));
    updateMessagesForThread(resumePayload.threadId, (current) =>
      current.concat(
        nextApprovals.map((approval) => ({
          id: `message-approval-request-${approval.id}`,
          role: "system" as const,
          author: "Policy Engine",
          body: approval.detail,
          time: timeNow(),
          approvalId: approval.id
        }))
      ),
      resumePayload.threadId === activeThreadId
    );
    for (const approval of nextApprovals) {
      appendThreadSessionEntry(resumePayload.threadId, "approval", approval);
    }
  }

  function createLocalAgentPreview(payload: FiitxAgentTaskPayload): FiitxAgentTaskResult {
    const mode = inferAgentMode(payload.prompt, payload.attachments);
    const summary = `已接收任务：${payload.prompt}`;
    return {
      ok: true,
      summary,
      mode,
      model: payload.model,
      provider: "preview",
      title: buildFallbackTaskTitle(payload.prompt),
      artifact: {
        path: `artifacts/${Date.now()}-preview.md`,
        title: "preview.md",
        language: "markdown",
        status: "added",
        additions: 1,
        deletions: 0,
        preview: summary
      },
      toolEvents: []
    };
  }

  async function runAgentTask(payload: FiitxAgentTaskPayload) {
    if (window.fiitx?.promptAgent) {
      return window.fiitx.promptAgent(payload);
    }
    if (window.fiitx?.runAgentTask) {
      return window.fiitx.runAgentTask(payload);
    }
    return createLocalAgentPreview(payload);
  }

  function inferAgentMode(prompt: string, files: string[] = []): "chat" | "coding" {
    const text = prompt.toLowerCase();
    const signals = ["代码", "项目", "文件", "目录结构", "开发", "实现", "生成", "修复", "bug", "build", "npm", "git", "app", "小程序", "网页", "组件", "接口", "脚本"];
    return files.length > 0 || signals.some((signal) => text.includes(signal.toLowerCase())) ? "coding" : "chat";
  }

  function agentLabel(mode: "chat" | "coding" | undefined) {
    return mode === "chat" ? "Chat Agent" : "Coding Agent";
  }

  function updateMessagesForThread(threadId: string, updater: Message[] | ((current: Message[]) => Message[]), display = threadId === activeThreadId) {
    let nextMessagesForEntry: Message[] = [];
    if (display) {
      setMessages((current) => {
        const next = applyStateUpdate(current, updater);
        nextMessagesForEntry = next.slice(current.length);
        return next;
      });
    }
    updateThreadRecord(threadId, (record) => ({
      ...appendSessionEntryToRecord(record, "message", {
        messages: (nextMessagesForEntry.length > 0 ? nextMessagesForEntry : applyStateUpdate(record.messages, updater).slice(record.messages.length))
      }),
      messages: applyStateUpdate(record.messages, updater)
    }));
  }

  function updateArtifactsForThread(threadId: string, updater: FileArtifact[] | ((current: FileArtifact[]) => FileArtifact[]), display = threadId === activeThreadId) {
    if (display) {
      setArtifacts((current) => applyStateUpdate(current, updater));
    }
    updateThreadRecord(threadId, (record) => ({
      ...appendSessionEntryToRecord(record, "artifact", {
        artifacts: applyStateUpdate(record.artifacts, updater).slice(0, 3)
      }),
      artifacts: applyStateUpdate(record.artifacts, updater)
    }));
  }

  function setThreadLastArtifact(threadId: string, artifact: FileArtifact | null, display = threadId === activeThreadId) {
    if (display) {
      setLastAgentArtifact(artifact);
    }
    updateThreadRecord(threadId, (record) => ({
      ...record,
      lastAgentArtifact: artifact
    }));
  }

  function setThreadExecutionArtifacts(threadId: string, nextArtifacts: FileArtifact[], display = threadId === activeThreadId) {
    if (display) {
      setExecutionArtifacts(nextArtifacts);
    }
    updateThreadRecord(threadId, (record) => ({
      ...record,
      executionArtifacts: nextArtifacts
    }));
  }

  function recordAgentProgress(
    taskId: string,
    title: string,
    detail: string,
    status: FiitxAgentProgress["status"] = "running",
    threadId = activeThreadId,
    display = threadId === activeThreadId
  ) {
    const event: FiitxAgentProgress = {
      id: `progress-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      taskId,
      threadId,
      title,
      detail,
      status,
      time: new Date().toISOString()
    };

    if (display) {
      setAgentProgressEvents((current) => current.concat(event).slice(-64));
    }
    updateThreadRecord(threadId, (record) => ({
      ...appendSessionEntryToRecord(record, "progress", event),
      progressEvents: record.progressEvents.concat(event).slice(-64)
    }));
  }

  function formatElapsed(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  function getExecutionElapsedLabel() {
    if (!executionStartedAt) {
      return "";
    }
    const end = agentRunning ? statusNow : executionFinishedAt || statusNow;
    return formatElapsed(end - executionStartedAt);
  }

  function getExecutionStatusLabel() {
    if (agentRunning) {
      const title = latestProgress?.title || "";
      return title.includes("Pi Agent") || title.includes("Model") || title.includes("Intent") ? "正在思考" : "处理中";
    }
    if (activeThread.status === "waiting" && pendingApprovalCount > 0) {
      return "等待审批";
    }
    return "已处理";
  }

  function getExecutionStatusClass() {
    if (agentRunning) {
      return "running";
    }
    if (activeThread.status === "waiting" && pendingApprovalCount > 0) {
      return "warn";
    }
    return "done";
  }

  function getLatestEditSummary() {
    if (executionArtifacts.length === 0) {
      return null;
    }

    return {
      count: executionArtifacts.length,
      additions: executionArtifacts.reduce((sum, file) => sum + file.additions, 0),
      deletions: executionArtifacts.reduce((sum, file) => sum + file.deletions, 0)
    };
  }

  function openLatestAgentResult() {
    if (lastAgentArtifact) {
      selectFileArtifact(lastAgentArtifact);
    }
  }

  function renderExecutionActivity() {
    if (visibleAgentProgress.length === 0) {
      return null;
    }

    const executionElapsed = getExecutionElapsedLabel();
    const executionStatus = getExecutionStatusLabel();
    const editSummary = getLatestEditSummary();
    const latestDetail = latestProgress?.detail?.trim();

    return (
      <article className="execution-message" aria-live={agentRunning ? "polite" : "off"}>
        <div className="execution-message-gutter">
          {agentRunning ? <Brain size={16} /> : <Check size={16} />}
        </div>
        <div className={executionExpanded ? "execution-card inline expanded" : "execution-card inline collapsed"}>
          <button
            className={`execution-status-pill ${getExecutionStatusClass()}`}
            type="button"
            onClick={() => setExecutionExpanded((current) => !current)}
            aria-expanded={executionExpanded}
          >
            <span>
              {executionStatus}
              {executionElapsed ? ` ${executionElapsed}` : ""}
            </span>
            <ChevronDown size={16} />
          </button>

          <div className="execution-summary">
            <div className="execution-summary-row">
              {agentRunning ? <Brain size={15} /> : <Activity size={15} />}
              <span>{latestProgress?.title ?? (agentRunning ? "正在思考" : "执行完成")}</span>
              {latestDetail ? <small>{latestDetail}</small> : null}
            </div>

            {editSummary ? (
              <button
                className="execution-summary-row execution-summary-button"
                type="button"
                onClick={openLatestAgentResult}
                disabled={!lastAgentArtifact}
                title="查看执行结果"
              >
                <FileText size={15} />
                <span>已编辑 {editSummary.count} 个文件</span>
                <code>
                  +{editSummary.additions} -{editSummary.deletions}
                </code>
              </button>
            ) : null}
          </div>

          {executionExpanded ? (
            <div className="execution-list">
              {lastAgentArtifact ? (
                <button className="execution-result-button" onClick={openLatestAgentResult} type="button">
                  <PanelRight size={15} />
                  <span>查看执行结果</span>
                </button>
              ) : null}
              {visibleAgentProgress.map((event) => (
                <div className={`execution-step ${event.status}`} key={event.id}>
                  <span className="execution-dot" />
                  <div>
                    <strong>{event.title}</strong>
                    <span>{event.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  function getCurrentThreadFolderId(threadId: string) {
    return projectFoldersState.find((folder) => folder.threads.includes(threadId))?.id ?? null;
  }

  function placeThreadInProject(threadId: string, preferredFolderId: string | null | undefined = undefined) {
    const existingFolderId = getCurrentThreadFolderId(threadId);
    const targetFolderId = preferredFolderId === undefined ? existingFolderId ?? selectedProjectFolderId : preferredFolderId;
    const folderExists = targetFolderId ? projectFoldersState.some((folder) => folder.id === targetFolderId) : false;
    const finalFolderId = folderExists ? targetFolderId : null;

    setRootThreadIds((current) => {
      const withoutThread = current.filter((item) => item !== threadId);
      return finalFolderId ? withoutThread : [threadId, ...withoutThread];
    });

    setProjectFoldersState((current) =>
      current.map((folder) => {
        const withoutThread = folder.threads.filter((item) => item !== threadId);
        return folder.id === finalFolderId
          ? {
              ...folder,
              threads: [threadId, ...withoutThread]
            }
          : {
              ...folder,
              threads: withoutThread
            };
      })
    );
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              projectFolderId: finalFolderId
            }
          : thread
      )
    );
  }

  function createTaskThread(seedPrompt = "", folderId: string | null = selectedProjectFolderId) {
    const mode = inferAgentMode(seedPrompt);
    const folder = folderId ? projectFoldersState.find((item) => item.id === folderId) : null;
    const threadWorkspacePath = folder?.path || workspacePath;
    const nextThread: Thread = {
      id: `thread-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: buildFallbackTaskTitle(seedPrompt),
      kind: mode === "chat" ? "Chat" : "Coding",
      model: AUTO_MODEL_LABEL,
      status: "waiting",
      updatedAt: "刚刚",
      createdAt: Date.now(),
      workspacePath: threadWorkspacePath,
      projectFolderId: folderId
    };

    setThreads((current) => [nextThread, ...current]);
    setActiveThreadId(nextThread.id);
    setThreadRecords((current) => ({
      ...current,
      [nextThread.id]: emptyThreadRecord()
    }));
    placeThreadInProject(nextThread.id, folderId);
    return nextThread;
  }

  function renameThread(threadId: string, title: string) {
    if (!threadId || threadId === DRAFT_THREAD_ID) {
      return;
    }

    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              title: title || "未命名任务"
            }
          : thread
      )
    );
  }

  async function steerRunningTask(visibleBody: string) {
    if (!isPersistableThread(activeThreadId) || !activeAgentTaskId) {
      addAudit("Agent Session", "steer 失败", "当前没有正在运行的任务", "warn");
      return;
    }

    updateMessagesForThread(activeThreadId, (current) => [
      ...current,
      {
        id: `message-user-steer-${Date.now()}`,
        role: "user",
        author: "你",
        body: visibleBody,
        time: timeNow()
      }
    ], true);
    recordAgentProgress(activeAgentTaskId, "收到中途补充", visibleBody.slice(0, 120), "running", activeThreadId, true);
    setComposer("");
    setAttachments([]);
    addAudit("Agent Session", "steer", visibleBody.slice(0, 120), "info");

    const result = await window.fiitx?.steerAgent?.({
      threadId: activeThreadId,
      taskId: activeAgentTaskId,
      text: visibleBody
    });

    if (result && !result.ok) {
      recordAgentProgress(activeAgentTaskId, "Steer 失败", result.message || "Agent session 不可用", "warn", activeThreadId, true);
    }
  }

  async function abortActiveTask() {
    if (!isPersistableThread(activeThreadId) || !activeAgentTaskId) {
      return;
    }

    recordAgentProgress(activeAgentTaskId, "请求停止", "用户停止当前 Agent 回合。", "warn", activeThreadId, true);
    const result = await window.fiitx?.abortAgent?.({
      threadId: activeThreadId,
      taskId: activeAgentTaskId
    });
    addAudit("Agent Session", result?.ok ? "abort" : "abort 失败", result?.message || activeThreadId, result?.ok ? "warn" : "info");
  }

  async function sendMessage() {
    const body = composer.trim();
    if (!body && attachments.length === 0) {
      return;
    }

    const attachmentSummary = attachments.map((path) => path.split("/").pop()).join(", ");
    const visibleBody = [body || "请处理这些附件。", attachmentSummary ? `附件：${attachmentSummary}` : ""]
      .filter(Boolean)
      .join("\n");

    if (agentRunning) {
      await steerRunningTask(visibleBody);
      return;
    }

    const permission = permissionOptions.find((option) => option.id === permissionMode) ?? permissionOptions[0];
    const optimisticMode = inferAgentMode(body || "请处理这些附件。", attachments);
    const optimisticAgentLabel = agentLabel(optimisticMode);
    const runtimeThread = activeThread.id === DRAFT_THREAD_ID ? createTaskThread(body || "请处理这些附件。", selectedProjectFolderId) : activeThread;
    placeThreadInProject(runtimeThread.id);
    const agentMessageId = `message-agent-${Date.now()}`;
    const taskId = `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const taskPayload: FiitxAgentTaskPayload = {
      taskId,
      prompt: body || "请处理这些附件。",
      workspacePath,
      model: AUTO_MODEL,
      permissionMode,
      policySettings,
      attachments,
      threadId: runtimeThread.id,
      currentDate: getCurrentDateContext(),
      timeZone: "Asia/Shanghai",
      contextMessages: buildPiContextMessages()
    };
    const optimisticBody =
      optimisticMode === "chat"
        ? "正在分析上下文并自动选择模型。"
        : `正在分析任务意图并自动选择模型。权限为“${permission.label}”。`;
    const startedAt = Date.now();
    setActiveAgentTaskId(taskId);
    setAgentProgressEvents([]);
    setLastAgentArtifact(null);
    setExecutionArtifacts([]);
    setExecutionStartedAt(startedAt);
    setExecutionFinishedAt(null);
    setStatusNow(startedAt);
    setExecutionExpanded(true);
    updateThreadRecord(runtimeThread.id, (record) => ({
      ...record,
      activeAgentTaskId: taskId,
      progressEvents: [],
      lastAgentArtifact: null,
      executionArtifacts: [],
      executionStartedAt: startedAt,
      executionFinishedAt: null,
      executionExpanded: true
    }));
    recordAgentProgress(taskId, "提交任务", visibleBody.slice(0, 120), "running", runtimeThread.id, true);

    updateMessagesForThread(runtimeThread.id, (current) => [
      ...current,
      {
        id: `message-user-${Date.now()}`,
        role: "user",
        author: "你",
        body: visibleBody,
        time: timeNow()
      },
      {
        id: agentMessageId,
        role: "agent",
        author: optimisticAgentLabel,
        body: optimisticBody,
          time: timeNow()
        }
    ], true);
    setThreads((current) =>
      current.map((thread) =>
        thread.id === runtimeThread.id
          ? {
              ...thread,
              model: AUTO_MODEL_LABEL,
              kind: optimisticMode === "chat" ? "Chat" : "Coding",
              status: "running",
              updatedAt: "刚刚"
            }
          : thread
      )
    );
    setComposer("");
    setAttachments([]);
    setAgentRunning(true);
    addAudit(
      optimisticAgentLabel,
      optimisticMode === "chat" ? "启动 Chat 回合" : permission.auditLabel,
      optimisticMode === "chat" ? AUTO_MODEL_LABEL : runtimeThread.title,
      optimisticMode === "chat" ? "info" : permissionMode === "ask" ? "warn" : "success"
    );

    try {
      const result = await runAgentTask(taskPayload);
      if (result.title) {
        renameThread(runtimeThread.id, result.title);
      }
      updateMessagesForThread(runtimeThread.id, (current) =>
        current.map((message) =>
          message.id === agentMessageId
            ? {
                ...message,
                author: result.ok ? agentLabel(result.mode) : "Agent Runtime",
                body: result.summary
              }
            : message
        )
      , true);

      if (result.artifact) {
        const artifact = result.artifact as FileArtifact;
        updateArtifactsForThread(runtimeThread.id, (current) => [artifact, ...current], true);
        setThreadLastArtifact(runtimeThread.id, artifact, true);
        setThreadExecutionArtifacts(runtimeThread.id, [artifact], true);
        selectFileArtifact(artifact);
      }
      recordAgentProgress(
        taskId,
        result.ok ? "执行完成" : "执行异常",
        result.artifact ? `结果已生成：${result.artifact.title}` : result.summary,
        result.ok ? "success" : "warn",
        runtimeThread.id,
        true
      );

      if (result.approvalRequests?.length) {
        appendApprovalRequests(result.approvalRequests, {
          ...taskPayload,
          permissionMode: "auto",
          taskId: `task-${Date.now()}-${Math.random().toString(16).slice(2)}`
        });
      }
      appendAuditEvents(result.toolEvents ?? []);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === runtimeThread.id
            ? {
                ...thread,
                model: result.provider && result.model ? `${result.provider} / ${result.model}` : result.model ?? AUTO_MODEL_LABEL,
                status: result.approvalRequests?.length ? "waiting" : result.ok ? "done" : "waiting",
                updatedAt: "刚刚"
              }
            : thread
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent runtime 执行失败";
      updateMessagesForThread(runtimeThread.id, (current) =>
        current.map((item) =>
          item.id === agentMessageId
            ? {
                ...item,
                author: "Agent Runtime",
                body: `任务失败：${message}`
              }
            : item
        )
      , true);
      addAudit("Agent Runtime", "任务失败", message, "warn");
      recordAgentProgress(taskId, "任务失败", message, "warn", runtimeThread.id, true);
    } finally {
      const finishedAt = Date.now();
      setExecutionFinishedAt(finishedAt);
      setStatusNow(finishedAt);
      setExecutionExpanded(false);
      updateThreadRecord(runtimeThread.id, (record) => ({
        ...record,
        executionFinishedAt: finishedAt,
        executionExpanded: false
      }));
      setAgentRunning(false);
    }
  }

  async function resumeApprovedTask(approval: Approval) {
    if (!approval.resumePayload) {
      return;
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const payload: FiitxAgentTaskPayload = {
      ...approval.resumePayload,
      taskId,
      permissionMode: "auto"
    };
    const agentMessageId = `message-agent-${Date.now()}`;
    const startedAt = Date.now();
    setActiveAgentTaskId(taskId);
    setAgentRunning(true);
    setExecutionArtifacts([]);
    setExecutionStartedAt(startedAt);
    setExecutionFinishedAt(null);
    setStatusNow(startedAt);
    setExecutionExpanded(true);
    updateThreadRecord(payload.threadId, (record) => ({
      ...record,
      activeAgentTaskId: taskId,
      executionArtifacts: [],
      executionStartedAt: startedAt,
      executionFinishedAt: null,
      executionExpanded: true
    }));
    recordAgentProgress(taskId, "恢复执行", approval.command, "running", payload.threadId, payload.threadId === activeThreadId);
    updateMessagesForThread(payload.threadId, (current) => [
      ...current,
      {
        id: agentMessageId,
        role: "agent",
        author: "Coding Agent",
        body: "已收到审批，继续执行任务。",
        time: timeNow()
      }
    ], payload.threadId === activeThreadId);

    try {
      const result = await runAgentTask(payload);
      if (result.title) {
        renameThread(payload.threadId, result.title);
      }
      updateMessagesForThread(payload.threadId, (current) =>
        current.map((message) =>
          message.id === agentMessageId
            ? {
                ...message,
                author: result.ok ? agentLabel(result.mode) : "Agent Runtime",
                body: result.summary
              }
            : message
        )
      , payload.threadId === activeThreadId);
      if (result.artifact) {
        const artifact = result.artifact as FileArtifact;
        updateArtifactsForThread(payload.threadId, (current) => [artifact, ...current], payload.threadId === activeThreadId);
        setThreadLastArtifact(payload.threadId, artifact, payload.threadId === activeThreadId);
        setThreadExecutionArtifacts(payload.threadId, [artifact], payload.threadId === activeThreadId);
        if (payload.threadId === activeThreadId) {
          selectFileArtifact(artifact);
        }
      }
      appendAuditEvents(result.toolEvents ?? []);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === payload.threadId
            ? {
                ...thread,
                model: result.model ?? payload.model,
                status: result.ok ? "done" : "waiting",
                updatedAt: "刚刚"
              }
            : thread
        )
      );
      recordAgentProgress(taskId, result.ok ? "执行完成" : "执行异常", result.summary, result.ok ? "success" : "warn", payload.threadId, payload.threadId === activeThreadId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "审批后恢复执行失败";
      recordAgentProgress(taskId, "恢复失败", message, "warn", payload.threadId, payload.threadId === activeThreadId);
      addAudit("Agent Runtime", "审批后恢复失败", message, "warn");
    } finally {
      const finishedAt = Date.now();
      setExecutionFinishedAt(finishedAt);
      setStatusNow(finishedAt);
      setExecutionExpanded(false);
      updateThreadRecord(payload.threadId, (record) => ({
        ...record,
        executionFinishedAt: finishedAt,
        executionExpanded: false
      }));
      setAgentRunning(false);
    }
  }

  async function resolveApproval(id: string, status: Exclude<ApprovalStatus, "pending">) {
    const approval = approvals.find((item) => item.id === id);
    if (!approval) {
      return;
    }

    setApprovals((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
    const targetThreadId = approval.resumePayload?.threadId || activeThreadId;
    updateMessagesForThread(targetThreadId, (current) => [
      ...current,
      {
        id: `message-approval-${Date.now()}`,
        role: "system",
        author: "Policy Engine",
        body:
          status === "approved"
            ? `已批准：${approval.command}`
            : `已拒绝：${approval.command}`,
        time: timeNow()
      }
    ], targetThreadId === activeThreadId);
    setThreads((current) =>
      current.map((thread) =>
        thread.id === approval.resumePayload?.threadId
          ? { ...thread, status: status === "approved" ? "running" : "done", updatedAt: "刚刚" }
          : thread
      )
    );
    addAudit("Policy Engine", status === "approved" ? "批准工具调用" : "拒绝工具调用", approval.command, status === "approved" ? "success" : "warn");
    if (status === "approved") {
      await resumeApprovedTask(approval);
    }
  }

  function selectProvider(name: string) {
    const provider = providerTemplates.find((item) => item.name === name);
    const capabilityDefaults = providerCapabilityDefaults[name] ?? {};
    setModelForm((current) => ({
      ...current,
      ...capabilityDefaults,
      provider: name,
      model: providerModelDefaults[name] ?? current.model,
      baseUrl: provider?.baseUrl ?? current.baseUrl
    }));
    setTestState("idle");
    setTestMessage("等待连接测试");
  }

  function toggleBestFor(item: string) {
    setModelForm((current) => ({
      ...current,
      bestFor: current.bestFor.includes(item)
        ? current.bestFor.filter((value) => value !== item)
        : current.bestFor.concat(item)
    }));
  }

  function setPolicyActionMode(action: string, mode: ToolPolicyMode) {
    setPolicySettings((current) => ({
      ...current,
      actionModes: {
        ...current.actionModes,
        [action]: mode
      }
    }));
  }

  function setDefaultPolicyMode(mode: PermissionMode) {
    setPolicySettings((current) => ({
      ...current,
      defaultPermissionMode: mode
    }));
    setPermissionMode(mode);
  }

  async function testModelConnection() {
    setTestState("testing");
    setTestMessage("正在校验 provider、模型和凭据格式");
    const payload = {
      ...modelForm,
      contextWindow: Number(modelForm.contextWindow)
    };
    const result = await window.fiitx?.testModelConnection(payload);

    if (result?.ok || (!window.fiitx && modelForm.provider && modelForm.model && modelForm.apiKey)) {
      setTestState("passed");
      setTestMessage(result?.message ?? "本地预览环境校验通过");
      addAudit("Model Center", "模型连接测试通过", `${modelForm.provider} / ${modelForm.model}`, "success");
    } else {
      setTestState("failed");
      setTestMessage(result?.message ?? "供应商、模型和 API Key 不能为空");
      addAudit("Model Center", "模型连接测试失败", `${modelForm.provider} / ${modelForm.model}`, "warn");
    }
  }

  async function saveModelProfile() {
    setSavingProfile(true);
    const payload = {
      ...modelForm,
      contextWindow: Number(modelForm.contextWindow)
    };

    try {
      const saved = await window.fiitx?.saveModelProfile(payload);
      const profile =
        saved ??
        ({
          id: `local-${Date.now()}`,
          provider: payload.provider,
          model: payload.model,
          baseUrl: payload.baseUrl,
          apiKeyRef: `keychain:${payload.provider}:${payload.model}`,
          contextWindow: payload.contextWindow,
          supportsTools: payload.supportsTools,
          supportsVision: payload.supportsVision,
          supportsStreaming: payload.supportsStreaming,
          supportsJsonMode: payload.supportsJsonMode,
          bestFor: payload.bestFor,
          toolCallStyle: payload.toolCallStyle,
          updatedAt: new Date().toISOString()
      } satisfies FiitxModelProfile);

      setProfiles((current) => current.filter((item) => item.id !== profile.id).concat(profile));
      setModelForm((current) => ({ ...current, apiKey: "" }));
      addAudit("Model Center", "保存模型 profile", `${profile.provider} / ${profile.model}`, "success");
    } finally {
      setSavingProfile(false);
    }
  }

  function renderHeader() {
    const workspaceLabel = workspacePath ? workspacePath.split("/").filter(Boolean).slice(-1)[0] : "选择工作区";
    return (
      <header className="topbar">
        <div>
          <div className="eyebrow">Fiitx BYOM Agent Desktop</div>
          <h1>{navItems.find((item) => item.id === activeView)?.label}</h1>
        </div>
        <div className="topbar-actions">
          <button className="icon-text-button ghost" onClick={chooseWorkspace} title="选择工作区">
            <FolderOpen size={17} />
            <span>{workspaceLabel}</span>
          </button>
          <button className="icon-button ghost" title="刷新状态">
            <RefreshCw size={18} />
          </button>
          <button className="primary-button" onClick={createThread}>
            <Plus size={17} />
            <span>新建任务</span>
          </button>
        </div>
      </header>
    );
  }

  function renderSelectedFileToolbar() {
    if (!selectedFile) {
      return null;
    }

    const targetTab = artifactTabs.find((tab) => tab.id === getArtifactIdForFile(selectedFile)) ?? artifactTabs[2];
    const TargetIcon = targetTab.icon;
    return (
      <div className="file-action-toolbar">
        <button className="file-action active" onClick={() => setActiveArtifact(targetTab.id)}>
          <TargetIcon size={15} />
          <span>{targetTab.label}</span>
        </button>
        <button className="file-action">
          <Download size={15} />
          <span>导出</span>
        </button>
        <button className="file-action" onClick={() => setSelectedFile(null)}>
          <X size={15} />
          <span>关闭</span>
        </button>
      </div>
    );
  }

  function renderProjectSection() {
    return (
      <div className="sidebar-section project-section">
        <div className="sidebar-section-heading">
          <button
            className={selectedProjectFolderId ? "section-label project-root-button" : "section-label project-root-button active"}
            onClick={() => setSelectedProjectFolderId(null)}
            title="选择项目根目录"
            type="button"
          >
            项目
          </button>
          <div className="project-menu-wrap">
            <button className="section-icon-button" onClick={() => setProjectMenuOpen((open) => !open)} title="添加项目文件夹">
              <FolderPlus size={16} />
            </button>
            {projectMenuOpen ? (
              <div className="project-menu-popover">
                <button onClick={createBlankProject}>
                  <SquarePlus size={16} />
                  <span>新建空白项目</span>
                </button>
                <button onClick={addExistingFolderProject}>
                  <Folder size={16} />
                  <span>使用现有文件夹</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="project-tree">
          {rootThreadIds.length === 0 && projectFoldersState.length === 0 ? <div className="empty-inline">暂无任务</div> : null}
          {rootThreadIds.length > 0 ? (
            <div className="project-thread-list root-thread-list">
              {rootThreadIds.map((threadId) => {
                const thread = threads.find((item) => item.id === threadId);
                if (!thread) {
                  return null;
                }

                return (
                  <button
                    className={thread.id === activeThread.id ? "project-thread-row active" : "project-thread-row"}
                    key={`root-${thread.id}`}
                    onClick={() => openTaskThread(thread.id, null)}
                  >
                    <span className={`status-dot ${thread.status}`} />
                    <span>
                      <strong>{thread.title}</strong>
                      <small>{thread.kind}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {projectFoldersState.map((folder) => {
            const isCollapsed = Boolean(collapsedProjectFolders[folder.id]);
            const isSelected = selectedProjectFolderId === folder.id;
            return (
              <div className="project-folder" key={folder.id}>
                <button
                  className={[
                    "project-folder-title",
                    isCollapsed ? "collapsed" : "",
                    isSelected ? "selected" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => toggleProjectFolder(folder.id)}
                  aria-expanded={!isCollapsed}
                  title={isCollapsed ? "展开文件夹" : "关闭文件夹"}
                >
                  {isCollapsed ? <Folder size={16} /> : <FolderOpen size={16} />}
                  <span>{folder.name}</span>
                  <ChevronDown className="folder-caret" size={15} />
                </button>
                {!isCollapsed ? (
                  <div className="project-thread-list">
                    {folder.threads.map((threadId) => {
                      const thread = threads.find((item) => item.id === threadId);
                      if (!thread) {
                        return null;
                      }

                      return (
                        <button
                          className={thread.id === activeThread.id ? "project-thread-row active" : "project-thread-row"}
                          key={`${folder.id}-${thread.id}`}
                          onClick={() => openTaskThread(thread.id, folder.id)}
                        >
                          <span className={`status-dot ${thread.status}`} />
                          <span>
                            <strong>{thread.title}</strong>
                            <small>{thread.kind}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderSidebar() {
    return (
      <aside className="sidebar">
        <div className="window-drag" />
        <div className="brand">
          <img src={logoUrl} alt="Fiitx" />
          <div>
            <strong>Fiitx</strong>
            <span>Enterprise Agent</span>
          </div>
        </div>

        {renderProjectSection()}

        <nav className="nav-list">
          {navItems.filter((item) => !["workbench", "models"].includes(item.id)).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activeView === item.id ? "nav-item active" : "nav-item"}
                onClick={() => setActiveView(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.id === "approvals" && pendingApprovalCount > 0 ? (
                  <b className="nav-badge">{pendingApprovalCount}</b>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-section">
          <div className="section-label">模型路由</div>
          <button className={activeView === "models" ? "route-pill route-button active" : "route-pill route-button"} onClick={() => setActiveView("models")}>
            <Store size={15} />
            <span>模型中心</span>
          </button>
          <div className="route-pill">
            <Sparkles size={15} />
            <span>{AUTO_MODEL_LABEL}</span>
          </div>
          <div className="route-pill muted">
            <Database size={15} />
            <span>{profiles.filter((profile) => profile.updatedAt !== "default").length} 个已配置 Key</span>
          </div>
          <div className="route-pill muted">
            <LockKeyhole size={15} />
            <span>{encryptionAvailable ? "Keychain 加密" : "本地加密不可用"}</span>
          </div>
        </div>

        <footer className="sidebar-footer">
          <span>{platform}</span>
          <span>v0.1.0</span>
        </footer>
      </aside>
    );
  }

  function renderWorkbench() {
    return (
      <div
        className={[
          "workbench-grid",
          visiblePanels.artifact ? "" : "artifact-hidden"
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <section className="conversation panel">
          <div className="task-scroll-area" ref={taskScrollRef}>
            <div className="task-header">
              <div>
                <input
                  className="task-title-input"
                  value={activeThread.title}
                  onChange={(event) => renameThread(activeThread.id, event.target.value)}
                  placeholder="未命名任务"
                  disabled={activeThread.id === DRAFT_THREAD_ID}
                />
                <p>{activeThread.kind} · {activeThread.model}</p>
              </div>
              {activeThread.id !== DRAFT_THREAD_ID ? <div className={`task-status ${activeThread.status}`}>{statusLabel(activeThread.status)}</div> : null}
            </div>

            <div className="tool-timeline">
              <div className="timeline-step done">
                <Check size={15} />
                <span>Workspace</span>
              </div>
              <div className="timeline-step done">
                <Brain size={15} />
                <span>Model</span>
              </div>
              <div className="timeline-step active">
                <ShieldCheck size={15} />
                <span>Approval</span>
              </div>
              <div className="timeline-step">
                <PanelRight size={15} />
                <span>Artifact</span>
              </div>
            </div>

            {artifacts.length > 0 ? (
              <div className="changed-files-card">
                <div className="changed-files-header">
                  <div>
                    <strong>Artifact {artifacts.length} 个文件</strong>
                    <span>+{artifacts.reduce((sum, file) => sum + file.additions, 0)} -{artifacts.reduce((sum, file) => sum + file.deletions, 0)}</span>
                  </div>
                  <button className="icon-text-button" title="审核文件变更">
                    <ClipboardCheck size={16} />
                    <span>审核</span>
                  </button>
                </div>
                <div className="changed-files-list">
                  {artifacts.map((file) => (
                    <button
                      key={file.path}
                      className={selectedFile?.path === file.path ? "changed-file-row active" : "changed-file-row"}
                      onClick={() => selectFileArtifact(file)}
                    >
                      <span>{file.title}</span>
                      <code>
                        +{file.additions} -{file.deletions}
                      </code>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="message-list">
              {messages.map((message) => (
                <article key={message.id} className={`message ${message.role}`}>
                  <div className="avatar">
                    {message.role === "user" ? <UserRound size={16} /> : message.role === "agent" ? <Bot size={16} /> : <ShieldCheck size={16} />}
                  </div>
                  <div className="message-body">
                    <div className="message-meta">
                      <strong>{message.author}</strong>
                      <span>{message.time}</span>
                    </div>
                    {renderMessageBody(message)}
                  </div>
                </article>
              ))}
              {renderExecutionActivity()}
            </div>
            <div className="message-end-anchor" ref={messageEndRef} />
          </div>

          <div className="composer">
            {attachments.length > 0 ? (
              <div className="attachment-row">
                {attachments.map((path) => (
                  <button className="attachment-chip" key={path} onClick={() => selectAttachmentArtifact(path)} title="查看附件内容">
                    <FileText size={14} />
                    <span>{path.split("/").pop()}</span>
                    <X size={13} />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="composer-input">
              <textarea
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="输入消息或任务"
              />
            </div>
            <div className="composer-actions">
              <div className="composer-actions-left">
                <button className="composer-icon-button" onClick={addAttachments} title="添加附件">
                  <Plus size={21} />
                </button>
                <label className={`composer-select permission-control ${permissionMode}`}>
                  <Shield size={16} />
                  <select value={permissionMode} onChange={(event) => setPermissionMode(event.target.value as PermissionMode)}>
                    {permissionOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} />
                </label>
              </div>
              <div className="composer-actions-right">
                <button className="composer-icon-button" onClick={startVoiceInput} title="语音输入">
                  <Mic size={19} />
                </button>
                {agentRunning ? (
                  <button className="composer-icon-button danger" onClick={abortActiveTask} title="停止当前回合">
                    <X size={18} />
                  </button>
                ) : null}
                <button
                  className="send-button"
                  onClick={sendMessage}
                  title={agentRunning ? "发送中途补充" : "发送任务"}
                  disabled={!composer.trim() && attachments.length === 0}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {visiblePanels.artifact ? (
          <section className="artifact-pane panel">
            <div className="panel-header">
              <div>
                <span>{selectedFile ? selectedFile.title : "Artifact"}</span>
                <small>{selectedFile ? `${selectedFile.language} · ${selectedFile.status}` : "等待文件或执行结果"}</small>
              </div>
              <button className="icon-text-button" title="导出">
                <Download size={16} />
                <span>导出</span>
              </button>
            </div>

            {renderSelectedFileToolbar()}

            <div className="artifact-tabs">
              {getVisibleArtifactTabs().map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    className={activeArtifact === tab.id ? "artifact-tab active" : "artifact-tab"}
                    onClick={() => setActiveArtifact(tab.id)}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {renderArtifact()}

            <div className="approval-strip">
              <div className="strip-title">
                <AlertTriangle size={16} />
                <span>待审批动作</span>
              </div>
              {approvals
                .filter((approval) => approval.status === "pending")
                .slice(0, 2)
                .map((approval) => (
                  <div className="approval-mini" key={approval.id}>
                    <div>
                      <strong>{approval.title}</strong>
                      <small>{approval.command}</small>
                    </div>
                    <div className="mini-actions">
                      <button className="icon-button success" title="批准" onClick={() => resolveApproval(approval.id, "approved")}>
                        <Check size={15} />
                      </button>
                      <button className="icon-button danger" title="拒绝" onClick={() => resolveApproval(approval.id, "denied")}>
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  function renderArtifact() {
    if (selectedFile) {
      const header = [
        `### ${selectedFile.title}`,
        `- 路径：${selectedFile.path}`,
        `- 状态：${selectedFile.status}，+${selectedFile.additions} -${selectedFile.deletions}`
      ].join("\n");
      const artifactMarkdown = `${header}\n\n${selectedFile.preview}`;

      if (activeArtifact === "image") {
        const extension = getArtifactExtension(selectedFile);
        const mediaKind = getMediaKindFromExtension(extension);
        const source = selectedFile.path || selectedFile.preview;
        const htmlContent = mediaKind === "html" ? selectedFile.preview : "";
        const mediaPreview = renderMediaPreview(source, selectedFile.title, `selected-media-${selectedFile.path}`, htmlContent);

        if (mediaPreview) {
          return (
            <div className="artifact-preview selected-media-preview">
              {mediaPreview}
            </div>
          );
        }

        return (
          <div className="artifact-preview cover-art selected-image-preview">
            <img src={getFileUrl(selectedFile.path)} alt={selectedFile.title} />
            <div>
              <strong>{selectedFile.title}</strong>
              <span>{selectedFile.path}</span>
            </div>
          </div>
        );
      }

      if (activeArtifact === "ppt") {
        return (
          <div className="artifact-preview document selected-file-document markdown-message artifact-markdown">
            <button className="markdown-copy-button" onClick={() => copyText(artifactMarkdown)} title="复制 Markdown">
              <Copy size={14} />
              <span>复制</span>
            </button>
            {renderMarkdownBlocks(artifactMarkdown)}
          </div>
        );
      }

      if (activeArtifact === "report") {
        return (
          <div className="artifact-preview document selected-file-document markdown-message artifact-markdown">
            <button className="markdown-copy-button" onClick={() => copyText(artifactMarkdown)} title="复制 Markdown">
              <Copy size={14} />
              <span>复制</span>
            </button>
            {renderMarkdownBlocks(artifactMarkdown)}
          </div>
        );
      }

      return (
        <div className="artifact-preview diff selected-file-preview artifact-code-preview">
          {renderCodeBlock(selectedFile.preview, selectedFile.language || getArtifactExtension(selectedFile), `artifact-${selectedFile.path}`)}
        </div>
      );
    }

    return (
      <div className="artifact-preview empty-artifact">
        <FileText size={22} />
        <span>暂无 Artifact</span>
      </div>
    );
  }

  function renderModels() {
    return (
      <div className="model-layout">
        <section className="panel provider-panel">
          <div className="panel-header">
            <div>
              <span>供应商</span>
              <small>一等 provider 配置</small>
            </div>
          </div>
          <div className="provider-list">
            {providerTemplates.map((provider) => (
              <button
                key={provider.name}
                className={modelForm.provider === provider.name ? "provider-row active" : "provider-row"}
                onClick={() => selectProvider(provider.name)}
              >
                <span>{provider.name}</span>
                <small>{provider.tag}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="panel config-panel">
          <div className="panel-header">
            <div>
              <span>模型 Profile</span>
              <small>保存为可路由模型</small>
            </div>
            <div className={`test-chip ${testState}`}>{testMessage}</div>
          </div>

          <div className="form-grid">
            <label>
              <span>Provider</span>
              <input value={modelForm.provider} onChange={(event) => setModelForm((current) => ({ ...current, provider: event.target.value }))} />
            </label>
            <label>
              <span>Model</span>
              <input value={modelForm.model} onChange={(event) => setModelForm((current) => ({ ...current, model: event.target.value }))} />
            </label>
            <label className="wide">
              <span>Base URL</span>
              <input value={modelForm.baseUrl} onChange={(event) => setModelForm((current) => ({ ...current, baseUrl: event.target.value }))} />
            </label>
            <label className="wide">
              <span>API Key</span>
              <input
                type="password"
                value={modelForm.apiKey}
                onChange={(event) => setModelForm((current) => ({ ...current, apiKey: event.target.value }))}
                placeholder="保存时写入系统安全存储"
              />
            </label>
            <label>
              <span>Context Window</span>
              <input
                type="number"
                value={modelForm.contextWindow}
                onChange={(event) => setModelForm((current) => ({ ...current, contextWindow: Number(event.target.value) }))}
              />
            </label>
            <label>
              <span>Tool Call Style</span>
              <select value={modelForm.toolCallStyle} onChange={(event) => setModelForm((current) => ({ ...current, toolCallStyle: event.target.value }))}>
                <option value="openai">openai</option>
                <option value="anthropic">anthropic</option>
                <option value="gemini">gemini</option>
                <option value="none">none</option>
              </select>
            </label>
          </div>

          <div className="capability-row">
            {[
              ["supportsTools", "Tools"],
              ["supportsVision", "Vision"],
              ["supportsStreaming", "Streaming"],
              ["supportsJsonMode", "JSON Mode"]
            ].map(([key, label]) => (
              <button
                key={key}
                className={modelForm[key as keyof ModelForm] ? "toggle active" : "toggle"}
                onClick={() =>
                  setModelForm((current) => ({
                    ...current,
                    [key]: !current[key as keyof ModelForm]
                  }))
                }
              >
                <Check size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="chips">
            {bestForOptions.map((item) => (
              <button key={item} className={modelForm.bestFor.includes(item) ? "chip active" : "chip"} onClick={() => toggleBestFor(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className="form-actions">
            <button className="icon-text-button" onClick={testModelConnection}>
              <Play size={16} />
              <span>{testState === "testing" ? "测试中" : "测试连接"}</span>
            </button>
            <button className="primary-button" onClick={saveModelProfile} disabled={savingProfile}>
              <Save size={16} />
              <span>{savingProfile ? "保存中" : "保存 Profile"}</span>
            </button>
          </div>
        </section>

        <section className="panel profiles-panel">
          <div className="panel-header">
            <div>
              <span>已配置模型</span>
              <small>{profiles.length} 个 profile</small>
            </div>
          </div>
          <div className="profile-list">
            {profiles.map((profile) => (
              <div className="profile-row" key={profile.id}>
                <div className="profile-icon">
                  <KeyRound size={18} />
                </div>
                <div>
                  <strong>{profile.model}</strong>
                  <span>{profile.provider} · {profileSummary(profile)}</span>
                  <small>{profile.apiKeyRef}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderAgents() {
    return (
      <div className="agents-layout">
        {agents.length === 0 ? <div className="panel empty-state">暂无 Agent 编排</div> : null}
        {agents.map((agent) => (
          <section className={`agent-panel panel ${agent.accent}`} key={agent.name}>
            <div className="agent-heading">
              <div>
                <span className={`agent-status ${agent.status}`}>{agent.status}</span>
                <h3>{agent.name}</h3>
                <p>{agent.scope}</p>
              </div>
              <Bot size={24} />
            </div>
            <div className="agent-meta">
              <span>模型</span>
              <strong>{agent.model}</strong>
            </div>
            <div className="tool-grid">
              {agent.tools.map((tool) => (
                <span key={tool}>{tool}</span>
              ))}
            </div>
            <button className="icon-text-button">
              <Workflow size={16} />
              <span>打开编排</span>
            </button>
          </section>
        ))}
      </div>
    );
  }

  function renderApprovals() {
    return (
      <div className="approval-layout panel">
        <div className="panel-header">
          <div>
            <span>权限审批队列</span>
            <small>Shell、网络、文件写入和敏感读取</small>
          </div>
        </div>
        <div className="approval-table">
          {approvals.length === 0 ? <div className="empty-state">暂无审批动作</div> : null}
          {approvals.map((approval) => (
            <div className={`approval-row ${approval.status}`} key={approval.id}>
              <div className="approval-risk">
                <AlertTriangle size={17} />
                <span>{riskLabel(approval.risk)}</span>
              </div>
              <div className="approval-content">
                <strong>{approval.title}</strong>
                <p>{approval.detail}</p>
                <code>{approval.command}</code>
              </div>
              <div className="approval-requester">{approval.requester}</div>
              <div className="approval-status">{approval.status}</div>
              <div className="approval-actions">
                <button className="icon-button success" title="批准" disabled={approval.status !== "pending"} onClick={() => resolveApproval(approval.id, "approved")}>
                  <Check size={16} />
                </button>
                <button className="icon-button danger" title="拒绝" disabled={approval.status !== "pending"} onClick={() => resolveApproval(approval.id, "denied")}>
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderAudit() {
    return (
      <div className="audit-layout panel">
        <div className="panel-header">
          <div>
            <span>审计日志</span>
            <small>任务、模型、工具和策略事件</small>
          </div>
          <button className="icon-text-button">
            <Download size={16} />
            <span>诊断包</span>
          </button>
        </div>
        <div className="audit-table">
          {auditLogs.length === 0 ? <div className="empty-state">暂无审计事件</div> : null}
          {auditLogs.map((log) => (
            <div className={`audit-row ${log.level}`} key={log.id}>
              <span>{log.time}</span>
              <strong>{log.actor}</strong>
              <p>{log.event}</p>
              <code>{log.target}</code>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderSettings() {
    const policyRows = [
      ["workspace.scan", "Workspace 扫描", "读取文件列表和安全文本片段，构建 coding 上下文。"],
      ["workspace.write_manifest", "文件写入", "模型返回 file manifest 后写入当前 workspace。"],
      ["shell.exec", "Shell 命令", "执行 bash/npm/git 等本地命令。"],
      ["network.request", "网络访问", "访问外部 URL、下载依赖或查询远程资源。"],
      ["sensitive.read", "敏感读取", "读取 .env、ssh key、token、证书等敏感文件。"]
    ] as const;

    return (
      <div className="settings-layout">
        <section className="panel policy-panel">
          <div className="panel-header">
            <div>
              <span>安全策略</span>
              <small>默认企业级边界</small>
            </div>
          </div>
          <div className="policy-controls">
            <label>
              <span>默认权限</span>
              <select value={policySettings.defaultPermissionMode} onChange={(event) => setDefaultPolicyMode(event.target.value as PermissionMode)}>
                {permissionOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>工具执行</span>
              <select value={policySettings.toolExecution} onChange={(event) => setPolicySettings((current) => ({ ...current, toolExecution: event.target.value as PolicySettings["toolExecution"] }))}>
                <option value="sequential">sequential</option>
                <option value="parallel">parallel</option>
              </select>
            </label>
            <label>
              <span>Sandbox</span>
              <select value={policySettings.sandboxMode} onChange={(event) => setPolicySettings((current) => ({ ...current, sandboxMode: event.target.value as PolicySettings["sandboxMode"] }))}>
                <option value="read-only">read-only</option>
                <option value="workspace-write">workspace-write</option>
                <option value="danger-full-access">danger-full-access</option>
              </select>
            </label>
          </div>
          {policyRows.map(([action, title, detail]) => (
            <div className="policy-row" key={action}>
              <ShieldCheck size={18} />
              <div>
                <strong>{title}</strong>
                <span>{detail}</span>
                <code>{action}</code>
              </div>
              <select value={policySettings.actionModes[action] ?? "ask"} onChange={(event) => setPolicyActionMode(action, event.target.value as ToolPolicyMode)}>
                <option value="ask">请求批准</option>
                <option value="auto">替我审批</option>
                <option value="full">完全访问</option>
                <option value="block">禁止</option>
              </select>
            </div>
          ))}
        </section>

        <section className="panel metrics-panel">
          <div className="panel-header">
            <div>
              <span>本地状态</span>
              <small>桌面客户端</small>
            </div>
          </div>
          <div className="metric-grid">
            <div>
              <Database size={18} />
              <strong>SQLite</strong>
              <span>session / history</span>
            </div>
            <div>
              <Terminal size={18} />
              <strong>Sandbox</strong>
              <span>tool runtime</span>
            </div>
            <div>
              <Eye size={18} />
              <strong>Audit</strong>
              <span>{auditLogs.length} events</span>
            </div>
            <div>
              <MessageSquare size={18} />
              <strong>Threads</strong>
              <span>{threads.length} active</span>
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderContent() {
    if (activeView === "models") {
      return renderModels();
    }
    if (activeView === "agents") {
      return renderAgents();
    }
    if (activeView === "approvals") {
      return renderApprovals();
    }
    if (activeView === "audit") {
      return renderAudit();
    }
    if (activeView === "settings") {
      return renderSettings();
    }
    return renderWorkbench();
  }

  function renderTerminalPanel() {
    return (
      <section className="terminal-panel">
        <div className="terminal-tabs">
          <button className="terminal-tab active">
            <Terminal size={15} />
            <span>Fiitx</span>
          </button>
          <button className="terminal-tab plus" title="新建终端">
            <Plus size={15} />
          </button>
          <button className="terminal-close" title="关闭 Terminal" onClick={() => togglePanel("terminal")}>
            <X size={16} />
          </button>
        </div>
        <div className="terminal-body">
          <span className="terminal-cursor">▌</span>
          <code>(base) botbotbot@botbotmac Fiitx %</code>
        </div>
      </section>
    );
  }

  function renderEdgeHotspots() {
    return (
      <>
        <button
          className="edge-hotspot sidebar-hotspot"
          title={visiblePanels.sidebar ? "收起左侧导航" : "展开左侧导航"}
          onClick={() => togglePanel("sidebar")}
        >
          {visiblePanels.sidebar ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        {activeView === "workbench" ? (
          <button
            className="edge-hotspot artifact-hotspot"
            title={visiblePanels.artifact ? "收起 Artifact" : "展开 Artifact"}
            onClick={() => togglePanel("artifact")}
          >
            {visiblePanels.artifact ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        ) : null}
        <button
          className="edge-hotspot terminal-hotspot"
          title={visiblePanels.terminal ? "收起 Terminal" : "展开 Terminal"}
          onClick={() => togglePanel("terminal")}
        >
          <Terminal size={18} />
        </button>
      </>
    );
  }

  return (
    <main className={visiblePanels.sidebar ? "app-shell" : "app-shell sidebar-collapsed"}>
      {renderEdgeHotspots()}
      {visiblePanels.sidebar ? renderSidebar() : null}
      <section className={visiblePanels.terminal ? "content-shell" : "content-shell terminal-collapsed"}>
        {renderHeader()}
        {renderContent()}
        {visiblePanels.terminal ? renderTerminalPanel() : null}
      </section>
    </main>
  );
}
