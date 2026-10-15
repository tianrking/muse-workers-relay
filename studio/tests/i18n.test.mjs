import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { english } from "../src/i18n/en.ts";
import {
  getLanguage,
  preferredLanguage,
  setLanguage,
  subscribeLanguage,
  t,
} from "../src/i18n/runtime.ts";
import { newConversation } from "../src/lib/storage.ts";

test("language negotiation respects saved preference and Chinese browser locales", () => {
  assert.equal(preferredLanguage("en", "zh-CN"), "en");
  assert.equal(preferredLanguage("zh-CN", "en-US"), "zh-CN");
  assert.equal(preferredLanguage("invalid", "zh-TW"), "zh-CN");
  assert.equal(preferredLanguage(null, "es-ES"), "en");
});

test("switching language notifies subscribers and survives unavailable storage", () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const original = getLanguage();
  let notifications = 0;
  const unsubscribe = subscribeLanguage(() => notifications++);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw Error("Storage blocked");
    },
  });
  try {
    setLanguage("zh-CN");
    assert.equal(t("连接与诊断"), "连接与诊断");
    setLanguage("en");
    assert.equal(t("连接与诊断"), "Connection diagnostics");
    assert.equal(notifications, 2);
    unsubscribe();
    setLanguage("zh-CN");
    assert.equal(notifications, 2);
  } finally {
    unsubscribe();
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
    setLanguage(original);
  }
});

test("English defaults and dynamic errors preserve protocol numbers and identifiers", () => {
  const original = getLanguage();
  try {
    setLanguage("en");
    assert.equal(newConversation("profile").title, "New conversation");
    assert.equal(
      t("连接断开，正在准备第 3 次重连…"),
      "Connection lost. Preparing reconnect 3…",
    );
    assert.equal(t("刷新失败：HTTP 403"), "Refresh failed: HTTP 403");
    assert.equal(t("vm_id_example"), "vm_id_example");
    assert.equal(t("Upstream unavailable"), "Upstream unavailable");
    setLanguage("zh-CN");
    assert.equal(newConversation("profile").title, "新的对话");
  } finally {
    setLanguage(original);
  }
});

test("all application translation calls have English dictionary entries", async () => {
  const source = new URL("../src/", import.meta.url);
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = new URL(
        entry.name + (entry.isDirectory() ? "/" : ""),
        directory,
      );
      if (entry.isDirectory()) {
        await scan(file);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const text = await readFile(file, "utf8");
      for (const match of text.matchAll(/\bt\(("(?:[^"\\]|\\.)*")\)/g)) {
        const key = JSON.parse(match[1]);
        assert.ok(Object.hasOwn(english, key), `Missing translation: ${key}`);
        assert.ok(english[key].trim().length > 0);
      }
    }
  }
  await scan(source);
});
