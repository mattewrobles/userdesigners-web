import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: "https://b4ec9791e36baf2ed72412ec8d479319@o4511917426409472.ingest.us.sentry.io/4511917434798080",
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/astro/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
  // Enable logs to be sent to Sentry
  enableLogs: true,
  // Define how likely traces are sampled. Adjust this value in production,
  // or use tracesSampler for greater control.
  tracesSampleRate: 1.0,
});
