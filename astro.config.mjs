import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import sentry from "@sentry/astro";

export default defineConfig({
  site: "https://www.userdesigners.com",
  integrations: [
    sitemap({
      filter: (page) => {
        const excluded = ["/diag", "/diag-logos", "/diag-logos2", "/hero-preview", "/home-framer", "/mantenimiento", "/design-system"];
        return !excluded.some((path) => page.includes(path));
      },
    }),
    sentry({
      project: "users-website",
      org: "user-designers",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  output: "static",
  build: {
    assets: "assets",
  },
  trailingSlash: "ignore",
});
