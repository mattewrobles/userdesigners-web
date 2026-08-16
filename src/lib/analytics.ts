import * as Sentry from "@sentry/astro";

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
  }
}

function toGA4(name: string, params: Record<string, string | number> = {}) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", name, params);
  }
}

function toSentry(name: string, params: Record<string, string | number> = {}) {
  Sentry.metrics.count(name, 1, { attributes: params });
}

export function pageView(page: string) {
  toGA4("page_view", { page_path: page });
  toSentry("page_view", { page });
}

export function track(name: string, params: Record<string, string | number> = {}) {
  toGA4(name, params);
  toSentry(name, params);
}

export function click(name: string, params: Record<string, string | number> = {}) {
  toGA4(`click_${name}`, params);
  toSentry(`click_${name}`, params);
}

export function duration(name: string, valueMs: number, params: Record<string, string | number> = {}) {
  toGA4(name, { ...params, value: valueMs });
  Sentry.metrics.distribution(name, valueMs, { unit: "millisecond", attributes: params });
}

export function gauge(name: string, value: number, params: Record<string, string | number> = {}) {
  toGA4(name, { ...params, value });
  Sentry.metrics.gauge(name, value, { attributes: params });
}

export function ctaClicked(cta: string, destino: string) {
  track("cta_clicked", { cta, destino });
}

export function channelClick(channel: string) {
  track("contact_channel_click", { channel });
}

export function formSubmit(channel: string) {
  track("contact_form_submit", { channel });
}

export function formError(reason: string) {
  track("contact_form_error", { reason });
}

export function blogPostView(post: string) {
  track("blog_post_view", { post });
}

export function blogRead(post: string, depth: number) {
  track(`blog_read_${depth}`, { post });
}

export function sectionView(section: string) {
  track("section_view", { section });
}

export function projectView(project: string) {
  track("proyecto_view", { proyecto: project });
}

export function outboundClick(url: string) {
  track("outbound_click", { url });
}
