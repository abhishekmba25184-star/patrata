# Student job match website

Start with the launch guide shared in your chat. Short version:

- Change the site name, address and email in `site.config.json`.
- Host on Cloudflare Pages: no build command, output directory `public`.
- Optional secrets in Cloudflare: `GEMINI_API_KEY`, `JSEARCH_API_KEY`, `DAILY_AI_LIMIT`, `GEMINI_MODEL`.
- `.github/workflows/refresh-jobs.yml` refreshes openings and search pages twice a day.
- Add employers in `scripts/companies.json`. Edit page text in `scripts/content.mjs` and `scripts/home.html`.
- Do not edit HTML inside `public/` by hand. It is rebuilt by `node scripts/build-pages.mjs`.

Tests: `node --test tests/*.test.mjs`
