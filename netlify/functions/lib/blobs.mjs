import { getStore } from "@netlify/blobs";

// Each ladder gets its own blob key: "ladder:{id}"
// The index of all ladder IDs is stored at "ladder-index"

export function getDb(ctx) {
  return getStore({ name: "pickle-ladder", siteID: ctx.site.id, token: ctx.env.get("NETLIFY_AUTH_TOKEN") || "" });
}

export async function getIndex(store) {
  try {
    const data = await store.get("ladder-index", { type: "json" });
    return data || [];
  } catch {
    return [];
  }
}

export async function setIndex(store, ids) {
  await store.setJSON("ladder-index", ids);
}

export async function getLadder(store, id) {
  try {
    return await store.get(`ladder:${id}`, { type: "json" });
  } catch {
    return null;
  }
}

export async function setLadder(store, id, data) {
  await store.setJSON(`ladder:${id}`, data);
}

export async function deleteLadder(store, id) {
  try {
    await store.delete(`ladder:${id}`);
  } catch {}
}
