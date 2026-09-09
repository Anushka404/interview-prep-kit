import * as cheerio from "cheerio";
import { assertFetchable } from "@/lib/url-guard";

export interface PageLink {
  href: string;
  text: string;
}
export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  links: PageLink[];
}

const USER_AGENT =
  process.env.CRAWLER_USER_AGENT ?? "InterviewPrepKitBot/1.0 (+assessment; respects robots.txt)";
const TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 12_000);
const MAX_BYTES = Number(process.env.FETCH_MAX_BYTES ?? 2_000_000);
const MAX_TEXT_CHARS = Number(process.env.FETCH_MAX_TEXT ?? 20_000);

/**
 * Retrieve and clean a single page (brief §3). Restricts content types and sizes,
 * follows relative links, and returns absolute links for the crawler to rank.
 * ponytail: redirects are followed by native fetch; a redirect-to-private SSRF is
 * an accepted ceiling here — re-guard the final hop if this ever faces hostile input.
 */
export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  const u = await assertFetchable(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(u, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,text/plain" },
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} for ${u.href}`);

  const ct = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml|text\/plain/i.test(ct)) {
    throw new Error(`unsupported content-type "${ct}" for ${u.href}`);
  }
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared && declared > MAX_BYTES) {
    throw new Error(`page too large (${declared} bytes) for ${u.href}`);
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error(`page too large for ${u.href}`);
  const html = new TextDecoder("utf-8").decode(buf);

  const finalUrl = res.url || u.href;
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || $("h1").first().text().trim();

  const links: PageLink[] = [];
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, finalUrl);
      if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
      abs.hash = "";
      const key = abs.href;
      if (seen.has(key)) return;
      seen.add(key);
      links.push({ href: abs.href, text: $(el).text().trim().slice(0, 120) });
    } catch {
      /* skip malformed href */
    }
  });

  $("script, style, noscript, svg, template, iframe").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);

  return { url: finalUrl, title, text, links };
}
