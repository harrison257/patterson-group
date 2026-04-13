# Upgrading to Server-Backed Listings

## The Problem
The current site stores Aryeo listings in `localStorage`, which means:
- Kevin adds a listing on his laptop → only visible on his laptop
- A visitor on their phone sees zero listings
- Clearing browser data wipes everything

## The Solution
A Netlify Function stores listings on the server. Kevin's admin panel works exactly the same way, but listings are now visible to everyone.

---

## Project Structure (after upgrade)

```
patterson-group/
├── netlify.toml                    ← Netlify config
├── package.json                    ← Declares @netlify/blobs dependency
├── public/
│   ├── index.html                  ← Renamed from patterson-group.html
│   └── js/
│       └── listings-manager.js     ← New listing logic (replaces localStorage code)
└── netlify/
    └── functions/
        └── listings.mjs            ← Serverless API endpoint
```

---

## Step-by-Step Setup

### 1. Restructure the project

Create the folder structure above. Move `patterson-group.html` into `public/` and rename it `index.html`.

### 2. Update the HTML file

**a) Add the new script.** Near the bottom of `index.html`, just before `</body>`, add:
```html
<script src="/js/listings-manager.js"></script>
```

**b) Remove the old localStorage functions.** In the existing `<script>` block, delete these functions entirely:
- `loadListings()`
- `saveListings()`
- `parseAryeoInput()`
- `renderListings()`
- `addAryeoListing()`
- `removeListing()`
- `toggleAdmin()`

Also delete the `DOMContentLoaded` listener that calls `loadListings()` and `renderListings()` — the new script handles initialization.

**c) (Optional) Add a label field to the admin panel.** The new code supports an optional label per listing. In the admin panel HTML, you can add a text input before the "Add Listing" button:
```html
<input type="text" id="aryeoLabel" placeholder="Label (e.g. '2772 Pine Valley')" 
       style="width: 100%; padding: 10px; margin-bottom: 8px; border: 1px solid var(--border); border-radius: 6px;">
```
This lets Kevin give each card a readable name instead of just seeing the URL.

### 3. Set the admin password

In Netlify:
1. Go to **Site settings → Environment variables**
2. Add a new variable:
   - Key: `ADMIN_PASSWORD`
   - Value: whatever you want Kevin's password to be (e.g., `PattersonGroup2025!`)
3. Save

Kevin will be prompted for this password the first time he opens the admin panel each browser session.

### 4. Deploy

**Option A: Netlify CLI**
```bash
npm install
npx netlify deploy --prod
```

**Option B: Git-based deploy**
1. Push the project folder to a GitHub repo
2. Connect the repo to Netlify
3. Netlify auto-detects the config and deploys

**Option C: Drag and drop**
Unfortunately, drag-and-drop deploy on Netlify doesn't support Functions. Use Option A or B.

### 5. Test

1. Visit the site — the Featured Listings section should show the empty state
2. Click "Manage Listings" — you should be prompted for the password
3. Paste an Aryeo URL → click "Add Listing"
4. Open the site in a different browser or incognito window → the listing should be visible
5. That's the whole point: listings are now universal

---

## How It Works (Technical Summary)

```
Kevin's browser                    Netlify
─────────────────                  ─────────────────
                                   
[Manage Listings]                  
  │                                
  ├─ GET /api/listings ──────────→ Function reads from Netlify Blobs
  │                          ←──── Returns JSON array of listings
  │                                
  ├─ POST /api/listings ─────────→ Function validates password,
  │   { action: "add",            writes to Netlify Blobs
  │     url: "...",          ←──── Returns updated listings array
  │     password via header }      
  │                                
  └─ POST /api/listings ─────────→ Function validates password,
      { action: "remove",         removes from Netlify Blobs
        id: "..." }          ←──── Returns updated listings array


Visitor's browser                  Netlify
─────────────────                  ─────────────────
                                   
[Page loads]                       
  │                                
  └─ GET /api/listings ──────────→ Function reads from Netlify Blobs
                             ←──── Returns same listings Kevin added
                                   (visible to everyone)
```

**Storage:** Netlify Blobs — a key-value store built into Netlify. No database to manage, no external service. Data persists across deploys.

**Auth:** Simple password sent as an HTTP header (`X-Admin-Password`). Checked against the `ADMIN_PASSWORD` environment variable. Not enterprise-grade security, but appropriate for a single-agent real estate site where the worst case is someone adds a fake listing (which Kevin can remove).

**Fallback:** If the API is unreachable (network error, Netlify outage), the site gracefully shows the empty state rather than crashing.

---

## Future Improvements (Optional)

- **Drag-to-reorder:** The API already supports a `reorder` action. The client-side code would need a drag-and-drop UI (e.g., SortableJS) to call it.
- **Listing thumbnails:** Instead of rendering the full Aryeo iframe in each card, fetch a thumbnail/preview image from the Aryeo page to make the grid load faster.
- **Bulk import:** If Kevin has many listings, a "paste multiple URLs" mode could parse line-separated URLs and add them all at once.

---

## Costs

- **Netlify Free Tier** covers this entirely:
  - 125K function invocations/month (this site will use maybe 1,000)
  - Netlify Blobs included in free tier
  - No credit card required
