const capabilityRoutes = {
  "vision.qa": {
    routeTarget: "model",
    modelCapabilities: ["imageInput"],
    toolCapabilities: [],
    runtime: "model",
    modelRequired: true
  },
  "media.image.generate": {
    routeTarget: "model",
    modelCapabilities: ["imageGeneration"],
    toolCapabilities: [],
    runtime: "model",
    modelRequired: true
  },
  "media.video.generate": {
    routeTarget: "model",
    modelCapabilities: ["videoGeneration"],
    toolCapabilities: [],
    runtime: "model",
    modelRequired: true
  },
  "media.audio.generate": {
    routeTarget: "model",
    modelCapabilities: ["audioGeneration"],
    toolCapabilities: [],
    runtime: "model",
    modelRequired: true
  },
  "artifact.pdf.export": {
    routeTarget: "tool",
    modelCapabilities: [],
    toolCapabilities: ["workspace", "pdf", "document"],
    runtime: "local-tool",
    localFirst: true,
    modelRequired: false
  },
  "file.transform.base64": {
    routeTarget: "tool",
    modelCapabilities: [],
    toolCapabilities: ["workspace", "file-transform"],
    runtime: "local-tool",
    localFirst: true,
    modelRequired: false
  }
};

function detectCapabilityIntent(taskIntent) {
  const route = capabilityRoutes[taskIntent.namespace] || {};
  const routeTarget = route.routeTarget || (taskIntent.mode === "coding" ? "agent" : "model");
  const requiredModelCapabilities = Array.isArray(route.modelCapabilities) ? route.modelCapabilities.slice() : [];
  const requiredToolCapabilities = Array.isArray(route.toolCapabilities) ? route.toolCapabilities.slice() : [];

  if (taskIntent.mode === "coding") {
    requiredToolCapabilities.push("workspace");
  }
  if (taskIntent.requiresExternalContext) {
    requiredToolCapabilities.push("web");
  }
  if (taskIntent.outputAction === "html.embed_data_uri") {
    requiredToolCapabilities.push("html-embed");
  }

  const runtime =
    route.runtime ||
    (routeTarget === "agent" ? "agent-runtime" : routeTarget === "tool" ? "local-tool" : "model-runtime");

  return {
    routeTarget,
    runtime,
    inputModalities: taskIntent.hasImageAttachment ? ["text", "image"] : ["text"],
    outputModality: taskIntent.modality,
    modelCapability: requiredModelCapabilities[0] || "chat",
    requiredModelCapabilities,
    requiredToolCapabilities: Array.from(new Set(requiredToolCapabilities)),
    outputAction: taskIntent.outputAction || "",
    localFirst: Boolean(route.localFirst),
    modelRequired: route.modelRequired != null ? Boolean(route.modelRequired) : routeTarget !== "tool",
    executionPlan: {
      runtime,
      toolChain: routeTarget === "tool" ? Array.from(new Set(requiredToolCapabilities)) : [],
      outputAction: taskIntent.outputAction || "",
      agentRequired: routeTarget === "agent",
      modelRequired: route.modelRequired != null ? Boolean(route.modelRequired) : routeTarget !== "tool"
    }
  };
}

module.exports = {
  capabilityRoutes,
  detectCapabilityIntent
};
