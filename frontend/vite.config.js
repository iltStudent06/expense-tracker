import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/app/" : "/",
  publicDir: "../client/public",
  plugins: [react()],
  resolve: {
    alias: {
      react: fileURLToPath(new URL("./node_modules/react", import.meta.url)),
      "react-dom": fileURLToPath(new URL("./node_modules/react-dom", import.meta.url)),
      "react-router-dom": fileURLToPath(new URL("./node_modules/react-router-dom", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    globals: true
  },
  server: {
    port: 5173,
    fs: {
      allow: [".."]
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
}));
