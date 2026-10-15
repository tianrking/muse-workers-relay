// Fixed-destination Muse relay and browser adapter. Never log credentials or payloads.
const API_PATHS = new Map([
  ["/fetch_vms", "GET"],
  ["/device_token/mint", "POST"],
  ["/device_token/refresh", "POST"],
]);
const WEB_APIS = new Map([
  ["/web/account", ["/fetch_vms", "GET"]],
  ["/web/refresh", ["/device_token/refresh", "POST"]],
]);
function originAllowed(request, url, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  if (origin === url.origin) return true;
  try {
    const allowed = JSON.parse(env.BROWSER_ORIGINS || "[]");
    return Array.isArray(allowed) && allowed.includes(origin);
  } catch {
    return false;
  }
}
function cors(request, response, allowed) {
  if (!allowed || response.status === 101) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", request.headers.get("Origin"));
  headers.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}
export default {
  async fetch(request, env) {
    const RELAY_KEY = env?.MUSE_RELAY_KEY;
    if (!RELAY_KEY)
      return new Response("Relay secret not configured", { status: 503 });
    const url = new URL(request.url),
      allowed = originAllowed(request, url, env);
    const respond = (body, status) =>
      cors(request, new Response(body, { status }), allowed);
    if (request.method === "OPTIONS") {
      if (!allowed) return respond("Origin not allowed", 403);
      if (
        !API_PATHS.has(url.pathname) &&
        !WEB_APIS.has(url.pathname) &&
        url.pathname !== "/health"
      )
        return respond("Not found", 404);
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": request.headers.get("Origin"),
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers":
            "Authorization, Content-Type, X-API-Version, X-Muse-Relay-Key",
          "Access-Control-Max-Age": "600",
          Vary: "Origin",
        },
      });
    }
    if (url.pathname === "/health" && request.method === "GET")
      return cors(
        request,
        Response.json(
          { service: "muse-personal-relay", version: 4, build: "2026-10-15" },
          { headers: { "Cache-Control": "no-store" } },
        ),
        allowed,
      );
    if (
      ["GET", "HEAD"].includes(request.method) &&
      env.ASSETS &&
      (url.pathname === "/" ||
        url.pathname.startsWith("/assets/") ||
        ["/app.css", "/app.mjs", "/muse-client.mjs", "/favicon.svg"].includes(
          url.pathname,
        ))
    ) {
      const asset = await env.ASSETS.fetch(request),
        headers = new Headers(asset.headers);
      headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https: wss:; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      );
      headers.set("Referrer-Policy", "no-referrer");
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(asset.body, { status: asset.status, headers });
    }
    const browser =
      url.pathname === "/web/noise" || url.pathname === "/web/official-noise";
    const official =
      url.pathname === "/web/official-noise" || WEB_APIS.has(url.pathname);
    let browserAuth;
    if (browser) {
      if (!allowed) return respond("Origin not allowed", 403);
      const protocols = (request.headers.get("Sec-WebSocket-Protocol") || "")
        .split(",")
        .map((s) => s.trim());
      const auth = protocols.filter((s) => s.startsWith("muse-auth."));
      if (
        !protocols.includes("muse-v1") ||
        auth.length !== 1 ||
        auth[0].length > 16000
      )
        return respond("Browser authorization required", 401);
      try {
        browserAuth = JSON.parse(
          atob(auth[0].slice(10).replace(/-/g, "+").replace(/_/g, "/")),
        );
      } catch {
        return respond("Invalid authorization", 401);
      }
      if (
        !browserAuth ||
        typeof browserAuth !== "object" ||
        typeof browserAuth.token !== "string" ||
        !browserAuth.token ||
        browserAuth.token.length > 12000 ||
        /[\r\n]/.test(browserAuth.token)
      )
        return respond("Invalid authorization", 401);
    }
    // Official browser routes require the caller's Muse bearer, never this owner's device credentials.
    if (
      official &&
      !browser &&
      !allowed &&
      request.headers.get("Sec-Fetch-Site") !== "same-origin"
    )
      return respond("Origin not allowed", 403);
    if (
      !official &&
      (browser ? browserAuth.key : request.headers.get("X-Muse-Relay-Key")) !==
        RELAY_KEY
    )
      return respond("Unauthorized", 401);
    let target;
    if (url.pathname === "/v1/noise" || browser) {
      if (
        request.method !== "GET" ||
        request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
      )
        return respond("WebSocket required", 426);
      const ids = url.searchParams.getAll("vm_id");
      if (
        ids.length !== 1 ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(ids[0]) ||
        [...url.searchParams.keys()].some((k) => k !== "vm_id")
      )
        return respond("Invalid VM id", 400);
      target = new URL("https://hatch.metaaivm.com/v1/noise");
      target.search = url.search;
    } else if (WEB_APIS.has(url.pathname) && !url.search) {
      const [path, method] = WEB_APIS.get(url.pathname);
      if (request.method !== method) return respond("Method not allowed", 405);
      target = new URL(path, "https://api.muse.ai");
    } else if (API_PATHS.has(url.pathname) && !url.search) {
      if (request.method !== API_PATHS.get(url.pathname))
        return respond("Method not allowed", 405);
      target = new URL(url.pathname, "https://api.muse.ai");
    } else return respond("Not found", 404);
    const authorization = browser
      ? "Bearer " + browserAuth.token
      : request.headers.get("Authorization");
    if (
      !authorization?.startsWith("Bearer ") ||
      authorization.length < 8 ||
      authorization.length > 16000
    )
      return respond("Muse authorization required", 401);
    const headers = new Headers();
    for (const name of [
      "Content-Type",
      "X-API-Version",
      "Upgrade",
      "Connection",
      "Sec-WebSocket-Key",
      "Sec-WebSocket-Version",
      "Sec-WebSocket-Protocol",
    ]) {
      if (browser && name === "Sec-WebSocket-Protocol") continue;
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    headers.set("Authorization", authorization);
    try {
      const upstream = await fetch(
        new Request(target, {
          method: request.method,
          headers,
          body: request.method === "POST" ? request.body : undefined,
          redirect: "manual",
          duplex: "half",
        }),
      );
      if (upstream.status === 101)
        return browser
          ? new Response(null, {
              status: 101,
              webSocket: upstream.webSocket,
              headers: { "Sec-WebSocket-Protocol": "muse-v1" },
            })
          : upstream;
      const out = new Headers(upstream.headers);
      out.set("Cache-Control", "no-store");
      out.delete("Set-Cookie");
      return cors(
        request,
        new Response(upstream.body, { status: upstream.status, headers: out }),
        allowed,
      );
    } catch {
      return respond("Upstream unavailable", 502);
    }
  },
};
