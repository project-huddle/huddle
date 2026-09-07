import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron/simple";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "VITE_");
  const apiUrl = new URL(env.VITE_API_URL || "http://localhost:8080/api");
  if (!["http:", "https:"].includes(apiUrl.protocol)) {
    throw new Error("VITE_API_URL must be an absolute HTTP or HTTPS URL for desktop.");
  }

  return {
    base: "./",
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(apiUrl.toString()),
    },
    plugins: [
      react(),
      tailwindcss(),
      electron({
        main: { entry: "electron/main.ts" },
        preload: {
          input: "electron/preload.ts",
          vite: {
            build: {
              rolldownOptions: { output: { entryFileNames: "preload.cjs" } },
            },
          },
        },
      }),
    ],
    server: { host: "localhost", port: 8081, strictPort: true },
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "../shared/src") },
    },
  };
});
