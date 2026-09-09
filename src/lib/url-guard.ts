import net from "node:net";
import { lookup } from "node:dns/promises";

/**
 * Validate external URLs before fetching (brief §11). Private and loopback
 * addresses are rejected in production. The batch tests serve company sites from
 * localhost, so loopback is allowed unless NODE_ENV === 'production' (override
 * with ALLOW_PRIVATE_HOSTS=true if ever needed).
 */
const BLOCK_PRIVATE =
  process.env.NODE_ENV === "production" && process.env.ALLOW_PRIVATE_HOSTS !== "true";

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const low = ip.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    low === "::1" ||
    low === "::" ||
    low.startsWith("fc") ||
    low.startsWith("fd") ||
    low.startsWith("fe80")
  );
}

export async function assertFetchable(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error(`invalid URL: ${rawUrl}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`unsupported protocol: ${u.protocol}`);
  }
  if (!BLOCK_PRIVATE) return u;

  const host = u.hostname;
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error(`refusing private address: ${host}`);
    return u;
  }
  const addrs = await lookup(host, { all: true });
  for (const a of addrs) {
    if (isPrivateIp(a.address)) throw new Error(`refusing host resolving to private address: ${host}`);
  }
  return u;
}
