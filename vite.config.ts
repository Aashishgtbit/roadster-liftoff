/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: "./",                       // relative asset paths, so the build works on GitHub Pages or any sub-folder
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 700,     // three.js on its own is ~550 kB
    rollupOptions: {
      input: { main: page("./index.html"), story: page("./about.html") },
      output: { manualChunks: { three: ["three"] } },   // the engine in its own long-cached chunk
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
