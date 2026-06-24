import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { DiffEditor, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Code2,
  Copy,
  FileText,
  Folder,
  FolderOpen,
  GitCompare,
  Maximize2,
  Minimize2,
  RefreshCw,
  Save,
  X
} from "lucide-react";
import "./IDE.css";

loader.config({ monaco });

type IdeArtifact = {
  path: string;
  title: string;
  language: string;
  preview: string;
  status?: string;
};

type OpenDocument = {
  id: string;
  source: "workspace" | "artifact";
  path: string;
  title: string;
  language: string;
  content: string;
  originalContent: string;
  originalSource: "opened" | "git-head" | "git-missing" | "artifact";
  savedContent: string;
  dirty: boolean;
  readOnly: boolean;
  truncated?: boolean;
};

type FileTreeNode = {
  type: "folder" | "file";
  name: string;
  path: string;
  children: FileTreeNode[];
  file?: FiitxWorkspaceFile;
};

type WorkspaceIDEProps = {
  workspacePath: string;
  artifacts: IdeArtifact[];
  selectedArtifact: IdeArtifact | null;
  selectedWorkspaceFile?: {
    path: string;
    requestId: number;
  } | null;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onChooseWorkspace: () => void | Promise<void>;
  onSaved?: (path: string, bytes: number) => void;
};

const MAX_EDITOR_BYTES = 1024 * 1024;

function documentId(source: OpenDocument["source"], path: string) {
  return `${source}:${path}`;
}

function fileNameFromPath(path: string) {
  return path.split("/").filter(Boolean).pop() || path;
}

function languageFromPath(path: string, fallback = "plaintext") {
  const extension = path.split(".").pop()?.toLowerCase() || "";
  const aliases: Record<string, string> = {
    cjs: "javascript",
    css: "css",
    html: "html",
    js: "javascript",
    json: "json",
    jsx: "javascript",
    md: "markdown",
    mjs: "javascript",
    py: "python",
    sh: "shell",
    ts: "typescript",
    tsx: "typescript",
    txt: "plaintext",
    wxml: "html",
    wxss: "css",
    yaml: "yaml",
    yml: "yaml"
  };
  return aliases[extension] || fallback;
}

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function buildFileTree(files: FiitxWorkspaceFile[]) {
  const root: FileTreeNode = {
    type: "folder",
    name: "",
    path: "",
    children: []
  };
  const folders = new Map<string, FileTreeNode>([["", root]]);

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    if (parts.length === 0) {
      continue;
    }

    let parent = root;
    let currentPath = "";
    for (const part of parts.slice(0, -1)) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let folder = folders.get(currentPath);
      if (!folder) {
        folder = {
          type: "folder",
          name: part,
          path: currentPath,
          children: []
        };
        folders.set(currentPath, folder);
        parent.children.push(folder);
      }
      parent = folder;
    }

    parent.children.push({
      type: "file",
      name: parts[parts.length - 1],
      path: file.path,
      children: [],
      file
    });
  }

  function sortNode(node: FileTreeNode) {
    node.children.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "folder" ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
    for (const child of node.children) {
      sortNode(child);
    }
  }

  sortNode(root);
  return root;
}

function upsertDocument(documents: OpenDocument[], document: OpenDocument) {
  const index = documents.findIndex((item) => item.id === document.id);
  if (index === -1) {
    return documents.concat(document);
  }
  return documents.map((item) => (item.id === document.id ? document : item));
}

function FileTreeBranch({
  node,
  activePath,
  expandedFolders,
  loadingPath,
  depth,
  onOpenFile,
  onToggleFolder
}: {
  node: FileTreeNode;
  activePath: string;
  expandedFolders: Record<string, boolean>;
  loadingPath: string;
  depth: number;
  onOpenFile: (file: FiitxWorkspaceFile) => void;
  onToggleFolder: (path: string) => void;
}) {
  if (node.type === "file") {
    return (
      <button
        className={activePath === node.path ? "file-tree-node selected" : "file-tree-node"}
        onClick={() => node.file && onOpenFile(node.file)}
        title={`${node.path}${node.file ? ` · ${formatBytes(node.file.size)}` : ""}`}
        style={{ paddingLeft: 10 + depth * 13 }}
        type="button"
      >
        <FileText className="file-tree-icon" size={14} />
        <span className="file-tree-name">{node.name}</span>
        {loadingPath === node.path ? <span className="file-tree-loading-dot" /> : null}
      </button>
    );
  }

  const expanded = expandedFolders[node.path] ?? depth < 1;
  return (
    <div className="file-tree-folder">
      {node.path ? (
        <button
          className="file-tree-node folder"
          onClick={() => onToggleFolder(node.path)}
          title={node.path}
          style={{ paddingLeft: 10 + depth * 13 }}
          type="button"
        >
          {expanded ? <FolderOpen className="file-tree-icon" size={14} /> : <Folder className="file-tree-icon" size={14} />}
          <span className="file-tree-name">{node.name}</span>
          <ChevronDown className={expanded ? "file-tree-caret expanded" : "file-tree-caret"} size={13} />
        </button>
      ) : null}
      {expanded || !node.path
        ? node.children.map((child) => (
            <FileTreeBranch
              key={`${child.type}-${child.path}`}
              node={child}
              activePath={activePath}
              expandedFolders={expandedFolders}
              loadingPath={loadingPath}
              depth={node.path ? depth + 1 : depth}
              onOpenFile={onOpenFile}
              onToggleFolder={onToggleFolder}
            />
          ))
        : null}
    </div>
  );
}

export function WorkspaceIDE({
  workspacePath,
  artifacts,
  selectedArtifact,
  selectedWorkspaceFile,
  isMaximized,
  onToggleMaximize,
  onChooseWorkspace,
  onSaved
}: WorkspaceIDEProps) {
  const [files, setFiles] = useState<FiitxWorkspaceFile[]>([]);
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [editorMode, setEditorMode] = useState<"edit" | "diff">("edit");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingPath, setLoadingPath] = useState("");
  const [savePending, setSavePending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("选择工作区后即可浏览和编辑文件");
  const [errorMessage, setErrorMessage] = useState("");
  const saveActiveDocumentRef = useRef<() => void>(() => undefined);
  const lastExternalOpenRef = useRef("");

  const activeDocument = useMemo(
    () => openDocuments.find((document) => document.id === activeDocumentId) ?? null,
    [activeDocumentId, openDocuments]
  );

  const fileTree = useMemo(() => buildFileTree(files), [files]);
  const workspaceLabel = workspacePath ? fileNameFromPath(workspacePath) : "未选择工作区";
  const activeWorkspacePath = activeDocument?.source === "workspace" ? activeDocument.path : "";

  const refreshFiles = useCallback(async () => {
    if (!workspacePath) {
      setFiles([]);
      setWorkspaceRoot("");
      setStatusMessage("选择工作区后即可浏览和编辑文件");
      return;
    }

    setLoadingFiles(true);
    setErrorMessage("");
    try {
      const result = await window.fiitx?.listWorkspaceFiles?.({
        workspacePath,
        limit: 900
      });
      if (!result) {
        throw new Error("当前运行环境未连接 Electron workspace API");
      }
      setWorkspaceRoot(result.root);
      setFiles(result.files);
      setStatusMessage(result.truncated ? `已载入前 ${result.files.length} 个可见文件` : `已载入 ${result.files.length} 个可见文件`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "文件树载入失败");
    } finally {
      setLoadingFiles(false);
    }
  }, [workspacePath]);

  const openWorkspaceFile = useCallback(
    async (file: FiitxWorkspaceFile) => {
      if (!file.text) {
        setErrorMessage(`当前文件不是可编辑文本：${file.path}`);
        return;
      }

      const id = documentId("workspace", file.path);
      const existing = openDocuments.find((document) => document.id === id);
      if (existing) {
        setActiveDocumentId(id);
        setEditorMode("edit");
        return;
      }

      setLoadingPath(file.path);
      setErrorMessage("");
      try {
        const result = await window.fiitx?.readWorkspaceFile?.({
          workspacePath,
          path: file.path,
          maxBytes: MAX_EDITOR_BYTES
        });
        if (!result) {
          throw new Error("当前运行环境未连接 Electron workspace API");
        }

        let diffBase: FiitxWorkspaceDiffBase | null = null;
        try {
          diffBase = await window.fiitx?.readWorkspaceDiffBase?.({
            workspacePath,
            path: result.path
          }) ?? null;
        } catch {
          diffBase = null;
        }

        const diffBaseSource = diffBase?.ok && (diffBase.source === "git-head" || diffBase.source === "git-missing")
          ? diffBase.source
          : null;
        const diffBaseContent = diffBaseSource ? diffBase?.content ?? "" : result.content;
        const document: OpenDocument = {
          id,
          source: "workspace",
          path: result.path,
          title: fileNameFromPath(result.path),
          language: languageFromPath(result.path),
          content: result.content,
          originalContent: diffBaseContent,
          originalSource: diffBaseSource ?? "opened",
          savedContent: result.content,
          dirty: false,
          readOnly: result.truncated,
          truncated: result.truncated
        };
        setOpenDocuments((current) => upsertDocument(current, document));
        setActiveDocumentId(id);
        setEditorMode("edit");
        const diffHint = diffBaseSource
          ? diffBaseSource === "git-missing"
            ? " · Diff 基线：新增文件"
            : " · Diff 基线：Git HEAD"
          : "";
        setStatusMessage(result.truncated ? `${result.path} 超过编辑大小限制，已用只读模式打开${diffHint}` : `已打开 ${result.path}${diffHint}`);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "文件打开失败");
      } finally {
        setLoadingPath("");
      }
    },
    [openDocuments, workspacePath]
  );

  const openArtifactDocument = useCallback((artifact: IdeArtifact) => {
    const id = documentId("artifact", artifact.path);
    const document: OpenDocument = {
      id,
      source: "artifact",
      path: artifact.path,
      title: artifact.title || fileNameFromPath(artifact.path),
      language: languageFromPath(artifact.path, artifact.language || "markdown"),
      content: artifact.preview,
      originalContent: artifact.preview,
      originalSource: "artifact",
      savedContent: artifact.preview,
      dirty: false,
      readOnly: true
    };
    setOpenDocuments((current) => upsertDocument(current, document));
    setActiveDocumentId(id);
    setEditorMode("edit");
    setStatusMessage(`已打开 Artifact：${document.title}`);
  }, []);

  const closeDocument = useCallback(
    (documentIdToClose: string) => {
      setOpenDocuments((current) => {
        const next = current.filter((document) => document.id !== documentIdToClose);
        if (activeDocumentId === documentIdToClose) {
          setActiveDocumentId(next[next.length - 1]?.id ?? "");
        }
        return next;
      });
    },
    [activeDocumentId]
  );

  const saveActiveDocument = useCallback(async () => {
    if (!activeDocument || activeDocument.source !== "workspace" || activeDocument.readOnly || !activeDocument.dirty) {
      return;
    }

    setSavePending(true);
    setErrorMessage("");
    try {
      const result = await window.fiitx?.writeWorkspaceFile?.({
        workspacePath,
        path: activeDocument.path,
        content: activeDocument.content
      });
      if (!result) {
        throw new Error("当前运行环境未连接 Electron workspace API");
      }
      setOpenDocuments((current) =>
        current.map((document) =>
          document.id === activeDocument.id
            ? {
                ...document,
                dirty: false,
                originalContent: document.originalSource === "opened" ? document.content : document.originalContent,
                savedContent: document.content
              }
            : document
        )
      );
      setStatusMessage(`已保存 ${result.path}`);
      onSaved?.(result.path, result.bytes);
      void refreshFiles();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "文件保存失败");
    } finally {
      setSavePending(false);
    }
  }, [activeDocument, onSaved, refreshFiles, workspacePath]);

  useEffect(() => {
    saveActiveDocumentRef.current = () => {
      void saveActiveDocument();
    };
  }, [saveActiveDocument]);

  useEffect(() => {
    void refreshFiles();
  }, [refreshFiles]);

  useEffect(() => {
    setOpenDocuments((current) => current.filter((document) => document.source === "artifact"));
    setActiveDocumentId((current) => (current.startsWith("workspace:") ? "" : current));
  }, [workspacePath]);

  useEffect(() => {
    if (selectedArtifact) {
      openArtifactDocument(selectedArtifact);
    }
  }, [openArtifactDocument, selectedArtifact]);

  useEffect(() => {
    const requestedPath = selectedWorkspaceFile?.path?.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!requestedPath || !workspacePath) {
      return;
    }

    const requestKey = `${workspacePath}:${requestedPath}:${selectedWorkspaceFile?.requestId || 0}`;
    if (lastExternalOpenRef.current === requestKey) {
      return;
    }

    lastExternalOpenRef.current = requestKey;
    void openWorkspaceFile({
      path: requestedPath,
      size: 0,
      text: true
    });
  }, [openWorkspaceFile, selectedWorkspaceFile, workspacePath]);

  function updateActiveDocument(content: string) {
    if (!activeDocument || activeDocument.readOnly) {
      return;
    }
    setOpenDocuments((current) =>
      current.map((document) =>
        document.id === activeDocument.id
          ? {
              ...document,
              content,
              dirty: content !== document.savedContent
            }
          : document
      )
    );
  }

  function handleEditorMount(editor: any, monaco: any) {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveActiveDocumentRef.current();
    });
  }

  function copyActivePath() {
    if (activeDocument?.path) {
      void navigator.clipboard?.writeText(activeDocument.path);
      setStatusMessage(`已复制路径：${activeDocument.path}`);
    }
  }

  return (
    <div className="ide-container">
      <header className="ide-header">
        <div className="ide-header-copy">
          <span>Fiitx IDE</span>
          <strong title={workspaceRoot || workspacePath}>{workspaceLabel}</strong>
        </div>
        <div className="ide-header-actions">
          <button className="ide-icon-button" onClick={refreshFiles} title="刷新文件树" type="button" disabled={!workspacePath || loadingFiles}>
            <RefreshCw size={16} />
          </button>
          <button className="ide-icon-button" onClick={onToggleMaximize} title={isMaximized ? "还原 IDE" : "最大化 IDE"} type="button">
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      <div className="ide-body">
        <aside className="ide-file-tree-panel">
          <div className="ide-panel-title">
            <span>Explorer</span>
            {loadingFiles ? <RefreshCw className="ide-spin" size={13} /> : null}
          </div>

          {!workspacePath ? (
            <div className="ide-empty-panel">
              <span>尚未选择 workspace</span>
              <button onClick={onChooseWorkspace} type="button">选择工作区</button>
            </div>
          ) : null}

          {workspacePath && files.length === 0 && !loadingFiles ? <div className="file-tree-loading">没有可编辑文本文件</div> : null}

          {files.length > 0 ? (
            <FileTreeBranch
              node={fileTree}
              activePath={activeWorkspacePath}
              expandedFolders={expandedFolders}
              loadingPath={loadingPath}
              depth={0}
              onOpenFile={(file) => void openWorkspaceFile(file)}
              onToggleFolder={(path) => setExpandedFolders((current) => ({ ...current, [path]: !(current[path] ?? true) }))}
            />
          ) : null}

          {artifacts.length > 0 ? (
            <div className="ide-artifact-group">
              <div className="ide-panel-title compact">Artifacts</div>
              {artifacts.slice(0, 12).map((artifact) => (
                <button
                  className={activeDocument?.source === "artifact" && activeDocument.path === artifact.path ? "file-tree-node selected" : "file-tree-node"}
                  key={artifact.path}
                  onClick={() => openArtifactDocument(artifact)}
                  title={artifact.path}
                  type="button"
                >
                  <FileText className="file-tree-icon" size={14} />
                  <span className="file-tree-name">{artifact.title}</span>
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <section className="ide-main-panel">
          <div className="ide-tab-bar">
            {openDocuments.length === 0 ? <span className="ide-tab-placeholder">打开一个文件开始编辑</span> : null}
            {openDocuments.map((document) => (
              <button
                className={document.id === activeDocumentId ? "ide-tab active" : "ide-tab"}
                key={document.id}
                onClick={() => setActiveDocumentId(document.id)}
                title={document.path}
                type="button"
              >
                <span className={document.dirty ? "ide-dirty-dot" : "ide-clean-dot"} />
                <span>{document.title}</span>
                {document.readOnly ? <small>RO</small> : null}
                <X
                  className="ide-tab-close"
                  size={13}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeDocument(document.id);
                  }}
                />
              </button>
            ))}
          </div>

          <div className="ide-toolbar">
            <div className="ide-mode-switch">
              <button className={editorMode === "edit" ? "active" : ""} onClick={() => setEditorMode("edit")} type="button">
                <Code2 size={14} />
                <span>Edit</span>
              </button>
              <button className={editorMode === "diff" ? "active" : ""} onClick={() => setEditorMode("diff")} type="button" disabled={!activeDocument}>
                <GitCompare size={14} />
                <span>Diff</span>
              </button>
            </div>
            <div className="ide-toolbar-actions">
              <button className="ide-text-button" onClick={copyActivePath} type="button" disabled={!activeDocument}>
                <Copy size={14} />
                <span>路径</span>
              </button>
              <button
                className="ide-text-button primary"
                onClick={() => void saveActiveDocument()}
                type="button"
                disabled={!activeDocument || activeDocument.source !== "workspace" || activeDocument.readOnly || !activeDocument.dirty || savePending}
              >
                {activeDocument && !activeDocument.dirty && activeDocument.source === "workspace" ? <Check size={14} /> : <Save size={14} />}
                <span>{savePending ? "保存中" : "保存"}</span>
              </button>
            </div>
          </div>

          <div className="ide-editor-panel">
            {!activeDocument ? (
              <div className="ide-empty">
                <Code2 size={28} />
                <strong>选择左侧文件</strong>
                <span>支持 TypeScript、JavaScript、JSON、Markdown、HTML、CSS、Python、Shell 等文本文件。</span>
              </div>
            ) : editorMode === "diff" ? (
              <DiffEditor
                key={`diff-${activeDocument.id}`}
                language={activeDocument.language}
                original={activeDocument.originalContent}
                modified={activeDocument.content}
                theme="vs-dark"
                onMount={handleEditorMount}
                options={{
                  automaticLayout: true,
                  fontSize: 13,
                  minimap: { enabled: false },
                  renderSideBySide: true,
                  readOnly: true,
                  scrollBeyondLastLine: false,
                  wordWrap: "on"
                }}
              />
            ) : (
              <Editor
                key={`edit-${activeDocument.id}`}
                path={activeDocument.path}
                language={activeDocument.language}
                value={activeDocument.content}
                theme="vs-dark"
                onChange={(value) => updateActiveDocument(value ?? "")}
                onMount={handleEditorMount}
                options={{
                  automaticLayout: true,
                  bracketPairColorization: { enabled: true },
                  fontSize: 13,
                  minimap: { enabled: true },
                  readOnly: activeDocument.readOnly,
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  tabSize: 2,
                  wordWrap: "on"
                }}
              />
            )}
          </div>

          <footer className="ide-status-bar">
            <span title={errorMessage || statusMessage} className={errorMessage ? "error" : ""}>
              {errorMessage ? (
                <>
                  <AlertTriangle size={13} />
                  {errorMessage}
                </>
              ) : (
                statusMessage
              )}
            </span>
            <span>{activeDocument ? `${activeDocument.language} · ${activeDocument.dirty ? "未保存" : "已同步"}` : `${files.length} files`}</span>
          </footer>
        </section>
      </div>
    </div>
  );
}
