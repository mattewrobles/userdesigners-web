import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://www.userdesigners.com",
  integrations: [sitemap()],
  output: "static",
  build: {
    assets: "assets",
  },
});
