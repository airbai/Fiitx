const THREE_ESM_BASE = "https://esm.sh/three@0.160.0";

function isHtmlPath(filePath) {
  return /\.html?$/i.test(String(filePath || "").split("?")[0].split("#")[0]);
}

function normalizeHtmlModuleImports(filePath, content) {
  if (!isHtmlPath(filePath) || typeof content !== "string" || !/\bthree(?:\/addons\/)?/i.test(content)) {
    return content;
  }

  return content
    .replace(
      /from\s+(['"])three\/addons\/([^'"]+)\1/g,
      (_match, quote, addonPath) => `from ${quote}${THREE_ESM_BASE}/examples/jsm/${addonPath}${quote}`
    )
    .replace(
      /from\s+(['"])three\1/g,
      (_match, quote) => `from ${quote}${THREE_ESM_BASE}${quote}`
    )
    .replace(
      /import\(\s*(['"])three\/addons\/([^'"]+)\1\s*\)/g,
      (_match, quote, addonPath) => `import(${quote}${THREE_ESM_BASE}/examples/jsm/${addonPath}${quote})`
    )
    .replace(
      /import\(\s*(['"])three\1\s*\)/g,
      (_match, quote) => `import(${quote}${THREE_ESM_BASE}${quote})`
    )
    .replace(
      /https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/"']+\/build\/three\.module\.js/g,
      THREE_ESM_BASE
    )
    .replace(
      /https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/"']+\/examples\/jsm\//g,
      `${THREE_ESM_BASE}/examples/jsm/`
    )
    .replace(
      /https:\/\/unpkg\.com\/three@[^/"']+\/build\/three\.module\.js/g,
      THREE_ESM_BASE
    )
    .replace(
      /https:\/\/unpkg\.com\/three@[^/"']+\/examples\/jsm\//g,
      `${THREE_ESM_BASE}/examples/jsm/`
    );
}

module.exports = {
  THREE_ESM_BASE,
  isHtmlPath,
  normalizeHtmlModuleImports
};
