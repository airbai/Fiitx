const path = require("node:path");

function buildWorkspaceArtifactPreview({ payload, workspace, profile, summary, modelError }) {
  const snippets = workspace.snippets
    .map((snippet) => `## ${snippet.path}\n${snippet.content.slice(0, 1200)}`)
    .join("\n\n");
  const externalDocuments = payload.externalContext?.documents || [];
  const externalPreview = externalDocuments
    .map((document, index) => `## ${index + 1}. ${document.title || document.url}
- URL：${document.finalUrl || document.url}
- HTTP：${document.status}${document.ok ? "" : "（读取异常）"}

${(document.text || document.error || "没有可读取正文。").slice(0, 1600)}`)
    .join("\n\n");

  return `# Coding Workspace Artifact

任务：${payload.prompt}
工作区：${workspace.root}
模型：${profile ? `${profile.provider} / ${profile.model}` : "未配置"}
状态：${modelError ? "模型调用失败，已回退到本地扫描" : "模型与工具链已完成首轮扫描"}
外部文档：${externalDocuments.length} 个

## Agent 输出
${summary}

## 工具调用
- list_files：${workspace.files.length} 个文件
- read_snippets：${workspace.snippets.length} 个非敏感文本片段
- web.fetch_url：${externalDocuments.length} 个外部文档
- git_diff_stat：${workspace.gitDiffStat ? "已读取" : "无 diff 或非 git 仓库"}

## 文件入口
${workspace.files.slice(0, 40).map((file) => `- ${file.path}`).join("\n")}

${externalPreview ? `## 外部文档片段\n${externalPreview}` : ""}

${snippets ? `## 关键片段\n${snippets}` : ""}`;
}

function createWorkspaceScanArtifact({ payload, workspace, profile, summary, modelError }) {
  return {
    path: `artifacts/${Date.now()}-workspace-scan.md`,
    title: "Workspace Scan Artifact",
    language: "markdown",
    status: "added",
    additions: workspace.files.length,
    deletions: 0,
    preview: buildWorkspaceArtifactPreview({ payload, workspace, profile, summary, modelError })
  };
}

function createAgentResultArtifact({ payload, profile, summary, modelError, title = "Agent Result Artifact" }) {
  const externalDocuments = payload.externalContext?.documents || [];
  return {
    path: `artifacts/${Date.now()}-agent-result.md`,
    title,
    language: "markdown",
    status: "added",
    additions: summary ? summary.split(/\r?\n/).length : 0,
    deletions: 0,
    preview: `# ${title}

任务：${payload.prompt}
模型：${profile ? `${profile.provider} / ${profile.model}` : "未配置"}
状态：${modelError ? "执行异常" : "已完成"}
外部文档：${externalDocuments.length} 个

## Agent 输出
${summary || modelError || "无输出"}`
  };
}

function buildTree(projectName, relativeFiles) {
  const sorted = relativeFiles.slice().sort();
  return [
    `${projectName}/`,
    ...sorted.map((file) => `├─ ${file}`)
  ].join("\n");
}

function createGeneratedProjectArtifact({ projectName, projectRoot, requiredFiles = [], relativeFiles, title, summary }) {
  const tree = buildTree(projectName, relativeFiles);
  const preview = `# ${title}

已生成完整项目，可导入对应开发工具：
${projectRoot}

${summary ? `## 说明\n${summary}\n` : ""}

${requiredFiles.length > 0 ? `## 文件完整性检查\n${requiredFiles.map((file) => `- ${file}：已提供`).join("\n")}` : `## 文件数量\n- 已生成 ${relativeFiles.length} 个文件`}

## 项目目录树
\`\`\`
${tree}
\`\`\`

## 生成文件
${relativeFiles.map((file) => `- ${path.join(projectName, file)}`).join("\n")}`;

  return {
    path: `${projectName}/README.md`,
    title,
    language: "markdown",
    status: "added",
    additions: relativeFiles.length,
    deletions: 0,
    preview
  };
}

module.exports = {
  createAgentResultArtifact,
  createGeneratedProjectArtifact,
  createWorkspaceScanArtifact
};
