import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import sentry from "@sentry/astro";

export default defineConfig({
  site: "https://www.userdesigners.com",
  integrations: [
    sitemap(),
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
