import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function okPassword(pw) {
  const real = process.env.ADMIN_PASSWORD || "";
  const a = Buffer.from(String(pw || "")), b = Buffer.from(real);
  return real.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export default async (req) => {
  const store = getStore("cantare");
  if (req.method === "GET") {
    const d = await store.get("catalog", { type: "json" });
    return json(d || { empty: true });
  }
  if (req.method === "POST" || req.method === "PUT") {
    if (!okPassword(req.headers.get("x-admin-password"))) {
      await new Promise((r) => setTimeout(r, 500));
      return json({ error: "unauthorized" }, 401);
    }
    if (req.method === "POST") return json({ ok: true });
    const text = await req.text();
    if (text.length > 2_000_000) return json({ error: "too_large" }, 413);
    let d;
    try { d = JSON.parse(text); } catch { return json({ error: "bad_json" }, 400); }
    if (!d || typeof d.sections !== "object" || Array.isArray(d.sections)) return json({ error: "bad_shape" }, 400);
    for (const k of Object.keys(d.sections)) if (!Array.isArray(d.sections[k])) return json({ error: "bad_shape" }, 400);
    await store.setJSON("catalog", { sections: d.sections, nextId: Number(d.nextId) || 1000, seeded: true, updatedAt: new Date().toISOString() });
    return json({ ok: true });
  }
  return json({ error: "method_not_allowed" }, 405);
};

export const config = { path: "/api/catalog" };
