function createToolRuntime({ workspaceManager }) {
  async function scanWorkspace(workspacePath) {
    const workspace = workspaceManager.collectWorkspaceContext(workspacePath);
    return {
      workspace,
      toolEvent: {
        actor: "Tool Runtime",
        event: "扫描 workspace",
        target: `${workspace.files.length} files`,
        level: "success"
      }
    };
  }

  async function writeGeneratedProject(root, projectName, files) {
    const projectRoot = workspaceManager.writeGeneratedProject(root, projectName, files);
    return {
      projectRoot,
      toolEvent: {
        actor: "Tool Runtime",
        event: "写入生成项目",
        target: projectRoot,
        level: "success"
      }
    };
  }

  async function writeFileManifest(root, manifest) {
    const projectName = manifest?.projectName || "generated-project";
    const files = {};
    for (const file of manifest?.files || []) {
      if (!file?.path || typeof file.content !== "string") {
        throw new Error("文件 manifest 中每个文件都必须包含 path 和 content");
      }
      files[file.path] = file.content;
    }

    if (Object.keys(files).length === 0) {
      throw new Error("文件 manifest 为空");
    }

    const projectRoot = workspaceManager.writeGeneratedProject(root, projectName, files);
    return {
      projectRoot,
      relativeFiles: Object.keys(files),
      toolEvent: {
        actor: "Tool Runtime",
        event: "写入文件 manifest",
        target: projectRoot,
        level: "success"
      }
    };
  }

  return {
    scanWorkspace,
    writeFileManifest,
    writeGeneratedProject
  };
}

module.exports = {
  createToolRuntime
};
