import { useLanguage } from "../i18n/useLanguage";
import { t } from "../i18n/runtime";
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
import { OnboardingGuide, SourcePicker } from "./OnboardingGuide";
import { Modal } from "./Modal";
import { credentialsFrom, newId, normalizeServer } from "../lib/storage";
import { probe } from "../lib/account-api";
import type { Profile, Credentials, CredentialSource } from "../types";
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
  useLanguage();
  const [tab, setTab] = useState<"account" | "connect" | "guide">("account"),
    [source, setSource] = useState<CredentialSource>(
      profile?.credentialSource || "esp32",
    ),
    [importNote, setImportNote] = useState(""),
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
    credentialSource: source,
    server: mode === "relay" ? normalizeServer(server) : location.origin,
    vmId: profile?.vmId,
    createdAt: profile?.createdAt || Date.now(),
  });
  async function importFile(file: File) {
    try {
      if (file.size > 65536) throw Error(t("配置文件不能超过 64 KB"));
      const raw = JSON.parse(await file.text());
      if (raw && !raw.access_token && typeof raw.device_id === "string") {
        if (!token.trim())
          throw Error(t("请先导入 pairing.json，再补充 identity.json"));
        if (!raw.device_id.trim() || raw.device_id.length > 16000)
          throw Error(t("device_id 无效"));
        setDeviceId(raw.device_id.trim());
        setImportNote(
          t(
            "已补齐 device_id，可用于手动刷新。请确认两个文件来自同一台 Linux 设备。",
          ),
        );
        setError("");
        return;
      }
      const data = credentialsFrom(raw);
      setToken(data.access_token);
      setRelayKey(data.relay_key || "");
      setRefreshToken(data.refresh_token || "");
      setDeviceId(data.device_id || "");
      setSdkToken(data.sdk_token || "");
      if (!name && typeof raw.username === "string") setName(raw.username);
      setImportNote(
        data.refresh_token && !data.device_id
          ? t(
              "已导入聊天凭证。刷新还需要 device_id；Linux 可继续导入同设备的 identity.json，或使用完整导出工具。",
            )
          : t(
              "已导入设备凭证，保存后连接即可。文件中的服务器地址不会覆盖你的线路选择。",
            ),
      );
      if (raw.credential_source === "linux" || file.name === "pairing.json")
        setSource("linux");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("导入失败"));
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (!name.trim()) throw Error(t("给这个账号起个名字"));
      const p = makeProfile();
      if (p.mode === "relay" && p.server !== location.origin && !trusted)
        throw Error(t("请确认你信任此自定义服务器"));
      if (sdkToken && !sdkToken.startsWith("mgst_"))
        throw Error(t("SDK token 应以 mgst_ 开头"));
      if (token.startsWith("mgst_"))
        throw Error(
          t("SDK token 不能用于聊天。请在「新账号接入」查看官方配对步骤"),
        );
      if (!token.trim() && !sdkToken.trim())
        throw Error(t("请导入设备凭证，或保存 SDK token 作为待配对账号"));
      if (p.mode === "relay" && !relayKey.trim())
        throw Error(t("自定义中转需要中转 Token"));
      if (remember && password.length < 10)
        throw Error(t("本机解锁密码至少 10 个字符"));
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
      setError(e instanceof Error ? e.message : t("保存失败"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={profile ? t("编辑账号") : t("添加 Muse 账号")}
      subtitle={t("账号凭证由你掌握，连接方式随时可换。")}
      onClose={onClose}
      wide
    >
      <div className="tabs">
        <button
          className={tab === "account" ? "active" : ""}
          onClick={() => setTab("account")}
        >
          <KeyRound size={15} />
          {t("账号授权")}
        </button>
        <button
          className={tab === "connect" ? "active" : ""}
          onClick={() => setTab("connect")}
        >
          <Server size={15} />
          {t("连接方式")}
        </button>
        <button
          className={tab === "guide" ? "active" : ""}
          onClick={() => setTab("guide")}
        >
          <Info size={15} />
          {t("新账号接入")}
        </button>
      </div>
      <form onSubmit={submit}>
        <div hidden={tab !== "account"} className="panel-body">
          <SourcePicker value={source} onChange={setSource} />
          <div className="info-card">
            <Info size={18} />
            <div>
              <strong>
                {source === "esp32"
                  ? t("ESP32 配对后获取长 Token")
                  : t("Linux 电脑配对后获取长 Token")}
              </strong>
              <p>
                {source === "esp32"
                  ? t(
                      "固件配置短 SDK token → 手机 Muse App 添加设备 → 圆屏确认 → 导入配对后的 access_token。",
                    )
                  : t(
                      "Linux SDK + 电脑蓝牙 → 手机 Muse App 确认 → 导入 pairing.json 或完整导出配置，无需 ESP32。",
                    )}
              </p>
              <button
                type="button"
                className="secondary"
                onClick={() => setTab("guide")}
              >
                {t("查看获取步骤")}
              </button>
            </div>
          </div>
          <div className="two-columns">
            <label>
              {t("账号名称")}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder={t("例如：我的 Muse")}
              />
            </label>
            <label>
              {t("网页设备名称")}
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
              {t("导入配对凭证（ESP32 / Linux）")}
              <small>
                {t("支持 JSON、Linux pairing.json 与补充 identity.json")}
              </small>
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
          {importNote && (
            <p className="field-help" role="status">
              {importNote}
            </p>
          )}
          <label>
            Device access token
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              placeholder={t("配对完成后的 access_token")}
            />
          </label>
          <div className="field-help">
            {t("聊天使用 device token。SDK token 请填在下面的高级字段。")}
          </div>
          <details className="advanced">
            <summary>{t("高级凭证与刷新设置")}</summary>
            <label>
              {t("Refresh token（可选）")}
              <input
                type="password"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="two-columns">
              <label>
                {t("配对 device_id（可选）")}
                <input
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder={t("用于手动刷新凭证")}
                />
              </label>
              <label>
                {t("SDK token（可选）")}
                <input
                  type="password"
                  value={sdkToken}
                  onChange={(e) => setSdkToken(e.target.value)}
                  autoComplete="off"
                  placeholder={t("mgst_…，用于官方配对／刷新")}
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
              {t("密码加密保存到这台设备")}
            </label>
            <p>{t("默认仅当前页面内存。保存后，下次打开需要输入解锁密码。")}</p>
            {remember && (
              <label>
                {t("本机解锁密码")}
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("至少 10 个字符；不会发送给服务器")}
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
              <strong>{t("默认中转（推荐）")}</strong>
              <small>{t("本站中转 · 无需填写中转 Token")}</small>
              {mode === "official" && <Check size={15} />}
            </button>
            <button
              type="button"
              className={mode === "relay" ? "choice selected" : "choice"}
              onClick={() => setMode("relay")}
            >
              <Radio size={22} />
              <strong>{t("自定义中转（高级）")}</strong>
              <small>{t("使用你信任的 Muse Relay")}</small>
              {mode === "relay" && <Check size={15} />}
            </button>
          </div>
          {mode === "official" ? (
            <div className="info-card">
              <ShieldCheck size={18} />
              <div>
                <strong>{t("已配置本站中转，无需额外设置")}</strong>
                <p>
                  {t(
                    "默认通过本站中转连接 Muse 官方服务。你只需填写自己的 Muse device access token，无需填写中转地址或中转 Token。",
                  )}
                </p>
                <code>{location.origin}</code>
              </div>
            </div>
          ) : (
            <>
              <label>
                {t("中转服务器地址")}
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
                {t("中转 Token")}
                <input
                  type="password"
                  value={relayKey}
                  onChange={(e) => setRelayKey(e.target.value)}
                  autoComplete="off"
                  placeholder={t("该服务器的 X-Muse-Relay-Key")}
                />
              </label>
              <div className="field-help">
                {t(
                  "服务器需支持 /fetch_vms、/web/noise 和来自本网站的 CORS／Origin。普通 HTTP 代理不兼容。",
                )}
              </div>
              {server.replace(/\/$/, "") !== location.origin && (
                <label className="check-label trust">
                  <input
                    type="checkbox"
                    checked={trusted}
                    onChange={(e) => setTrusted(e.target.checked)}
                  />
                  {t("我信任这个服务器，并同意向它发送此账号的凭证")}
                </label>
              )}
            </>
          )}
          <button
            className="secondary"
            type="button"
            onClick={async () => {
              setCheck(t("正在检测…"));
              try {
                const result = await probe(makeProfile());
                setCheck(
                  t("服务可达 · ") +
                    result.ms +
                    " ms · Relay v" +
                    result.version,
                );
              } catch (e) {
                setCheck(e instanceof Error ? e.message : t("检测失败"));
              }
            }}
          >
            {t("检测服务器")}
          </button>
          {check && (
            <p className="field-help" role="status">
              {t(check)}
            </p>
          )}
        </div>
        <div hidden={tab !== "guide"} className="panel-body">
          <OnboardingGuide source={source} onChange={setSource} />
        </div>
        {error && (
          <div className="form-error" role="alert">
            {t(error)}
          </div>
        )}
        <div className="modal-footer">
          <span>
            <LockKeyhole size={13} />
            {t("凭证不会嵌入网页源码")}
          </span>
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={saving}
          >
            {t("取消")}
          </button>
          <button className="primary" disabled={saving}>
            {saving ? t("正在保存…") : t("保存账号")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
