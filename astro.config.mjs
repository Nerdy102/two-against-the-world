import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // View Transitions works automatically when ClientRouter is used.
  vite: {
    plugins: [tailwindcss()],
  },
});
