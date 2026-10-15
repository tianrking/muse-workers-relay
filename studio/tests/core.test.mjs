import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeServer,
  credentialsFrom,
  newConversation,
} from "../src/lib/storage.ts";
import { seal, unseal } from "../src/lib/vault.ts";
import { MuseClient } from "../src/lib/muse-client.mjs";
test("custom endpoint accepts only HTTPS origins, never embedded credentials", () => {
  assert.equal(
    normalizeServer(" https://relay.example "),
    "https://relay.example",
  );
  for (const value of [
    "http://relay.example",
    "https://user:secret@relay.example",
    "https://relay.example/path",
    "https://relay.example?token=secret",
    "https://relay.example#token",
  ])
    assert.throws(() => normalizeServer(value));
});
test("SDK tokens cannot masquerade as device credentials", () => {
  assert.throws(
    () => credentialsFrom({ access_token: "mgst_example" }),
    /SDK token/,
  );
  assert.throws(() => credentialsFrom({}));
  assert.deepEqual(
    credentialsFrom({ access_token: " device ", unrelated: "discard" }),
    { access_token: "device" },
  );
});
test("new chats use isolated IDs and main is explicit", () => {
  const a = newConversation("account-a"),
    b = newConversation("account-a");
  assert.equal(a.kind, "thread");
  assert.ok(a.sessionId);
  assert.notEqual(a.sessionId, b.sessionId);
  assert.equal(newConversation("account-a", "main").sessionId, null);
});
test("password vault round-trips and rejects wrong passwords and tampering", async () => {
  const secrets = {
    access_token: "test-private-access",
    relay_key: "test-private-relay",
  };
  const vault = await seal(secrets, "my-test-password");
  assert.ok(!JSON.stringify(vault).includes(secrets.access_token));
  assert.deepEqual(await unseal(vault, "my-test-password"), secrets);
  await assert.rejects(unseal(vault, "wrong-password"));
  const raw = Uint8Array.from(atob(vault.data), (c) => c.charCodeAt(0));
  raw[0] ^= 1;
  await assert.rejects(
    unseal(
      { ...vault, data: btoa(String.fromCharCode(...raw)) },
      "my-test-password",
    ),
  );
});
test("independent chat sends session ID and rejects an acknowledgement for main", async () => {
  const client = new MuseClient({ base: "https://example.test" });
  client.ready = true;
  client.deviceId = "web-test";
  client.retired = new Set();
  client.subscribe = async () => {};
  let body;
  client.request = (_method, _path, bytes, _end, _headers, _callback, wait) => {
    body = JSON.parse(new TextDecoder().decode(bytes));
    wait.resolve({ message_id: "u1", session_id: "main", is_thread: false });
    return 1;
  };
  await assert.rejects(client.chat("hello", "side-chat"), /独立会话/);
  assert.equal(body.session_id, "side-chat");
  assert.equal(body.device_id, "web-test");
  client.close();
});
test("reply filtering excludes other sessions and replayed messages", () => {
  const replies = [];
  const client = new MuseClient({
    base: "https://example.test",
    onReply: (r) => replies.push(r),
  });
  client.retired = new Set(["old"]);
  client.turn = {
    ack: true,
    session: "side-chat",
    parents: new Set(["u1"]),
    replies: new Map(),
    wait: { resolve() {}, reject() {} },
  };
  for (const [sid, id] of [
    ["main", "other"],
    ["side-chat", "old"],
  ])
    client.chatEvent({
      type: "event",
      event: "delta.text_append",
      payload: { session_id: sid, message_id: id, text: "ignored" },
    });
  assert.equal(replies.length, 0);
  client.chatEvent({
    type: "event",
    event: "delta.text_append",
    payload: { session_id: "side-chat", message_id: "new", text: "独立 🌱" },
  });
  assert.equal(replies.at(-1).text, "独立 🌱");
  client.close();
});

test("stopping before the chat acknowledgement releases the pending request promptly", async () => {
  const client = new MuseClient({ base: "https://example.test" });
  client.ready = true;
  client.deviceId = "web-test";
  client.retired = new Set();
  client.subscribe = async () => {};
  client.enqueue = async () => {};
  client.request = (_m, _p, _b, _e, _h, _c, wait) => {
    client.streams.set(1, { wait });
    return 1;
  };
  const pending = client.chat("hello", "side-chat");
  await new Promise((resolve) => setImmediate(resolve));
  client.cancelTurn();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(client.streams.size, 0);
  client.close();
});
