# AHARAM POS + QR Ordering

A deployable React/Vite + Supabase starter for AHARAM. It includes customer QR ordering, a staff login, owner menu management, table QR printing, a kitchen order queue with realtime updates, and order-status tracking. Prices are in INR; GST is disabled.

## Important before going live

- This ZIP is the complete application source, but it is **not already hosted**. You must create a Supabase project and deploy the frontend to Vercel/Netlify.
- The starter menu is transcribed from the AHARAM gold menu PDF available in the project context. Please verify the items and prices in the Owner dashboard before accepting customer orders.
- Customer ordering becomes active only after the owner imports the starter menu into the database.
- The browser print action is for paper/receipt printing via the device's print dialog. Direct Bluetooth ESC/POS printing is hardware/browser dependent and is not guaranteed by this build. For reliable Bluetooth thermal printing, use a compatible Android print bridge/app or add a tested ESC/POS integration for the exact printer model.
- Do not put a Supabase service-role key in this frontend. Only the public anon/publishable key belongs in VITE_SUPABASE_ANON_KEY.

## Features

- Customer menu with search, category filters, cart, optional name/phone and table-aware ordering.
- Three table URLs: `/?table=1`, `/?table=2`, `/?table=3`.
- Supabase-backed orders with server-calculated prices and a private tracking token.
- Kitchen queue with realtime updates and New → Accepted → Preparing → Ready → Served states.
- Owner login through Supabase Auth; owner/staff roles stored in `profiles`.
- Owner menu manager: add/edit prices, descriptions, categories and availability.
- Print table QR cards after setting the deployed website URL.
- Premium dark/black and gold responsive design.

## Deploy

1. Create a Supabase project at https://supabase.com.
2. In Supabase → SQL Editor, run `supabase/migrations/0001_init.sql`.
3. In Supabase → Authentication → Users, create your owner user with an email and strong password.
4. Copy that user's UUID. In SQL Editor run:

   ```sql
   insert into public.profiles (id, role)
   values ('PASTE_OWNER_USER_UUID_HERE', 'owner')
   on conflict (id) do update set role = 'owner';
   ```

5. On your computer, unzip the project, open a terminal in this folder and run:

   ```bash
   npm install
   cp .env.example .env
   ```

6. In Supabase → Project Settings → API, copy the Project URL and anon/publishable key into `.env`:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
   ```

7. Run locally:

   ```bash
   npm run dev
   ```

8. Sign in using the owner account. Open Owner → Menu manager → **Import starter menu to database**. Verify all menu names and prices.
9. Deploy to Vercel: import this folder/repository, set the same two environment variables in Project Settings → Environment Variables, and deploy. Build command: `npm run build`; output directory: `dist`.
10. After deployment, sign in to Owner, replace the URL in Table QR codes with your real HTTPS domain, and print Table 1, Table 2 and Table 3 QR cards.
11. On the Android tablet, open the deployed URL and use the browser menu → Add to Home screen. Sign in as owner; switch to Kitchen when preparing orders.

## Access control

- Customer menu reads are public.
- Customer order submission calls the `place_order` database function. The function reads item prices from the database, validates availability and calculates the total server-side.
- Customer order status uses an unguessable tracking token via `track_order`; customers cannot list other orders.
- Owner/staff menu and kitchen access is controlled by the `profiles.role` value and Supabase RLS.
- Create staff users in Supabase Auth and insert their profile with role `staff`.

## Thermal printer

This version uses the browser print dialog for printable receipts/QR sheets. Bluetooth printing support differs by printer, Android version and browser. Before relying on it at the counter, test the exact printer and paper width. If your printer supports ESC/POS and Android Bluetooth, a dedicated Android print bridge or a native wrapper is the dependable route; do not assume a browser `window.print()` call sends raw ESC/POS bytes.

## Notes / next production hardening

- Set Supabase Auth password and rate-limit policies; use a unique owner password.
- Configure automated database backups in Supabase.
- Add your final logo and item photos in the menu editor after launch.
- Confirm the final menu prices with the printed menu before QR launch.
- Add a dedicated payment reconciliation flow if you need UPI transaction references, split payments or refunds.
