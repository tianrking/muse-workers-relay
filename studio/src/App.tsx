import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Command,
  Globe,
  Info,
  KeyRound,
  Layers,
  Link2,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Plus,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Sun,
  X,
} from "lucide-react";
import { AccountEditor } from "./components/AccountEditor";
import { Modal } from "./components/Modal";
import { MessageList } from "./components/MessageList";
import { useMuse } from "./hooks/useMuse";
import {
  load,
  save,
  newId,
  newConversation,
  storedProfiles,
  storedConversations,
  markdown,
} from "./lib/storage";
import { seal, unseal } from "./lib/vault";
import { refreshCredentials } from "./lib/account-api";
import type { Profile, Credentials, Conversation, Message } from "./types";
export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>(storedProfiles),
    [conversations, setConversations] =
      useState<Conversation[]>(storedConversations),
    [activeId, setActiveId] = useState<string>(() => load("activeProfile", "")),
    [conversationId, setConversationId] = useState(""),
    [query, setQuery] = useState(""),
    [archived, setArchived] = useState(false),
    [editor, setEditor] = useState<Profile | "new" | null>(null),
    [manage, setManage] = useState(false),
    [diagnostics, setDiagnostics] = useState(false),
    [unlock, setUnlock] = useState<Profile | null>(null),
    [unlockPassword, setUnlockPassword] = useState(""),
    [unlockError, setUnlockError] = useState(""),
    [draft, setDraft] = useState(""),
    [toast, setToast] = useState(""),
    [mobile, setMobile] = useState(false),
    [dark, setDark] = useState<boolean>(() => load("dark", false)),
    [renaming, setRenaming] = useState(false),
    [titleDraft, setTitleDraft] = useState(""),
    [refresh, setRefresh] = useState<Profile | null>(null),
    [refreshing, setRefreshing] = useState(false),
    [network, setNetwork] = useState(navigator.onLine),
    [connectionMs, setConnectionMs] = useState(0),
    [, setSecretVersion] = useState(0);
  const secrets = useRef(new Map<string, Credentials>()),
    composer = useRef<HTMLTextAreaElement>(null),
    search = useRef<HTMLInputElement>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    engine = useMuse();
  const active = profiles.find((p) => p.id === activeId),
    conversation = conversations.find(
      (c) => c.id === conversationId && c.accountId === activeId,
    ),
    busy = engine.phase === "sending",
    connecting = engine.phase === "connecting",
    ready = engine.phase === "ready" && engine.accountId === activeId;
  const list = useMemo(
    () =>
      conversations
        .filter(
          (c) =>
            c.accountId === activeId &&
            !!c.archived === archived &&
            c.title.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations, activeId, archived, query],
  );
  function notify(text: string) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }
  useEffect(() => {
    try {
      save("profiles", profiles);
    } catch {
      notify("账号配置无法保存，本机存储空间可能不足");
    }
  }, [profiles]);
  useEffect(() => {
    try {
      save("conversations", conversations);
    } catch {
      notify("聊天记录无法保存，请导出重要会话并释放本机空间");
    }
  }, [conversations]);
  useEffect(() => {
    try {
      save("activeProfile", activeId);
    } catch {
      notify("浏览器未允许保存账号选择");
    }
  }, [activeId]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      save("dark", dark);
    } catch {
      /* Theme can still be used for this page. */
    }
  }, [dark]);
  useEffect(() => {
    const online = () => setNetwork(navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  useEffect(() => {
    return () => {
      engine.disconnect();
      clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        search.current?.focus();
      }
      if (event.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);
  function selectAccount(id: string) {
    if (busy || connecting) return;
    engine.disconnect();
    setActiveId(id);
    setConversationId("");
    setMobile(false);
    setArchived(false);
  }
  function create(kind: "thread" | "main" = "thread") {
    if (busy) return;
    if (!active) {
      setEditor("new");
      return;
    }
    if (conversations.length >= 150) {
      notify("最多保存 150 个本机会话，请先导出记录");
      return;
    }
    if (kind === "main") {
      const existing = conversations.find(
        (c) => c.accountId === activeId && c.kind === "main",
      );
      if (existing) {
        setConversationId(existing.id);
        setArchived(false);
        setConversations((rows) =>
          rows.map((c) =>
            c.id === existing.id ? { ...c, archived: false } : c,
          ),
        );
        return;
      }
    }
    const row = newConversation(activeId, kind);
    setConversations((rows) => [row, ...rows]);
    setConversationId(row.id);
    setArchived(false);
    setMobile(false);
    composer.current?.focus();
  }
  async function storeAccount(
    profile: Profile,
    credentials: Credentials,
    password: string,
  ) {
    if (!profiles.some((p) => p.id === profile.id) && profiles.length >= 30)
      throw Error("本机最多保存 30 个账号");
    let next = profile;
    if (password)
      next = { ...profile, vault: await seal(credentials, password) };
    else next = { ...profile, vault: undefined };
    secrets.current.set(profile.id, credentials);
    setSecretVersion((n) => n + 1);
    setProfiles((rows) =>
      rows.some((p) => p.id === profile.id)
        ? rows.map((p) => (p.id === profile.id ? next : p))
        : [...rows, next],
    );
    if (engine.accountId === profile.id) engine.disconnect();
    if (activeId !== profile.id) {
      engine.disconnect();
      setConversationId("");
    }
    setActiveId(profile.id);
    notify(
      credentials.access_token
        ? "账号已保存，点击连接开始"
        : "账号已保存，等待官方配对后补齐 device token",
    );
  }
  async function connect(profile = active) {
    if (!profile || busy || connecting) return;
    const credentials = secrets.current.get(profile.id);
    if (!credentials?.access_token) {
      if (profile.vault && !credentials) {
        setUnlock(profile);
        setUnlockPassword("");
        setUnlockError("");
        return;
      }
      setEditor(profile);
      notify("请先补齐该账号的 device access token");
      return;
    }
    const start = performance.now();
    try {
      await engine.connect(profile, credentials);
      setConnectionMs(Math.round(performance.now() - start));
      notify("已连接 " + profile.name);
    } catch (e) {
      notify(e instanceof Error ? e.message : "连接失败");
    }
  }
  function edit(profile: Profile) {
    setManage(false);
    setEditor(profile);
  }
  function updateConversation(
    id: string,
    fn: (row: Conversation) => Conversation,
  ) {
    setConversations((rows) => rows.map((c) => (c.id === id ? fn(c) : c)));
  }
  async function send(text = draft) {
    if (busy || connecting || !text.trim()) return;
    if (!active) {
      setEditor("new");
      return;
    }
    if (!ready) {
      notify("先连接当前账号，再发送消息");
      return;
    }
    let target = conversation;
    if (!target) {
      target = newConversation(activeId);
      setConversations((rows) => [target!, ...rows]);
      setConversationId(target.id);
    }
    if (target.messages.length >= 300) {
      notify("当前会话已达 300 条本地消息，请新建会话");
      return;
    }
    const id = target.id,
      now = Date.now(),
      user: Message = {
        id: newId(),
        role: "user",
        text: text.trim(),
        createdAt: now,
        status: "done",
      };
    updateConversation(id, (row) => ({
      ...row,
      messages: [...row.messages, user],
      title:
        row.messages.length === 0 && row.kind === "thread"
          ? text.trim().slice(0, 24)
          : row.title,
      updatedAt: now,
    }));
    setDraft("");
    try {
      const result = await engine.send(text, target, (reply) =>
        updateConversation(id, (row) => {
          const existing = row.messages.find((m) => m.id === reply.id),
            next: Message = {
              id: reply.id,
              role: "assistant",
              text: reply.text,
              createdAt: existing?.createdAt || Date.now(),
              status: reply.done ? "done" : "streaming",
            };
          return {
            ...row,
            messages: existing
              ? row.messages.map((m) => (m.id === reply.id ? next : m))
              : [...row.messages, next],
            updatedAt: Date.now(),
          };
        }),
      );
      updateConversation(id, (row) => ({
        ...row,
        verified: result?.isThread === true,
      }));
    } catch (e) {
      const error = e as Error;
      if (error.name === "AbortError") {
        updateConversation(id, (row) => ({
          ...row,
          messages: row.messages.map((m) =>
            m.status === "streaming" ? { ...m, status: "stopped" } : m,
          ),
        }));
        notify("已停止本次接收，云端任务可能继续");
      } else
        updateConversation(id, (row) => ({
          ...row,
          messages: [
            ...row.messages,
            {
              id: newId(),
              role: "error",
              text: error.message || "暂时无法获得回复，请检查连接后重试",
              createdAt: Date.now(),
              status: "done",
            },
          ],
        }));
    }
  }
  function exportChat() {
    if (!conversation) return;
    const blob = new Blob([markdown(conversation)], {
        type: "text/markdown;charset=utf-8",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = conversation.title.replace(/[<>:"/\\|?*]/g, "_") + ".md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("已导出当前会话");
  }
  const Icon = active?.mode === "relay" ? Radio : Cloud;
  return (
    <div className="studio">
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <div className="brand">
          <div className="brand-icon">
            <Sparkles size={21} />
          </div>
          <span>
            Mori<span className="brand-sub">MUSE STUDIO</span>
          </span>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobile(false)}
            aria-label="关闭侧栏"
          >
            <X size={18} />
          </button>
        </div>
        <button
          className="new-conversation"
          onClick={() => create()}
          disabled={busy}
        >
          <Plus size={17} />
          新建独立会话<span>＋</span>
        </button>
        <div className="search-box">
          <Search size={15} />
          <input
            ref={search}
            aria-label="搜索会话"
            placeholder="搜索会话"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>⌘ K</kbd>
        </div>
        <div className="section-label">
          <span>{archived ? "已归档" : "你的会话"}</span>
          <button
            className="icon-button"
            onClick={() => setArchived(!archived)}
            aria-label={archived ? "查看活跃会话" : "查看归档"}
          >
            {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          </button>
        </div>
        <nav className="conversation-list" aria-label="会话列表">
          {list.map((row) => (
            <div
              key={row.id}
              className={
                "conversation-item " +
                (row.id === conversationId ? "selected" : "")
              }
            >
              <button
                disabled={busy}
                onClick={() => {
                  setConversationId(row.id);
                  setMobile(false);
                }}
              >
                <MessageCircle size={15} />
                <span>{row.title}</span>
                {row.kind === "main" && <small>main</small>}
              </button>
              <button
                className="archive-button"
                disabled={busy}
                aria-label={row.archived ? "恢复会话" : "归档会话"}
                onClick={() => {
                  updateConversation(row.id, (c) => ({
                    ...c,
                    archived: !c.archived,
                  }));
                  if (row.id === conversationId) setConversationId("");
                  notify(
                    row.archived ? "会话已恢复" : "仅在本机归档，官方记录保留",
                  );
                }}
              >
                {row.archived ? (
                  <ArchiveRestore size={13} />
                ) : (
                  <Archive size={13} />
                )}
              </button>
            </div>
          ))}
          {!list.length && (
            <div className="empty-list">
              {query
                ? "没有找到匹配的会话"
                : archived
                  ? "还没有归档会话"
                  : "让第一个想法从这里开始。"}
            </div>
          )}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">✳</span>
          <p>
            给想法一点空间。
            <br />
            给自己一点时间。
          </p>
          <small>YOUR PERSONAL MUSE SPACE</small>
        </div>
        <div className="account-footer">
          <div className="account-select">
            <div className="account-avatar">
              {active?.name.slice(0, 1) || "M"}
            </div>
            <select
              aria-label="当前账号"
              value={activeId}
              disabled={busy || connecting}
              onChange={(e) => selectAccount(e.target.value)}
            >
              <option value="">选择账号</option>
              {profiles
                .filter((p) => !p.disabled)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <ChevronDown size={14} />
          </div>
          <div className="footer-actions">
            <button onClick={() => setManage(true)}>
              <Settings2 size={14} />
              账号与设置
            </button>
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label="切换主题"
            >
              <Sun size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="workspace-path">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="打开侧栏"
            >
              <Menu size={20} />
            </button>
            <span>工作空间</span>
            <ChevronRight size={13} />
            <strong>{active?.name || "欢迎来到 Mori"}</strong>
            <span className="beta">PERSONAL</span>
          </div>
          <div className="top-actions">
            <button
              className={"connection-status " + engine.phase}
              onClick={() => setDiagnostics(true)}
            >
              <i />
              {engine.phase === "sending"
                ? "正在回复"
                : engine.phase === "ready"
                  ? "已连接"
                  : engine.phase === "connecting"
                    ? "连接中"
                    : engine.phase === "error"
                      ? "连接失败"
                      : "未连接"}
              <ChevronDown size={12} />
            </button>
            <button
              className="icon-button"
              onClick={() => setEditor(active || "new")}
              aria-label="连接设置"
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </header>
        {!network && (
          <div className="network-banner" role="alert">
            网络已离线。恢复网络后重新连接即可继续。
          </div>
        )}
        <div className="chat-heading">
          <div>
            {conversation ? (
              <>
                {renaming ? (
                  <input
                    className="rename-input"
                    autoFocus
                    value={titleDraft}
                    maxLength={60}
                    aria-label="会话名称"
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={() => {
                      if (titleDraft.trim())
                        updateConversation(conversation.id, (row) => ({
                          ...row,
                          title: titleDraft.trim(),
                        }));
                      setRenaming(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setRenaming(false);
                    }}
                  />
                ) : (
                  <h1>
                    {conversation.title}
                    <button
                      className="icon-button"
                      disabled={busy}
                      aria-label="重命名会话"
                      onClick={() => {
                        setTitleDraft(conversation.title);
                        setRenaming(true);
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                  </h1>
                )}
                <span
                  className={
                    "session-badge " +
                    (conversation.kind === "main" ? "main" : "")
                  }
                >
                  <Layers size={12} />
                  {conversation.kind === "main"
                    ? "主会话 · 写入 Muse main"
                    : conversation.verified
                      ? "独立会话 · 官方已确认"
                      : "独立会话 · 首条消息时创建"}
                </span>
              </>
            ) : (
              <div className="welcome-tag">
                <span />A SPACE TO THINK, TOGETHER.
              </div>
            )}
          </div>
          <div className="heading-actions">
            {conversation && (
              <button
                className="icon-button"
                onClick={exportChat}
                aria-label="导出会话"
              >
                <ArrowDownToLine size={17} />
              </button>
            )}
            <button
              className="quiet-button"
              disabled={busy}
              onClick={() => create("main")}
            >
              <MessageCircle size={14} />
              进入主会话
            </button>
          </div>
        </div>
        <section className="chat-stage">
          {conversation?.messages.length ? (
            <MessageList messages={conversation.messages} busy={busy} />
          ) : (
            <div className="welcome">
              <div className="hero-illustration" aria-hidden="true">
                <div className="orbit one" />
                <div className="orbit two" />
                <span className="star star-a">✦</span>
                <span className="star star-b">✧</span>
                <div className="hero-orb">
                  <div className="orb-eye left" />
                  <div className="orb-eye right" />
                  <div className="orb-mouth" />
                </div>
                <span className="orb-chip">
                  <Sparkles size={15} />
                </span>
              </div>
              <div className="hello-label">你的 Muse，你的节奏。</div>
              <h2>
                把想法，聊成<span>下一步。</span>
              </h2>
              <p>
                整理灵感、探索问题，或者只是聊聊今天。
                <br />
                为每一个新想法，留一间独立的小房间。
              </p>
              <div className="prompt-grid">
                {[
                  {
                    icon: Sparkles,
                    title: "灵感发芽",
                    text: "帮我把一个模糊的想法变成可执行的计划。",
                    hint: "让一个想法有新的可能",
                  },
                  {
                    icon: Layers,
                    title: "理清思路",
                    text: "带我一步步梳理今天最重要的三件事。",
                    hint: "从纷乱中找到下一步",
                  },
                  {
                    icon: Sun,
                    title: "轻松聊聊",
                    text: "给我推荐一个今天就能做的小冒险。",
                    hint: "让今天多一点小惊喜",
                  },
                ].map(({ icon: PromptIcon, title, text, hint }) => (
                  <button
                    key={title}
                    onClick={() => {
                      setDraft(text);
                      composer.current?.focus();
                    }}
                  >
                    <PromptIcon size={18} />
                    <strong>{title}</strong>
                    <small>{hint}</small>
                    <ArrowUp size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        <div className="composer-area">
          <div className="composer-inner">
            {!ready && !busy && (
              <div className="connect-nudge">
                <span>
                  <Link2 size={14} />
                  {active
                    ? "连接 " + active.name + "，开始你的对话"
                    : "添加自己的 Muse 账号，开始使用"}
                </span>
                <button
                  disabled={connecting}
                  onClick={() => (active ? void connect() : setEditor("new"))}
                >
                  {connecting ? "正在连接…" : active ? "连接账号" : "添加账号"}
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
            <form
              className={"composer " + (busy ? "busy" : "")}
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <textarea
                ref={composer}
                aria-label="消息"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="写下你的想法…"
                maxLength={2000}
                rows={2}
              />
              <div className="composer-toolbar">
                <span>
                  <Layers size={13} />
                  {conversation?.kind === "main" ? "Muse 主会话" : "独立会话"}
                  <span className="toolbar-dot">·</span>
                  {active?.name || "尚未选择账号"}
                </span>
                {busy ? (
                  <button
                    className="send-button stop"
                    type="button"
                    onClick={engine.cancel}
                    aria-label="停止接收"
                    title="停止接收；云端任务可能继续"
                  >
                    <Square size={14} />
                  </button>
                ) : (
                  <button
                    className="send-button"
                    type="submit"
                    disabled={!draft.trim() || !ready || connecting}
                    aria-label="发送消息"
                  >
                    <ArrowUp size={19} />
                  </button>
                )}
              </div>
            </form>
            <div className="composer-caption">
              <span>
                <ShieldCheck size={11} />
                Noise 加密传输 · 本机保存会话
              </span>
              <span>
                {draft.length > 1800
                  ? draft.length + "/2000"
                  : "Enter 发送 · Shift + Enter 换行"}
              </span>
            </div>
          </div>
        </div>
        <footer className="workspace-footer">
          <span>
            Mori <span>·</span> Independent Muse client
          </span>
          <button onClick={() => setDiagnostics(true)}>
            <Icon size={12} />
            {active?.mode === "relay" ? "自定义中转" : "默认中转"}
            <span>↗</span>
          </button>
        </footer>
      </main>
      {editor && (
        <AccountEditor
          profile={editor === "new" ? undefined : editor}
          credentials={
            editor === "new" ? undefined : secrets.current.get(editor.id)
          }
          onClose={() => setEditor(null)}
          onSave={storeAccount}
        />
      )}
      {manage && (
        <Modal
          title="账号与工作空间"
          subtitle="不同账号分别保存配置与会话，凭证不会混用。"
          onClose={() => setManage(false)}
        >
          <div className="account-manager">
            {profiles.map((profile) => (
              <div className="managed-account" key={profile.id}>
                <div className="account-avatar">{profile.name.slice(0, 1)}</div>
                <div>
                  <strong>
                    {profile.name}
                    {profile.disabled ? " · 已停用" : ""}
                  </strong>
                  <small>
                    {profile.mode === "official" ? "默认中转" : profile.server}{" "}
                    ·{" "}
                    {secrets.current.get(profile.id)?.access_token
                      ? "已授权"
                      : profile.vault
                        ? "已加密锁定"
                        : "待官方配对"}
                  </small>
                </div>
                <button
                  className="icon-button"
                  onClick={() => edit(profile)}
                  aria-label={"编辑 " + profile.name}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={"锁定 " + profile.name}
                  onClick={() => {
                    if (engine.accountId === profile.id) engine.disconnect();
                    secrets.current.delete(profile.id);
                    setSecretVersion((n) => n + 1);
                    notify(
                      profile.vault
                        ? "已锁定本机凭证"
                        : "已清除内存凭证，重新使用需要导入",
                    );
                  }}
                >
                  <LockKeyhole size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={
                    (profile.disabled ? "恢复 " : "停用 ") + profile.name
                  }
                  onClick={() => {
                    if (engine.accountId === profile.id) engine.disconnect();
                    secrets.current.delete(profile.id);
                    setProfiles((rows) =>
                      rows.map((p) =>
                        p.id === profile.id
                          ? { ...p, disabled: !p.disabled }
                          : p,
                      ),
                    );
                    if (activeId === profile.id) setActiveId("");
                    notify(
                      profile.disabled
                        ? "账号已恢复"
                        : "账号已停用，配置与会话保留",
                    );
                  }}
                >
                  {profile.disabled ? (
                    <ArchiveRestore size={15} />
                  ) : (
                    <Archive size={15} />
                  )}
                </button>
                <button
                  className="icon-button"
                  aria-label={"刷新 " + profile.name}
                  disabled={!secrets.current.get(profile.id)?.refresh_token}
                  onClick={() => {
                    setManage(false);
                    setRefresh(profile);
                  }}
                >
                  <KeyRound size={15} />
                </button>
              </div>
            ))}
            {!profiles.length && (
              <div className="empty-account">
                <KeyRound size={28} />
                <p>还没有账号，添加自己的 Muse 凭证。</p>
              </div>
            )}
            <button
              className="add-account"
              onClick={() => {
                setManage(false);
                setEditor("new");
              }}
            >
              <Plus size={16} />
              添加另一个账号
            </button>
            <div className="info-card">
              <Info size={17} />
              <p>
                账号名称、连接配置和会话保存在当前浏览器。未加密保存的凭证在关闭或刷新页面后清除。
              </p>
            </div>
            <button
              className="secondary full-width"
              onClick={() => {
                setManage(false);
                setDiagnostics(true);
              }}
            >
              查看当前连接与诊断
            </button>
          </div>
        </Modal>
      )}
      {unlock && (
        <Modal
          title={"解锁 " + unlock.name}
          subtitle="密码只在本机用于解密，不会发送到服务器。"
          onClose={() => setUnlock(null)}
        >
          <form
            className="panel-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setUnlockError("");
              try {
                const credentials = await unseal(unlock.vault!, unlockPassword);
                secrets.current.set(unlock.id, credentials);
                setSecretVersion((n) => n + 1);
                const profile = unlock;
                setUnlock(null);
                setUnlockPassword("");
                await connect(profile);
              } catch (error) {
                setUnlockError(
                  error instanceof Error ? error.message : "解锁失败",
                );
              }
            }}
          >
            <label>
              本机解锁密码
              <input
                autoFocus
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {unlockError && (
              <p className="form-error" role="alert">
                {unlockError}
              </p>
            )}
            <button className="primary full-width">解锁并连接</button>
          </form>
        </Modal>
      )}
      {diagnostics && (
        <Modal
          title="连接与诊断"
          subtitle="查看实际连接路线，诊断信息不包含 token 或聊天内容。"
          onClose={() => setDiagnostics(false)}
        >
          <div className="panel-body">
            <div className="route-visual">
              <span>浏览器</span>
              <ChevronRight size={15} />
              <span>
                {active?.mode === "relay"
                  ? "自定义 Relay"
                  : "本站默认中转 · 免填中转 Token"}
              </span>
              <ChevronRight size={15} />
              <span>Muse 官方</span>
            </div>
            <dl className="diagnostic-list">
              <div>
                <dt>当前状态</dt>
                <dd>{engine.label}</dd>
              </div>
              <div>
                <dt>账号</dt>
                <dd>{active?.name || "未选择"}</dd>
              </div>
              <div>
                <dt>连接入口</dt>
                <dd>
                  {active?.mode === "relay" ? active.server : location.origin}
                </dd>
              </div>
              {conversation && (
                <>
                  <div>
                    <dt>会话类型</dt>
                    <dd>
                      {conversation.kind === "thread"
                        ? "独立线程"
                        : "Muse main"}
                    </dd>
                  </div>
                  <div>
                    <dt>会话 ID</dt>
                    <dd>{conversation.sessionId || "main"}</dd>
                  </div>
                </>
              )}
              <div>
                <dt>官方 API</dt>
                <dd>api.muse.ai</dd>
              </div>
              <div>
                <dt>握手耗时</dt>
                <dd>{connectionMs ? connectionMs + " ms" : "尚未测量"}</dd>
              </div>
              <div>
                <dt>可用 Muse</dt>
                <dd>{engine.vms.length}</dd>
              </div>
            </dl>
            {engine.vms.length > 1 && active && (
              <label>
                选择 Muse
                <select
                  value={
                    active.vmId ||
                    engine.vms.find((vm) => vm.default)?.vm_id ||
                    ""
                  }
                  disabled={busy}
                  onChange={(e) => {
                    setProfiles((rows) =>
                      rows.map((p) =>
                        p.id === active.id ? { ...p, vmId: e.target.value } : p,
                      ),
                    );
                    engine.disconnect();
                    notify("Muse 已切换，请重新连接");
                  }}
                >
                  {engine.vms.map((vm) => (
                    <option key={vm.vm_id} value={vm.vm_id}>
                      {vm.vm_name || "Muse"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="diagnostic-events">
              {engine.diagnostics.map((row, i) => (
                <div key={i}>
                  <Check size={13} />
                  <span>
                    {row.stage === "reconnect"
                      ? "自动重连"
                      : row.stage === "account"
                        ? "账号验证"
                        : row.stage === "registered"
                          ? "Noise 握手与设备注册"
                          : row.stage === "chat_ack"
                            ? "消息确认"
                            : "订阅状态"}
                  </span>
                  <code>
                    {row.status ||
                      (row.isThread
                        ? "独立会话"
                        : row.noise
                          ? "已加密"
                          : row.vmCount || "OK")}
                  </code>
                </div>
              ))}
            </div>
            <div className="info-card">
              <Globe size={17} />
              <p>
                官方模式仍经过本网站的浏览器适配入口。自定义中转必须支持 Muse
                浏览器协议和允许本站 Origin，不能填入任意 HTTP 代理。
              </p>
            </div>
            <div className="button-row">
              <button
                className="secondary"
                onClick={() => {
                  engine.disconnect();
                  setDiagnostics(false);
                }}
              >
                断开连接
              </button>
              <button
                className="primary"
                disabled={busy || connecting || !active}
                onClick={() => {
                  setDiagnostics(false);
                  void connect();
                }}
              >
                重新连接
              </button>
            </div>
          </div>
        </Modal>
      )}
      {refresh && (
        <Modal
          title="手动刷新设备凭证"
          subtitle="仅对你独立用于网页的设备凭证执行。"
          onClose={() => !refreshing && setRefresh(null)}
        >
          <div className="panel-body">
            <div className="info-card">
              <Info size={18} />
              <p>
                官方刷新可能轮换 refresh token。若此凭证还被 MCU
                使用，刷新后需同步更新设备。本操作不会自动修改板子，也不会自动重试。
              </p>
            </div>
            <p className="field-help">
              刷新后的凭证会更新到当前页面内存；若账号有加密存储，请在编辑账号中重新输入本机密码保存。
            </p>
            <div className="button-row">
              <button
                className="secondary"
                onClick={() => setRefresh(null)}
                disabled={refreshing}
              >
                取消
              </button>
              <button
                className="primary"
                disabled={refreshing}
                onClick={async () => {
                  setRefreshing(true);
                  try {
                    const next = await refreshCredentials(
                      refresh,
                      secrets.current.get(refresh.id)!,
                    );
                    engine.disconnect();
                    secrets.current.set(refresh.id, next);
                    setSecretVersion((n) => n + 1);
                    setProfiles((rows) =>
                      rows.map((p) =>
                        p.id === refresh.id ? { ...p, vault: undefined } : p,
                      ),
                    );
                    setRefresh(null);
                    notify("凭证已更新到内存，请重新连接并保存");
                  } catch (e) {
                    notify(e instanceof Error ? e.message : "刷新失败");
                  } finally {
                    setRefreshing(false);
                  }
                }}
              >
                {refreshing ? "正在刷新…" : "确认轮换凭证"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}
