import robotsParser from "robots-parser";
import { fetchPage, type FetchedPage } from "./fetchPage";
import { assertFetchable } from "@/lib/url-guard";

const USER_AGENT =
  process.env.CRAWLER_USER_AGENT ?? "InterviewPrepKitBot/1.0 (+assessment; respects robots.txt)";
const REQUEST_GAP_MS = Number(process.env.CRAWL_GAP_MS ?? 500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface CrawlResult {
  homepageUrl: string;
  pages: { url: string; title: string; text: string }[];
  pagesUsed: string[];
  failed: { url: string; reason: string }[];
  foundHiring: boolean;
}

// Link scoring: hiring/interview pages score highest, then about/team, then blogs.
// Paths are ranked from what the site actually links, never hard-coded (brief §2).
const KEYWORD_WEIGHTS: [RegExp, number][] = [
  [/interview|hiring[- ]?process|how[- ]we[- ]hire|recruit/i, 10],
  [/career|jobs?|join|open[- ]?roles?|vacan/i, 7],
  [/handbook|culture|life[- ]at|working[- ]here|process/i, 5],
  [/about|team|company|people|mission|values/i, 4],
  [/engineering|blog|tech/i, 2],
];

function scoreLink(href: string, text: string): number {
  const hay = `${href} ${text}`.toLowerCase();
  let score = 0;
  for (const [re, w] of KEYWORD_WEIGHTS) if (re.test(hay)) score += w;
  return score;
}

const HIRING_RE = /interview|hiring|recruit|career|jobs?|join|open[- ]?roles?/i;

async function loadRobots(origin: string) {
  try {
    const res = await fetch(new URL("/robots.txt", origin), {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return robotsParser(new URL("/robots.txt", origin).href, await res.text());
  } catch {
    return null; // no robots.txt → default allow
  }
}

async function fetchWithRetry(url: string, retries = 1): Promise<FetchedPage> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchPage(url);
    } catch (err) {
      lastErr = err;
      if (i < retries) await sleep(800 * (i + 1)); // back off on failure (brief §2)
    }
  }
  throw lastErr;
}

export async function crawlSite(rawUrl: string, maxPages = 4): Promise<CrawlResult> {
  const base = await assertFetchable(rawUrl);
  const robots = await loadRobots(base.origin);
  const allowed = (url: string) => !robots || robots.isAllowed(url, USER_AGENT) !== false;

  // Homepage is mandatory; if it can't be reached the site is unreachable.
  const homepage = await fetchWithRetry(base.href, 2);

  const pages: CrawlResult["pages"] = [{ url: homepage.url, title: homepage.title, text: homepage.text }];
  const pagesUsed = [homepage.url];
  const failed: CrawlResult["failed"] = [];

  // Rank internal links (same host, prefer relative-followed links) and take the best.
  const homeHost = new URL(homepage.url).host;
  const candidates = homepage.links
    .filter((l) => {
      try {
        return new URL(l.href).host === homeHost;
      } catch {
        return false;
      }
    })
    .map((l) => ({ ...l, score: scoreLink(l.href, l.text) }))
    .filter((l) => l.score > 0 && l.href !== homepage.url)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPages);

  let foundHiring = false;
  for (const c of candidates) {
    if (!allowed(c.href)) {
      failed.push({ url: c.href, reason: "disallowed by robots.txt" });
      continue;
    }
    await sleep(REQUEST_GAP_MS);
    try {
      const page = await fetchWithRetry(c.href, 1);
      pages.push({ url: page.url, title: page.title, text: page.text });
      pagesUsed.push(page.url);
      if (HIRING_RE.test(`${c.href} ${c.text}`)) foundHiring = true;
    } catch (err) {
      failed.push({ url: c.href, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { homepageUrl: homepage.url, pages, pagesUsed, failed, foundHiring };
}
