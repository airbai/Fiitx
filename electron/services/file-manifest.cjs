function stripCodeFence(text) {
  return text
    .replace(/^```(?:json|fiitx-file-manifest)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractFileManifest(text) {
  const source = String(text || "");
  const fenced = source.match(/```fiitx-file-manifest\s*([\s\S]*?)```/i);
  if (!fenced) {
    return null;
  }

  const raw = stripCodeFence(fenced[1]);
  const manifest = JSON.parse(raw);
  if (!manifest || !Array.isArray(manifest.files)) {
    throw new Error("fiitx-file-manifest 必须包含 files 数组");
  }

  return {
    projectName: manifest.projectName || "generated-project",
    title: manifest.title || "Generated Coding Project",
    files: manifest.files.map((file) => ({
      path: String(file.path || ""),
      content: String(file.content || "")
    }))
  };
}

function removeFileManifest(text) {
  return String(text || "").replace(/```fiitx-file-manifest\s*[\s\S]*?```/i, "").trim();
}

module.exports = {
  extractFileManifest,
  removeFileManifest
};
