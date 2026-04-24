import { getStore } from "@netlify/blobs";

// ─── STORE HELPER ─────────────────────────────────────────────
function store(req) {
  return getStore("pickle-ladder");
}

async function getIndex(s) {
  try { return await s.get("ladder-index", { type: "json" }) || []; } catch { return []; }
}

// ─── CORS HEADERS ─────────────────────────────────────────────
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Pin",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

// ─── HANDLER ──────────────────────────────────────────────────
export default async (req, context) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const s = store(req);

  try {
    // ── GET: list all ladders (index only) ──
    if (req.method === "GET" && action === "list") {
      const ids = await getIndex(s);
      const ladders = [];
      for (const id of ids) {
        try {
          const l = await s.get(`ladder:${id}`, { type: "json" });
          if (l) ladders.push(l);
        } catch {}
      }
      return json({ ladders });
    }

    // ── GET: single ladder ──
    if (req.method === "GET" && action === "get") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing id" }, 400);
      const ladder = await s.get(`ladder:${id}`, { type: "json" });
      if (!ladder) return json({ error: "Not found" }, 404);
      return json({ ladder });
    }

    // ── POST: save/update a ladder ──
    if (req.method === "POST" && action === "save") {
      const body = await req.json();
      const ladder = body.ladder;
      if (!ladder || !ladder.id) return json({ error: "Missing ladder data" }, 400);

      // Verify admin PIN
      const pin = req.headers.get("x-admin-pin");
      // On first save (creating), accept any PIN. On updates, check stored PIN.
      const existing = await s.get(`ladder:${ladder.id}`, { type: "json" }).catch(() => null);
      if (existing && existing.adminPin && pin !== existing.adminPin) {
        return json({ error: "Unauthorized" }, 401);
      }

      await s.setJSON(`ladder:${ladder.id}`, ladder);

      // Update index
      const ids = await getIndex(s);
      if (!ids.includes(ladder.id)) {
        ids.push(ladder.id);
        await s.setJSON("ladder-index", ids);
      }

      return json({ ok: true, ladder });
    }

    // ── DELETE: remove a ladder ──
    if (req.method === "DELETE" && action === "delete") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing id" }, 400);

      // Verify admin PIN
      const pin = req.headers.get("x-admin-pin");
      const existing = await s.get(`ladder:${id}`, { type: "json" }).catch(() => null);
      if (existing && existing.adminPin && pin !== existing.adminPin) {
        return json({ error: "Unauthorized" }, 401);
      }

      await s.delete(`ladder:${id}`).catch(() => {});

      const ids = await getIndex(s);
      const newIds = ids.filter(i => i !== id);
      await s.setJSON("ladder-index", newIds);

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);

  } catch (err) {
    console.error("API error:", err);
    return json({ error: err.message || "Server error" }, 500);
  }
};
