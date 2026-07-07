import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const tauriHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: tauriHost || false,
    ...(tauriHost
      ? {
          hmr: {
            protocol: "ws" as const,
            host: tauriHost,
            port: 1421,
          },
        }
      : {}),
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
