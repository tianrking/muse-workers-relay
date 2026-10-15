import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const target = env.VITE_DEV_ADAPTER_URL || "https://muse.2fast.cfd";
  return {
    plugins: [react()],
    build: { target: "es2022", sourcemap: false },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: Object.fromEntries(
        ["/web", "/fetch_vms", "/device_token", "/health"].map((path) => [
          path,
          { target, changeOrigin: true, secure: true, ws: path === "/web" },
        ]),
      ),
    },
  };
});
