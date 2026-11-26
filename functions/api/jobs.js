// Live search through JSearch (Google for Jobs results, including posts from large job sites).
// Optional: works only when JSEARCH_API_KEY is set. Answers are cached for a day.
import { ROLE_FAMILIES, CITIES } from "../../public/js/lib/skills.js";

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });

export async function onRequestGet({ request, env, waitUntil }) {
  const u = new URL(request.url);
  const role = u.searchParams.get("role") || "";
  const city = u.searchParams.get("city") || "";
  // Only fixed choices are accepted, so nobody can burn the quota with random searches.
  if (!ROLE_FAMILIES[role] || (city && !CITIES.includes(city))) return json({ jobs: [], error: "Unknown search." }, 400);
  if (!env.JSEARCH_API_KEY) return json({ jobs: [], live: false });

  const entry = u.searchParams.get("level") === "entry";
  const key = new Request(`${u.origin}/cache/jobs?${new URLSearchParams({ role, city, entry })}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit;

  const query = `${ROLE_FAMILIES[role].query}${entry ? " fresher" : ""} jobs in ${city && city !== "Remote" ? city : "India"}`;
  const api = new URL("https://api.openwebninja.com/jsearch/search-v2");
  api.search = new URLSearchParams({ query, country: "in", date_posted: "month", ...(city === "Remote" ? { work_from_home: "true" } : {}) });
  let jobs = [], ok = false;
  try {
    const r = await fetch(api, { headers: { "x-api-key": env.JSEARCH_API_KEY } });
    if (r.ok) { jobs = mapJobs(await r.json()); ok = true; }
    else console.log("JSearch error", r.status);
  } catch (e) { console.log("JSearch failed", e.message); }

  const res = json({ jobs, live: ok }, 200, { "cache-control": `public, max-age=${ok ? 86400 : 900}` });
  waitUntil(cache.put(key, res.clone()));
  return res;
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
