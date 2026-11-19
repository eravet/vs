# Going live on Netlify

About 30–45 minutes, done once. Order matters: the site goes to a free `*.netlify.app` address first,
Mark reviews it there, and only then does `velo-savvy.com` move over from Vercel.

## 1. GitHub repo
1. On github.com: **New repository** → name **`vs3`** (owner `eravet`) → **Private** → *don't* add a
   README, .gitignore or licence → **Create repository**.
   (A different name is fine: change `repo:` near the top of `src/admin/config.yml` to match.)
2. Push the local repo (Claude can run this for you):
   ```
   git remote add origin https://github.com/eravet/vs3.git
   git push -u origin main
   ```

## 2. Netlify project
1. app.netlify.com → **Add new project** → **Import an existing project** → **GitHub** → allow access
   to the `vs3` repo → pick it.
2. Build settings fill in from `netlify.toml` (`npm run build`, publish `_site`). Click **Deploy**.
   The first build takes ~2 minutes (it resizes every photo; later builds reuse them).
3. **Project configuration → General → Change project name** → `velo-savvy`, giving
   `https://velo-savvy.netlify.app`. This is the link to share with Mark.

## 3. Editor login (GitHub)
Mark signs in to `/admin/` with **Login with GitHub**. Netlify does the sign-in handshake; you set it
up once.

**a. Create a GitHub OAuth app** (github.com → your avatar → **Settings → Developer settings →
OAuth Apps → New OAuth App**):
- Application name: `Velo-Savvy editor`
- Homepage URL: `https://velo-savvy.netlify.app` (change to `https://www.velo-savvy.com` after launch; optional)
- Authorization callback URL: **`https://api.netlify.com/auth/done`** (exactly this)
- Register → copy the **Client ID** → **Generate a new client secret** → copy it.

**b. Give them to Netlify:** Netlify project → **Project configuration → Access & security → OAuth →
Install provider** → **GitHub** → paste the Client ID and secret → Install.

**c. Give Mark access to the repo:**
1. Mark creates a free account at github.com (any username; use the email he'll check).
2. GitHub repo → **Settings → Collaborators → Add people** → his username → role **Write**.
3. He accepts the invite email from GitHub.

**d. Try it:** open `https://velo-savvy.netlify.app/admin/` → **Login with GitHub** → authorise once.
Edit something small, **Publish**, and the site updates about a minute later.

## 4. Forms
After the first deploy, Netlify → **Forms** lists five forms: **contact**, **newsletter**,
**junior-interest**, **program-interest** and **intake**.
1. If the Forms page asks, click **Enable form detection** and redeploy (Deploys → Trigger deploy).
2. **Forms → Form notifications → Add notification → Email notification** → Mark's email → choose
   *Any form* (or add one per form).
3. Send a test message from the live Contact page and check it arrives.

## 5. Share with Mark
Send him:
- the preview link `https://velo-savvy.netlify.app`
- `docs/EDITING-GUIDE.md` (how to log in and edit)
- the ⚠️ items in `docs/RESEARCH-NOTES.md` to confirm or correct (he can fix most of them himself in
  the editor; it's good practice)

## 6. Move velo-savvy.com from Vercel to Netlify
When Mark is happy:
1. Netlify → **Domain management → Add a domain** → `www.velo-savvy.com` (Netlify also adds the bare
   `velo-savvy.com` and redirects it to `www`).
2. Netlify shows the DNS records to use. Where the domain is managed:
   - **If DNS is on Vercel** (Vercel → Domains → velo-savvy.com): first **remove the domain from the
     old Vercel project** so Vercel stops serving it, then in the domain's DNS records set
     `www` → **CNAME** → `velo-savvy.netlify.app` and the bare domain → **A** → `75.2.60.5`
     (use the values Netlify shows if they differ). Keep any email (MX/TXT) records as they are.
   - **If DNS is at a registrar** (GoDaddy, Namecheap, Squarespace…): make the same two changes there.
3. Wait for Netlify to show the domain as verified; HTTPS is issued automatically (minutes to an hour).
4. Old addresses (`/services`, `/blog`, `*.html`) already redirect via `netlify.toml`.
5. Optional: update the GitHub OAuth app's Homepage URL to `https://www.velo-savvy.com`.

## 7. After launch
- Google Search Console → add `velo-savvy.com` → submit `https://www.velo-savvy.com/sitemap.xml`.
- Claim a **Google Business Profile** for Velo-Savvy (Austin), the biggest local-search win, then put
  its review link in **Pages → Athlete hub** in the editor.
- Keep the old Vercel project for a week or two in case anything needs checking, then delete it.

## If something goes wrong
- **Editor says "Not Found" / can't load entries:** the `repo:` in `src/admin/config.yml` doesn't
  match the GitHub repo, or Mark isn't a collaborator yet (or hasn't accepted the invite).
- **"Login with GitHub" popup errors:** the OAuth callback URL must be exactly
  `https://api.netlify.com/auth/done`, and the provider must be installed on *this* Netlify project.
- **Build fails:** Netlify → Deploys → open the failed deploy → the log's last lines say why.
  Every editor change is a Git commit, so any bad edit can be reverted on GitHub.
