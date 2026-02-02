import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  adapter: cloudflare(),
  session: {
    driver: "memory",
  },
  image: {
    serviceEntryPoint: "astro/assets/services/compile",
  },
  // View Transitions works automatically when ClientRouter is used.
  vite: {
    plugins: [tailwindcss()],
  },
});
