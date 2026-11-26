// Live search. Optional sources, each switched on by adding its key in Cloudflare:
// CAREERJET_API_KEY (free, Careerjet India) and JSEARCH_API_KEY (Google for Jobs, paid beyond the free plan).
import { ROLE_FAMILIES, CITIES } from "../../public/js/lib/skills.js";

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });

export async function onRequestGet({ request, env, waitUntil }) {
  const u = new URL(request.url);
  const role = u.searchParams.get("role") || "";
  const city = u.searchParams.get("city") || "";
  // Only fixed choices are accepted, so nobody can burn the quota with random searches.
  if (!ROLE_FAMILIES[role] || (city && !CITIES.includes(city))) return json({ jobs: [], error: "Unknown search." }, 400);
  const entry = u.searchParams.get("level") === "entry";
  const [a, b] = await Promise.all([
    env.JSEARCH_API_KEY ? jsearch({ u, env, waitUntil, role, city, entry }) : [],
    env.CAREERJET_API_KEY ? careerjet({ request, env, role, city, entry }) : []
  ]);
  const jobs = [...a, ...b];
  return json({ jobs, live: jobs.length > 0 }, 200, { "cache-control": "private, max-age=600" });
}

async function jsearch({ u, env, waitUntil, role, city, entry }) {
  const key = new Request(`${u.origin}/cache/jobs?${new URLSearchParams({ role, city, entry })}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return (await hit.json()).jobs || [];
  const query = `${ROLE_FAMILIES[role].query}${entry ? " fresher" : ""} jobs in ${city && city !== "Remote" ? city : "India"}`;
  const api = new URL("https://api.openwebninja.com/jsearch/search-v2");
  api.search = new URLSearchParams({ query, country: "in", date_posted: "month", ...(city === "Remote" ? { work_from_home: "true" } : {}) });
  let jobs = [], ok = false;
  try {
    const r = await fetch(api, { headers: { "x-api-key": env.JSEARCH_API_KEY } });
    if (r.ok) { jobs = mapJobs(await r.json()); ok = true; }
    else console.log("JSearch error", r.status);
  } catch (e) { console.log("JSearch failed", e.message); }
  waitUntil(cache.put(key, json({ jobs }, 200, { "cache-control": `public, max-age=${ok ? 86400 : 900}` })));
  return jobs;
}

// Careerjet search engine (free publisher key). It asks for the visitor's IP and browser,
// so results are fetched per visit and not shared between visitors.
async function careerjet({ request, env, role, city, entry }) {
  const params = new URLSearchParams({
    locale_code: "en_IN", keywords: `${ROLE_FAMILIES[role].query}${entry ? " fresher" : ""}`, sort: "date",
    page_size: "100", fragment_size: "600",
    user_ip: request.headers.get("cf-connecting-ip") || "0.0.0.0",
    user_agent: request.headers.get("user-agent") || "Mozilla/5.0"
  });
  if (city && city !== "Remote") params.set("location", city === "Delhi NCR" ? "Delhi" : city);
  else if (city === "Remote") params.set("keywords", `${params.get("keywords")} remote`);
  try {
    const r = await fetch(`https://search.api.careerjet.net/v4/query?${params}`, { headers: { authorization: `Basic ${btoa(`${env.CAREERJET_API_KEY}:`)}` } });
    if (!r.ok) { console.log("Careerjet error", r.status, await r.text()); return []; }
    return mapCareerjet(await r.json());
  } catch (e) { console.log("Careerjet failed", e.message); return []; }
}

export function mapCareerjet(body) {
  return (body?.jobs || []).map((j, k) => ({
    id: `cj-${String(j.url || k).slice(-40)}`, title: j.title, company: j.company || "Employer not named",
    location: j.locations || "India", url: j.url, source: "Careerjet", posted: Number.isNaN(Date.parse(j.date)) ? null : new Date(j.date).toISOString(),
    description: String(j.description || "").replace(/<[^>]+>/g, " ")
  })).filter(j => j.title && /^https?:\/\//.test(j.url || ""));
}

export function mapJobs(body) {
  const list = Array.isArray(body?.data) ? body.data : body?.data?.jobs || [];
  return list.map(j => ({
    id: j.job_id, title: j.job_title, company: j.employer_name,
    location: j.job_location || [j.job_city, j.job_state].filter(Boolean).join(", ") || "India",
    remote: Boolean(j.job_is_remote), url: j.job_apply_link,
    source: j.job_publisher || "Google for Jobs", posted: j.job_posted_at_datetime_utc || null,
    description: String(j.job_description || "").slice(0, 6000)
  })).filter(j => j.title && j.company && /^https?:\/\//.test(j.url || ""));
}
