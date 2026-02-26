import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  adapter: cloudflare(),
  // We enforce CSRF in API routes via signed cookie + header token.
  // Disable Astro's global Origin check to avoid false 403s on multipart uploads.
  security: {
    checkOrigin: false,
  },
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
