import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// IMPORTANT
// - This turns your site into SSR on Cloudflare so you can have:
//   - D1-backed posts (publish = live instantly)
//   - real comments / reactions
//   - R2 media serving
export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
  },
});
