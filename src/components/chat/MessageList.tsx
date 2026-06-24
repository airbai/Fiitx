import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bot, Copy, ShieldCheck, UserRound } from "lucide-react";

export type ChatMessage = {
  id: string;
  role: "user" | "agent" | "system";
  author: string;
  body: string;
  time: string;
  approvalId?: string;
};

type MessageListProps = {
  messages: ChatMessage[];
  renderMessageBody: (message: ChatMessage) => ReactNode;
  renderExecutionActivity: () => ReactNode;
  onCopyMessage?: (message: ChatMessage) => void;
  initialVisibleCount?: number;
  pageSize?: number;
};

export function MessageList({
  messages,
  renderMessageBody,
  renderExecutionActivity,
  onCopyMessage,
  initialVisibleCount = 80,
  pageSize = 50
}: MessageListProps) {
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);

  useEffect(() => {
    setVisibleCount((current) => Math.max(current, Math.min(messages.length, initialVisibleCount)));
  }, [initialVisibleCount, messages.length]);

  const hiddenCount = Math.max(0, messages.length - visibleCount);
  const visibleMessages = useMemo(() => messages.slice(hiddenCount), [hiddenCount, messages]);

  return (
    <div className="message-list">
      {hiddenCount > 0 ? (
        <div className="message-history-window">
          <button
            className="message-history-button"
            onClick={() => setVisibleCount((current) => Math.min(messages.length, current + pageSize))}
            type="button"
          >
            显示更早 {Math.min(pageSize, hiddenCount)} 条消息 · 已隐藏 {hiddenCount} 条
          </button>
        </div>
      ) : null}

      {visibleMessages.map((message) => (
        <article key={message.id} className={`message ${message.role}`}>
          <div className="avatar">
            {message.role === "user" ? <UserRound size={16} /> : message.role === "agent" ? <Bot size={16} /> : <ShieldCheck size={16} />}
          </div>
          <div className="message-body">
            <div className="message-meta">
              <strong>{message.author}</strong>
              <span>{message.time}</span>
              {onCopyMessage ? (
                <button
                  className="message-meta-copy-button"
                  onClick={() => onCopyMessage(message)}
                  title="复制消息"
                  type="button"
                >
                  <Copy size={14} />
                  <span>复制</span>
                </button>
              ) : null}
            </div>
            {renderMessageBody(message)}
          </div>
        </article>
      ))}
      {renderExecutionActivity()}
    </div>
  );
}
