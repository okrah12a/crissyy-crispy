# Crissyy Crispy — Ordering Platform

A storefront where customers browse snacks, add to cart, and send their
order straight to your WhatsApp. An admin page lets you manage products
and see incoming orders, protected by HTTP Basic Auth (no login page to
build or maintain).

## What's in here

```
index.html              Storefront (product catalog + cart)
admin.html               Admin panel (products + orders)
css/style.css             Storefront styles
css/admin.css              Admin styles
js/config.js               Your Supabase + WhatsApp settings — EDIT THIS
js/supabase-client.js      Supabase client setup
js/app.js                  Storefront logic
js/admin.js                 Admin logic
netlify.toml                Wires up the edge function
netlify/edge-functions/admin-auth.js   Basic Auth gate for /admin*
supabase/schema.sql          Database schema + starter placeholder products
assets/logo.png               Your logo
```

## 1. Set up Supabase

1. In your Supabase project, open the SQL editor and run everything in
   `supabase/schema.sql`. This creates the `products` and `categories`
   ("sections") tables, adds a couple of missing columns to your
   existing `orders` table (`customer_phone`, `delivery_address`,
   `whatsapp_order_ref`), creates a public `product-images` Storage
   bucket for uploaded photos, sets Row Level Security policies, and
   inserts a starter section with 3 placeholder snacks.
2. Go to **Project Settings → API** and copy your **Project URL** and
   **anon/public key**.
3. Paste them into `js/config.js`:
   ```js
   SUPABASE_URL: "https://xxxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJ...",
   ```

`js/config.js` also has your WhatsApp number (already set to
`2348139305072`) and currency symbol — change either if needed.

## 2. Deploy to Netlify

1. Push this folder to a GitHub repo (or drag-and-drop deploy it
   directly on Netlify).
2. In Netlify: **Site settings → Environment variables**, add:
   - `ADMIN_USER` — the username for the admin page
   - `ADMIN_PASS` — the password for the admin page
3. Deploy. `/admin` will now prompt for that username/password before
   loading — no custom login page or session logic needed.

## 3. Using the admin page

- **Sections**: create named groups (e.g. "Chips", "Chocolates",
  "Drinks") that snacks are organized under. The storefront shows each
  section as its own heading with that section's snacks underneath;
  products with no section land in a trailing "More snacks" group.
  Deleting a section doesn't delete its products — they just become
  unsectioned.
- **Products tab**: add new snacks with a photo (uploaded directly,
  stored in Supabase Storage — no need to host images elsewhere or
  paste a URL), assign them to a section, edit name/price/stock/
  description/section/photo inline, toggle active/inactive (inactive
  products don't show on the storefront), or delete a product.
- **Orders tab**: see every order as it comes in (matches the WhatsApp
  message by its order ref), with a status dropdown (pending →
  fulfilled/cancelled).

## Notes on how checkout works

When a customer taps "Send order on WhatsApp":
1. The order is saved to Supabase (one row per line item) with status
   `pending`.
2. A pre-filled WhatsApp message opens (via `wa.me`) addressed to
   `2348139305072`, listing items, total, their name, phone, address,
   and an order ref — they just hit send.
3. You'll see the order land in the admin Orders tab, and get the
   WhatsApp message itself as the real-time notification.

Stock isn't auto-decremented on order — update quantities yourself in
the admin panel as you fulfill orders, since a customer completing
checkout doesn't guarantee they actually sent the WhatsApp message.

## Security note

The `products` and `orders` tables currently allow the public anon key
to read/write directly (needed so the storefront can insert orders and
so the admin page — with no separate backend — can manage products).
The admin page itself is gated by Basic Auth in front of Netlify, but
the Supabase anon key/policies aren't aware of that gate. This is a
reasonable tradeoff for a small storefront; if you want stricter
protection later, move product writes behind a Netlify Function using a
Supabase service-role key instead of doing them from the browser.
