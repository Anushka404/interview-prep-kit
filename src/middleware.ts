import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Gate protected pages and kit APIs: a signed-out visitor cannot reach them
 * (brief §1). Runs on the edge, so it verifies the JWT directly rather than
 * importing the Node-only auth helpers.
 */
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

async function isSignedIn(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("prepkit_session")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const signedIn = await isSignedIn(req);
  const { pathname } = req.nextUrl;

  if (!signedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Protect the app pages and the kit APIs; auth APIs and the landing stay public.
export const config = {
  matcher: ["/kits/:path*", "/api/kits/:path*"],
};
