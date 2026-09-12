import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * On-demand ISR revalidation for public marketing pages.
 * Called by the API after portfolio/services (and similar) publishes.
 *
 * Auth: header `x-revalidate-secret` must match WEB_REVALIDATE_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.WEB_REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "WEB_REVALIDATE_SECRET is not configured" },
      { status: 503 },
    );
  }

  const provided = request.headers.get("x-revalidate-secret");
  if (!provided || provided !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { tags?: string[]; paths?: string[] } = {};
  try {
    body = (await request.json()) as { tags?: string[]; paths?: string[] };
  } catch {
    body = {};
  }

  const tags = Array.isArray(body.tags) ? body.tags.filter(Boolean) : [];
  const paths = Array.isArray(body.paths) ? body.paths.filter(Boolean) : [];

  for (const tag of tags) {
    revalidateTag(tag);
  }
  for (const path of paths) {
    revalidatePath(path);
  }

  if (!tags.length && !paths.length) {
    revalidateTag("public-portfolio");
    revalidatePath("/");
  }

  return NextResponse.json({
    ok: true,
    revalidated: { tags, paths: paths.length ? paths : ["/"] },
    now: Date.now(),
  });
}
