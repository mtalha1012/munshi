# Munshi — website

Public site for Munshi, served at **https://munshi.mtalhasajid.dev**. Static
HTML/CSS with self-hosted fonts (Alata + Mada). No build step.

```
index.html      Landing page
privacy.html    Privacy policy   →  /privacy on Vercel
terms.html      Terms of service →  /terms on Vercel
styles.css      Design system (dark hero + light body, gold accent)
fonts/          Alata + Mada woff2 (self-hosted, no external font requests)
logo.svg        Logo shape (used via CSS mask)
favicon.svg     Tab icon
og.svg          Social preview card
vercel.json     Clean URLs, /download redirect, security headers
robots.txt / sitemap.xml
```

## Deploy to Vercel

1. Put this `munshi-site/` folder in a Git repo (its own repo is simplest).
2. Vercel → **Add New → Project**, import the repo. If it's in a subfolder, set
   **Root Directory** to `munshi-site`. Framework preset: **Other**. No build
   command.
3. Deploy, open the `*.vercel.app` URL, confirm it loads.
4. **Settings → Domains** → add `munshi.mtalhasajid.dev`. Add the CNAME Vercel
   gives you (`cname.vercel-dns.com`) in Cloudflare DNS for the `munshi`
   subdomain, set to **DNS only / grey cloud** (not proxied).
5. Load `https://munshi.mtalhasajid.dev` and check `/`, `/privacy`, `/terms`.

`vercel.json` enables clean URLs, so `/privacy` and `/terms` work without the
`.html` on Vercel. Locally (file:// or a plain server) use the `.html` links —
the site's own links already do.

## Analytics (privacy-friendly)

The pages include **Vercel Web Analytics** (`/_vercel/insights/script.js`). It is
cookieless, collects no personal data, and does not track across sites. Turn it
on after deploy:

1. Vercel dashboard → your project → **Analytics** tab → **Enable Web Analytics**.
   The `/_vercel/insights/*` endpoint then serves automatically (locally the
   script 404s, which is harmless).
2. What you'll see: page views, top pages, referrers, country, device — all
   aggregate.
3. **Download clicks** are sent as a custom event named `download_click` (every
   "Download" button calls `va('event', …)`). You'll see it under **Events**.

For the **true number of downloads**, GitHub is the source of record: each
release asset on `github.com/mtalha1012/munshi/releases` shows a download count,
also available via the API:

```bash
curl -s https://api.github.com/repos/mtalha1012/munshi/releases \
  | grep -E '"(name|download_count)"'
```

The privacy policy (`/privacy`) discloses this analytics. The desktop app itself
has no analytics or telemetry — keep it that way.

## The download button

Buttons link straight to `https://github.com/mtalha1012/munshi/releases`, which
always exists. Once you publish a release (via `npm run build:win:publish` in the
app repo, then Publish the draft), the installer appears there. A `/download`
redirect to the latest `.exe` is also configured in `vercel.json` if you prefer
a direct-download link later.

## Google OAuth verification (what this site satisfies)

- Homepage is public, responsive, and states the app's purpose.
- Homepage links to the privacy policy (nav + footer).
- Privacy policy is live at `/privacy` with the full text.
- The app name on the homepage is **Munshi**, matching the consent screen.

Deploy, confirm all three URLs load over HTTPS, then request reverification.
