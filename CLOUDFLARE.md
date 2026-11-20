# Domain, email and website on Cloudflare

Status as of 2026-11-20: the domain, email forwarding and website are live.
This repo is public, so personal inboxes are written here as "your Gmail" and
"Iris's Gmail", never as addresses.

## What is set up

- **Domain:** `4thgenerationstudios.com`, registered at Cloudflare (at cost,
  auto-renew on). DNS is on Cloudflare.
- **Website:** the page in this repo, served by a Cloudflare Worker named
  `fourth-generation-studios` (static assets only, no server code) at
  https://4thgenerationstudios.com and https://www.4thgenerationstudios.com.
  The workers.dev URL is off, so there is no duplicate copy.
- **Email (free):** Cloudflare Email Routing receives mail and forwards it.
  Gmail sends replies.

  | Address | Goes to |
  |---|---|
  | ryan@4thgenerationstudios.com | your Gmail |
  | info@4thgenerationstudios.com | your Gmail |
  | iris@4thgenerationstudios.com | Iris's Gmail (**not yet**: see below) |
  | no-reply@4thgenerationstudios.com | dropped |

  The catch-all is set to drop, so made-up addresses go nowhere.

## Publishing a change to the page

```sh
./deploy.sh
```

The first time on a machine, run `npx wrangler login` first. The script
rebuilds `styles.css` from `index.html`, copies **only** `index.html`,
`styles.css` and `feedback.js` into `dist/`, and publishes that folder. Nothing else in the repo
(this file, the copy drafts) can be published by accident.

The page's styles come from a compiled Tailwind file (`styles.css`), not
Tailwind's browser CDN. The CDN version compiles the styles in the visitor's
browser on every page view, and Tailwind says it is not for production. The
colours live in `tailwind.config.js`. If you add a Tailwind class to the page,
`./deploy.sh` picks it up. To preview the page locally after changing classes,
run the `tailwindcss` line from `deploy.sh` by itself.

## Commenting on the page

Add `?feedback` to the address, e.g. https://4thgenerationstudios.com/?feedback
(works on a phone too), or run `./review.sh` to comment on unpublished local
edits. Click anything to comment on it or rewrite its text; clicking the next
spot saves the last one. **Copy JSON** puts every note on the clipboard to
paste into Claude. Notes stay in that browser until **Notes > Clear all**;
nothing is sent anywhere. Turn **Commenting** off to follow links. Visitors
without `?feedback` never load any of it.

The old GitHub Pages site (ryanfunk021.github.io/WashingtonHeritageScanning)
still shows the old name until this branch is merged into `main` and pushed.
It can be switched off in the repo's Settings > Pages once the domain is the
address you hand out.

## Still to do

1. **Iris:** click the verification link Cloudflare emailed to her Gmail. Then
   the iris@ forward can be created (Claude can do it).
2. **Reply as ryan@ / info@ from Gmail:**
   1. Turn on 2-Step Verification for the Google account if it is not already,
      then create an **App password** (Google Account > Security > App passwords).
   2. Gmail > Settings > See all settings > Accounts and Import > **Send mail
      as** > Add another email address. Name "Ryan Funk, 4th Generation
      Studios", address ryan@4thgenerationstudios.com.
   3. SMTP server `smtp.gmail.com`, port 587, TLS, username = your Gmail
      address, password = the app password.
   4. Gmail emails a code to ryan@, which forwards back to your inbox; enter
      it. Repeat for info@.

   The honest catch: mail sent this way is signed by gmail.com, not the new
   domain, so some recipients may see "via gmail.com" and a little may land in
   spam. If that becomes a problem, Cloudflare's paid Email Sending or Google
   Workspace fixes it; neither is needed to start.
3. **Turn on two-factor sign-in for the Cloudflare account.** The domain,
   email and site all sit behind that one login.
4. **The logo badge still says "W"** (from Washington Heritage Scanning).
5. After email works (Claude can do these):
   - Point the website's Formspree form notifications at info@ (in Formspree).
   - Set `EMAIL = "info@4thgenerationstudios.com"` in the operator app's
     `archive_manager/brand.py`, so READMEs and delivery emails use it.
   - Rebuild the page from `sixth-generation-studio-webpage-copy.md` (renamed).
