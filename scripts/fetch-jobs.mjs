// Collects India openings from official company career boards. Run daily by GitHub Actions.
import { readFile, writeFile } from "node:fs/promises";
import { normaliseJob } from "../public/js/lib/match.js";
import { findCities } from "../public/js/lib/skills.js";

const root = new URL("../", import.meta.url);

export const decode = s => String(s || "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
export const toText = html => decode(decode(html).replace(/<\/(p|li|h\d|div|ul|ol)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

export const inIndia = loc => /\bindia\b/i.test(loc) || findCities(loc).some(c => c !== "Remote");

export function fromGreenhouse(body, company) {
  return (body.jobs || []).map(j => {
    const location = [j.location?.name, ...(j.offices || []).map(o => o.location || o.name)].filter(Boolean);
    return { id: `gh-${j.id}`, title: j.title, company, location: j.location?.name || location[0] || "", where: location.join("; "), url: j.absolute_url, posted: j.updated_at, source: "Company career page", description: toText(j.content) };
  });
}
export function fromLever(body, company) {
  return (Array.isArray(body) ? body : []).map(j => ({
    id: `lv-${j.id}`, title: j.text, company, location: j.categories?.location || "", where: [j.categories?.location, ...(j.categories?.allLocations || []), j.country === "IN" ? "India" : ""].filter(Boolean).join("; "),
    url: j.hostedUrl, posted: j.createdAt ? new Date(j.createdAt).toISOString() : null, source: "Company career page", remote: j.workplaceType === "remote",
    description: [j.descriptionPlain, ...(j.lists || []).map(l => `${l.text}\n${toText(l.content)}`), j.additionalPlain].filter(Boolean).join("\n")
  }));
}
export function fromAshby(body, company) {
  return (body.jobs || []).map(j => ({
    id: `ab-${j.id}`, title: j.title, company, location: j.location || "", where: [j.location, ...(j.secondaryLocations || []).map(l => l.location), j.address?.postalAddress?.addressCountry].filter(Boolean).join("; "),
    url: j.jobUrl, posted: j.publishedAt || null, source: "Company career page", remote: j.isRemote, description: j.descriptionPlain || toText(j.descriptionHtml)
  }));
}

const BOARDS = {
  greenhouse: { urls: s => [`https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=true`, `https://boards-api.eu.greenhouse.io/v1/boards/${s}/jobs?content=true`], map: fromGreenhouse },
  lever: { urls: s => [`https://api.lever.co/v0/postings/${s}?mode=json`, `https://api.eu.lever.co/v0/postings/${s}?mode=json`], map: fromLever },
  ashby: { urls: s => [`https://api.ashbyhq.com/posting-api/job-board/${s}`], map: fromAshby }
};

async function fetchCompany(c) {
  const board = BOARDS[c.ats];
  if (!board) throw new Error(`unknown ats ${c.ats}`);
  let last = "";
  for (const url of board.urls(encodeURIComponent(c.slug))) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { accept: "application/json" } });
      if (r.ok) return board.map(await r.json(), c.name);
      last = `HTTP ${r.status}`;
    } catch (e) { last = e.message; }
  }
  throw new Error(last);
}

async function main() {
  const { companies } = JSON.parse(await readFile(new URL("scripts/companies.json", root)));
  const previous = await readFile(new URL("public/data/jobs.json", root)).then(JSON.parse).catch(() => ({ jobs: [] }));
  const jobs = [], report = [];
  for (const c of companies) {
    try {
      const found = (await fetchCompany(c)).filter(j => j.title && j.url && inIndia(`${j.location}; ${j.where}`));
      jobs.push(...found.map(j => normaliseJob({ ...j, location: inIndia(j.location) ? j.location : j.where })));
      report.push(`OK    ${c.name}: ${found.length} India openings`);
    } catch (e) {
      // Keep yesterday's openings if one board is briefly down.
      const old = previous.jobs.filter(j => j.company === c.name && previous.updated && Date.now() - Date.parse(previous.updated) < 3 * 864e5);
      jobs.push(...old);
      report.push(`SKIP  ${c.name}: ${e.message}`);
    }
  }
  console.log(report.join("\n"));
  console.log(`Total: ${jobs.length}`);
  if (!jobs.length) { console.error("No jobs collected. Existing file left unchanged."); process.exit(1); }
  await writeFile(new URL("public/data/jobs.json", root), JSON.stringify({ updated: new Date().toISOString(), jobs }));
}
if (process.argv[1]?.endsWith("fetch-jobs.mjs")) main();
