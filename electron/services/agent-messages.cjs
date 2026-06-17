const crypto = require("node:crypto");

const AGENT_MESSAGE_TYPES = Object.freeze({
  LLM: "llm",
  TOOL_CALL: "tool_call",
  TOOL_RESULT: "tool_result",
  ARTIFACT: "artifact",
  APPROVAL: "approval",
  CHANNEL_EVENT: "channel_event",
  EXTERNAL_CONTEXT: "external_context",
  SUMMARY: "summary",
  UI: "ui",
  TELEMETRY: "telemetry"
});

function createAgentMessage(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || crypto.randomUUID(),
    parentId: Object.prototype.hasOwnProperty.call(input, "parentId") ? input.parentId : null,
    type: input.type || AGENT_MESSAGE_TYPES.LLM,
    role: input.role || "system",
    content: typeof input.content === "string" ? input.content : "",
    visibility: input.visibility || "model",
    createdAt: input.createdAt || now,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}
  };
}

function createLlmMessage(role, content, metadata = {}) {
  return createAgentMessage({
    type: AGENT_MESSAGE_TYPES.LLM,
    role,
    content,
    metadata
  });
}

function createContextMessage(kind, content, metadata = {}) {
  return createAgentMessage({
    type: kind || AGENT_MESSAGE_TYPES.EXTERNAL_CONTEXT,
    role: metadata.role || "user",
    content,
    visibility: "model",
    metadata: {
      contextKind: kind,
      ...metadata
    }
  });
}

function createToolCallMessage(toolCall, metadata = {}) {
  return createAgentMessage({
    type: AGENT_MESSAGE_TYPES.TOOL_CALL,
    role: "assistant",
    content: "",
    visibility: "audit",
    metadata: {
      toolCallId: toolCall?.id || "",
      toolName: toolCall?.name || toolCall?.function?.name || "",
      arguments: toolCall?.arguments || toolCall?.function?.arguments || {},
      ...metadata
    }
  });
}

function createToolResultMessage(toolCall, result, metadata = {}) {
  return createAgentMessage({
    type: AGENT_MESSAGE_TYPES.TOOL_RESULT,
    role: "tool",
    content: typeof result === "string" ? result : JSON.stringify(result, null, 2),
    visibility: "model",
    metadata: {
      toolCallId: toolCall?.id || metadata.toolCallId || "",
      toolName: toolCall?.name || metadata.toolName || "",
      ...metadata
    }
  });
}

function createApprovalMessage(approvalRequest, metadata = {}) {
  return createAgentMessage({
    type: AGENT_MESSAGE_TYPES.APPROVAL,
    role: "system",
    content: approvalRequest?.detail || approvalRequest?.title || "",
    visibility: "ui",
    metadata: {
      approvalRequest,
      ...metadata
    }
  });
}

function createArtifactMessage(artifact, metadata = {}) {
  return createAgentMessage({
    type: AGENT_MESSAGE_TYPES.ARTIFACT,
    role: "assistant",
    content: artifact?.preview || artifact?.title || "",
    visibility: "ui",
    metadata: {
      artifact,
      ...metadata
    }
  });
}

function createChannelEventMessage(channelEvent, metadata = {}) {
  return createAgentMessage({
    type: AGENT_MESSAGE_TYPES.CHANNEL_EVENT,
    role: "system",
    content: channelEvent?.detail || channelEvent?.event || "",
    visibility: "audit",
    metadata: {
      channelEvent,
      ...metadata
    }
  });
}

function contentToText(content) {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((block) => block?.text || block?.thinking || "")
    .filter(Boolean)
    .join("\n");
}

function fromUiContextMessage(message, metadata = {}) {
  if (!message?.content || !["user", "assistant"].includes(message.role)) {
    return null;
  }
  return createLlmMessage(message.role, contentToText(message.content), {
    source: "ui-context",
    time: message.time,
    ...metadata
  });
}

function transformContext(agentMessages = [], options = {}) {
  const maxMessages = Math.max(4, Number(options.maxMessages || 36));
  const systemMessages = agentMessages.filter((message) => message.role === "system" && message.visibility !== "ui");
  const contextMessages = agentMessages.filter((message) =>
    [
      AGENT_MESSAGE_TYPES.EXTERNAL_CONTEXT,
      AGENT_MESSAGE_TYPES.CHANNEL_EVENT,
      AGENT_MESSAGE_TYPES.SUMMARY
    ].includes(message.type) && message.visibility === "model"
  );
  const conversational = agentMessages.filter((message) =>
    message.type === AGENT_MESSAGE_TYPES.LLM &&
    message.role !== "system" &&
    message.visibility === "model"
  );
  const toolResults = agentMessages.filter((message) =>
    message.type === AGENT_MESSAGE_TYPES.TOOL_RESULT &&
    message.visibility === "model"
  );

  const nearContext = conversational.slice(-maxMessages);
  return [
    ...systemMessages.slice(0, 1),
    ...contextMessages.slice(-8),
    ...nearContext,
    ...toolResults.slice(-12)
  ];
}

function convertToLlm(agentMessages = []) {
  return agentMessages
    .map((message) => {
      if (!message || message.visibility === "ui") {
        return null;
      }
      if (message.type === AGENT_MESSAGE_TYPES.TOOL_RESULT) {
        if (!message.metadata?.preserveToolRole || !message.metadata?.toolCallId) {
          const toolName = message.metadata?.toolName ? `（${message.metadata.toolName}）` : "";
          return {
            role: "user",
            content: `历史工具结果${toolName}：\n${message.content}`
          };
        }
        return {
          role: "tool",
          tool_call_id: message.metadata?.toolCallId,
          name: message.metadata?.toolName,
          content: message.content
        };
      }
      if (message.type === AGENT_MESSAGE_TYPES.TOOL_CALL || message.type === AGENT_MESSAGE_TYPES.ARTIFACT) {
        return null;
      }
      return {
        role: ["system", "user", "assistant"].includes(message.role) ? message.role : "user",
        content: message.content,
        name: message.metadata?.name
      };
    })
    .filter(Boolean)
    .map((message) => {
      if (!message.name) {
        delete message.name;
      }
      return message;
    });
}

module.exports = {
  AGENT_MESSAGE_TYPES,
  contentToText,
  convertToLlm,
  createAgentMessage,
  createApprovalMessage,
  createArtifactMessage,
  createChannelEventMessage,
  createContextMessage,
  createLlmMessage,
  createToolCallMessage,
  createToolResultMessage,
  fromUiContextMessage,
  transformContext
};
