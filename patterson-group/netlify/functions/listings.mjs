import { getStore } from "@netlify/blobs";

const STORE_NAME = "listings";
const BLOB_KEY = "aryeo_listings";

// CORS headers for all responses
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

// Check admin password against environment variable
function isAuthorized(request) {
  const password = request.headers.get("x-admin-password");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    // If no password is configured, reject all writes (fail secure)
    return false;
  }
  return password === expected;
}

// Read listings from blob store
async function getListings() {
  const store = getStore(STORE_NAME);
  try {
    const data = await store.get(BLOB_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Write listings to blob store
async function saveListings(listings) {
  const store = getStore(STORE_NAME);
  await store.set(BLOB_KEY, JSON.stringify(listings));
}

export default async function handler(request) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // --- PUBLIC: Get all listings ---
  if (request.method === "GET") {
    const listings = await getListings();
    return new Response(JSON.stringify({ listings }), {
      status: 200,
      headers,
    });
  }

  // --- ADMIN: Modify listings ---
  if (request.method === "POST") {
    if (!isAuthorized(request)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Check your admin password." }),
        { status: 401, headers }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body." }),
        { status: 400, headers }
      );
    }

    const { action } = body;
    const listings = await getListings();

    // --- Add a listing ---
    if (action === "add") {
      const { url, label } = body;
      if (!url) {
        return new Response(
          JSON.stringify({ error: "Missing 'url' field." }),
          { status: 400, headers }
        );
      }
      // Duplicate check
      if (listings.some((l) => l.url === url)) {
        return new Response(
          JSON.stringify({ error: "This listing has already been added." }),
          { status: 409, headers }
        );
      }
      const newListing = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        url,
        label: label || "",
        added: new Date().toISOString(),
      };
      listings.push(newListing);
      await saveListings(listings);
      return new Response(
        JSON.stringify({ ok: true, listing: newListing, listings }),
        { status: 201, headers }
      );
    }

    // --- Remove a listing ---
    if (action === "remove") {
      const { id } = body;
      if (!id) {
        return new Response(
          JSON.stringify({ error: "Missing 'id' field." }),
          { status: 400, headers }
        );
      }
      const idx = listings.findIndex((l) => l.id === id);
      if (idx === -1) {
        return new Response(
          JSON.stringify({ error: "Listing not found." }),
          { status: 404, headers }
        );
      }
      listings.splice(idx, 1);
      await saveListings(listings);
      return new Response(
        JSON.stringify({ ok: true, listings }),
        { status: 200, headers }
      );
    }

    // --- Reorder listings ---
    if (action === "reorder") {
      const { order } = body; // array of IDs in desired order
      if (!Array.isArray(order)) {
        return new Response(
          JSON.stringify({ error: "'order' must be an array of listing IDs." }),
          { status: 400, headers }
        );
      }
      // Rebuild the array in the requested order
      const reordered = [];
      for (const id of order) {
        const found = listings.find((l) => l.id === id);
        if (found) reordered.push(found);
      }
      // Append any listings not in the order array (safety net)
      for (const l of listings) {
        if (!reordered.some((r) => r.id === l.id)) {
          reordered.push(l);
        }
      }
      await saveListings(reordered);
      return new Response(
        JSON.stringify({ ok: true, listings: reordered }),
        { status: 200, headers }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use 'add', 'remove', or 'reorder'." }),
      { status: 400, headers }
    );
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed." }),
    { status: 405, headers }
  );
}

export const config = {
  path: "/api/listings",
};
