# Munshi — Privacy Policy

**Last updated: 23 July 2026**

Munshi is a Windows desktop application that helps lawyers keep their Google
Calendar in sync with court hearing dates from the District Judiciary Punjab
case-search website. This policy explains exactly what data Munshi touches,
where it is stored, and who it is (and is not) shared with.

Munshi is developed and distributed by **Muhammad Talha** (“we”, “us”). If you have
any questions, contact us at **support@mtalhasajid.dev** — this must be the same
email shown on the app’s Google sign-in consent screen.

---

## The short version

- Munshi runs entirely **on your own computer**. There is no Munshi server.
- Your Google sign-in tokens and all your case data are stored **only in your
  own Windows user profile**. We never receive them.
- Munshi talks to exactly three places over the internet: **Google**
  (your calendar), the **District Judiciary Punjab court website**, and
  **GitHub** (to check for app updates). Nothing else.
- We do **not** sell, rent, share, or transfer your data to anyone, and we run
  **no** analytics, advertising, or tracking.

---

## What data Munshi accesses

### 1. Google Account data

When you sign in with Google, Munshi requests these permissions (scopes):

| Permission | Why Munshi needs it |
|---|---|
| **See and edit events on your calendars** (`calendar.events`) | To create a calendar event for each case, move it when a hearing is adjourned, and re-create it if it is deleted. This is the core function of the app. |
| **Your email address** and **basic profile** (`email`, `profile`, `openid`) | Only to show you which Google account is signed in. |

Using these permissions, Munshi:

- **Reads** the calendar event it is tracking for each case (to check its date
  and carry forward any edits you made in Google Calendar), and reads your
  upcoming events so you can view or link them inside the app.
- **Creates and updates** calendar events on the hearing dates it finds.

Munshi does **not** read, modify, or delete any calendar event other than the
ones it creates or that you explicitly link to a case. Munshi **never deletes**
calendar events.

### 2. Case information you enter

The case number, district, and case name you type are stored **locally on your
computer** so Munshi knows what to look up each day.

### 3. Court website lookups

To find hearing dates, Munshi submits the **case number and district** you
entered to the public District Judiciary Punjab search website
(`dsjlahore.punjab.gov.pk`), exactly as you would if you searched the site
yourself. No Google Account data is ever sent to the court website.

---

## Where your data is stored

Everything Munshi keeps lives **on your own device**, inside your Windows user
profile (via the operating system’s standard local application storage). This
includes:

- Your Google authentication tokens
- Your signed-in Google email address
- Your case list and each case’s settings
- A snapshot of each tracked calendar event (used only to rebuild an event you
  delete by accident)
- The result of the most recent sync

**None of this data is transmitted to us or to any third-party server.** We, the
developers, have no ability to see your tokens, your calendar, or your cases.

---

## How Google user data is used, shared, and protected

Munshi’s use of information received from Google APIs adheres to the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including the **Limited Use** requirements.

Specifically:

- Google user data (your calendar events and basic profile) is used **only** to
  provide the calendar-syncing feature described above, directly visible to you.
- Google user data is **not** transferred to any third party, except as
  necessary to provide the feature (i.e. communicating with Google’s own
  Calendar API on your behalf).
- Google user data is **not** used for advertising.
- Google user data is **not** sold.
- No humans read your Google user data, except where you give explicit consent
  for support, to comply with applicable law, or as needed for security.

---

## Who your data is shared with

Munshi does not share your data with any third party for our benefit. The only
external services Munshi communicates with, and only to make the app work, are:

- **Google** ([Privacy Policy](https://policies.google.com/privacy)) — to sign
  you in and read/write your calendar events.
- **District Judiciary Punjab** (`dsjlahore.punjab.gov.pk`) — to look up hearing
  dates using the case number and district you provide.
- **GitHub** ([Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement))
  — Munshi checks for new versions of the app by downloading update files from
  its public release page. These are ordinary file downloads and carry none of
  your personal, Google, or case data.

---

## Data retention and deletion

Because your data lives only on your device, **you are in full control of it**:

- **Sign out** (Settings → Sign out) removes your stored Google tokens and email
  from your computer.
- **Remove a case** deletes that case from Munshi. This does **not** delete
  anything already on your Google Calendar.
- **Uninstall Munshi** removes the application. To also remove its locally
  stored data, delete Munshi’s application-data folder in your Windows user
  profile.
- **Revoke Munshi’s access to your Google Account** at any time from
  [Google Account → Security → Third-party access](https://myaccount.google.com/connections).

We retain no copy of your data, so there is nothing for us to delete on your
behalf.

---

## Security

Your Google tokens and case data are stored within your own operating-system
user account, protected by your device’s login. Google sign-in uses the OAuth
2.0 authorization-code flow with PKCE and a state check, so your Google password
is entered only on Google’s own website and is never seen by Munshi.

No method of storage or transmission is perfectly secure, but because Munshi
keeps your data locally and sends it to no server of ours, the surface for
remote compromise is minimal.

---

## Children

Munshi is a professional tool intended for practising lawyers and is not
directed to children under 13 (or the equivalent minimum age in your
jurisdiction). We do not knowingly collect data from children.

---

## Changes to this policy

We may update this policy from time to time. Material changes will be reflected
by a new “Last updated” date at the top of this page. Continued use of Munshi
after a change means you accept the revised policy.

---

## Contact

Questions about this policy or your data:

**Muhammad Talha**
Email: **support@mtalhasajid.dev**
App homepage: **https://munshi.mtalhasajid.dev**
