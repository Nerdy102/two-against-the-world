import process from "node:process";

const baseUrl = process.env.BASE_URL || "http://localhost:8788";
const adminPassword = process.env.ADMIN_PASSWORD;
const reactionKind = "🥺";

if (!adminPassword) {
  console.error("Missing ADMIN_PASSWORD in environment.");
  process.exit(1);
}

const jar = new Map();

const captureCookies = (response) => {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  const fallback = response.headers.get("set-cookie");
  if (fallback) {
    const parts = fallback.split(/,(?=[^;]+?=)/);
    setCookies.push(...parts);
  }
  for (const header of setCookies) {
    const [pair] = header.split(";");
    const [key, value] = pair.split("=");
    if (!key) continue;
    jar.set(key.trim(), value?.trim() ?? "");
  }
};

const cookieHeader = () =>
  Array.from(jar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");

const getCsrfToken = () => jar.get("twaw_admin_csrf") ?? "";

const requestJson = async (path, options = {}) => {
  const method = options.method ?? "GET";
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(method !== "GET"
        ? {
            origin: baseUrl,
            referer: `${baseUrl}/`,
          }
        : {}),
      ...(options.headers ?? {}),
      cookie: cookieHeader(),
    },
  });
  captureCookies(res);
  const payload = await res.json().catch(() => ({}));
  return { res, payload };
};

const assertOk = (condition, message) => {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
};

console.log(`🔎 Doctor check: ${baseUrl}`);

const health = await requestJson("/api/health");
assertOk(health.res.ok, `Health failed: ${health.payload?.error ?? health.res.status}`);
console.log("✅ /api/health ok");

const unlock = await requestJson("/api/admin/unlock", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: adminPassword }),
});
assertOk(unlock.res.ok, `Unlock failed: ${unlock.payload?.error ?? unlock.res.status}`);
console.log("✅ /api/admin/unlock ok");

const slug = `doctor-mode-${Date.now()}`;
const createPost = await requestJson("/api/admin/posts", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-csrf-token": getCsrfToken(),
  },
  body: JSON.stringify({
    title: "Doctor Mode Post",
    slug,
    summary: "Integration test post",
    content_md: "Testing post content.",
    status: "draft",
    author: "admin",
  }),
});
assertOk(createPost.res.ok, `Create post failed: ${createPost.payload?.error ?? createPost.res.status}`);
const postId = createPost.payload?.id;
assertOk(postId, "Create post did not return id.");
console.log("✅ /api/admin/posts create ok");

const publish = await requestJson(`/api/admin/posts/${postId}/publish`, {
  method: "POST",
  headers: { "x-csrf-token": getCsrfToken() },
});
assertOk(publish.res.ok, `Publish failed: ${publish.payload?.error ?? publish.res.status}`);
console.log("✅ /api/admin/posts/:id/publish ok");

const publishedCheck = await requestJson(`/api/posts/${slug}`);
assertOk(publishedCheck.res.ok, `Published post fetch failed: ${publishedCheck.payload?.error ?? publishedCheck.res.status}`);
console.log("✅ /api/posts/:slug ok");

if (health.payload?.env?.hasTurnstile) {
  console.error("❌ Turnstile is enabled. Provide a test token or disable TURNSTILE_SECRET for local runs.");
  process.exit(1);
}

const comment = await requestJson("/api/comments", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    slug,
    displayName: "Doctor",
    body: "Integration test comment.",
  }),
});
assertOk(comment.res.ok, `Comment failed: ${comment.payload?.error ?? comment.res.status}`);
console.log("✅ /api/comments POST ok");

if (comment.payload?.status === "pending") {
  const pending = await requestJson(`/api/admin/comments?status=pending&slug=${encodeURIComponent(slug)}`);
  assertOk(pending.res.ok, `Pending comment fetch failed: ${pending.payload?.error ?? pending.res.status}`);
  assertOk(
    (pending.payload?.comments ?? []).some((item) => item.id === comment.payload?.id),
    "Pending comment not found in admin list."
  );
} else {
  const commentList = await requestJson(`/api/comments?slug=${encodeURIComponent(slug)}`);
  assertOk(commentList.res.ok, `Comment list failed: ${commentList.payload?.error ?? commentList.res.status}`);
  assertOk(
    (commentList.payload?.comments ?? []).some((item) => item.id === comment.payload?.id),
    "Comment not found in public list."
  );
}
console.log("✅ comments verified");

const react = await requestJson("/api/reactions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ slug, kind: reactionKind }),
});
assertOk(react.res.ok, `Reaction failed: ${react.payload?.error ?? react.res.status}`);

const reactionStats = await requestJson(`/api/reactions?slug=${encodeURIComponent(slug)}`);
assertOk(reactionStats.res.ok, `Reaction stats failed: ${reactionStats.payload?.error ?? reactionStats.res.status}`);
const count = Number(reactionStats.payload?.counts?.[reactionKind] ?? 0);
assertOk(count > 0, "Reaction count did not increment.");
console.log("✅ reactions verified");

console.log("🎉 Integration test completed successfully.");
