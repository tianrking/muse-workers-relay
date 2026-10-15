import type { Credentials, Profile } from "../types";
export function endpoint(profile: Profile) {
  return profile.mode === "official" ? location.origin : profile.server;
}
export function connectionOptions(profile: Profile) {
  return {
    base: endpoint(profile),
    accountPath: profile.mode === "official" ? "/web/account" : "/fetch_vms",
    noisePath:
      profile.mode === "official" ? "/web/official-noise" : "/web/noise",
    vmId: profile.vmId,
    deviceName: profile.deviceName,
  };
}
export async function probe(profile: Profile) {
  const start = performance.now();
  const response = await fetch(endpoint(profile) + "/health", {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw Error("服务器检测失败：HTTP " + response.status);
  const data = await response.json();
  return {
    ms: Math.round(performance.now() - start),
    version: data.version,
    service: data.service,
  };
}
export async function refreshCredentials(
  profile: Profile,
  credentials: Credentials,
): Promise<Credentials> {
  if (!credentials.refresh_token || !credentials.device_id)
    throw Error("刷新需要配对时的 refresh_token 和 device_id");
  const raw = credentials.refresh_token.split(":").at(-1);
  const response = await fetch(
    endpoint(profile) +
      (profile.mode === "official" ? "/web/refresh" : "/device_token/refresh"),
    {
      method: "POST",
      headers: {
        Authorization: "Bearer hatch_refresh:" + raw,
        "Content-Type": "application/json",
        ...(profile.mode === "relay"
          ? { "X-Muse-Relay-Key": credentials.relay_key || "" }
          : {}),
      },
      body: JSON.stringify({
        device_id: credentials.device_id,
        ...(credentials.sdk_token ? { sdk_token: credentials.sdk_token } : {}),
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  if (!response.ok)
    throw Error(
      response.status === 401
        ? "刷新被官方拒绝，请重新配对"
        : "刷新失败：HTTP " + response.status,
    );
  const responseData = await response.json();
  const data = responseData.payload || responseData;
  if (
    typeof data.access_token !== "string" ||
    typeof data.refresh_token !== "string"
  )
    throw Error("官方没有返回完整的新凭证");
  return {
    ...credentials,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  };
}
