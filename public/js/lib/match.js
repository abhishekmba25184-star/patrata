// Reads eligibility criteria out of a job post and compares them with a profile.
import { findSkills, findCities, ROLE_FAMILIES } from "./skills.js";
import { DEGREES } from "./profile.js";

const SENIOR = /\b(senior|sr\.?|lead|head|director|principal|staff|vp|avp|dvp|vice president|chief(?! of staff)|architect|gm|general manager)\b/i;
const ENTRY = /\b(intern(ship)?|trainee|fresher|graduate|apprentice|entry.level|campus)\b/i;
const MANAGER = /\bmanager\b/i;
const JUNIOR_MANAGER = /\b(assistant|associate|trainee|management trainee)\b/i;

export function readCriteria(title, description = "") {
  const text = `${title}\n${description}`;
  let minExp = null, maxExp = null;
  const patterns = [
    /(\d{1,2})\s*(?:\+)?\s*(?:-|–|—|to)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i,
    /(?:minimum|min\.?|at least|atleast)\s*(?:of\s*)?(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i,
    /(\d{1,2})\s*\+\s*(?:years?|yrs?)/i,
    /(\d{1,2})\s*(?:or more\s*)?(?:years?|yrs?)['’]?\s*(?:of\s+)?(?:[\w/&-]+\s+){0,4}?experience/i,
    /experience\s*[:\-–]\s*(\d{1,2})\s*(?:years?|yrs?)/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && +m[1] <= 25) { minExp = +m[1]; if (m[2] && re === patterns[0]) maxExp = +m[2]; break; }
  }
  const fresherWelcome = /\bfreshers?\b[^.\n]{0,30}(welcome|can apply|eligible)|\b0\s*(?:-|–|to)\s*\d\s*(years?|yrs?)|no (prior )?experience (is )?(required|needed)/i.test(text) || ENTRY.test(title);

  const batches = new Set();
  for (const m of text.matchAll(/\b(20[2-3]\d)(?:\s*(?:\/|,|&|and|or)\s*(20[2-3]\d))?\s*(?:batch|pass.?outs?|passouts?|graduat(?:es?|ing))\b|\b(?:batch|class|pass.?outs?)\s*(?:of|:)?\s*(20[2-3]\d)(?:\s*(?:\/|,|&|and|or)\s*(20[2-3]\d))?|\bpass\s*-?\s*out\s*(20[2-3]\d)/gi))
    m.slice(1).filter(Boolean).forEach(y => batches.add(+y));

  const degrees = [], preferred = [];
  for (const sentence of text.split(/(?<=[.;])\s+|\n+/)) {
    const hits = DEGREES.filter(d => d.re.test(sentence)).map(d => d.id);
    if (/\bengineering (degree|graduate)|degree in (computer science|engineering)/i.test(sentence)) hits.push("btech");
    if (!hits.length) continue;
    const soft = /prefer|plus|bonus|advantage|desirable|good to have|nice to have|or equivalent|or related/i.test(sentence);
    hits.forEach(h => (soft ? preferred : degrees).push(h));
  }
  const cg = text.match(/(?:minimum|min\.?|at least|above)\s*(?:of\s*)?(\d(?:\.\d{1,2})?)\s*(?:\+\s*)?(?:CGPA|CPI|GPA)|(?:CGPA|CPI|GPA)\s*(?:of|:|>=?|above)?\s*(\d(?:\.\d{1,2})?)\s*(?:\+|and above|or above|or higher)|(?:minimum|min\.?|at least)\s*(?:of\s*)?(?:an?\s*)?(?:CGPA|CPI|GPA)\s*(?:of|:)?\s*(\d(?:\.\d{1,2})?)(?!\d)/i);

  return {
    minExp, maxExp, fresherWelcome,
    internship: /\bintern(ship)?\b/i.test(title),
    batches: [...batches].sort(),
    degrees: [...new Set(degrees)],
    preferredDegrees: [...new Set(preferred)],
    minCgpa: cg && +(cg[1] || cg[2] || cg[3]) <= 10 ? +(cg[1] || cg[2] || cg[3]) : null
  };
}

export function roleOf(title) {
  return Object.entries(ROLE_FAMILIES).filter(([, f]) => f.title.test(title)).map(([n]) => n);
}

// Converts any raw posting into the compact shape the website uses.
export function normaliseJob(raw) {
  const description = String(raw.description || "");
  return {
    id: raw.id, title: String(raw.title || "").trim(), company: raw.company,
    location: raw.location || "India", cities: findCities(`${raw.location || ""} ${raw.remote ? "remote" : ""}`),
    url: raw.url, source: raw.source, posted: raw.posted || null,
    summary: description.replace(/\s+/g, " ").trim().slice(0, 320),
    skills: findSkills(`${raw.title}\n${description}`).filter(s => s !== "Communication" && s !== "Leadership"),
    roles: roleOf(String(raw.title || "")),
    criteria: readCriteria(String(raw.title || ""), description)
  };
}

const label = id => DEGREES.find(d => d.id === id)?.label || id;

// verdict: "eligible" | "check" | "no"
export function checkEligibility(profile, job) {
  const c = job.criteria, checks = [];
  const add = (name, state, detail) => checks.push({ name, state, detail });
  const exp = profile.experienceYears || 0;
  const months = profile.experienceMonths ?? Math.round(exp * 12);
  const expText = months < 24 ? `${months} month${months === 1 ? "" : "s"}` : `${Math.round(exp * 10) / 10} years`;

  if (c.minExp !== null && c.minExp > 0) {
    const gap = c.minExp - exp;
    add("Experience", gap <= 0 ? "pass" : gap <= 1 ? "check" : "fail",
      `Asks for ${c.minExp}${c.maxExp ? ` to ${c.maxExp}` : "+"} years. Your full-time experience is ${expText}.`);
  } else if (c.fresherWelcome || c.minExp === 0) add("Experience", "pass", "Open to students or freshers.");

  if (!c.internship) {
    if (SENIOR.test(job.title) && exp < 3) add("Seniority", "fail", "The title indicates a senior role.");
    else if (MANAGER.test(job.title) && !JUNIOR_MANAGER.test(job.title) && exp < 2 && c.minExp === null)
      add("Seniority", "check", "Manager roles often expect prior experience.");
  }

  if (c.batches.length) {
    if (!profile.gradYear) add("Batch", "check", `Meant for the ${c.batches.join(", ")} batch. Add your graduation year.`);
    else add("Batch", c.batches.includes(profile.gradYear) ? "pass" : "fail", `Meant for the ${c.batches.join(", ")} batch. Yours is ${profile.gradYear}.`);
  }

  if (c.degrees.length) {
    const ok = c.degrees.some(d => profile.degrees.includes(d));
    add("Degree", ok ? "pass" : profile.degrees.length ? "fail" : "check", `Mentions ${c.degrees.map(label).join(" or ")}.`);
  }

  if (c.minCgpa) {
    const yours = [profile.cgpaUg != null && `UG ${profile.cgpaUg}`, profile.cgpaPg != null && `PG ${profile.cgpaPg}`].filter(Boolean).join(", ") || profile.cgpa;
    if (!profile.cgpa) add("CGPA", "check", `Asks for ${c.minCgpa} or higher. Add your CGPA.`);
    else add("CGPA", profile.cgpa >= c.minCgpa ? "pass" : "fail", `Asks for ${c.minCgpa} or higher. Yours: ${yours}.`);
  }

  let verdict = checks.some(x => x.state === "fail") ? "no" : checks.some(x => x.state === "check") ? "check" : checks.length ? "eligible" : "check";
  if (!checks.length) add("Criteria", "check", "The post does not state clear criteria. Read it before applying.");
  return { verdict, checks };
}

export function scoreJob(profile, job) {
  const matched = job.skills.filter(s => profile.skills.includes(s));
  const missing = job.skills.filter(s => !profile.skills.includes(s));
  const skill = job.skills.length ? matched.length / Math.max(job.skills.length, 3) : 0.25;
  const roleHit = job.roles.some(r => profile.roles.includes(r));
  const eligibility = checkEligibility(profile, job);
  const expFit = eligibility.verdict === "eligible" ? 1 : eligibility.verdict === "check" ? 0.6 : 0;
  const cityFit = !profile.cities.length || job.cities.includes("Remote") || job.cities.some(c => profile.cities.includes(c)) ? 1 : 0;
  const score = Math.round(skill * 45 + (roleHit ? 30 : 0) + expFit * 15 + cityFit * 10);
  return { job, score, matched, missing, roleHit, cityFit, ...eligibility };
}

export function rankJobs(profile, jobs) {
  const order = { eligible: 0, check: 1, no: 2 };
  const sorted = jobs.map(j => scoreJob(profile, j))
    .filter(r => r.roleHit || r.matched.length >= 2)
    .sort((a, b) => order[a.verdict] - order[b.verdict] || b.score - a.score);
  return spread(sorted);
}

// Within each verdict, a company's 4th opening onwards and repeats of the same title
// (one role posted in many cities) move behind openings from other employers.
export function spread(sorted, perCompany = 3) {
  const out = [], byCo = new Map(), titles = new Set();
  for (const v of ["eligible", "check", "no"]) {
    const group = sorted.filter(r => r.verdict === v), first = [], later = [];
    for (const r of group) {
      const co = String(r.job.company).toLowerCase();
      const t = `${co}|${String(r.job.title).toLowerCase().replace(/[^a-z]+/g, " ").replace(/\b(i{1,3}|iv)\b/g, "").trim()}`;
      const n = byCo.get(co) || 0;
      if (n >= perCompany || titles.has(t)) later.push(r);
      else { first.push(r); byCo.set(co, n + 1); titles.add(t); }
    }
    out.push(...first, ...later);
  }
  return out;
}

// Which single skill would add the most matching, reachable openings.
export function skillUnlocks(ranked, limit = 6) {
  const count = new Map();
  for (const r of ranked) if (r.verdict !== "no") for (const s of r.missing) count.set(s, (count.get(s) || 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1]).slice(0, limit);
}
