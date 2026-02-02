type CommentDTO = {
  id: string;
  name: string;
  message: string;
  created_at: number;
};

function qs<T extends Element>(root: ParentNode, sel: string): T | null {
  return root.querySelector(sel) as T | null;
}

function escapeText(s: string): string {
  return (s ?? "").toString();
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  // Keep it simple; your site can restyle later.
  return d.toLocaleString();
}

function renderComment(c: CommentDTO): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "twaw-comment";

  const header = document.createElement("div");
  header.className = "twaw-comment__header";

  const name = document.createElement("strong");
  name.textContent = escapeText(c.name);

  const time = document.createElement("span");
  time.className = "twaw-comment__time";
  time.textContent = ` • ${formatTime(c.created_at)}`;

  header.appendChild(name);
  header.appendChild(time);

  const msg = document.createElement("p");
  msg.className = "twaw-comment__msg";
  msg.textContent = escapeText(c.message);

  li.appendChild(header);
  li.appendChild(msg);
  return li;
}

async function apiGetComments(slug: string, after: number): Promise<CommentDTO[]> {
  const res = await fetch(`/api/comments?slug=${encodeURIComponent(slug)}&after=${after}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GET /api/comments failed: ${res.status}`);
  const data = (await res.json()) as { comments?: CommentDTO[] };
  return data.comments ?? [];
}

async function apiPostComment(slug: string, name: string, message: string, turnstileToken: string): Promise<CommentDTO> {
  const res = await fetch(`/api/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ slug, name, message, turnstileToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as any)?.error || res.status;
    throw new Error(String(err));
  }
  return (data as any).comment as CommentDTO;
}

function setStatus(el: HTMLElement, msg: string, kind: "ok" | "error" | "info" = "info") {
  el.textContent = msg;
  el.dataset.kind = kind;
}

function getTurnstileToken(form: HTMLFormElement): string {
  const fd = new FormData(form);
  const v = fd.get("cf-turnstile-response");
  return typeof v === "string" ? v : "";
}

export function initComments() {
  const root = document.querySelector<HTMLElement>("[data-comments]");
  if (!root) return;

  const slug = root.dataset.slug || "";
  if (!slug) return;

  const list = qs<HTMLUListElement>(root, "[data-comment-list]");
  const form = qs<HTMLFormElement>(root, "[data-comment-form]");
  const status = qs<HTMLElement>(root, "[data-comment-status]");
  if (!list || !form || !status) return;

  let lastSeen = 0;
  let stopped = false;

  async function refresh(after = 0) {
    const items = await apiGetComments(slug, after);
    for (const c of items) {
      list.appendChild(renderComment(c));
      lastSeen = Math.max(lastSeen, c.created_at);
    }
  }

  async function poll() {
    if (stopped) return;
    try {
      await refresh(lastSeen);
    } catch {
      // ignore
    } finally {
      if (!stopped) setTimeout(poll, 5000);
    }
  }

  // Initial load
  setStatus(status, "Loading comments…", "info");
  refresh(0)
    .then(() => {
      setStatus(status, "", "ok");
      poll();
    })
    .catch(() => {
      setStatus(status, "Couldn't load comments. Try refresh.", "error");
      poll();
    });

  document.addEventListener("visibilitychange", () => {
    // Basic pause/resume
    stopped = document.hidden;
    if (!stopped) poll();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const message = String(fd.get("message") || "").trim();
    const token = getTurnstileToken(form);

    if (!name || !message) {
      setStatus(status, "Please fill in your name and message.", "error");
      return;
    }

    const btn = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (btn) btn.disabled = true;

    try {
      const comment = await apiPostComment(slug, name, message, token);
      list.appendChild(renderComment(comment));
      lastSeen = Math.max(lastSeen, comment.created_at);
      form.reset();
      setStatus(status, "Sent!", "ok");
    } catch (err: any) {
      const msg = String(err?.message || err || "failed");
      if (msg === "rate_limited") {
        setStatus(status, "Too fast 😅 — please wait ~15s and try again.", "error");
      } else if (msg === "turnstile_failed") {
        setStatus(status, "Anti-spam check failed. Please try again.", "error");
      } else {
        setStatus(status, "Couldn't send. Please try again.", "error");
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

// Auto-init on every page that has the widget
initComments();
