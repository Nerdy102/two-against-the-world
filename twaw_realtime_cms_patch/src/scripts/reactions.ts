type ReactionState = {
  counts: Record<string, number>;
  reacted: boolean;
};

function qs<T extends Element>(root: ParentNode, sel: string): T | null {
  return root.querySelector(sel) as T | null;
}

async function apiGet(slug: string): Promise<ReactionState> {
  const res = await fetch(`/api/reactions?slug=${encodeURIComponent(slug)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GET /api/reactions failed: ${res.status}`);
  return (await res.json()) as ReactionState;
}

async function apiToggle(slug: string): Promise<ReactionState> {
  const res = await fetch(`/api/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ slug, type: "heart" }),
  });
  if (!res.ok) throw new Error(`POST /api/reactions failed: ${res.status}`);
  return (await res.json()) as ReactionState;
}

export function initReactions() {
  const root = document.querySelector<HTMLElement>("[data-reactions]");
  if (!root) return;

  const slug = root.dataset.slug || "";
  if (!slug) return;

  const btn = qs<HTMLButtonElement>(root, "[data-heart-button]");
  const countEl = qs<HTMLElement>(root, "[data-heart-count]");
  if (!btn || !countEl) return;

  function apply(state: ReactionState) {
    const n = state.counts?.heart ?? 0;
    countEl.textContent = String(n);
    btn.dataset.reacted = state.reacted ? "1" : "0";
    btn.setAttribute("aria-pressed", state.reacted ? "true" : "false");
  }

  apiGet(slug)
    .then(apply)
    .catch(() => {
      // ignore
    });

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const state = await apiToggle(slug);
      apply(state);
    } catch {
      // ignore
    } finally {
      btn.disabled = false;
    }
  });
}

initReactions();
