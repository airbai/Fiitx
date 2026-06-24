const fs = require("node:fs");
const path = require("node:path");

const CONFIG_VERSION = 2;

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function readMcpIfExists(root) {
  const mcpPath = path.join(root, "mcp.json");
  return readJson(mcpPath, null);
}

function skillIdFromRoot(root) {
  return path.basename(path.resolve(root)).replace(/[^a-zA-Z0-9_-]+/g, "-") || "skill";
}

function skillIdFromPath(prefix, root, baseRoot) {
  const relative = path.relative(baseRoot, path.resolve(root)) || path.basename(path.resolve(root));
  const safe = relative.split(path.sep).join(":").replace(/[^a-zA-Z0-9:_-]+/g, "-").replace(/:+/g, ":");
  return `${prefix}:${safe.replace(/^:+|:+$/g, "") || skillIdFromRoot(root)}`;
}

function readSkillDescriptor(root) {
  const resolvedRoot = path.resolve(root);
  const skillPrompt = readTextIfExists(path.join(resolvedRoot, "SKILL.md"));
  const mcp = readMcpIfExists(resolvedRoot);
  if (!skillPrompt && !mcp) {
    throw new Error(`Skill root must contain SKILL.md or mcp.json: ${resolvedRoot}`);
  }

  return {
    id: mcp?.name || skillIdFromRoot(resolvedRoot),
    name: mcp?.name || skillIdFromRoot(resolvedRoot),
    version: mcp?.version || "0.0.0-local",
    root: resolvedRoot,
    description: mcp?.description || skillPrompt.slice(0, 180),
    capabilities: Array.isArray(mcp?.capabilities) ? mcp.capabilities : [],
    apis: Array.isArray(mcp?.apis) ? mcp.apis : [],
    mcp,
    skillPrompt
  };
}

function normalizeConfig(raw = {}) {
  const installed = Array.isArray(raw.installedSkills)
    ? raw.installedSkills
    : Array.isArray(raw.skills)
    ? raw.skills
    : [];
  return {
    version: raw.version || CONFIG_VERSION,
    installedSkills: installed
      .filter((item) => item?.root)
      .map((item) => ({
        id: item.id || skillIdFromRoot(item.root),
        name: item.name || item.id || skillIdFromRoot(item.root),
        version: item.version || "0.0.0-local",
        root: path.resolve(item.root),
        source: item.source || "local",
        enabled: item.enabled !== false,
        external: item.external === true,
        hidden: item.hidden === true,
        installedAt: item.installedAt || new Date().toISOString(),
        description: item.description || ""
      }))
  };
}

function withDescriptorIdentity(descriptor, id) {
  return {
    ...descriptor,
    id
  };
}

function splitPathList(value) {
  return String(value || "")
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueResolvedPaths(paths) {
  const seen = new Set();
  const unique = [];
  for (const item of paths) {
    if (!item) {
      continue;
    }
    const resolved = path.resolve(item);
    if (seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    unique.push(resolved);
  }
  return unique;
}

function createSkillMarketplace({ app, configPath, catalogRoots = [] } = {}) {
  const resolvedConfigPath = configPath || path.join(app.getPath("userData"), "skills.json");
  const homePath = app.getPath("home");
  const codexRoot = path.join(app.getPath("home"), ".codex");
  const defaultCatalogRoots = [
    path.resolve(__dirname, "../../examples/wechat-ai/customer-chatbox-miniapp/skills"),
    path.resolve(__dirname, "../../examples/wechat-ai"),
    path.resolve(__dirname, "../../../openclaw"),
    path.join(homePath, "Downloads/quanse/ai/fiit.ai/openclaw"),
    path.join(homePath, "Documents/Fiitx Workspaces"),
    ...splitPathList(process.env.FIITX_SKILL_CATALOG_ROOTS)
  ];
  const externalSkillRoots = [
    path.join(codexRoot, "skills"),
    path.join(codexRoot, "plugins", "cache"),
    path.join(codexRoot, "plugins")
  ];

  function loadConfig() {
    return normalizeConfig(readJson(resolvedConfigPath, { version: CONFIG_VERSION, installedSkills: [] }));
  }

  function saveConfig(config) {
    writeJson(resolvedConfigPath, normalizeConfig(config));
    return getConfig();
  }

  function getConfig() {
    return {
      ...loadConfig(),
      path: resolvedConfigPath
    };
  }

  function discoverSkillRoots(rootPath, options = {}) {
    const resolvedRoot = path.resolve(rootPath);
    if (!fs.existsSync(resolvedRoot)) {
      return [];
    }
    const found = [];
    const maxDepth = Number.isFinite(options.maxDepth) ? options.maxDepth : 4;
    const maxItems = Number.isFinite(options.maxItems) ? options.maxItems : 200;
    const queue = [{ directory: resolvedRoot, depth: 0 }];
    while (queue.length) {
      const current = queue.shift();
      if (!current || current.depth > maxDepth || found.length >= maxItems) {
        continue;
      }
      const hasSkill = fs.existsSync(path.join(current.directory, "SKILL.md")) || fs.existsSync(path.join(current.directory, "mcp.json"));
      if (hasSkill) {
        found.push(current.directory);
        continue;
      }
      let entries = [];
      try {
        entries = fs.readdirSync(current.directory, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          queue.push({ directory: path.join(current.directory, entry.name), depth: current.depth + 1 });
        }
      }
    }
    return [...new Set(found)];
  }

  function getExternalSource(root) {
    const resolvedRoot = path.resolve(root);
    const pluginCacheRoot = path.join(codexRoot, "plugins", "cache");
    if (resolvedRoot.startsWith(`${pluginCacheRoot}${path.sep}`)) {
      return "codex-plugin";
    }
    return "codex-skill";
  }

  function getExternalId(root) {
    const resolvedRoot = path.resolve(root);
    const pluginCacheRoot = path.join(codexRoot, "plugins", "cache");
    if (resolvedRoot.startsWith(`${pluginCacheRoot}${path.sep}`)) {
      return skillIdFromPath("plugin", resolvedRoot, pluginCacheRoot);
    }
    return skillIdFromPath("codex", resolvedRoot, path.join(codexRoot, "skills"));
  }

  function readExternalSkillRecords() {
    const records = [];
    const seenRoots = new Set();
    for (const root of externalSkillRoots) {
      for (const skillRoot of discoverSkillRoots(root, { maxDepth: 8, maxItems: 800 })) {
        const resolvedRoot = path.resolve(skillRoot);
        if (seenRoots.has(resolvedRoot)) {
          continue;
        }
        seenRoots.add(resolvedRoot);
        try {
          const descriptor = readSkillDescriptor(resolvedRoot);
          const id = getExternalId(resolvedRoot);
          records.push({
            id,
            name: descriptor.name,
            version: descriptor.version,
            root: resolvedRoot,
            source: getExternalSource(resolvedRoot),
            enabled: true,
            external: true,
            installedAt: new Date().toISOString(),
            description: descriptor.description,
            descriptor: withDescriptorIdentity(descriptor, id)
          });
        } catch {
          // Ignore invalid external skill folders.
        }
      }
    }
    return records;
  }

  function findKnownSkill(id) {
    const config = loadConfig();
    const configured = config.installedSkills.find((item) => item.id === id);
    if (configured) {
      return configured;
    }
    return readExternalSkillRecords().find((item) => item.id === id);
  }

  function listCatalog(options = {}) {
    const roots = uniqueResolvedPaths([
      ...defaultCatalogRoots,
      ...catalogRoots,
      ...(Array.isArray(options.roots) ? options.roots : [])
    ]);
    const installed = new Map(loadConfig().installedSkills.map((skill) => [path.resolve(skill.root), skill]));
    const items = [];
    for (const root of roots) {
      for (const skillRoot of discoverSkillRoots(root)) {
        try {
          const descriptor = readSkillDescriptor(skillRoot);
          items.push({
            ...descriptor,
            installed: installed.has(path.resolve(skillRoot)),
            source: "local-catalog"
          });
        } catch {
          // Ignore invalid catalog entries.
        }
      }
    }
    return items;
  }

  function installLocalSkill({ root, id, enabled = true } = {}) {
    if (!root) {
      throw new Error("installLocalSkill requires root");
    }
    const descriptor = readSkillDescriptor(root);
    const skill = {
      id: id || descriptor.id,
      name: descriptor.name,
      version: descriptor.version,
      root: descriptor.root,
      source: "local",
      enabled,
      installedAt: new Date().toISOString(),
      description: descriptor.description
    };
    const config = loadConfig();
    config.installedSkills = [
      skill,
      ...config.installedSkills.filter((item) => item.id !== skill.id && path.resolve(item.root) !== skill.root)
    ];
    saveConfig(config);
    return {
      ...skill,
      descriptor
    };
  }

  function uninstallSkill(id) {
    const config = loadConfig();
    const known = findKnownSkill(id);
    if (known?.external || known?.source?.startsWith?.("codex")) {
      const hiddenRecord = {
        id: known.id,
        name: known.name,
        version: known.version,
        root: known.root,
        source: known.source || "codex-skill",
        enabled: false,
        external: true,
        hidden: true,
        installedAt: known.installedAt || new Date().toISOString(),
        description: known.description || ""
      };
      config.installedSkills = [
        hiddenRecord,
        ...config.installedSkills.filter((item) => item.id !== id && path.resolve(item.root) !== path.resolve(known.root))
      ];
    } else {
      config.installedSkills = config.installedSkills.filter((item) => item.id !== id);
    }
    return saveConfig(config);
  }

  function setSkillEnabled(id, enabled) {
    const config = loadConfig();
    const known = findKnownSkill(id);
    const hasRecord = config.installedSkills.some((item) => item.id === id);
    if (hasRecord) {
      config.installedSkills = config.installedSkills.map((item) => item.id === id ? { ...item, enabled: Boolean(enabled), hidden: false } : item);
    } else if (known) {
      config.installedSkills = [
        {
          id: known.id,
          name: known.name,
          version: known.version,
          root: known.root,
          source: known.source || "local",
          enabled: Boolean(enabled),
          external: Boolean(known.external),
          hidden: false,
          installedAt: new Date().toISOString(),
          description: known.description || ""
        },
        ...config.installedSkills
      ];
    }
    return saveConfig(config);
  }

  function listInstalled() {
    const config = loadConfig();
    const configuredById = new Map(config.installedSkills.map((item) => [item.id, item]));
    const configuredRoots = new Set(config.installedSkills.map((item) => path.resolve(item.root)));
    const configuredItems = config.installedSkills.filter((item) => !item.hidden).map((item) => {
      try {
        const descriptor = readSkillDescriptor(item.root);
        return {
          ...item,
          descriptor: withDescriptorIdentity(descriptor, item.id)
        };
      } catch (error) {
        return {
          ...item,
          error: error instanceof Error ? error.message : "Skill 读取失败"
        };
      }
    });
    const externalItems = readExternalSkillRecords()
      .filter((item) => {
        const configured = configuredById.get(item.id);
        if (configured?.hidden) {
          return false;
        }
        return !configuredRoots.has(path.resolve(item.root));
      })
      .map((item) => ({
        ...item,
        enabled: configuredById.get(item.id)?.enabled ?? item.enabled
      }));
    return [...configuredItems, ...externalItems];
  }

  function getEnabledDescriptors() {
    return listInstalled()
      .filter((item) => item.enabled !== false && item.descriptor && !item.error)
      .map((item) => item.descriptor);
  }

  return {
    getConfig,
    getEnabledDescriptors,
    installLocalSkill,
    listCatalog,
    listInstalled,
    readSkillDescriptor,
    saveConfig,
    setSkillEnabled,
    uninstallSkill
  };
}

module.exports = {
  createSkillMarketplace,
  readSkillDescriptor
};
