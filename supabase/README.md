# Sund 2.0 database

The Supabase project behind Sund 2.0: one shared pool list, and everyone's
swims, cards and places kept to themselves by row-level security.

| File | What it is |
|---|---|
| `migrations/` | The schema, its privacy rules and the functions the app calls, in the order they run. |
| `seed.sql` | The shared pool list and the sundlaugar.is details, made by `node bin/export-supabase-seed.mjs` from `lib/pools.js` and `lib/poolinfo.js`. Never edited by hand; every row is an upsert, so loading it again after a crawl only updates pools. |

## What is shared and what is not

- **Shared, read by anyone:** `pools`, `pool_info`, `rates`. Only the database
  owner and admins (through `resolve_suggestion`) change them.
- **Private to each person:** `profiles`, `cards`, `card_pools`, `places`,
  `trips`, `pool_suggestions`. Every policy is `user_id = auth.uid()`; an admin
  sees suggestions but never anyone's swims.
- **A public page** is `public_profile(username)`: sums only (total, per month,
  per weekday, pools and cards), and nothing at all until the person turns
  their page on.

## Applying it

With the Supabase CLI, from the repo root:

    supabase link --project-ref nyblioaklfiqyxrftpzx
    supabase db push
    psql "$(supabase db url)" -f supabase/seed.sql   # or paste it into the SQL editor

Or paste each migration, then `seed.sql`, into the dashboard's SQL editor.

## Pool suggestions

Every place someone names (a swim at a pool that is not on the list) is offered
to the shared list as it is made. An admin answers it at `/admin/`: add it as a
new pool, merge it into a pool already on the list as another name for it, or
keep it private. Adding or merging moves every swim logged there to the pool.
An admin sees the place's name, position, who named it and how many swims are
logged there, never when.

Nobody can make themselves an admin. In the SQL editor:

    update public.profiles set is_admin = true where username = 'franklinmagnus';

A pool added this way is on the shared list in the database, so every
signed-in person can pick it. The front page's map and pool list are still
drawn from `lib/pools.js`, so add it there too for it to show up publicly.

## Testing it

    bin/test-db.sh

Starts a throwaway Postgres (15 or later, with its contrib extensions), stands
in what Supabase provides (`tests/db/bootstrap.sql`), applies the migrations
and the seed, and runs `tests/db/rls.sql`, which signs in as two people and an
admin and checks that each sees only what they should. The Database workflow
runs it on every pull request that touches these files.
