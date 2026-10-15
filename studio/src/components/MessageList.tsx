import { memo, useEffect, useRef, useState } from "react";
import { Check, Copy, Sparkles, UserRound, ArrowDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../types";

const MessageItem = memo(function MessageItem({
  message,
}: {
  message: Message;
}) {
  const [copied, setCopied] = useState("");
  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
    }
  }
  return (
    <article key={message.id} className={"message-row " + message.role}>
      <div className="message-avatar">
        {message.role === "user" ? (
          <UserRound size={17} />
        ) : (
          <Sparkles size={18} />
        )}
      </div>
      <div className="message-body">
        <div className="message-meta">
          <strong>
            {message.role === "user"
              ? "你"
              : message.role === "error"
                ? "连接提示"
                : "Muse"}
          </strong>
          <time>
            {new Intl.DateTimeFormat("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(message.createdAt)}
          </time>
          {message.status === "streaming" && (
            <span className="stream-label">正在回复</span>
          )}
          {message.status === "stopped" && <span>已停止接收</span>}
        </div>
        <div className="prose">
          {message.role === "user" ? (
            <p className="user-text">{message.text}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
                pre: ({ children }) => (
                  <div className="code-shell">
                    <div className="code-label">CODE</div>
                    <pre>{children}</pre>
                  </div>
                ),
              }}
            >
              {message.text || " "}
            </ReactMarkdown>
          )}
        </div>
        {message.text && message.role !== "error" && (
          <button
            className="copy-message"
            onClick={() => void copy(message.id, message.text)}
            aria-label="复制消息"
          >
            {copied === message.id ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied === message.id ? "已复制" : "复制"}</span>
          </button>
        )}
      </div>
    </article>
  );
});

export function MessageList({
  messages,
  busy,
}: {
  messages: Message[];
  busy: boolean;
}) {
  const end = useRef<HTMLDivElement>(null),
    viewport = useRef<HTMLDivElement>(null),
    follow = useRef(true),
    [away, setAway] = useState(false);
  useEffect(() => {
    if (follow.current)
      end.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [messages, busy]);
  return (
    <div
      className="message-scroll"
      ref={viewport}
      onScroll={() => {
        const el = viewport.current;
        if (el) {
          follow.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          setAway(!follow.current);
        }
      }}
    >
      <div className="message-column">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}{" "}
        {busy && !messages.some((m) => m.status === "streaming") && (
          <div className="thinking-row">
            <span className="thinking-spark">
              <Sparkles size={17} />
            </span>
            <div className="typing">
              <i />
              <i />
              <i />
            </div>
            <span>Muse 正在思考</span>
          </div>
        )}
        <div ref={end} />
      </div>
      {away && (
        <button
          className="jump-bottom"
          onClick={() => {
            follow.current = true;
            end.current?.scrollIntoView({ behavior: "smooth" });
            setAway(false);
          }}
        >
          <ArrowDown size={15} />
          回到最新消息
        </button>
      )}
    </div>
  );
}
