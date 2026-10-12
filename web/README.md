# Sund 2.0 on Netlify

The public, multi-user Sund at sund.talva.is: static pages that talk to
Supabase from the browser. `bin/build-web.mjs` builds it from the same files the
one-person app serves; `web/netlify.toml` tells Netlify how.

| Address | What it is |
|---|---|
| `/` | Every pool on a map and in a list, and the way in |
| `/login.html` | Sign in or sign up with Google or Microsoft |
| `/welcome.html` | The wizard a new account goes through once: username, card, public page, import |
| `/app/` | The signed-in counter, with its map and pool pages |
| `/<username>/` | Someone's public page, sums only, if they have switched it on |

## Going live

**Supabase** (Authentication → URL Configuration)
- Site URL: `https://sund.talva.is`
- Redirect URLs: `https://sund.talva.is/login.html`
- Authentication → Providers: turn on Google and Azure (Microsoft) with their
  client ids and secrets. Azure's tenant URL is
  `https://login.microsoftonline.com/common` so personal and work accounts
  both work.
- The database: `supabase/README.md`.

**Netlify** (Site configuration → Build & deploy)
- Base directory: `web`. Netlify then reads `web/netlify.toml`: build command
  and publish directory come from there, so leave those fields empty.
- No environment variables. The Supabase address and publishable key are public
  by design and live in `lib/cloud.js`; the service_role key never goes here.
- Turn builds on, then point sund.talva.is at the site.

**Your swims**: in the one-person app, ⚙ → Export, then in Sund 2.0 import the
file in the wizard's last step, or under ⚙ → Account before logging any swim.

## Trying it locally

    node bin/build-web.mjs /tmp/sund-web
    npx serve /tmp/sund-web    # or any static server; _redirects needs Netlify

It talks to the real Supabase project, so sign-in needs `http://localhost:…`
added to Supabase's redirect URLs.
