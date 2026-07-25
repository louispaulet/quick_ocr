import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [
      react(),
      tailwindcss(),
      ...(command === "serve" && mode === "development" ? [cloudflare()] : []),
    ],
  };
});
