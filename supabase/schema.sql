-- Crissyy Crispy ordering platform schema
-- Run this in the Supabase SQL editor.

-- Categories ("sections") that products are grouped under on the storefront,
-- e.g. "Chips", "Chocolates", "Drinks". Managed from the admin page.
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Products table
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  quantity integer not null default 0,     -- stock on hand
  is_active boolean not null default true, -- shown on storefront when true
  created_at timestamptz not null default now()
);

-- Safe to run even though products already exists.
alter table products add column if not exists category_id uuid references categories(id) on delete set null;

-- Orders table (matches what already exists; included here for completeness)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  quantity integer not null,
  customer_name text,
  customer_email text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Checkout collects a phone number and delivery address (used to build the
-- WhatsApp message) rather than an email. These statements are safe to
-- run even though the orders table above already exists.
alter table orders add column if not exists customer_phone text;
alter table orders add column if not exists delivery_address text;
alter table orders add column if not exists whatsapp_order_ref text;

-- Row Level Security
alter table products enable row level security;
alter table orders enable row level security;
alter table categories enable row level security;

-- Anyone (anon key) can read active products
create policy "Public can read active products"
  on products for select
  using (is_active = true);

-- Anyone can read categories (needed to render section headings); admin
-- manages them from the same anon key, same tradeoff as products below.
create policy "Public can read categories"
  on categories for select
  using (true);

create policy "Public can manage categories"
  on categories for all
  using (true)
  with check (true);

-- Anyone (anon key) can insert an order (checkout is public)
create policy "Public can create orders"
  on orders for insert
  with check (true);

-- Writes to products (insert/update/delete) and reads of orders happen
-- through the admin page, which sits behind Netlify Basic Auth in front
-- of the same anon key. If you want DB-level admin protection too, swap
-- the anon key on admin.html for a service-role key called from a
-- Netlify Function instead of the browser.
create policy "Public can manage products"
  on products for all
  using (true)
  with check (true);

create policy "Public can read orders"
  on orders for select
  using (true);

create policy "Public can update orders"
  on orders for update
  using (true);

-- A starter section, and a few placeholder snacks so the storefront isn't empty
insert into categories (name, sort_order) values ('Snacks', 0)
on conflict (name) do nothing;

insert into products (name, description, price, image_url, quantity, is_active, category_id)
select 'Crunch Bites Original', 'Imported crispy corn snack, lightly salted.', 1500, '', 25, true, id from categories where name = 'Snacks'
union all
select 'Spicy Star Puffs', 'Fiery imported puff snack with a spicy kick.', 1800, '', 20, true, id from categories where name = 'Snacks'
union all
select 'Sweet Toffee Crisps', 'Crunchy toffee-glazed imported crisps.', 2000, '', 15, true, id from categories where name = 'Snacks'
on conflict do nothing;

-- Storage bucket for uploaded product photos (used by the admin page's
-- "upload a picture" field instead of pasting an image URL).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Public can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images');

create policy "Public can read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Public can update product images"
  on storage.objects for update
  using (bucket_id = 'product-images');

create policy "Public can delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images');
