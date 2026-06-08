const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fiitx", {
  getPlatform: () => ipcRenderer.invoke("app:get-platform"),
  chooseWorkspace: () => ipcRenderer.invoke("app:choose-workspace"),
  chooseFiles: () => ipcRenderer.invoke("app:choose-files"),
  inspectPath: (path, basePath) => ipcRenderer.invoke("path:inspect", { path, basePath }),
  openPath: (path, basePath) => ipcRenderer.invoke("path:open", { path, basePath }),
  previewPath: (path, basePath) => ipcRenderer.invoke("path:preview", { path, basePath }),
  listModelProfiles: () => ipcRenderer.invoke("model:list"),
  saveModelProfile: (payload) => ipcRenderer.invoke("model:save", payload),
  testModelConnection: (payload) => ipcRenderer.invoke("model:test", payload),
  loadThreadState: () => ipcRenderer.invoke("thread-state:load"),
  saveThreadState: (payload) => ipcRenderer.invoke("thread-state:save", payload),
  runAgentTask: (payload) => ipcRenderer.invoke("agent:run-task", payload),
  promptAgent: (payload) => ipcRenderer.invoke("agent:prompt", payload),
  steerAgent: (payload) => ipcRenderer.invoke("agent:steer", payload),
  followUpAgent: (payload) => ipcRenderer.invoke("agent:follow-up", payload),
  abortAgent: (payload) => ipcRenderer.invoke("agent:abort", payload),
  continueAgent: (payload) => ipcRenderer.invoke("agent:continue", payload),
  compactAgent: (payload) => ipcRenderer.invoke("agent:compact", payload),
  onAgentProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("agent:progress", listener);
    return () => ipcRenderer.removeListener("agent:progress", listener);
  }
});
