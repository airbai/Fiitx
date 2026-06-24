const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fiitx", {
  getPlatform: () => ipcRenderer.invoke("app:get-platform"),
  chooseWorkspace: () => ipcRenderer.invoke("app:choose-workspace"),
  chooseFiles: () => ipcRenderer.invoke("app:choose-files"),
  savePastedAttachment: (payload) => ipcRenderer.invoke("app:save-pasted-attachment", payload),
  listWorkspaceFiles: (payload) => ipcRenderer.invoke("workspace:list-files", payload),
  readWorkspaceFile: (payload) => ipcRenderer.invoke("workspace:read-file", payload),
  readWorkspaceDiffBase: (payload) => ipcRenderer.invoke("workspace:read-diff-base", payload),
  writeWorkspaceFile: (payload) => ipcRenderer.invoke("workspace:write-file", payload),
  inspectPath: (path, basePath) => ipcRenderer.invoke("path:inspect", { path, basePath }),
  openPath: (path, basePath) => ipcRenderer.invoke("path:open", { path, basePath }),
  openContainingFolder: (path, basePath) => ipcRenderer.invoke("path:show-in-folder", { path, basePath }),
  previewPath: (path, basePath) => ipcRenderer.invoke("path:preview", { path, basePath }),
  listModelProfiles: () => ipcRenderer.invoke("model:list"),
  saveModelProfile: (payload) => ipcRenderer.invoke("model:save", payload),
  testModelConnection: (payload) => ipcRenderer.invoke("model:test", payload),
  loadThreadState: () => ipcRenderer.invoke("thread-state:load"),
  saveThreadState: (payload) => ipcRenderer.invoke("thread-state:save", payload),
  discoverWechatAiSkills: () => ipcRenderer.invoke("wechat-ai:discover-skills"),
  routeWechatAiPrompt: (payload) => ipcRenderer.invoke("wechat-ai:route-prompt", payload),
  invokeWechatAiSkill: (payload) => ipcRenderer.invoke("wechat-ai:invoke-skill", payload),
  getMcpConfig: () => ipcRenderer.invoke("mcp:get-config"),
  saveMcpConfig: (payload) => ipcRenderer.invoke("mcp:save-config", payload),
  upsertMcpServer: (payload) => ipcRenderer.invoke("mcp:upsert-server", payload),
  removeMcpServer: (payload) => ipcRenderer.invoke("mcp:remove-server", payload),
  refreshMcpRegistry: (payload) => ipcRenderer.invoke("mcp:refresh", payload),
  callMcpTool: (payload) => ipcRenderer.invoke("mcp:call-tool", payload),
  listMcpResources: (payload) => ipcRenderer.invoke("mcp:list-resources", payload),
  readMcpResource: (payload) => ipcRenderer.invoke("mcp:read-resource", payload),
  listMcpPrompts: (payload) => ipcRenderer.invoke("mcp:list-prompts", payload),
  getMcpPrompt: (payload) => ipcRenderer.invoke("mcp:get-prompt", payload),
  listSkillCatalog: (payload) => ipcRenderer.invoke("skill-market:list-catalog", payload),
  listInstalledSkills: () => ipcRenderer.invoke("skill-market:list-installed"),
  installLocalSkill: (payload) => ipcRenderer.invoke("skill-market:install-local", payload),
  uninstallSkill: (payload) => ipcRenderer.invoke("skill-market:uninstall", payload),
  setSkillEnabled: (payload) => ipcRenderer.invoke("skill-market:set-enabled", payload),
  getWechatChannelStatus: () => ipcRenderer.invoke("wechat-channel:status"),
  runTerminalCommand: (payload) => ipcRenderer.invoke("terminal:run-command", payload),
  onWechatChannelInbound: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("wechat-channel:inbound", listener);
    return () => ipcRenderer.removeListener("wechat-channel:inbound", listener);
  },
  runAgentTask: (payload) => ipcRenderer.invoke("agent:run-task", payload),
  promptAgent: (payload) => ipcRenderer.invoke("agent:prompt", payload),
  steerAgent: (payload) => ipcRenderer.invoke("agent:steer", payload),
  followUpAgent: (payload) => ipcRenderer.invoke("agent:follow-up", payload),
  abortAgent: (payload) => ipcRenderer.invoke("agent:abort", payload),
  continueAgent: (payload) => ipcRenderer.invoke("agent:continue", payload),
  compactAgent: (payload) => ipcRenderer.invoke("agent:compact", payload),
  getAgentSessionTree: (payload) => ipcRenderer.invoke("agent:session-tree", payload),
  replayAgentSession: (payload) => ipcRenderer.invoke("agent:session-replay", payload),
  getAgentTelemetrySummary: (payload) => ipcRenderer.invoke("agent:telemetry-summary", payload),
  inspectAgentRoute: (payload) => ipcRenderer.invoke("agent:inspect-route", payload),
  runAgentEval: (payload) => ipcRenderer.invoke("agent:run-eval", payload),
  getAgentHarnessSnapshot: (payload) => ipcRenderer.invoke("agent:harness-snapshot", payload),
  getAgentHistorySnapshot: (payload) => ipcRenderer.invoke("agent-history:snapshot", payload),
  getAgentTrace: (payload) => ipcRenderer.invoke("agent-history:trace", payload),
  compareAgentRuns: (payload) => ipcRenderer.invoke("agent-history:compare", payload),
  exportAgentAuditPackage: (payload) => ipcRenderer.invoke("agent-history:export", payload),
  // === VS Code 通道 API ===
  getVscodeChannelStatus: () => ipcRenderer.invoke("vscode-channel:status"),
  onVscodeChannelInbound: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("vscode-channel:inbound", listener);
    return () => ipcRenderer.removeListener("vscode-channel:inbound", listener);
  },
  onVscodeChannelContext: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("vscode-channel:context", listener);
    return () => ipcRenderer.removeListener("vscode-channel:context", listener);
  },
  onVscodeDiffAccepted: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("vscode-channel:diff-accepted", listener);
    return () => ipcRenderer.removeListener("vscode-channel:diff-accepted", listener);
  },
  onVscodeDiffRejected: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("vscode-channel:diff-rejected", listener);
    return () => ipcRenderer.removeListener("vscode-channel:diff-rejected", listener);
  },
  onAgentProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("agent:progress", listener);
    return () => ipcRenderer.removeListener("agent:progress", listener);
  }
});
