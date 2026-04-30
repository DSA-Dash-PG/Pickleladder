import { getStore } from "@netlify/blobs";

function store() { return getStore("pickle-friends"); }
async function getIndex(s) { try { return await s.get("ladder-index", { type: "json" }) || []; } catch { return []; } }

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Pin",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json",
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });

function checkPin(req) {
  const envPin = Netlify.env.get("ADMIN_PIN") || "1234";
  const sentPin = req.headers.get("x-admin-pin") || "";
  return sentPin === envPin;
}

export default async (req, context) => {
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const s = store();

  try {
    // ── Verify PIN (client calls this to check if PIN is correct) ──
    if (action === "verify-pin") {
      return json({ valid: checkPin(req) });
    }

    // ── GET: list all ladders ──
    if (req.method === "GET" && action === "list") {
      const ids = await getIndex(s);
      const ladders = [];
      for (const id of ids) {
        try { const l = await s.get(`ladder:${id}`, { type: "json" }); if (l) ladders.push(l); } catch {}
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

    // ── POST: save ladder (admin only) ──
    if (req.method === "POST" && action === "save") {
      if (!checkPin(req)) return json({ error: "Unauthorized" }, 401);
      const body = await req.json();
      const ladder = body.ladder;
      if (!ladder || !ladder.id) return json({ error: "Missing ladder data" }, 400);

      await s.setJSON(`ladder:${ladder.id}`, ladder);

      const ids = await getIndex(s);
      if (!ids.includes(ladder.id)) {
        ids.push(ladder.id);
        await s.setJSON("ladder-index", ids);
      }
      return json({ ok: true, ladder });
    }

    // ── DELETE: remove ladder (admin only) ──
    if (req.method === "DELETE" && action === "delete") {
      if (!checkPin(req)) return json({ error: "Unauthorized" }, 401);
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing id" }, 400);

      await s.delete(`ladder:${id}`).catch(() => {});
      const ids = await getIndex(s);
      await s.setJSON("ladder-index", ids.filter(i => i !== id));
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("API error:", err);
    return json({ error: err.message || "Server error" }, 500);
  }
};
