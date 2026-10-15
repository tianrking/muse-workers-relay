import { useLanguage } from "../i18n/useLanguage";
import { t } from "../i18n/runtime";
import { ArrowUpRight, Cpu, Laptop, Download } from "lucide-react";
import type { CredentialSource } from "../types";
export function SourcePicker({
  value,
  onChange,
}: {
  value: CredentialSource;
  onChange: (value: CredentialSource) => void;
}) {
  useLanguage();
  return (
    <div className="connection-cards" aria-label={t("凭证获取方式")}>
      <button
        type="button"
        aria-pressed={value === "esp32"}
        className={value === "esp32" ? "choice selected" : "choice"}
        onClick={() => onChange("esp32")}
      >
        <Cpu size={22} />
        <strong>{t("ESP32 路线")}</strong>
        <small>{t("已有开发板 · 保留原有流程")}</small>
      </button>
      <button
        type="button"
        aria-pressed={value === "linux"}
        className={value === "linux" ? "choice selected" : "choice"}
        onClick={() => onChange("linux")}
      >
        <Laptop size={22} />
        <strong>{t("Linux 路线")}</strong>
        <small>{t("无需开发板 · 电脑蓝牙配对")}</small>
      </button>
    </div>
  );
}
export function OnboardingGuide({
  source,
  onChange,
}: {
  source: CredentialSource;
  onChange: (value: CredentialSource) => void;
}) {
  useLanguage();
  const linux = source === "linux";
  return (
    <>
      <div className="onboarding-intro">
        <span className="guide-badge">MUSE GADGET · DEVICE CREDENTIALS</span>
        <h3>{t("先授权一次，再用网页聊天")}</h3>
        <p>
          {t(
            "当前使用官方 Gadget 设备协议。短 SDK token 用于配对；聊天需要配对后的长 device access token。",
          )}
        </p>
      </div>
      <SourcePicker value={source} onChange={onChange} />
      <ol className="guide-steps">
        <li>
          <span>01</span>
          <div>
            <strong>{t("创建自己的 SDK token")}</strong>
            <p>
              {t("在 Muse Gadgets → Account → SDK tokens 创建 mgst_…，配置到")}
              {linux ? "Linux SDK" : t("ESP32 固件")}
              {t("。它不能直接当作聊天 Token。")}
            </p>
            <a href="https://gadgets.muse.ai" target="_blank" rel="noreferrer">
              {t("打开官方控制台")}
              <ArrowUpRight size={13} />
            </a>
          </div>
        </li>
        <li>
          <span>02</span>
          <div>
            <strong>
              {linux
                ? t("让 Linux 电脑成为配对设备")
                : t("启动 ESP32 并连接 Wi-Fi")}
            </strong>
            <p>
              {linux
                ? t(
                    "使用官方 Linux SDK。电脑需已联网，并有支持 BLE 外设广播的蓝牙适配器及 BlueZ。配对命令会开放 10 分钟发现窗口。Windows 浏览器和远程 VPS 不能直接替代这一步。",
                  )
                : t(
                    "设备启动后广播 MuseGadget…，手机靠近设备。我们当前的圆屏方案就是这条路线。",
                  )}
            </p>
            {linux ? (
              <>
                <pre className="setup-command">
                  <code>sudo musegadget pair</code>
                </pre>
                <a
                  href="https://github.com/facebookincubator/muse-gadget-sdk/blob/main/linux/README.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("先按官方说明安装 Linux SDK")}
                  <ArrowUpRight size={13} />
                </a>
              </>
            ) : (
              <a
                href="https://github.com/facebookincubator/muse-gadget-sdk/blob/main/esp32/README.md"
                target="_blank"
                rel="noreferrer"
              >
                {t("查看官方 ESP32 说明")}
                <ArrowUpRight size={13} />
              </a>
            )}
          </div>
        </li>
        <li>
          <span>03</span>
          <div>
            <strong>{t("在手机 Muse App 完成账号授权")}</strong>
            <p>
              {t("Settings → Devices → Developer mode → 添加 MuseGadget…。")}
              {linux
                ? t(
                    "Linux 使用 App 内确认，无需按实体按钮；电脑已联网，按官方流程选择显示的网络即可。",
                  )
                : t(
                    "按提示在圆屏点击确认或按设备确认键，并完成 Wi-Fi 设置。",
                  )}{" "}
              {t(
                "两条路线首次都需要手机 App，只有短 Token 不能自行换取长 Token。",
              )}
            </p>
          </div>
        </li>
        <li>
          <span>04</span>
          <div>
            <strong>
              {linux
                ? t("导出并导入 Linux 配对凭证")
                : t("导入 ESP32 配对后的设备凭证")}
            </strong>
            <p>
              {linux
                ? t(
                    "官方把凭证保存到 /var/lib/musegadget/pairing.json。可直接导入该文件；为了同时带上刷新所需的 device_id，推荐用下面的离线导出工具。工具只读本机配置，不联网、不输出 Token、不安装服务。",
                  )
                : t(
                    "从你自己的已配对设备取得 access_token，保存为 JSON 后，在「账号授权」导入。现有 pc-relay-credentials.json 可继续使用，无需重新配对。",
                  )}
            </p>
            {linux && (
              <>
                <a href="/assets/mori-linux-export.py" download>
                  <Download size={13} />
                  {t("下载 Linux 离线导出工具")}
                </a>
                <pre className="setup-command">
                  <code>
                    {
                      "sudo python3 mori-linux-export.py --output ./mori-device.json"
                    }
                  </code>
                </pre>
                <p>
                  {t(
                    "把 mori-device.json 安全传到打开网页的电脑，再导入。若继续让 Linux 服务使用同一凭证，请避免两端同时刷新；可先执行 sudo systemctl stop musegadget。仅导出文件不会自动关闭服务。",
                  )}
                </p>
              </>
            )}
          </div>
        </li>
      </ol>
      <div className="info-card">
        <Laptop size={18} />
        <div>
          <strong>{t("获取方式不同，聊天和中转相同")}</strong>
          <p>
            {t(
              "两种凭证均可通过本站默认中转聊天，无需中转 Token。Linux 路线尚未在本机实测配对。这里切换的是获取说明，不会自动安装 SDK 或进行蓝牙配对。",
            )}
          </p>
        </div>
      </div>
    </>
  );
}
