import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/server/auth";
import { deletePost, getAllPostsForAdmin, upsertPost } from "../../../lib/server/posts";

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Env;
  try {
    await requireAdmin(request, env);
  } catch (resp) {
    return resp as Response;
  }

  const posts = await getAllPostsForAdmin(env.DB, 200);
  return json({ posts });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Env;
  let session;
  try {
    session = await requireAdmin(request, env);
  } catch (resp) {
    return resp as Response;
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const post = await upsertPost(env.DB, {
      id: body?.id,
      slug: body?.slug,
      title: body?.title,
      excerpt: body?.excerpt ?? null,
      content_md: body?.content_md ?? "",
      cover_key: body?.cover_key ?? null,
      topic: body?.topic ?? null,
      pinned: Boolean(body?.pinned),
      draft: Boolean(body?.draft),
      author: body?.author ?? session.author ?? null,
      published_at: body?.published_at ?? null,
    });

    return json({ post });
  } catch (e: any) {
    return json({ error: e?.message || "save_failed" }, { status: 400 });
  }
};

export const DELETE: APIRoute = async ({ request, url, locals }) => {
  const env = locals.runtime.env as Env;
  try {
    await requireAdmin(request, env);
  } catch (resp) {
    return resp as Response;
  }

  const id = (url.searchParams.get("id") || "").trim();
  if (!id) return json({ error: "missing_id" }, { status: 400 });

  await deletePost(env.DB, id);
  return json({ ok: true });
};
