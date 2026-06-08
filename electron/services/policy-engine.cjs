const path = require("node:path");

const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "release",
  "coverage",
  ".next",
  ".turbo",
  "build",
  "out",
  ".cache"
]);

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".py",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".wxml",
  ".wxss",
  ".yaml",
  ".yml"
]);

function isIgnoredDirectory(name) {
  return ignoredDirectories.has(name) || name.startsWith(".");
}

function isSensitivePath(relativePath) {
  const normalized = relativePath.toLowerCase();
  const baseName = path.basename(normalized);
  return (
    baseName === ".env" ||
    baseName.startsWith(".env.") ||
    baseName === ".npmrc" ||
    baseName === ".pypirc" ||
    baseName === "id_rsa" ||
    baseName === "id_ed25519" ||
    normalized.endsWith(".pem") ||
    normalized.endsWith(".key") ||
    normalized.includes("secret") ||
    normalized.includes("token")
  );
}

function isTextFile(relativePath) {
  return textExtensions.has(path.extname(relativePath).toLowerCase());
}

function assertRequiredFiles(files, requiredFiles) {
  const missing = requiredFiles.filter((file) => !Object.prototype.hasOwnProperty.call(files, file));
  return {
    ok: missing.length === 0,
    missing
  };
}

module.exports = {
  assertRequiredFiles,
  isIgnoredDirectory,
  isSensitivePath,
  isTextFile
};
