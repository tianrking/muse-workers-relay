import { useRef, useState, useCallback } from "react";
import { MuseClient } from "../lib/muse-client.mjs";
import { connectionOptions } from "../lib/account-api";
import type {
  Credentials,
  Profile,
  Conversation,
  Phase,
  VM,
  Diagnostic,
} from "../types";
export function useMuse() {
  const client = useRef<InstanceType<typeof MuseClient> | null>(null);
  const generation = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [phase, setPhase] = useState<Phase>("offline"),
    [label, setLabel] = useState("尚未连接"),
    [accountId, setAccountId] = useState<string | null>(null),
    [vms, setVms] = useState<VM[]>([]),
    [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const disconnect = useCallback(() => {
    generation.current++;
    clearTimeout(retryTimer.current);
    retryTimer.current = undefined;
    client.current?.close();
    client.current = null;
    setPhase("offline");
    setLabel("尚未连接");
    setAccountId(null);
    setVms([]);
  }, []);
  const connect = useCallback(async function connectProfile(
    profile: Profile,
    credentials: Credentials,
    attempt = 0,
  ): Promise<void> {
    clearTimeout(retryTimer.current);
    retryTimer.current = undefined;
    const ticket = ++generation.current;
    client.current?.close();
    setPhase("connecting");
    setAccountId(profile.id);
    if (attempt === 0) setDiagnostics([]);
    else
      setDiagnostics((rows) => [
        ...rows.slice(-29),
        { stage: "reconnect", status: attempt },
      ]);
    const scheduleRetry = () => {
      if (
        ticket !== generation.current ||
        retryTimer.current ||
        attempt >= 3 ||
        !navigator.onLine
      )
        return;
      setPhase("connecting");
      setLabel(`连接断开，正在准备第 ${attempt + 1} 次重连…`);
      retryTimer.current = setTimeout(
        () => {
          retryTimer.current = undefined;
          void connectProfile(profile, credentials, attempt + 1).catch(
            () => {},
          );
        },
        Math.min(2000 * 2 ** attempt, 8000),
      );
    };
    const instance = new MuseClient({
      base: connectionOptions(profile).base,
      onState: (text: string) => {
        if (ticket !== generation.current) return;
        setLabel(text);
        if (/异常|失败|断开|拒绝|结束/.test(text)) setPhase("error");
        if (text === "连接已断开") scheduleRetry();
      },
      onDiagnostics: (event: Diagnostic) => {
        if (ticket === generation.current)
          setDiagnostics((rows) => [...rows.slice(-29), event]);
      },
    });
    client.current = instance;
    try {
      await instance.connect(credentials, connectionOptions(profile));
      if (ticket !== generation.current) {
        instance.close();
        return;
      }
      setVms(instance.vms || []);
      setPhase("ready");
      setLabel("已连接");
    } catch (error) {
      if (ticket === generation.current) {
        instance.close();
        setPhase("error");
        setLabel(error instanceof Error ? error.message : "连接失败");
        if (
          attempt > 0 &&
          !/授权|token|拒绝|配对/.test(
            error instanceof Error ? error.message : "",
          )
        )
          scheduleRetry();
      }
      throw error;
    }
  }, []);
  const send = useCallback(
    async (
      text: string,
      conversation: Conversation,
      onReply: (reply: { id: string; text: string; done: boolean }) => void,
    ) => {
      const instance = client.current;
      if (!instance?.ready) throw Error("请先连接账号");
      setPhase("sending");
      instance.onReply = onReply;
      try {
        const result = await instance.chat(
          text,
          conversation.kind === "thread" ? conversation.sessionId : null,
        );
        return result;
      } finally {
        if (client.current === instance) {
          setPhase(
            instance.ready
              ? "ready"
              : retryTimer.current
                ? "connecting"
                : "offline",
          );
          if (!retryTimer.current)
            setLabel(instance.ready ? "已连接" : "连接已断开");
          instance.onReply = () => {};
        }
      }
    },
    [],
  );
  const cancel = useCallback(() => client.current?.cancelTurn(), []);
  return {
    phase,
    label,
    accountId,
    vms,
    diagnostics,
    connect,
    disconnect,
    send,
    cancel,
  };
}
