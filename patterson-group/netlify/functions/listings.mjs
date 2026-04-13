import { getStore } from "@netlify/blobs";

const STORE_NAME = "listings";
const BLOB_KEY = "aryeo_listings";
const SETTINGS_KEY = "site_settings";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function isAuthorized(request) {
  const password = request.headers.get("x-admin-password");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return password === expected;
}

async function getListings() {
  const store = getStore(STORE_NAME);
  try {
    const data = await store.get(BLOB_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch { return []; }
}

async function saveListings(listings) {
  const store = getStore(STORE_NAME);
  await store.set(BLOB_KEY, JSON.stringify(listings));
}

async function getSettings() {
  const store = getStore(STORE_NAME);
  try {
    const data = await store.get(SETTINGS_KEY);
    if (!data) return {};
    return JSON.parse(data);
  } catch { return {}; }
}

async function saveSettings(settings) {
  const store = getStore(STORE_NAME);
  const existing = await getSettings();
  const merged = { ...existing, ...settings };
  await store.set(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // Public: get listings or settings
  if (request.method === "GET") {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    if (type === "settings") {
      const settings = await getSettings();
      return new Response(JSON.stringify({ settings }), { status: 200, headers });
    }

    const listings = await getListings();
    return new Response(JSON.stringify({ listings }), { status: 200, headers });
  }

  // Admin: modify listings
  if (request.method === "POST") {
    if (!isAuthorized(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized." }), { status: 401, headers });
    }

    let body;
    try { body = await request.json(); }
    catch { return new Response(JSON.stringify({ error: "Invalid JSON." }), { status: 400, headers }); }

    const { action } = body;
    const listings = await getListings();

    if (action === "add") {
      const { url, address, city, price, specs, photo } = body;
      if (!url) {
        return new Response(JSON.stringify({ error: "Missing listing URL." }), { status: 400, headers });
      }
      if (listings.some((l) => l.url === url)) {
        return new Response(JSON.stringify({ error: "This listing has already been added." }), { status: 409, headers });
      }
      const newListing = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        url,
        address: address || "",
        city: city || "",
        price: price || "",
        specs: specs || "",
        photo: photo || "",
        added: new Date().toISOString(),
      };
      listings.push(newListing);
      await saveListings(listings);
      return new Response(JSON.stringify({ ok: true, listing: newListing, listings }), { status: 201, headers });
    }

    if (action === "remove") {
      const { id } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing listing ID." }), { status: 400, headers });
      }
      const idx = listings.findIndex((l) => l.id === id);
      if (idx === -1) {
        return new Response(JSON.stringify({ error: "Listing not found." }), { status: 404, headers });
      }
      listings.splice(idx, 1);
      await saveListings(listings);
      return new Response(JSON.stringify({ ok: true, listings }), { status: 200, headers });
    }

    if (action === "reorder") {
      const { order } = body;
      if (!Array.isArray(order)) {
        return new Response(JSON.stringify({ error: "'order' must be an array of IDs." }), { status: 400, headers });
      }
      const reordered = [];
      for (const id of order) {
        const found = listings.find((l) => l.id === id);
        if (found) reordered.push(found);
      }
      for (const l of listings) {
        if (!reordered.some((r) => r.id === l.id)) reordered.push(l);
      }
      await saveListings(reordered);
      return new Response(JSON.stringify({ ok: true, listings: reordered }), { status: 200, headers });
    }

    if (action === "save_settings") {
      const { settings } = body;
      if (!settings || typeof settings !== "object") {
        return new Response(JSON.stringify({ error: "Missing settings object." }), { status: 400, headers });
      }
      const updated = await saveSettings(settings);
      return new Response(JSON.stringify({ ok: true, settings: updated }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Unknown action." }), { status: 400, headers });
  }

  return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers });
}

export const config = { path: "/api/listings" };
