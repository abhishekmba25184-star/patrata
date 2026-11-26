// Collects India openings from official company career boards. Run daily by GitHub Actions.
import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { normaliseJob } from "../public/js/lib/match.js";
import { findCities } from "../public/js/lib/skills.js";

const root = new URL("../", import.meta.url);

export const decode = s => String(s || "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&");
export const toText = html => decode(decode(html).replace(/<\/(p|li|h\d|div|ul|ol)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t\u00a0]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

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

const UA = { accept: "application/json", "accept-language": "en-US", "user-agent": "Mozilla/5.0 (compatible; PatrataJobsBot/1.0)" };
const MAX_PER_COMPANY = 300;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Waits and tries again when a site says "too many requests".
async function getJson(url, init = {}, retries = 4) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(30000), headers: { ...UA, ...(init.headers || {}) } });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status === 503) && attempt < retries) {
      const wait = Math.min(20, +r.headers.get("retry-after") || 5 * 2 ** attempt);
      await sleep(wait * 1000);
      continue;
    }
    throw new Error(`HTTP ${r.status}`);
  }
}

// Runs fn over items, a few at a time.
export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch { out[k] = null; } }
  }));
  return out;
}

export function fromSmartRecruiters(list, details, company, slug) {
  return list.map((j, k) => {
    const d = details[k] || {};
    const sec = d.jobAd?.sections || {};
    const loc = j.location?.fullLocation || [j.location?.city, j.location?.region, j.location?.country === "in" ? "India" : j.location?.country].filter(Boolean).join(", ");
    const level = [j.experienceLevel?.label && `Experience level: ${j.experienceLevel.label}.`, j.typeOfEmployment?.label && `Type: ${j.typeOfEmployment.label}.`].filter(Boolean).join(" ");
    return { id: `sr-${j.id}`, title: j.name, company, location: loc, where: loc, url: d.postingUrl || `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
      posted: j.releasedDate || null, source: "Company career page", remote: Boolean(j.location?.remote),
      description: [level, toText([sec.jobDescription?.text, sec.qualifications?.text, sec.additionalInformation?.text].filter(Boolean).join("\n"))].filter(Boolean).join("\n") };
  });
}

async function smartRecruiters(c) {
  const list = [];
  for (let offset = 0; list.length < MAX_PER_COMPANY; offset += 100) {
    const body = await getJson(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(c.slug)}/postings?country=in&limit=100&offset=${offset}`);
    list.push(...(body.content || []));
    if (!body.content?.length || offset + 100 >= (body.totalFound || 0)) break;
  }
  const trimmed = list.slice(0, MAX_PER_COMPANY);
  const details = await pool(trimmed, 6, j => getJson(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(c.slug)}/postings/${j.id}`));
  return fromSmartRecruiters(trimmed, details, c.name, c.slug);
}

// Finds the "India" choice in a Workday site's location filters.
export function indiaFacet(facets, parent = null) {
  for (const f of facets || []) {
    const param = f.facetParameter || parent;
    for (const v of f.values || []) {
      if (/^india$/i.test(String(v.descriptor || "").trim()) && v.id) return { param, id: v.id };
      if (v.values) { const hit = indiaFacet([v], param); if (hit) return hit; }
    }
  }
  return null;
}

export function fromWorkday(list, details, company, c) {
  return list.map((j, k) => {
    const d = details[k]?.jobPostingInfo || {};
    const where = [d.location || j.locationsText, ...(d.additionalLocations || []), d.country?.descriptor].filter(Boolean).join("; ");
    return { id: `wd-${c.tenant}-${d.id || j.bulletFields?.[0] || j.externalPath}`, title: d.title || j.title, company,
      location: d.location || j.locationsText || "", where, url: d.externalUrl || `https://${c.host}/en-US/${c.site}${j.externalPath}`,
      posted: d.startDate || null, source: "Company career page", remote: /remote/i.test(d.remoteType || ""), description: toText(d.jobDescription || "") };
  });
}

const WORKDAY_MAX = 150;
// Workday sites limit request rates. Each company gets a few minutes at most, and all Workday
// companies together get a time budget, so one slow site cannot hold up the daily refresh.
const WORKDAY_BUDGET = 25 * 60 * 1000;
const runStart = Date.now();
async function workday(c) {
  if (Date.now() - runStart > WORKDAY_BUDGET) throw new Error("skipped: time budget used");
  const deadline = Date.now() + 4 * 60 * 1000;
  const api = `https://${c.host}/wday/cxs/${c.tenant}/${c.site}`;
  const post = body => getJson(`${api}/jobs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, 2);
  const first = await post({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" });
  const india = indiaFacet(first.facets);
  const base = india ? { appliedFacets: { [india.param]: [india.id] }, searchText: "" } : { appliedFacets: {}, searchText: "India" };
  const list = [];
  for (let offset = 0; list.length < WORKDAY_MAX && Date.now() < deadline; offset += 20) {
    await sleep(400);
    const body = await post({ ...base, limit: 20, offset });
    const page = body.jobPostings || [];
    list.push(...page);
    if (page.length < 20 || offset + 20 >= (body.total || 0)) break;
  }
  const trimmed = list.slice(0, WORKDAY_MAX);
  // Descriptions are optional: stop asking for them if the site starts refusing or time runs out.
  let refusals = 0;
  const details = await pool(trimmed, 2, async j => {
    if (refusals >= 3 || Date.now() > deadline) return null;
    await sleep(250);
    try { return await getJson(`${api}${j.externalPath}`, {}, 1); } catch (e) { refusals++; return null; }
  });
  return fromWorkday(trimmed, details, c.name, c);
}

export function fromRecruitee(body, company) {
  return (body.offers || []).map(j => ({
    id: `rc-${j.id}`, title: j.title, company, location: [j.city, j.state_name || j.state, j.country].filter(Boolean).join(", ") || j.location || "",
    where: [j.location, j.country, j.country_code === "IN" ? "India" : ""].filter(Boolean).join("; "), url: j.careers_url || j.careers_apply_url,
    posted: j.published_at || j.created_at || null, source: "Company career page", remote: Boolean(j.remote),
    description: toText([j.description, j.requirements].filter(Boolean).join("\n"))
  }));
}
export function fromWorkable(body, company) {
  return (body.jobs || []).map(j => ({
    id: `wk-${j.shortcode || j.id}`, title: j.title, company, location: [j.city, j.state, j.country].filter(Boolean).join(", "),
    where: [...(j.locations || []).map(l => [l.city, l.region, l.country].filter(Boolean).join(", ")), j.country].filter(Boolean).join("; "),
    url: j.url || j.shortlink || j.application_url, posted: j.published_on || j.created_at || null, source: "Company career page",
    remote: Boolean(j.telecommuting), description: toText(j.description || "")
  }));
}

const BOARDS = {
  greenhouse: { urls: s => [`https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=true`, `https://boards-api.eu.greenhouse.io/v1/boards/${s}/jobs?content=true`], map: fromGreenhouse },
  lever: { urls: s => [`https://api.lever.co/v0/postings/${s}?mode=json`, `https://api.eu.lever.co/v0/postings/${s}?mode=json`], map: fromLever },
  ashby: { urls: s => [`https://api.ashbyhq.com/posting-api/job-board/${s}`], map: fromAshby },
  smartrecruiters: { run: smartRecruiters },
  recruitee: { urls: s => [`https://${s}.recruitee.com/api/offers/`], map: fromRecruitee },
  workable: { urls: s => [`https://www.workable.com/api/accounts/${s}?details=true`, `https://apply.workable.com/api/v1/widget/accounts/${s}?details=true`], map: fromWorkable },
  workday: { run: workday }
};

async function fetchCompany(c) {
  const board = BOARDS[c.ats];
  if (!board) throw new Error(`unknown ats ${c.ats}`);
  if (board.run) return board.run(c);
  let last = "";
  for (const url of board.urls(encodeURIComponent(c.slug))) {
    try { return board.map(await getJson(url), c.name); } catch (e) { last = e.message; }
  }
  throw new Error(last);
}

// Finds which hiring system a company uses by trying the usual board addresses.
export function slugGuesses(name) {
  const base = name.replace(/\(.*?\)/g, "").replace(/&/g, "and").trim();
  const flat = base.toLowerCase().replace(/[^a-z0-9]/g, "");
  const dashed = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const camel = base.replace(/[^A-Za-z0-9]/g, "");
  const tries = [];
  for (const s of new Set([flat, dashed])) tries.push({ ats: "greenhouse", slug: s }, { ats: "lever", slug: s }, { ats: "ashby", slug: s });
  for (const s of new Set([camel, flat])) tries.push({ ats: "smartrecruiters", slug: s });
  for (const s of new Set([flat, dashed])) tries.push({ ats: "recruitee", slug: s }, { ats: "workable", slug: s });
  return tries;
}
async function discover(name) {
  for (const t of slugGuesses(name)) {
    const c = { name, ...t };
    try {
      if (t.ats === "smartrecruiters") {
        const b = await getJson(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(t.slug)}/postings?country=in&limit=1`);
        if (b.totalFound > 0) return c;
        continue;
      }
      // Accept a board only if it has openings in India, so a same-named company abroad is not mixed in.
      const jobs = await fetchCompany(c);
      if (jobs.some(j => inIndia(`${j.location}; ${j.where}`))) return c;
    } catch { /* not on this system */ }
  }
  return null;
}

const slug = s => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const shardName = role => (role ? slug(role) : "other");

async function main() {
  const config = JSON.parse(await readFile(new URL("scripts/companies.json", root)));
  const known = await readFile(new URL("public/data/discovered.json", root)).then(JSON.parse).catch(() => ({}));
  const listed = new Set(config.companies.map(c => c.name.toLowerCase()));
  const week = 7 * 864e5, now = Date.now();
  const toProbe = (config.discover || []).filter(n => !listed.has(n.toLowerCase()) && !(known[n] && (known[n].ats || now - Date.parse(known[n].checked) < week)));
  const found = await pool(toProbe, 8, async n => ({ n, hit: await discover(n) }));
  for (const { n, hit } of found.filter(Boolean)) known[n] = hit ? { ats: hit.ats, slug: hit.slug, checked: new Date().toISOString() } : { checked: new Date().toISOString() };
  console.log(`Discovery: checked ${toProbe.length}, found ${found.filter(f => f?.hit).length}`);
  const companies = [...config.companies, ...(config.discover || []).filter(n => !listed.has(n.toLowerCase()) && known[n]?.ats).map(n => ({ name: n, ats: known[n].ats, slug: known[n].slug }))];
  const previous = await readFile(new URL("public/data/jobs.json", root)).then(JSON.parse).catch(() => ({ jobs: [] }));
  const fresh = previous.updated && Date.now() - Date.parse(previous.updated) < 3 * 864e5;
  // Workday sites share servers and limit request rates, so they go one at a time.
  const collect = async c => {
    try {
      const found = (await fetchCompany(c)).filter(j => j.title && j.url && inIndia(`${j.location}; ${j.where}`)).slice(0, MAX_PER_COMPANY);
      return { c, status: "ok", jobs: found.map(j => normaliseJob({ ...j, location: inIndia(j.location) ? j.location : j.where })) };
    } catch (e) {
      // Keep the last openings for a few days if one board is briefly down.
      return { c, status: "skip", error: e.message, jobs: fresh ? previous.jobs.filter(j => j.company === c.name) : [] };
    }
  };
  const [others, slow] = await Promise.all([pool(companies.filter(c => c.ats !== "workday"), 8, collect), pool(companies.filter(c => c.ats === "workday"), 1, collect)]);
  const results = [...others, ...slow];
  const seen = new Set(), jobs = [];
  for (const r of results) for (const j of r.jobs) {
    const k = `${j.company}|${j.title}|${j.location}`.toLowerCase();
    if (!seen.has(k)) { seen.add(k); jobs.push(j); }
  }
  const report = results.map(r => ({ name: r.c.name, ats: r.c.ats, status: r.status, openings: r.status === "ok" ? r.jobs.length : 0, ...(r.error ? { error: r.error } : {}) }));
  report.forEach(r => console.log(`${r.status === "ok" ? "OK  " : "SKIP"}  ${r.name}: ${r.status === "ok" ? `${r.openings} India openings` : r.error}`));
  console.log(`Total: ${jobs.length} from ${report.filter(r => r.openings).length} employers`);
  if (!jobs.length) { console.error("No jobs collected. Existing file left unchanged."); process.exit(1); }
  const updated = new Date().toISOString();
  await writeFile(new URL("public/data/jobs.json", root), JSON.stringify({ updated, jobs }));
  await writeFile(new URL("public/data/discovered.json", root), JSON.stringify(known, null, 1));
  await writeFile(new URL("public/data/sources.json", root), JSON.stringify({ updated, sources: report }, null, 1));
  // Smaller files per kind of role, so phones download only what a student needs.
  const shards = {};
  for (const j of jobs) for (const r of j.roles.length ? j.roles : [""]) (shards[shardName(r)] ||= []).push(j);
  await mkdir(new URL("public/data/jobs/", root), { recursive: true });
  for (const f of await readdir(new URL("public/data/jobs/", root))) await rm(new URL(`public/data/jobs/${f}`, root));
  for (const [name, list] of Object.entries(shards)) await writeFile(new URL(`public/data/jobs/${name}.json`, root), JSON.stringify({ updated, jobs: list }));
}
if (process.argv[1]?.endsWith("fetch-jobs.mjs")) main();
