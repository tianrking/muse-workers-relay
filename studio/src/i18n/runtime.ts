import { english } from "./en.ts";

export type Language = "en" | "zh-CN";
export const LANGUAGE_KEY = "mori.language.v1";

export function preferredLanguage(
  saved: string | null,
  browser = "en",
): Language {
  if (saved === "en" || saved === "zh-CN") return saved;
  return browser.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function initialLanguage(): Language {
  let saved = null;
  try {
    saved = localStorage.getItem(LANGUAGE_KEY);
  } catch {
    /* Storage is optional. */
  }
  return preferredLanguage(
    saved,
    typeof navigator === "undefined" ? "en" : navigator.language,
  );
}

let language = initialLanguage();
const listeners = new Set<() => void>();
export function getLanguage() {
  return language;
}
export function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function setLanguage(next: Language) {
  if (next !== "en" && next !== "zh-CN") return;
  language = next;
  try {
    localStorage.setItem(LANGUAGE_KEY, next);
  } catch {
    /* Keep the in-memory selection. */
  }
  updateDocumentLanguage();
  listeners.forEach((listener) => listener());
}
export function updateDocumentLanguage() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  const description = document.querySelector('meta[name="description"]');
  description?.setAttribute(
    "content",
    language === "en"
      ? "Mori — an optional browser client for the Muse Workers relay. Independent conversations and your own credentials."
      : "Mori — Muse Workers 中转的可选网页客户端。独立会话，使用你自己的凭证。",
  );
}

/** Translate application-owned copy only; never pass user messages or upstream payloads. */
export function t(copy: string): string {
  if (language === "zh-CN") return copy;
  if (Object.hasOwn(english, copy)) return english[copy];
  const retry = /^连接断开，正在准备第 (\d+) 次重连…$/.exec(copy);
  if (retry) return `Connection lost. Preparing reconnect ${retry[1]}…`;
  for (const prefix of [
    "服务器检测失败：HTTP ",
    "刷新失败：HTTP ",
    "Muse 请求失败：",
  ]) {
    if (copy.startsWith(prefix))
      return (english[prefix] || prefix) + copy.slice(prefix.length);
  }
  return copy;
}
