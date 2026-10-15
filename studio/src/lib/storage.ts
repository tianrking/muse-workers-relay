import type { Profile, Conversation, Credentials } from "../types";
const PREFIX = "mori.studio.v1.";
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}
export const newId = () => crypto.randomUUID();
export function normalizeServer(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw Error("请输入完整的 HTTPS 中转地址");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error("中转地址应为 HTTPS 域名，不含路径、密码或查询参数");
  return url.origin;
}
export function credentialsFrom(value: unknown): Credentials {
  if (!value || typeof value !== "object") throw Error("配置文件不是有效对象");
  const data = value as Record<string, unknown>;
  const token = data.access_token;
  if (typeof token !== "string" || !token.trim())
    throw Error("配置缺少 access_token");
  if (token.startsWith("mgst_"))
    throw Error(
      "这是 SDK token，请先通过 Muse App 配对，再导入 device access token",
    );
  if (token.length > 16000) throw Error("token 过长");
  const result: Credentials = { access_token: token.trim() };
  for (const key of [
    "relay_key",
    "refresh_token",
    "sdk_token",
    "device_id",
  ] as const) {
    if (typeof data[key] === "string") {
      if (data[key].length > 16000) throw Error("配置字段过长");
      result[key] = data[key].trim();
    }
  }
  return result;
}
export function newConversation(
  accountId: string,
  kind: "thread" | "main" = "thread",
): Conversation {
  const now = Date.now();
  return {
    id: newId(),
    accountId,
    title: kind === "main" ? "Muse 主会话" : "新的对话",
    kind,
    sessionId: kind === "thread" ? newId() : null,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}
export function storedProfiles(): Profile[] {
  const rows = load<Profile[]>("profiles", []);
  return Array.isArray(rows)
    ? rows
        .filter(
          (p) =>
            typeof p.id === "string" &&
            typeof p.name === "string" &&
            ["official", "relay"].includes(p.mode) &&
            typeof p.server === "string",
        )
        .slice(0, 30)
    : [];
}
export function storedConversations(): Conversation[] {
  const rows = load<Conversation[]>("conversations", []);
  return Array.isArray(rows)
    ? rows
        .filter(
          (c) =>
            typeof c.id === "string" &&
            typeof c.accountId === "string" &&
            Array.isArray(c.messages) &&
            ["thread", "main"].includes(c.kind),
        )
        .slice(0, 150)
    : [];
}
export function markdown(conversation: Conversation) {
  return (
    "# " +
    conversation.title +
    "\n\n" +
    conversation.messages
      .filter((m) => m.role !== "error")
      .map((m) => "## " + (m.role === "user" ? "你" : "Muse") + "\n\n" + m.text)
      .join("\n\n")
  );
}
