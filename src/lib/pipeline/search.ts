import { tavily } from "@tavily/core";

export interface SearchResult {
  text: string;
  sources: string[];
}

/**
 * Look for public discussion of how a company interviews (brief §2). Fails soft:
 * a missing API key or an empty/failed search returns nothing rather than aborting
 * the run — "public discussion turns up nothing" is a valid, honest outcome (§10).
 */
export async function searchInterviewProcess(company: string, role: string): Promise<SearchResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || !company.trim()) return { text: "", sources: [] };

  try {
    const client = tavily({ apiKey });
    const query = `${company} interview process ${role} candidate experience questions`;
    const res = await client.search(query, { maxResults: 5, searchDepth: "basic" });
    const results = res.results ?? [];
    const text = results
      .map((r) => `Source: ${r.url}\n${(r.content ?? "").slice(0, 1500)}`)
      .join("\n\n---\n\n");
    return { text, sources: results.map((r) => r.url) };
  } catch {
    return { text: "", sources: [] };
  }
}
