import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const outputRoot = fileURLToPath(new URL("../../website/community-hub", import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 8792,
    strictPort: true,
    fs: { allow: [repositoryRoot] },
    proxy: {
      "/api": {
        target: "https://renaiss.zeabur.app",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    outDir: outputRoot,
    emptyOutDir: true,
    assetsDir: "assets",
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  root: appRoot,
});
