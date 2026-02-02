import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  adapter: cloudflare(),
  // View Transitions works automatically when ClientRouter is used.
  vite: {
    plugins: [tailwindcss()],
  },
});
