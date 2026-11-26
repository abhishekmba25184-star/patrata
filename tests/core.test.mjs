import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProfile, redact, joinWrapped } from "../public/js/lib/profile.js";
import { readCriteria, normaliseJob, checkEligibility, rankJobs } from "../public/js/lib/match.js";
import { guardNumbers, reviewResume } from "../public/js/lib/ats.js";
import { findSkills } from "../public/js/lib/skills.js";
import { fromGreenhouse, fromLever, inIndia } from "../scripts/fetch-jobs.mjs";
import { mapJobs, onRequestGet } from "../functions/api/jobs.js";
import { onRequestPost } from "../functions/api/improve.js";

export const RESUME = `Asha Verma
asha.verma@example.com | +91 98765 43210 | linkedin.com/in/ashaverma
Jaipur, Rajasthan
Education
MBA (Finance), Example Institute of Management 2025 - 2027  CGPA: 7.8/10
B.Com (Hons), Example University 2021 - 2024  72%
Work Experience
Accounts Associate, Sample Traders   Jul 2024 - Jun 2025
• Prepared monthly GST returns for 14 clients and reduced filing errors
• Responsible for vendor reconciliation
Internships
Finance Intern, Demo Capital   Apr 2026 - Jun 2026
• Built a DCF valuation model in Excel for 3 listed companies
• Analysed ratio trends and presented findings to the investment team
Projects
• Created a Power BI dashboard tracking portfolio returns across 12 months
Skills
Financial Modelling, Valuation, Excel, Power BI, SQL, Accounting, PowerPoint
Positions of Responsibility
Coordinator, Finance Club`;
const now = new Date(2026, 10, 26);
const p = parseProfile(RESUME, now);

test("reads the profile", () => {
  assert.equal(p.name, "Asha Verma");
  assert.equal(p.gradYear, 2027);
  assert.equal(p.cgpa, 7.8);
  assert.deepEqual(p.degrees.sort(), ["bcom", "mba"]);
  assert.equal(p.experienceYears, 1);
  assert.equal(p.internshipMonths, 3);
  assert.ok(p.skills.includes("Valuation") && p.skills.includes("Taxation"));
  assert.equal(p.roles[0], "Finance");
  assert.deepEqual(p.cities, ["Jaipur"]);
});
test("joins wrapped points", () => {
  assert.equal(joinWrapped("• Built a model for\nthree companies\nProjects"), "• Built a model for three companies\nProjects");
});
test("removes identifiers before AI", () => {
  const r = redact(RESUME, p.name);
  for (const s of ["asha.verma@", "98765", "linkedin.com/in", "Asha", "Verma"]) assert.ok(!r.includes(s), s);
  assert.ok(r.includes("14 clients") && r.includes("2025 - 2027"));
});
test("avoids false skills", () => {
  assert.deepEqual(findSkills("We go the extra mile. R&D team. Express yourself."), []);
  assert.ok(findSkills("Skills: Python, R, SQL").includes("R"));
});
test("reads criteria", () => {
  assert.equal(readCriteria("Analyst", "3-5 years of experience").minExp, 3);
  assert.equal(readCriteria("Analyst", "Minimum 2 years in audit").minExp, 2);
  assert.equal(readCriteria("Analyst", "4+ yrs").minExp, 4);
  assert.deepEqual(readCriteria("Trainee", "Only 2026/2027 batch may apply").batches, [2026, 2027]);
  assert.deepEqual(readCriteria("Dev", "B.Tech required.").degrees, ["btech"]);
  assert.deepEqual(readCriteria("Dev", "MBA preferred.").degrees, []);
  assert.equal(readCriteria("A", "Minimum CGPA 7").minCgpa ?? readCriteria("A", "CGPA of 7 and above").minCgpa, 7);
  assert.equal(readCriteria("A", "We were founded 10 years ago.").minExp, null);
});
const job = (title, description) => normaliseJob({ id: title, title, company: "X", location: "Mumbai", url: "https://x.test", source: "t", description });
test("judges eligibility", () => {
  assert.equal(checkEligibility(p, job("Finance Analyst", "0-2 years. MBA. Excel.")).verdict, "eligible");
  assert.equal(checkEligibility(p, job("Senior Finance Manager", "Excel")).verdict, "no");
  assert.equal(checkEligibility(p, job("Finance Analyst", "5+ years of experience")).verdict, "no");
  assert.equal(checkEligibility(p, job("Finance Analyst", "2 years of experience")).verdict, "check");
  assert.equal(checkEligibility(p, job("Management Trainee", "2025 batch only")).verdict, "no");
  assert.equal(checkEligibility(p, job("Finance Analyst", "Great team.")).verdict, "check");
  assert.equal(checkEligibility(p, job("Developer", "B.Tech required. Freshers welcome.")).verdict, "no");
});
test("ranks relevant eligible jobs first", () => {
  const r = rankJobs(p, [job("Senior Finance Lead", "valuation excel"), job("Finance Intern", "Excel valuation"), job("Chef", "cooking")]);
  assert.equal(r.length, 2);
  assert.equal(r[0].job.title, "Finance Intern");
});
test("guards invented numbers and scores resume", () => {
  assert.equal(guardNumbers("Served 14 clients", "Served 14 clients, cutting errors 30%"), "Served 14 clients, cutting errors [add figure]%");
  const s = reviewResume(RESUME, p).score;
  assert.ok(s > 40 && s <= 100, String(s));
});
test("maps career board data and keeps India only", () => {
  const g = fromGreenhouse({ jobs: [{ id: 1, title: "Analyst", location: { name: "Bengaluru" }, absolute_url: "https://a.test", content: "&lt;p&gt;2+ years &amp;amp; SQL&lt;/p&gt;" }] }, "A")[0];
  assert.equal(g.description, "2+ years & SQL");
  assert.equal(fromLever([{ id: "2", text: "T", categories: { location: "Pune" }, hostedUrl: "https://b.test", lists: [] }], "B")[0].location, "Pune");
  assert.ok(inIndia("Gurugram") && !inIndia("Remote - US") && !inIndia("London"));
});

const store = new Map();
globalThis.caches = { default: { match: async k => store.get(k.url)?.clone(), put: async (k, v) => store.set(k.url, v) } };
const waitUntil = p => p;
test("live search function validates, caches and works without a key", async () => {
  const call = (q, env) => onRequestGet({ request: new Request(`https://s.test/api/jobs?${q}`), env, waitUntil });
  assert.equal((await call("role=hack", {})).status, 400);
  assert.deepEqual(await (await call("role=Finance", {})).json(), { jobs: [], live: false });
  let calls = 0;
  globalThis.fetch = async () => (calls++, Response.json({ data: { jobs: [{ job_id: "1", job_title: "Analyst", employer_name: "C", job_apply_link: "https://c.test", job_publisher: "LinkedIn", job_city: "Pune" }] } }));
  const a = await (await call("role=Finance&city=Pune", { JSEARCH_API_KEY: "k" })).json();
  await call("role=Finance&city=Pune", { JSEARCH_API_KEY: "k" });
  assert.equal(a.jobs[0].source, "LinkedIn"); assert.equal(calls, 1);
  assert.equal(mapJobs({ data: [{ job_title: "x", employer_name: "y", job_apply_link: "javascript:1" }] }).length, 0);
});
test("AI function enforces consent, origin and daily limit", async () => {
  store.clear();
  const call = (body, env = { GEMINI_API_KEY: "k", DAILY_AI_LIMIT: "1" }, headers = {}) => onRequestPost({ request: new Request("https://s.test/api/improve", { method: "POST", body: JSON.stringify(body), headers }), env, waitUntil });
  const good = { consent: true, resume: "x".repeat(200), bullets: ["a"] };
  assert.equal((await call(good, {})).status, 503);
  assert.equal((await call({ ...good, consent: false })).status, 400);
  assert.equal((await call(good, undefined, { origin: "https://evil.test" })).status, 403);
  globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: '{"summary":"s","rewrites":[{"index":0,"improved":"b","why":"w"}],"advice":[]}' }] } }] });
  assert.equal((await call(good)).status, 200);
  assert.equal((await call(good)).status, 429);
});
