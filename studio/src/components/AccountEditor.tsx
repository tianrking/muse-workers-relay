import { useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Cloud,
  FileUp,
  Info,
  KeyRound,
  LockKeyhole,
  Radio,
  Server,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "./Modal";
import { credentialsFrom, newId, normalizeServer } from "../lib/storage";
import { probe } from "../lib/account-api";
import type { Profile, Credentials } from "../types";
type Props = {
  profile?: Profile;
  credentials?: Credentials;
  onClose: () => void;
  onSave: (
    profile: Profile,
    credentials: Credentials,
    password: string,
  ) => Promise<void>;
};
export function AccountEditor({
  profile,
  credentials,
  onClose,
  onSave,
}: Props) {
  const [tab, setTab] = useState<"account" | "connect" | "guide">("account"),
    [name, setName] = useState(profile?.name || ""),
    [deviceName, setDeviceName] = useState(profile?.deviceName || "Mori Web"),
    [mode, setMode] = useState(profile?.mode || "official"),
    [server, setServer] = useState(profile?.server || location.origin),
    [token, setToken] = useState(credentials?.access_token || ""),
    [relayKey, setRelayKey] = useState(credentials?.relay_key || ""),
    [refreshToken, setRefreshToken] = useState(
      credentials?.refresh_token || "",
    ),
    [deviceId, setDeviceId] = useState(credentials?.device_id || ""),
    [sdkToken, setSdkToken] = useState(credentials?.sdk_token || ""),
    [remember, setRemember] = useState(!!profile?.vault),
    [password, setPassword] = useState(""),
    [trusted, setTrusted] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [check, setCheck] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const makeProfile = (): Profile => ({
    id: profile?.id || newId(),
    name: name.trim(),
    deviceName: deviceName.trim() || "Mori Web",
    mode,
    server: mode === "relay" ? normalizeServer(server) : location.origin,
    vmId: profile?.vmId,
    createdAt: profile?.createdAt || Date.now(),
  });
  async function importFile(file: File) {
    try {
      if (file.size > 65536) throw Error("配置文件不能超过 64 KB");
      const raw = JSON.parse(await file.text()),
        data = credentialsFrom(raw);
      setToken(data.access_token);
      setRelayKey(data.relay_key || "");
      setRefreshToken(data.refresh_token || "");
      setDeviceId(data.device_id || "");
      setSdkToken(data.sdk_token || "");
      if (!name && typeof raw.username === "string") setName(raw.username);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (!name.trim()) throw Error("给这个账号起个名字");
      const p = makeProfile();
      if (p.mode === "relay" && p.server !== location.origin && !trusted)
        throw Error("请确认你信任此自定义服务器");
      if (sdkToken && !sdkToken.startsWith("mgst_"))
        throw Error("SDK token 应以 mgst_ 开头");
      if (token.startsWith("mgst_"))
        throw Error(
          "SDK token 不能用于聊天。请在「新账号接入」查看官方配对步骤",
        );
      if (!token.trim() && !sdkToken.trim())
        throw Error("请导入设备凭证，或保存 SDK token 作为待配对账号");
      if (p.mode === "relay" && !relayKey.trim())
        throw Error("自定义中转需要中转 Token");
      if (remember && password.length < 10)
        throw Error("本机解锁密码至少 10 个字符");
      await onSave(
        p,
        {
          access_token: token.trim(),
          relay_key: relayKey.trim(),
          refresh_token: refreshToken.trim(),
          sdk_token: sdkToken.trim(),
          device_id: deviceId.trim(),
        },
        remember ? password : "",
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={profile ? "编辑账号" : "添加 Muse 账号"}
      subtitle="账号凭证由你掌握，连接方式随时可换。"
      onClose={onClose}
      wide
    >
      <div className="tabs">
        <button
          className={tab === "account" ? "active" : ""}
          onClick={() => setTab("account")}
        >
          <KeyRound size={15} />
          账号授权
        </button>
        <button
          className={tab === "connect" ? "active" : ""}
          onClick={() => setTab("connect")}
        >
          <Server size={15} />
          连接方式
        </button>
        <button
          className={tab === "guide" ? "active" : ""}
          onClick={() => setTab("guide")}
        >
          <Info size={15} />
          新账号接入
        </button>
      </div>
      <form onSubmit={submit}>
        <div hidden={tab !== "account"} className="panel-body">
          <div className="two-columns">
            <label>
              账号名称
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="例如：我的 Muse"
              />
            </label>
            <label>
              网页设备名称
              <input
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                maxLength={60}
                placeholder="Mori Web"
              />
            </label>
          </div>
          <button
            className="import-button"
            type="button"
            onClick={() => input.current?.click()}
          >
            <FileUp size={18} />
            <span>
              导入官方配对凭证或旧版配置
              <small>支持 JSON，内容只在浏览器中读取</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
          <input
            ref={input}
            type="file"
            hidden
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
              e.target.value = "";
            }}
          />
          <label>
            Device access token
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              placeholder="配对完成后的 access_token"
            />
          </label>
          <div className="field-help">
            聊天使用 device token。SDK token 请填在下面的高级字段。
          </div>
          <details className="advanced">
            <summary>高级凭证与刷新设置</summary>
            <label>
              Refresh token（可选）
              <input
                type="password"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="two-columns">
              <label>
                配对 device_id（可选）
                <input
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="用于手动刷新凭证"
                />
              </label>
              <label>
                SDK token（可选）
                <input
                  type="password"
                  value={sdkToken}
                  onChange={(e) => setSdkToken(e.target.value)}
                  autoComplete="off"
                  placeholder="mgst_…，用于官方配对／刷新"
                />
              </label>
            </div>
          </details>
          <div className="save-option">
            <label className="check-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <LockKeyhole size={17} />
              密码加密保存到这台设备
            </label>
            <p>默认仅当前页面内存。保存后，下次打开需要输入解锁密码。</p>
            {remember && (
              <label>
                本机解锁密码
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 10 个字符；不会发送给服务器"
                />
              </label>
            )}
          </div>
        </div>
        <div hidden={tab !== "connect"} className="panel-body">
          <div className="connection-cards">
            <button
              type="button"
              className={mode === "official" ? "choice selected" : "choice"}
              onClick={() => setMode("official")}
            >
              <Cloud size={22} />
              <strong>默认中转（推荐）</strong>
              <small>本站中转 · 无需填写中转 Token</small>
              {mode === "official" && <Check size={15} />}
            </button>
            <button
              type="button"
              className={mode === "relay" ? "choice selected" : "choice"}
              onClick={() => setMode("relay")}
            >
              <Radio size={22} />
              <strong>自定义中转（高级）</strong>
              <small>使用你信任的 Muse Relay</small>
              {mode === "relay" && <Check size={15} />}
            </button>
          </div>
          {mode === "official" ? (
            <div className="info-card">
              <ShieldCheck size={18} />
              <div>
                <strong>已配置本站中转，无需额外设置</strong>
                <p>
                  默认通过本站中转连接 Muse 官方服务。你只需填写自己的 Muse
                  device access token，无需填写中转地址或中转 Token。
                </p>
                <code>{location.origin}</code>
              </div>
            </div>
          ) : (
            <>
              <label>
                中转服务器地址
                <input
                  type="url"
                  value={server}
                  onChange={(e) => {
                    setServer(e.target.value);
                    setTrusted(false);
                  }}
                  placeholder="https://relay.example.com"
                />
              </label>
              <label>
                中转 Token
                <input
                  type="password"
                  value={relayKey}
                  onChange={(e) => setRelayKey(e.target.value)}
                  autoComplete="off"
                  placeholder="该服务器的 X-Muse-Relay-Key"
                />
              </label>
              <div className="field-help">
                服务器需支持 /fetch_vms、/web/noise 和来自本网站的
                CORS／Origin。普通 HTTP 代理不兼容。
              </div>
              {server.replace(/\/$/, "") !== location.origin && (
                <label className="check-label trust">
                  <input
                    type="checkbox"
                    checked={trusted}
                    onChange={(e) => setTrusted(e.target.checked)}
                  />
                  我信任这个服务器，并同意向它发送此账号的凭证
                </label>
              )}
            </>
          )}
          <button
            className="secondary"
            type="button"
            onClick={async () => {
              setCheck("正在检测…");
              try {
                const result = await probe(makeProfile());
                setCheck(
                  "服务可达 · " + result.ms + " ms · Relay v" + result.version,
                );
              } catch (e) {
                setCheck(e instanceof Error ? e.message : "检测失败");
              }
            }}
          >
            检测服务器
          </button>
          {check && (
            <p className="field-help" role="status">
              {check}
            </p>
          )}
        </div>
        <div hidden={tab !== "guide"} className="panel-body">
          <div className="onboarding-intro">
            <span className="guide-badge">OFFICIAL ONBOARDING</span>
            <h3>第一次使用 Muse？</h3>
            <p>
              账号授权与 SDK 授权是两件事。按官方流程配对后，再把设备凭证接入
              Mori。
            </p>
          </div>
          <ol className="guide-steps">
            <li>
              <span>01</span>
              <div>
                <strong>创建你的 SDK token</strong>
                <p>
                  登录 Muse Gadgets，在 Account → SDK tokens 中创建自己的
                  token。
                </p>
                <a
                  href="https://gadgets.muse.ai"
                  target="_blank"
                  rel="noreferrer"
                >
                  打开官方 SDK 控制台 <ArrowUpRight size={13} />
                </a>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>通过 Muse App 完成官方配对</strong>
                <p>
                  为官方 ESP32／Linux gadget 配置 SDK token，在手机 Settings →
                  Devices 开启 Developer mode，添加设备并确认。只有 SDK token
                  不能换取聊天权限。
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>导入配对后的 device 凭证</strong>
                <p>
                  从你自己的已配对设备取得 access_token；需要刷新时同时提供
                  refresh_token 和 device_id。纯网页不能冒充蓝牙外设完成这一步。
                </p>
                <a
                  href="https://github.com/facebookincubator/muse-gadget-sdk"
                  target="_blank"
                  rel="noreferrer"
                >
                  查看官方配对说明 <ArrowUpRight size={13} />
                </a>
              </div>
            </li>
          </ol>
          <div className="info-card">
            <KeyRound size={18} />
            <p>
              也可以先在高级字段保存自己的 SDK
              token，账号会显示「待官方配对」，完成后再补齐 device
              token。不会显示虚假的绑定成功。
            </p>
          </div>
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          <span>
            <LockKeyhole size={13} />
            凭证不会嵌入网页源码
          </span>
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={saving}
          >
            取消
          </button>
          <button className="primary" disabled={saving}>
            {saving ? "正在保存…" : "保存账号"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
