# Going live

Nothing has been pushed or deployed yet. Steps, in order:

## 1. GitHub
1. Create a **private** repo (e.g. `eravet/velo-savvy-site`) and push `main`.

## 2. Netlify site
1. Netlify → *Add new site* → *Import from Git* → pick the repo.
   Build settings come from `netlify.toml` (`npm run build`, publish `_site`).
2. Check the preview URL (`*.netlify.app`) before touching the domain.

## 3. Editor login (Netlify Identity + Git Gateway)
1. Site settings → **Identity** → *Enable Identity*.
2. Registration → **Invite only**.
3. Services → **Git Gateway** → *Enable*.
4. Identity → *Invite users* → Mark's email (and yours).
   The invite link lands on the home page, which forwards to `/admin/` after he sets a password.

> Netlify has deprecated Identity (it still works but gets no new features). If it ever stops,
> switch the editor's `backend` in `src/admin/config.yml` to `github` (Mark would need a GitHub
> account) or move to Sveltia CMS. The content files don't change.

## 4. Forms
1. Netlify → *Forms* should list **contact** and **newsletter** after the first deploy.
2. Forms → *Form notifications* → *Email notification* → Mark's email, for each form.

## 5. Domain
`velo-savvy.com` currently points at the old Next.js site (Vercel). When the Netlify preview looks right:
1. Netlify → *Domain management* → add `velo-savvy.com` and `www.velo-savvy.com`.
2. Update DNS at the registrar as Netlify instructs. HTTPS is automatic.
3. Old URLs (`/services`, `/blog`, `*.html`) redirect via `netlify.toml`.

## 6. After launch
- Submit `https://www.velo-savvy.com/sitemap.xml` in Google Search Console.
- Create/claim a **Google Business Profile** for Velo-Savvy (Austin). It's the biggest local-search win.
- Work through the ⚠️ items in `docs/RESEARCH-NOTES.md` with Mark.
