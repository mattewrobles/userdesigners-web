import * as Sentry from "@sentry/astro";

export function pageView(page: string) {
  Sentry.metrics.count("page_view", 1, { attributes: { page } });
}

export function click(name: string, attributes: Record<string, string | number> = {}) {
  Sentry.metrics.count(`click_${name}`, 1, { attributes });
}

export function track(name: string, value = 1, attributes: Record<string, string | number> = {}) {
  Sentry.metrics.count(name, value, { attributes });
}

export function duration(name: string, valueMs: number, attributes: Record<string, string | number> = {}) {
  Sentry.metrics.distribution(name, valueMs, { unit: "millisecond", attributes });
}

export function gauge(name: string, value: number, attributes: Record<string, string | number> = {}) {
  Sentry.metrics.gauge(name, value, { attributes });
}
