const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function createWorkspaceManager({ policyEngine, fallbackRoot = () => process.cwd() }) {
  function isFilesystemRoot(candidate) {
    return path.parse(candidate).root === candidate;
  }

  function getFallbackRoot() {
    let root = "";
    try {
      root = fallbackRoot();
    } catch {
      root = "";
    }

    const defaultRoot = path.join(os.homedir(), "Fiitx Workspaces");
    const resolved = path.resolve(root || defaultRoot);
    const safeRoot = isFilesystemRoot(resolved) ? defaultRoot : resolved;
    fs.mkdirSync(safeRoot, { recursive: true });
    return safeRoot;
  }

  function resolveWorkspaceRoot(workspacePath) {
    const candidate = path.resolve(workspacePath || getFallbackRoot());
    if (isFilesystemRoot(candidate) || !fs.existsSync(candidate)) {
      return getFallbackRoot();
    }

    const stat = fs.statSync(candidate);
    if (!stat.isDirectory()) {
      throw new Error("选择的 workspace 不是文件夹");
    }

    return candidate;
  }

  function resolveProjectFile(projectRoot, relativePath) {
    if (path.isAbsolute(relativePath)) {
      throw new Error(`生成文件路径不能是绝对路径：${relativePath}`);
    }

    const absolutePath = path.resolve(projectRoot, relativePath);
    const boundary = `${projectRoot}${path.sep}`;
    if (absolutePath !== projectRoot && !absolutePath.startsWith(boundary)) {
      throw new Error(`生成文件路径不能跳出项目目录：${relativePath}`);
    }

    return absolutePath;
  }

  function readTextSnippet(root, relativePath, maxBytes = 4800) {
    if (policyEngine.isSensitivePath(relativePath) || !policyEngine.isTextFile(relativePath)) {
      return null;
    }

    const absolutePath = path.join(root, relativePath);
    const stat = fs.statSync(absolutePath);
    const fd = fs.openSync(absolutePath, "r");
    const buffer = Buffer.alloc(Math.min(stat.size, maxBytes));
    try {
      fs.readSync(fd, buffer, 0, buffer.length, 0);
    } finally {
      fs.closeSync(fd);
    }

    return buffer.toString("utf8").replace(/\u0000/g, "").trim();
  }

  function listWorkspaceFiles(root, limit = 120) {
    const files = [];

    function walk(directory, depth) {
      if (files.length >= limit || depth > 5) {
        return;
      }

      let entries = [];
      try {
        entries = fs
          .readdirSync(directory, { withFileTypes: true })
          .sort((left, right) => left.name.localeCompare(right.name));
      } catch {
        return;
      }

      for (const entry of entries) {
        if (files.length >= limit) {
          break;
        }

        const absolutePath = path.join(directory, entry.name);
        const relativePath = path.relative(root, absolutePath);

        if (entry.isDirectory()) {
          if (!policyEngine.isIgnoredDirectory(entry.name)) {
            walk(absolutePath, depth + 1);
          }
          continue;
        }

        if (entry.isFile() && !policyEngine.isSensitivePath(relativePath)) {
          try {
            const stat = fs.statSync(absolutePath);
            files.push({
              path: relativePath,
              size: stat.size,
              text: policyEngine.isTextFile(relativePath)
            });
          } catch {
            // File disappeared or permissions changed during scan; skip it.
          }
        }
      }
    }

    walk(root, 0);
    return files;
  }

  function getGitDiffStat(root) {
    try {
      return execFileSync("git", ["-C", root, "diff", "--stat"], {
        encoding: "utf8",
        maxBuffer: 1024 * 128,
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 4000
      }).trim();
    } catch {
      return "";
    }
  }

  function collectWorkspaceContext(workspacePath) {
    const root = resolveWorkspaceRoot(workspacePath);

    const files = listWorkspaceFiles(root);
    const preferred = [
      "package.json",
      "README.md",
      "src/App.tsx",
      "electron/main.cjs",
      "electron/preload.cjs",
      "src/styles.css"
    ];
    const snippetPaths = preferred
      .filter((candidate) => files.some((file) => file.path === candidate))
      .concat(files.filter((file) => file.text).map((file) => file.path))
      .filter((candidate, index, list) => list.indexOf(candidate) === index)
      .slice(0, 8);

    const snippets = snippetPaths
      .map((relativePath) => ({
        path: relativePath,
        content: readTextSnippet(root, relativePath)
      }))
      .filter((snippet) => snippet.content);

    return {
      root,
      files,
      snippets,
      gitDiffStat: getGitDiffStat(root)
    };
  }

  function writeGeneratedProject(root, projectName, files) {
    const workspaceRoot = resolveWorkspaceRoot(root);
    const safeProjectName = path.basename(projectName);
    const projectRoot = path.resolve(workspaceRoot, safeProjectName);
    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = resolveProjectFile(projectRoot, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content, "utf8");
    }
    return projectRoot;
  }

  return {
    collectWorkspaceContext,
    getGitDiffStat,
    getFallbackRoot,
    listWorkspaceFiles,
    readTextSnippet,
    resolveWorkspaceRoot,
    writeGeneratedProject
  };
}

module.exports = {
  createWorkspaceManager
};
