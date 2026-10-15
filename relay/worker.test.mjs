import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.template.mjs";
const key = "relay-test-key";
const invoke = (request) => worker.fetch(request, { MUSE_RELAY_KEY: key });
const nativeFetch = globalThis.fetch;
function req(path, method = "GET", extra = {}) {
  return new Request("https://relay.example" + path, {
    method,
    headers: {
      "X-Muse-Relay-Key": key,
      Authorization: "Bearer fake-test-token",
      ...extra,
    },
    body: method === "POST" ? "{}" : undefined,
  });
}
test("health contains no credentials", async () => {
  const r = await invoke(new Request("https://relay.example/health"));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {
    service: "muse-personal-relay",
    version: 4,
    build: "2026-10-15",
  });
});
test("requires device key before outbound request", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
  };
  try {
    assert.equal(
      (await invoke(new Request("https://relay.example/fetch_vms"))).status,
      401,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});
test("rejects arbitrary proxy destinations and bad methods", async () => {
  for (const p of [
    "/https://evil.example",
    "/v1/noise?vm_id=good&host=evil",
    "/fetch_vms?url=evil",
  ])
    assert.notEqual((await invoke(req(p))).status, 200);
  assert.equal((await invoke(req("/fetch_vms", "POST"))).status, 405);
});
test("preserves auth errors and streams response without retaining data", async () => {
  for (const code of [401, 403, 429, 500]) {
    globalThis.fetch = async (r) => {
      assert.equal(r.url, "https://api.muse.ai/fetch_vms");
      assert.equal(r.headers.get("X-Muse-Relay-Key"), null);
      assert.equal(r.headers.get("Authorization"), "Bearer fake-test-token");
      assert.equal(r.redirect, "manual");
      return new Response("upstream error", {
        status: code,
        headers: { "Set-Cookie": "secret=1" },
      });
    };
    try {
      const r = await invoke(req("/fetch_vms"));
      assert.equal(r.status, code);
      assert.equal(r.headers.get("Set-Cookie"), null);
      assert.equal(await r.text(), "upstream error");
    } finally {
      globalThis.fetch = nativeFetch;
    }
  }
});
test("forwards token requests only to fixed API", async () => {
  globalThis.fetch = async (r) => {
    assert.equal(r.url, "https://api.muse.ai/device_token/refresh");
    assert.equal(await r.text(), "{}");
    return new Response("{}");
  };
  try {
    assert.equal(
      (await invoke(req("/device_token/refresh", "POST"))).status,
      200,
    );
  } finally {
    globalThis.fetch = nativeFetch;
  }
});
test("passes WebSocket upgrade through without opening or changing Noise payloads", async () => {
  const upgraded = { status: 101 };
  globalThis.fetch = async (r) => {
    assert.equal(r.url, "https://hatch.metaaivm.com/v1/noise?vm_id=test-vm");
    assert.equal(r.headers.get("Upgrade"), "websocket");
    return upgraded;
  };
  try {
    assert.equal(
      await invoke(
        req("/v1/noise?vm_id=test-vm", "GET", { Upgrade: "websocket" }),
      ),
      upgraded,
    );
  } finally {
    globalThis.fetch = nativeFetch;
  }
});
test("handles upstream network failure", async () => {
  globalThis.fetch = async () => {
    throw Error("private debug detail");
  };
  try {
    const r = await invoke(req("/fetch_vms"));
    assert.equal(r.status, 502);
    assert.equal(await r.text(), "Upstream unavailable");
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test("fails closed without configured secret", async () => {
  assert.equal(
    (await worker.fetch(new Request("https://relay.example/health"), {}))
      .status,
    503,
  );
});
test("preserves API JSON bytes and version header", async () => {
  const body = '{"vms":[{"vm_id":"test-vm","vm_name":"测试"}]}';
  globalThis.fetch = async (r) => {
    assert.equal(r.headers.get("X-API-Version"), "1.0.0");
    return new Response(body, {
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const r = await invoke(
      req("/fetch_vms", "GET", { "X-API-Version": "1.0.0" }),
    );
    assert.equal(await r.text(), body);
    assert.equal(r.headers.get("Content-Type"), "application/json");
  } finally {
    globalThis.fetch = nativeFetch;
  }
});
test("forwards refresh authorization and body unchanged", async () => {
  globalThis.fetch = async (r) => {
    assert.equal(r.headers.get("Authorization"), "Bearer hatch_refresh:fake");
    assert.equal(await r.text(), "{}");
    return new Response("{}");
  };
  try {
    assert.equal(
      (
        await invoke(
          req("/device_token/refresh", "POST", {
            Authorization: "Bearer hatch_refresh:fake",
          }),
        )
      ).status,
      200,
    );
  } finally {
    globalThis.fetch = nativeFetch;
  }
});
test("rejects ambiguous WebSocket routing", async () => {
  for (const p of [
    "/v1/noise",
    "/v1/noise?vm_id=a&vm_id=b",
    "/v1/noise?vm_id=a&target=b",
  ])
    assert.equal(
      (await invoke(req(p, "GET", { Upgrade: "websocket" }))).status,
      400,
    );
});

test("browser entry requires same origin and an explicit auth protocol", async () => {
  const url = "https://relay.example/web/noise?vm_id=example";
  assert.equal(
    (await invoke(new Request(url, { headers: { Upgrade: "websocket" } })))
      .status,
    403,
  );
  assert.equal(
    (
      await invoke(
        new Request(url, {
          headers: { Origin: "https://evil.example", Upgrade: "websocket" },
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await invoke(
        new Request(url, {
          headers: { Origin: "https://relay.example", Upgrade: "websocket" },
        }),
      )
    ).status,
    401,
  );
  for (const value of ["null", "{}", "broken"])
    assert.equal(
      (
        await invoke(
          new Request(url, {
            headers: {
              Origin: "https://relay.example",
              Upgrade: "websocket",
              "Sec-WebSocket-Protocol": "muse-v1, muse-auth." + btoa(value),
            },
          }),
        )
      ).status,
      401,
    );
});
test("browser credentials become upstream headers without exposing protocol auth", async () => {
  const native = globalThis.fetch;
  let called = false;
  globalThis.fetch = async (request) => {
    called = true;
    assert.equal(request.url, "https://hatch.metaaivm.com/v1/noise?vm_id=test");
    assert.equal(request.headers.get("Authorization"), "Bearer browser-test");
    assert.equal(request.headers.get("Sec-WebSocket-Protocol"), null);
    assert.equal(request.headers.get("X-Muse-Relay-Key"), null);
    return new Response("denied", { status: 401 });
  };
  try {
    const auth = btoa(JSON.stringify({ key, token: "browser-test" }));
    const r = await invoke(
      new Request("https://relay.example/web/noise?vm_id=test", {
        headers: {
          Origin: "https://relay.example",
          Upgrade: "websocket",
          "Sec-WebSocket-Protocol": "muse-v1, muse-auth." + auth,
        },
      }),
    );
    assert.equal(r.status, 401);
    assert.equal(await r.text(), "denied");
    assert.ok(called);
  } finally {
    globalThis.fetch = native;
  }
});

test("official browser account uses the caller bearer without a shared relay key", async () => {
  const native = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, "https://api.muse.ai/fetch_vms");
    assert.equal(request.headers.get("Authorization"), "Bearer caller-device");
    return Response.json({ vm_list: [] });
  };
  try {
    const r = await invoke(
      new Request("https://relay.example/web/account", {
        headers: {
          Origin: "https://relay.example",
          Authorization: "Bearer caller-device",
        },
      }),
    );
    assert.equal(r.status, 200);
    assert.equal((await r.json()).vm_list.length, 0);
    assert.equal(
      r.headers.get("Access-Control-Allow-Origin"),
      "https://relay.example",
    );
  } finally {
    globalThis.fetch = native;
  }
});
test("official browser account rejects missing authorization and cross-site callers", async () => {
  assert.equal(
    (
      await invoke(
        new Request("https://relay.example/web/account", {
          headers: { Origin: "https://relay.example" },
        }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await invoke(
        new Request("https://relay.example/web/account", {
          headers: {
            Origin: "https://evil.example",
            Authorization: "Bearer anything",
          },
        }),
      )
    ).status,
    403,
  );
});
test("custom browser origin preflight requires an explicit allowlist", async () => {
  const request = new Request("https://relay.example/fetch_vms", {
    method: "OPTIONS",
    headers: { Origin: "https://studio.example" },
  });
  assert.equal((await invoke(request)).status, 403);
  const r = await worker.fetch(request, {
    MUSE_RELAY_KEY: key,
    BROWSER_ORIGINS: '["https://studio.example"]',
  });
  assert.equal(r.status, 204);
  assert.equal(
    r.headers.get("Access-Control-Allow-Origin"),
    "https://studio.example",
  );
  assert.ok(
    r.headers.get("Access-Control-Allow-Headers").includes("X-Muse-Relay-Key"),
  );
});
