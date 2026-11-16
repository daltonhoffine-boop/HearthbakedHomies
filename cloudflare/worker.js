// RSVP API for the Hearthbaked Homies calendar. State lives in one KV key.
// store[runId] = { tank:[{n,c}], healer:[{n,c}], dps:[{n,c}] }
const CAPS = { tank: 1, healer: 1, dps: 3 };
const CLASSES = ["warrior", "paladin", "hunter", "rogue", "priest", "shaman", "mage", "warlock", "druid"];
const RUN_RE = /^2026-(11|12)-(0[1-9]|[12]\d|3[01])-[01]$/;
const KEY = "store";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" } });

export function applyAction(store, { run, role, name, cls, action }) {
  if (!RUN_RE.test(run || "")) return "Unknown run";
  const n = String(name || "").replace(/[^\p{L}\p{N} '-]/gu, "").trim().slice(0, 24);
  if (!n) return "Enter a character name";
  const same = e => e.n.toLowerCase() === n.toLowerCase();
  const r = (store[run] = store[run] || {});
  const hadRole = Object.keys(CAPS).find(k => (r[k] || []).some(same));
  for (const k of Object.keys(CAPS)) r[k] = (r[k] || []).filter(e => !same(e));
  if (action === "leave") return null;
  if (action !== "join" || !(role in CAPS)) return "Bad request";
  if (!CLASSES.includes(cls)) return "Pick a class";
  if (r[role].length >= CAPS[role]) {
    // Restore the previous sign-up so a failed move doesn't drop the player.
    if (hadRole) r[hadRole].push({ n, c: cls });
    return "That slot was just taken";
  }
  r[role].push({ n, c: cls });
  return null;
}

// A Durable Object serializes every read-modify-write, so simultaneous sign-ups can't overwrite each other.
export class Rsvps {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) {
    let store = await this.state.storage.get(KEY);
    if (!store) {
      // One-time import of whatever the old KV-based version had saved.
      store = JSON.parse((await this.env.RSVPS.get(KEY)) || "{}");
      await this.state.storage.put(KEY, store);
    }
    if (request.method === "GET") return json(store);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
    const err = applyAction(store, body);
    if (err) return json({ error: err, store }, 409);
    await this.state.storage.put(KEY, store);
    return json(store);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (new URL(request.url).pathname !== "/api/rsvps") return json({ error: "Not found" }, 404);
    return env.ROOM.get(env.ROOM.idFromName("guild")).fetch(request);
  },
};