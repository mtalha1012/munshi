# Munshi

**Munshi keeps a lawyer's Google Calendar in sync with their cases' court hearing
dates — automatically, once a day, in the background.**

It's a Windows desktop app for lawyers practising in Punjab, Pakistan (for now). You add a
case once (its number and district); Munshi looks up the next hearing date on the
[District Judiciary Punjab](https://dsjlahore.punjab.gov.pk) case-search site each
day and makes sure a calendar event sits on that date — moving it when a hearing
is adjourned, and putting it back if you delete it by accident. (Right now it supports 
only only one site. More will be added in the future)

> Its one job is that you never miss a hearing, so the sync is designed to have no
> silent holes: a case is either protected by a real calendar event, or it's
> flagged as needing attention — never quietly broken.

---

## What it does

- **Tracks each case by a real Google Calendar event**, not by guessing from
  event titles. Munshi creates the event and remembers its id.
- **Follows the court.** When a hearing is adjourned to a new date, Munshi *moves*
  the same event (never leaves a stale one on the old date, never duplicates).
- **Self-heals.** Delete the event in Google by mistake and the next run
  re-creates it. A deleted event can't cost you a hearing.
- **Your edits win.** Rename the event, add notes or change the reminder in Google
  Calendar and those changes carry forward to future hearings.
- **Keeps history.** Once a hearing date has passed, that event is left in place
  and a fresh one is created for the next date. Munshi never deletes anything.
- **Runs quietly.** Once a day in the background, optionally starting at login.

The court site publishes only a *date* (no time), so events default to all-day
with a reminder the day before. You can choose a specific time and reminder per
case, or link an event you've already made.

## How it works

An Electron desktop app — no Python, no browser driver, nothing else to install.

- **Scraper** — a hidden window loads the court site, reads its simple arithmetic
  captcha, fills the search form, and parses the results table. All in-process.
- **Calendar** — the sync engine (`create` / `move` / `re-create` / `noop`) is
  pure, deterministic TypeScript, covered by unit tests. Google Calendar is the
  source of truth; the app keeps a snapshot only to rebuild a deleted event.
- **Auth** — Google sign-in over a loopback redirect with **PKCE + state**.

## Tech stack

Electron 31 · electron-vite · React 18 · TypeScript · Tailwind + shadcn/ui ·
Google Calendar API · electron-store · electron-updater · vitest.

## Building it yourself

Requires Node 20+ (developed on Node 24) and Windows for the installer target.

```bash
cd munshi-app
npm install
npm run dev          # run in development
npm test             # run the unit tests
npm run build:win    # produce release/Munshi Setup <version>.exe (NSIS installer)
```

### Google setup (required)

Munshi writes to your Google Calendar, so it needs a Google OAuth client that you
create once:

1. In the [Google Cloud Console](https://console.cloud.google.com), create a
   project and **enable the Google Calendar API**.
2. Configure the **OAuth consent screen** (External). While it's in "Testing",
   add your Google account as a test user.
3. Create an **OAuth client ID → Desktop app**.
4. Provide the client id and secret to the app via environment variables (do
   **not** hardcode them — see Security below):

   ```bash
   # PowerShell
   $env:MUNSHI_GOOGLE_CLIENT_ID = "…apps.googleusercontent.com"
   $env:MUNSHI_GOOGLE_CLIENT_SECRET = "GOCSPX-…"
   npm run build:win
   ```

   `src/main/oauth-config.ts` reads these env vars and falls back to the
   placeholder constants (which you can fill in locally for convenience, but keep
   out of version control).

## Security

- **Never commit your OAuth client id/secret.** For a desktop app they are a
  *public client* (RFC 8252) and are not treated as confidential — they even ship
  inside the built `.exe` — but committing them invites automated abuse and quota
  scraping. Pass them via the environment variables above. `oauth-config.ts` in
  this repo intentionally holds only placeholders.
- Google sign-in uses PKCE and a `state` check, so an intercepted authorization
  code on the loopback port can't be exchanged for tokens.
- Your Google tokens are stored only in your own Windows user profile
  (electron-store); nothing is sent anywhere except Google and the court site.

## Status & limitations

- Windows only (Electron builds for other platforms are possible but untested).
- Covers the District Judiciary Punjab site. District coverage on that site is
  currently mostly Lahore; the app is ready as coverage expands.
- The daily background run depends on the machine being on; this is a desktop
  app, not a server.

## License

No license is set yet, which means default copyright (all rights reserved). Add a
`LICENSE` file if you intend others to use or contribute.

---

Built by Muhammad Talha.
