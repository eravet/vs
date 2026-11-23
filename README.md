# Velo-Savvy

Website for Velo-Savvy, cycling coaching with Mark Duroy.

- **Static site**: [Eleventy](https://www.11ty.dev/) builds plain HTML from templates + content.
- **Content editor**: [Decap CMS](https://decapcms.org/) at `/admin/`, logged in with GitHub (Netlify handles the sign-in).
  Mark edits text, prices, photos and Journal posts there; every save is a Git commit.
- **Hosting**: Netlify (forms for contact + newsletter signups).

## Where things live

```
src/
  _data/            ← content the editor changes (JSON)
    site.json         settings, contact, social
    home.json         home page
    about.json        About Mark page + timeline
    coaching.json     plans, prices, add-ons, FAQ
    testimonials.json
    credits.json      photo credits (used by /credits/)
  journal/*.md      ← Journal posts (Markdown + front matter)
  _includes/        ← layouts and partials (Nunjucks)
  assets/css/main.css   ← all styles; design tokens at the top
  assets/js/main.js     ← small enhancements (menu, filters)
  assets/images/    ← photos (uploads from the editor go to /uploads)
  admin/config.yml  ← the editor's fields. Keep in sync with _data (a test checks this).
  admin/draft/      ← "Draft with AI" page (Gemini drafts + Openverse photos)
netlify/
  functions/ai-*.mjs  ← server side of "Draft with AI" (needs GEMINI_API_KEY)
  lib/ai-draft.mjs    ← shared code for those functions
docs/
  EDITING-GUIDE.md  ← for Mark
  SETUP.md          ← deploying to Netlify, editor login, DNS
  RESEARCH-NOTES.md ← sourced facts about Mark + what still needs confirming
```

## Develop

```bash
npm install
npm run dev        # http://localhost:8080
npm run build      # outputs _site/
npm test           # Playwright (uses the system's Microsoft Edge)
```

Every `<img>` is turned into responsive WebP/JPEG automatically by `@11ty/eleventy-img`.
Processed images are cached between Netlify builds (`netlify-plugin-cache`).

To try the editor locally: set `local_backend: true` in `src/admin/config.yml`,
run `npx decap-server` alongside `npm run dev`, then open `/admin/`.
