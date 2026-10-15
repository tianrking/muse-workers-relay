// Browser port of Meta Muse gadget protocol (Apache-2.0), upstream 8e613f77.
// Noise XX, AES-GCM and X25519 use the browser's native Web Crypto implementation.
const enc = new TextEncoder(),
  dec = new TextDecoder();
const bytes = (value) =>
  typeof value === "string" ? enc.encode(value) : new Uint8Array(value);
const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const vi = (value) => {
  let n = BigInt(value),
    out = [];
  do {
    let b = Number(n & 127n);
    n >>= 7n;
    out.push(b | (n ? 128 : 0));
  } while (n);
  return Uint8Array.from(out);
};
const num = (field, value) => cat(vi(field * 8), vi(value));
const blob = (field, value) => {
  const b = bytes(value);
  return cat(vi(field * 8 + 2), vi(b.length), b);
};
function fields(data) {
  const out = new Map();
  let p = 0;
  const read = () => {
    let n = 0n;
    for (let i = 0; i < 10; i++) {
      if (p >= data.length) throw Error("协议数据不完整");
      const b = data[p++];
      if (i === 9 && b > 1) throw Error("协议整数无效");
      n |= BigInt(b & 127) << BigInt(i * 7);
      if (!(b & 128)) return n;
    }
    throw Error("协议整数过长");
  };
  while (p < data.length) {
    const key = Number(read()),
      f = key >> 3,
      w = key & 7;
    if (!f) throw Error("协议字段无效");
    let value;
    if (w === 0) value = read();
    else if (w === 2) {
      const n = Number(read());
      if (n > data.length - p) throw Error("协议长度无效");
      value = data.slice(p, p + n);
      p += n;
    } else if (w === 1 || w === 5) {
      p += w === 1 ? 8 : 4;
      if (p > data.length) throw Error("协议字段截断");
      continue;
    } else throw Error("协议类型无效");
    if (!out.has(f)) out.set(f, []);
    out.get(f).push(value);
  }
  return out;
}
const last = (f, n, fallback) => f.get(n)?.at(-1) ?? fallback;
const integer = (f, n, fallback = 0) => Number(last(f, n, BigInt(fallback)));
const raw = (f, n) => last(f, n, new Uint8Array());
const sha = async (data) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", data));
const hmac = async (key, data) =>
  new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      ),
      data,
    ),
  );
async function hkdf(key, input) {
  const tmp = await hmac(key, input),
    a = await hmac(tmp, Uint8Array.of(1));
  return [a, await hmac(tmp, cat(a, Uint8Array.of(2)))];
}
class Cipher {
  constructor(key) {
    this.key = key;
    this.nonce = 0;
    this.dead = false;
  }
  async apply(data, ad, decrypt = false) {
    if (this.dead || this.nonce >= Number.MAX_SAFE_INTEGER)
      throw Error("加密连接已失效");
    if (!this.key) return data;
    const iv = new Uint8Array(12);
    new DataView(iv.buffer).setBigUint64(4, BigInt(this.nonce++), false);
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        this.key,
        "AES-GCM",
        false,
        [decrypt ? "decrypt" : "encrypt"],
      );
      return new Uint8Array(
        await crypto.subtle[decrypt ? "decrypt" : "encrypt"](
          { name: "AES-GCM", iv, additionalData: ad, tagLength: 128 },
          key,
          data,
        ),
      );
    } catch {
      this.dead = true;
      throw Error("Muse 加密校验失败");
    }
  }
}
async function keypair() {
  const key = await crypto.subtle.generateKey("X25519", true, ["deriveBits"]);
  return {
    private: key.privateKey,
    public: new Uint8Array(await crypto.subtle.exportKey("raw", key.publicKey)),
  };
}
async function dh(privateKey, publicBytes) {
  if (publicBytes.length !== 32) throw Error("无效的 Muse 公钥");
  const publicKey = await crypto.subtle.importKey(
    "raw",
    publicBytes,
    "X25519",
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "X25519", public: publicKey },
      privateKey,
      256,
    ),
  );
  if (shared.every((v) => v === 0)) throw Error("无效的 Muse 公钥");
  return shared;
}
export class NoiseInitiator {
  async start() {
    this.h = new Uint8Array(32);
    this.h.set(enc.encode("Noise_XX_25519_AESGCM_SHA256"));
    this.ck = this.h.slice();
    this.cipher = new Cipher();
    await this.mixHash(new Uint8Array());
    this.e = await keypair();
    await this.mixHash(this.e.public);
    await this.encryptHash(new Uint8Array());
    return this.e.public;
  }
  async mixHash(data) {
    this.h = await sha(cat(this.h, data));
  }
  async mixKey(data) {
    const [ck, key] = await hkdf(this.ck, data);
    this.ck = ck;
    this.cipher = new Cipher(key);
  }
  async encryptHash(data) {
    const out = await this.cipher.apply(data, this.h);
    await this.mixHash(out);
    return out;
  }
  async decryptHash(data) {
    const out = await this.cipher.apply(data, this.h, true);
    await this.mixHash(data);
    return out;
  }
  async finish(message) {
    if (message.length < 96) throw Error("Muse 握手消息过短");
    const re = message.slice(0, 32);
    await this.mixHash(re);
    await this.mixKey(await dh(this.e.private, re));
    const rs = await this.decryptHash(message.slice(32, 80));
    await this.mixKey(await dh(this.e.private, rs));
    await this.decryptHash(message.slice(80));
    const s = await keypair(),
      encryptedStatic = await this.encryptHash(s.public);
    await this.mixKey(await dh(s.private, re));
    const m3 = cat(encryptedStatic, await this.encryptHash(new Uint8Array()));
    const [send, recv] = await hkdf(this.ck, new Uint8Array());
    this.e = null;
    this.ck = null;
    return { message: m3, send: new Cipher(send), recv: new Cipher(recv) };
  }
}
function deferred(ms = 35000) {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  const timer = setTimeout(
    () => reject(Error("Muse 响应超时，请重新连接")),
    ms,
  );
  promise.catch(() => {});
  return {
    promise,
    resolve: (v) => {
      clearTimeout(timer);
      resolve(v);
    },
    reject: (e) => {
      clearTimeout(timer);
      reject(e);
    },
  };
}

export { enc, dec, cat, num, blob, fields, last, integer, raw, deferred };
