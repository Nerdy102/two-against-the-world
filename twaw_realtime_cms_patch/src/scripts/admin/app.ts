import { prepareImageForUpload } from "../image/prepareUpload";

type DbPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_md: string;
  cover_key: string | null;
  topic: string | null;
  pinned: number;
  draft: number;
  author: string | null;
  created_at: number;
  updated_at: number;
  published_at: number | null;
};

function $(sel: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector(sel) as HTMLElement | null;
}

function $all(sel: string, root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll(sel)) as HTMLElement[];
}

async function apiJSON(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { Accept: "application/json", ...(init.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as any)?.error || `${res.status}`), { status: res.status, data });
  return data;
}

async function login(password: string, author: string) {
  return apiJSON("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, author }),
  });
}

async function logout() {
  return apiJSON("/api/admin/logout", { method: "POST" });
}

async function listPosts(): Promise<DbPost[]> {
  const data = await apiJSON("/api/admin/posts");
  return (data as any).posts || [];
}

async function savePost(post: Partial<DbPost> & { title: string; content_md: string }) {
  const data = await apiJSON("/api/admin/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(post),
  });
  return (data as any).post as DbPost;
}

async function deletePost(id: string) {
  return apiJSON(`/api/admin/posts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function uploadFile(file: File, kind: "image" | "audio" = "image") {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("kind", kind);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `upload_failed_${res.status}`);
  return (data as any).upload as { key: string; url: string; mime: string; size: number };
}

function fmtDate(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleString();
}

function renderLogin(root: HTMLElement) {
  root.innerHTML = `
    <div class="twaw-admin-card">
      <h1 class="twaw-admin-title">Admin</h1>
      <p class="twaw-admin-muted">Login to write & publish from your phone ✍️</p>

      <form id="loginForm" class="twaw-admin-form">
        <label>
          <span>Password</span>
          <input name="password" type="password" autocomplete="current-password" required />
        </label>

        <label>
          <span>Author name (optional)</span>
          <input name="author" type="text" placeholder="you / your partner" maxlength="40" />
        </label>

        <button type="submit">Login</button>
        <p id="loginStatus" class="twaw-admin-status"></p>
      </form>
    </div>
  `;

  const form = $("#loginForm", root) as HTMLFormElement;
  const status = $("#loginStatus", root) as HTMLElement;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    const fd = new FormData(form);
    const password = String(fd.get("password") || "");
    const author = String(fd.get("author") || "");

    try {
      await login(password, author);
      root.dispatchEvent(new CustomEvent("twaw:logged-in"));
    } catch {
      status.textContent = "Wrong password (or server not ready).";
    }
  });
}

function renderApp(root: HTMLElement, posts: DbPost[]) {
  root.innerHTML = `
    <div class="twaw-admin">
      <header class="twaw-admin-header">
        <div>
          <h1 class="twaw-admin-title">Two-Against-The-World • Studio</h1>
          <p class="twaw-admin-muted">Draft → Publish → live instantly.</p>
        </div>
        <div class="twaw-admin-actions">
          <button id="newPostBtn" type="button">+ New</button>
          <button id="logoutBtn" type="button">Logout</button>
        </div>
      </header>

      <div class="twaw-admin-grid">
        <aside class="twaw-admin-list">
          <input id="search" placeholder="Search…" />
          <div id="postList"></div>
        </aside>

        <main class="twaw-admin-editor">
          <form id="editorForm" class="twaw-admin-form">
            <div class="twaw-admin-row">
              <label>
                <span>Title</span>
                <input name="title" required />
              </label>
            </div>

            <div class="twaw-admin-row twaw-admin-row-2">
              <label>
                <span>Slug (optional)</span>
                <input name="slug" placeholder="YYYY-MM-DD-title" />
              </label>
              <label>
                <span>Topic (optional)</span>
                <input name="topic" placeholder="memories / nhật ký ..." />
              </label>
            </div>

            <div class="twaw-admin-row">
              <label>
                <span>Excerpt (optional)</span>
                <input name="excerpt" maxlength="200" />
              </label>
            </div>

            <div class="twaw-admin-row twaw-admin-row-2">
              <label class="twaw-admin-check">
                <input name="pinned" type="checkbox" />
                <span>Pin</span>
              </label>
              <label class="twaw-admin-check">
                <input name="draft" type="checkbox" checked />
                <span>Draft (uncheck = publish)</span>
              </label>
            </div>

            <div class="twaw-admin-row">
              <label>
                <span>Cover image</span>
                <input id="coverInput" type="file" accept="image/*" />
              </label>
              <div id="coverPreview" class="twaw-admin-preview"></div>
              <input type="hidden" name="cover_key" />
            </div>

            <div class="twaw-admin-row">
              <label>
                <span>Content (Markdown)</span>
                <textarea name="content_md" rows="16" placeholder="Write here…"></textarea>
              </label>
              <div class="twaw-admin-row twaw-admin-row-2">
                <label>
                  <span>Insert images into content</span>
                  <input id="inlineImages" type="file" accept="image/*" multiple />
                </label>
                <div class="twaw-admin-muted">We auto-resize & compress iPhone photos before upload.</div>
              </div>
            </div>

            <div class="twaw-admin-actions">
              <button id="saveBtn" type="submit">Save</button>
              <button id="publishBtn" type="button">Publish now</button>
              <button id="deleteBtn" type="button" class="twaw-admin-danger">Delete</button>
            </div>

            <p id="editorStatus" class="twaw-admin-status"></p>
            <p class="twaw-admin-muted" id="meta"></p>
          </form>
        </main>
      </div>
    </div>
  `;

  const postListEl = $("#postList", root)!;
  const searchEl = $("#search", root) as HTMLInputElement;
  const form = $("#editorForm", root) as HTMLFormElement;
  const status = $("#editorStatus", root)!;
  const meta = $("#meta", root)!;

  const coverInput = $("#coverInput", root) as HTMLInputElement;
  const coverPreview = $("#coverPreview", root)!;
  const inlineImages = $("#inlineImages", root) as HTMLInputElement;

  const newBtn = $("#newPostBtn", root) as HTMLButtonElement;
  const logoutBtn = $("#logoutBtn", root) as HTMLButtonElement;
  const publishBtn = $("#publishBtn", root) as HTMLButtonElement;
  const deleteBtn = $("#deleteBtn", root) as HTMLButtonElement;

  let current: DbPost | null = null;

  function setEditor(p: DbPost | null) {
    current = p;
    (form.elements.namedItem("title") as HTMLInputElement).value = p?.title ?? "";
    (form.elements.namedItem("slug") as HTMLInputElement).value = p?.slug ?? "";
    (form.elements.namedItem("topic") as HTMLInputElement).value = p?.topic ?? "";
    (form.elements.namedItem("excerpt") as HTMLInputElement).value = p?.excerpt ?? "";
    (form.elements.namedItem("content_md") as HTMLTextAreaElement).value = p?.content_md ?? "";
    (form.elements.namedItem("cover_key") as HTMLInputElement).value = p?.cover_key ?? "";
    (form.elements.namedItem("pinned") as HTMLInputElement).checked = Boolean(p?.pinned);
    (form.elements.namedItem("draft") as HTMLInputElement).checked = p ? Boolean(p.draft) : true;

    coverPreview.innerHTML = "";
    if (p?.cover_key) {
      const img = document.createElement("img");
      img.src = `/media/${p.cover_key}`;
      img.alt = "cover";
      coverPreview.appendChild(img);
    }

    status.textContent = "";
    meta.textContent = p
      ? `id: ${p.id} • updated: ${fmtDate(p.updated_at)} • published: ${fmtDate(p.published_at)} • ${p.draft ? "DRAFT" : "LIVE"}`
      : "New post";
  }

  function renderList(items: DbPost[]) {
    postListEl.innerHTML = "";
    for (const p of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "twaw-admin-post";
      btn.dataset.id = p.id;
      const safeTitle = escapeHTML(p.title);
      const safeSlug = escapeHTML(p.slug);
      btn.innerHTML = `
        <div class="twaw-admin-post__title">${safeTitle}</div>
        <div class="twaw-admin-post__meta">${p.draft ? "draft" : "published"} • ${safeSlug}</div>
      `;
      btn.addEventListener("click", () => setEditor(p));
      postListEl.appendChild(btn);
    }
  }

  function escapeHTML(s: string): string {
    return (s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function filtered(): DbPost[] {
    const q = searchEl.value.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => (p.title || "").toLowerCase().includes(q) || (p.slug || "").toLowerCase().includes(q));
  }

  renderList(posts);
  setEditor(posts[0] ?? null);

  searchEl.addEventListener("input", () => renderList(filtered()));

  newBtn.addEventListener("click", () => setEditor(null));

  logoutBtn.addEventListener("click", async () => {
    await logout().catch(() => {});
    location.reload();
  });

  coverInput.addEventListener("change", async () => {
    const file = coverInput.files?.[0];
    if (!file) return;

    status.textContent = "Preparing image…";
    try {
      const prepared = await prepareImageForUpload(file);
      status.textContent = `Uploading… (${Math.round(prepared.file.size / 1024)} KB)`;
      const uploaded = await uploadFile(prepared.file, "image");

      (form.elements.namedItem("cover_key") as HTMLInputElement).value = uploaded.key;
      coverPreview.innerHTML = "";
      const img = document.createElement("img");
      img.src = uploaded.url;
      img.alt = "cover";
      coverPreview.appendChild(img);

      status.textContent = "Cover uploaded.";
    } catch (e) {
      status.textContent = "Cover upload failed.";
    }
  });

  inlineImages.addEventListener("change", async () => {
    const files = Array.from(inlineImages.files || []);
    if (!files.length) return;

    const textarea = form.elements.namedItem("content_md") as HTMLTextAreaElement;
    for (const f of files) {
      status.textContent = "Preparing image…";
      try {
        const prepared = await prepareImageForUpload(f);
        status.textContent = `Uploading… (${Math.round(prepared.file.size / 1024)} KB)`;
        const uploaded = await uploadFile(prepared.file, "image");
        insertAtCursor(textarea, `\n![](${uploaded.url})\n`);
        status.textContent = "Inserted image.";
      } catch {
        status.textContent = "Image upload failed.";
      }
    }
    inlineImages.value = "";
  });

  function insertAtCursor(textarea: HTMLTextAreaElement, text: string) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    textarea.value = before + text + after;
    const pos = start + text.length;
    textarea.selectionStart = textarea.selectionEnd = pos;
    textarea.focus();
  }

  async function doSave(override: Partial<DbPost> = {}) {
    status.textContent = "Saving…";
    const fd = new FormData(form);

    const payload: any = {
      id: current?.id,
      title: String(fd.get("title") || "").trim(),
      slug: String(fd.get("slug") || "").trim() || undefined,
      excerpt: String(fd.get("excerpt") || "").trim() || null,
      topic: String(fd.get("topic") || "").trim() || null,
      pinned: Boolean(fd.get("pinned")),
      draft: Boolean(fd.get("draft")),
      cover_key: String(fd.get("cover_key") || "").trim() || null,
      content_md: String(fd.get("content_md") || ""),
      ...override,
    };

    try {
      const saved = await savePost(payload);
      // Update local list
      const idx = posts.findIndex((p) => p.id === saved.id);
      if (idx >= 0) posts[idx] = saved;
      else posts.unshift(saved);

      renderList(filtered());
      setEditor(saved);
      status.textContent = "Saved.";
    } catch (e: any) {
      status.textContent = `Save failed: ${String(e?.message || "").slice(0, 80)}`;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    doSave();
  });

  publishBtn.addEventListener("click", async () => {
    // Force draft=false
    (form.elements.namedItem("draft") as HTMLInputElement).checked = false;
    await doSave({ draft: false });
    status.textContent = "Published. Go check /entries 😄";
  });

  deleteBtn.addEventListener("click", async () => {
    if (!current) return;
    if (!confirm("Delete this post?")) return;

    status.textContent = "Deleting…";
    try {
      await deletePost(current.id);
      posts = posts.filter((p) => p.id !== current!.id);
      renderList(filtered());
      setEditor(posts[0] ?? null);
      status.textContent = "Deleted.";
    } catch {
      status.textContent = "Delete failed.";
    }
  });
}

async function boot() {
  const root = document.getElementById("twaw-admin-root");
  if (!root) return;

  renderLogin(root);

  root.addEventListener("twaw:logged-in", async () => {
    try {
      const posts = await listPosts();
      renderApp(root, posts);
    } catch {
      // If login succeeded but list failed, reload.
      location.reload();
    }
  });

  // Try to auto-enter app if already logged in
  try {
    const posts = await listPosts();
    renderApp(root, posts);
  } catch (e: any) {
    // 401 => stay on login
    if (e?.status && e.status !== 401) {
      const status = document.querySelector<HTMLElement>("#loginStatus");
      if (status) status.textContent = "Server error. Check deploy.";
    }
  }
}

boot();
