import { defineConfig } from "vite";

export default defineConfig({
  base: "/100g/",
  build: {
    target: "es2022",
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
