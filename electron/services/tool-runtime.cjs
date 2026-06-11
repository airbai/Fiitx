const { exec, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");

const execAsync = promisify(exec);

function clipToolOutput(value, maxChars = 30000) {
  const text = String(value || "");
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n\n[输出过长，已截断 ${text.length - maxChars} 个字符]`;
}

function decodeHtmlEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\""
  };

  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return named[lower] || match;
  });
}

function stripHtmlToText(html) {
  const withoutNoise = String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const readable = withoutNoise
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, "\n\n## $2\n")
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|main|header|footer|tr|table|ul|ol|pre|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(readable)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractHtmlTitle(html, fallback = "") {
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(String(html || ""));
  if (titleMatch) {
    return decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, " ").trim();
  }

  const h1Match = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(String(html || ""));
  if (h1Match) {
    return stripHtmlToText(h1Match[1]).replace(/\s+/g, " ").trim();
  }

  return fallback;
}

function normalizeFetchUrl(url) {
  const parsed = new URL(String(url || "").trim());
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`只支持 http/https URL：${url}`);
  }
  return parsed.toString();
}

function clipText(value, maxChars) {
  const text = String(value || "").trim();
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n\n[内容过长，已截断 ${text.length - maxChars} 个字符]`;
}

function textFromResponseBody(body, contentType) {
  const lowerType = String(contentType || "").toLowerCase();
  if (lowerType.includes("text/html") || /<!doctype html|<html[\s>]/i.test(body)) {
    return stripHtmlToText(body);
  }
  if (lowerType.includes("application/json")) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return decodeHtmlEntities(body).replace(/\r/g, "").trim();
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 20000;
  let timeoutTriggered = false;
  const timeout = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, timeoutMs);
  const abortListener = () => controller.abort();
  options.signal?.addEventListener?.("abort", abortListener, { once: true });

  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html,text/markdown,text/plain,application/json;q=0.9,*/*;q=0.5",
        // Fiitx branding kept for easy restore:
        // "User-Agent": "Fiitx-Agent/0.1 external-context"
        "User-Agent": "Deepsix-Agent/0.1 external-context"
      },
      redirect: "follow",
      signal: controller.signal
    });
  } catch (error) {
    if (timeoutTriggered) {
      throw new Error(`读取 URL 超时：${timeoutMs}ms`);
    }
    if (options.signal?.aborted) {
      throw new Error("用户已停止当前 URL 读取。");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener?.("abort", abortListener);
  }
}

function createToolRuntime({ workspaceManager }) {
  function resolveToolPath(workspacePath, targetPath = ".") {
    const root = workspaceManager.resolveWorkspaceRoot(workspacePath);
    const rawTarget = String(targetPath || ".").trim() || ".";
    const absolutePath = path.isAbsolute(rawTarget)
      ? path.resolve(rawTarget)
      : path.resolve(root, rawTarget);
    const boundary = `${root}${path.sep}`;
    if (absolutePath !== root && !absolutePath.startsWith(boundary)) {
      throw new Error(`工具路径不能跳出 workspace：${targetPath}`);
    }
    return {
      root,
      absolutePath,
      relativePath: absolutePath === root ? "." : path.relative(root, absolutePath)
    };
  }

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

  async function fetchUrlContext(urls, options = {}) {
    const uniqueUrls = [...new Set((urls || []).map(normalizeFetchUrl))].slice(0, options.limit || 5);
    const documents = [];

    for (const url of uniqueUrls) {
      try {
        const response = await fetchWithTimeout(url, {
          signal: options.signal,
          timeoutMs: options.timeoutMs
        });
        const contentType = response.headers.get("content-type") || "";
        const rawBody = await response.text();
        const title = extractHtmlTitle(rawBody, response.url || url);
        const text = clipText(textFromResponseBody(rawBody, contentType), options.maxCharsPerDocument || 12000);

        documents.push({
          url,
          finalUrl: response.url || url,
          title: title || response.url || url,
          status: response.status,
          ok: response.ok,
          contentType,
          text,
          fetchedAt: new Date().toISOString()
        });
      } catch (error) {
        if (options.signal?.aborted) {
          throw error;
        }
        documents.push({
          url,
          finalUrl: url,
          title: url,
          status: 0,
          ok: false,
          contentType: "",
          text: "",
          error: error instanceof Error ? error.message : "读取 URL 失败",
          fetchedAt: new Date().toISOString()
        });
      }
    }

    return {
      documents,
      toolEvent: {
        actor: "Tool Runtime",
        event: "读取外部 URL",
        target: `${documents.length} document(s)`,
        level: documents.every((document) => document.ok) ? "success" : "warn"
      }
    };
  }

  async function listDirectory(workspacePath, targetPath = ".", options = {}) {
    const { absolutePath, relativePath } = resolveToolPath(workspacePath, targetPath);
    const limit = Math.max(1, Math.min(Number(options.limit || 80), 300));
    const entries = fs
      .readdirSync(absolutePath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, limit)
      .map((entry) => {
        const entryPath = path.join(absolutePath, entry.name);
        const stat = fs.statSync(entryPath);
        return {
          name: entry.name,
          path: path.relative(resolveToolPath(workspacePath).root, entryPath),
          type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
          size: stat.size
        };
      });

    return {
      path: relativePath,
      entries,
      truncated: entries.length >= limit
    };
  }

  async function readWorkspaceFile(workspacePath, targetPath, options = {}) {
    const { root, relativePath } = resolveToolPath(workspacePath, targetPath);
    const maxBytes = Math.max(1, Math.min(Number(options.maxBytes || 24000), 120000));
    const content = workspaceManager.readTextSnippet(root, relativePath, maxBytes);
    if (content === null) {
      throw new Error(`文件不可读取或不是安全文本文件：${relativePath}`);
    }
    return {
      path: relativePath,
      content,
      truncated: Buffer.byteLength(content, "utf8") >= maxBytes
    };
  }

  async function writeWorkspaceFile(workspacePath, targetPath, content) {
    if (typeof content !== "string") {
      throw new Error("write 工具需要字符串 content");
    }
    const { absolutePath, relativePath } = resolveToolPath(workspacePath, targetPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf8");
    return {
      path: relativePath,
      bytes: Buffer.byteLength(content, "utf8")
    };
  }

  async function editWorkspaceFile(workspacePath, targetPath, options = {}) {
    const { absolutePath, relativePath } = resolveToolPath(workspacePath, targetPath);
    const search = String(options.search || "");
    const replace = String(options.replace || "");
    if (!search) {
      throw new Error("edit 工具需要 search 字符串");
    }
    const original = fs.readFileSync(absolutePath, "utf8");
    if (!original.includes(search)) {
      throw new Error(`文件中没有找到待替换文本：${relativePath}`);
    }
    const next = options.all
      ? original.split(search).join(replace)
      : original.replace(search, replace);
    fs.writeFileSync(absolutePath, next, "utf8");
    return {
      path: relativePath,
      replacements: options.all ? original.split(search).length - 1 : 1,
      bytes: Buffer.byteLength(next, "utf8")
    };
  }

  async function grepWorkspace(workspacePath, pattern, options = {}) {
    const { root, relativePath } = resolveToolPath(workspacePath, options.path || ".");
    const maxMatches = Math.max(1, Math.min(Number(options.maxMatches || 80), 300));
    if (!pattern) {
      throw new Error("grep 工具需要 pattern");
    }

    try {
      const output = execFileSync("rg", [
        "--line-number",
        "--no-heading",
        "--color=never",
        "--glob",
        "!node_modules/**",
        "--glob",
        "!dist/**",
        "--glob",
        "!release/**",
        "--",
        String(pattern),
        relativePath
      ], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 8000
      });
      const matches = output.trim().split(/\r?\n/).filter(Boolean).slice(0, maxMatches);
      return {
        pattern,
        matches,
        truncated: matches.length >= maxMatches
      };
    } catch (error) {
      const output = String(error?.stdout || "").trim();
      if (output) {
        const matches = output.split(/\r?\n/).filter(Boolean).slice(0, maxMatches);
        return {
          pattern,
          matches,
          truncated: matches.length >= maxMatches
        };
      }
      return {
        pattern,
        matches: [],
        truncated: false
      };
    }
  }

  async function findWorkspaceFiles(workspacePath, options = {}) {
    const { root, relativePath } = resolveToolPath(workspacePath, options.path || ".");
    const pattern = String(options.pattern || "").toLowerCase();
    const maxResults = Math.max(1, Math.min(Number(options.maxResults || 120), 500));
    const prefix = relativePath === "." ? "" : `${relativePath}${path.sep}`;
    const files = workspaceManager
      .listWorkspaceFiles(root, Math.max(maxResults * 4, 200))
      .filter((file) => !prefix || file.path === relativePath || file.path.startsWith(prefix))
      .filter((file) => !pattern || file.path.toLowerCase().includes(pattern))
      .slice(0, maxResults);
    return {
      pattern,
      files,
      truncated: files.length >= maxResults
    };
  }

  async function runShell(workspacePath, command, options = {}) {
    const { root } = resolveToolPath(workspacePath, ".");
    const trimmed = String(command || "").trim();
    if (!trimmed) {
      throw new Error("bash 工具需要 command");
    }
    const timeoutMs = Math.max(1000, Math.min(Number(options.timeoutMs || 60000), 180000));
    try {
      const result = await execAsync(trimmed, {
        cwd: root,
        env: process.env,
        shell: process.env.SHELL || "/bin/zsh",
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
        signal: options.signal
      });
      return {
        command: trimmed,
        cwd: root,
        exitCode: 0,
        stdout: clipToolOutput(result.stdout),
        stderr: clipToolOutput(result.stderr)
      };
    } catch (error) {
      if (options.signal?.aborted) {
        throw new Error("用户已停止当前 shell 执行。");
      }
      return {
        command: trimmed,
        cwd: root,
        exitCode: typeof error?.code === "number" ? error.code : 1,
        stdout: clipToolOutput(error?.stdout),
        stderr: clipToolOutput(error?.stderr || error?.message)
      };
    }
  }

  return {
    editWorkspaceFile,
    fetchUrlContext,
    findWorkspaceFiles,
    grepWorkspace,
    listDirectory,
    readWorkspaceFile,
    runShell,
    scanWorkspace,
    writeFileManifest,
    writeGeneratedProject,
    writeWorkspaceFile
  };
}

module.exports = {
  createToolRuntime
};
