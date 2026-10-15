import type { Credentials, Vault } from "../types";
const encoder = new TextEncoder();
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function derive(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 210000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(
  credentials: Credentials,
  password: string,
): Promise<Vault> {
  if (password.length < 10) throw Error("本机解锁密码至少 10 个字符");
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await derive(password, salt),
    encoder.encode(JSON.stringify(credentials)),
  );
  return { salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(data)) };
}
export async function unseal(
  vault: Vault,
  password: string,
): Promise<Credentials> {
  try {
    const data = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(vault.iv) },
      await derive(password, bytes(vault.salt)),
      bytes(vault.data),
    );
    return JSON.parse(new TextDecoder().decode(data));
  } catch {
    throw Error("解锁密码不正确，或本机凭证数据已损坏");
  }
}
