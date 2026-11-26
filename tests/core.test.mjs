import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProfile, redact, joinWrapped } from "../public/js/lib/profile.js";
import { readCriteria, normaliseJob, checkEligibility, rankJobs } from "../public/js/lib/match.js";
import { guardNumbers, reviewResume } from "../public/js/lib/ats.js";
import { findSkills } from "../public/js/lib/skills.js";
import { fromGreenhouse, fromLever, inIndia, fromSmartRecruiters, fromWorkday, indiaFacet, shardName } from "../scripts/fetch-jobs.mjs";
import { mapJobs, mapCareerjet, onRequestGet } from "../functions/api/jobs.js";
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
  assert.equal(p.cgpaPg, 7.8);
  assert.deepEqual(p.degrees.sort(), ["bcom", "mba"]);
  assert.equal(p.experienceMonths, 12);
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

test("reads CGPA per degree and stated experience in Indian layouts", () => {
  const t = (s) => parseProfile(joinWrapped(s), now);
  const a = t(`A B\nACADEMIC QUALIFICATIONS\nDegree Institute Year CGPA/%\nMBA IIM Kashipur 2025-2027 8.1\nB.Sc Example University 2019-2022 7.38\nClass XII CBSE 2019 89%\nClass X CBSE 2017 9.4\nWORK EXPERIENCE 13 Months\nAnalyst, Example Bank Jul'23 - Jul'24`);
  assert.deepEqual([a.cgpaPg, a.cgpaUg, a.cgpa, a.experienceMonths], [8.1, 7.38, 7.38, 13]);
  const b = t(`A B\nEDUCATION\nYear Degree Institute CGPA\n2025-2027 MBA IIM 8.1/10\n2019-2022 B.Sc College 7.38/10\nPROFESSIONAL EXPERIENCE (1 year 1 month)\nAssociate | Acme | June 2023 – June 2024`);
  assert.deepEqual([b.cgpaPg, b.cgpaUg, b.experienceMonths], [8.1, 7.38, 13]);
  const c = t(`A B\nEducation\nMBA, IIM, 2025 - 2027, CGPA: 8.1\nB.Sc, DU, 2019 - 2022, CGPA 7.38\nWork Experience\nData Analyst, Acme, Jun 2023 - Jun 2024\nInternships\nSummer Intern, Beta, Apr 2026 - May 2026`);
  assert.deepEqual([c.cgpaPg, c.cgpaUg, c.experienceMonths, c.internshipMonths], [8.1, 7.38, 13, 2]);
  const j = normaliseJob({ id: 1, title: "Analyst", company: "X", location: "Pune", url: "https://x.test", source: "t", description: "Minimum CGPA 7.5. 1-3 years of experience." });
  const r = checkEligibility(a, j);
  assert.equal(r.verdict, "no");
  assert.ok(r.checks.find(x => x.name === "CGPA").detail.includes("UG 7.38, PG 8.1"));
  assert.ok(r.checks.find(x => x.name === "Experience").detail.includes("13 months"));
});
test("maps SmartRecruiters, Workday and Careerjet data", () => {
  const sr = fromSmartRecruiters([{ id: "9", name: "Graduate Trainee", releasedDate: "2026-11-01", location: { fullLocation: "Pune, Maharashtra, India" }, experienceLevel: { label: "Entry Level" } }],
    [{ postingUrl: "https://jobs.smartrecruiters.com/X/9", jobAd: { sections: { jobDescription: { text: "<p>Excel&#xa0;and SQL</p>" } } } }], "X", "X")[0];
  assert.equal(sr.location, "Pune, Maharashtra, India"); assert.ok(sr.description.includes("Excel and SQL") && sr.description.includes("Entry Level"));
  assert.deepEqual(indiaFacet([{ facetParameter: "locationMainGroup", values: [{ facetParameter: "locationCountry", values: [{ descriptor: "Spain", id: "s" }, { descriptor: "India", id: "in1" }] }] }]), { param: "locationCountry", id: "in1" });
  const wd = fromWorkday([{ title: "Analyst", externalPath: "/job/Bangalore/Analyst_R1", locationsText: "Bangalore" }], [null], "W", { host: "w.wd5.myworkdayjobs.com", tenant: "w", site: "Ext" })[0];
  assert.equal(wd.url, "https://w.wd5.myworkdayjobs.com/en-US/Ext/job/Bangalore/Analyst_R1");
  assert.equal(mapCareerjet({ jobs: [{ title: "Sales", company: "C", locations: "Delhi", url: "https://www.careerjet.co.in/jobad/1", date: "bad" }] })[0].posted, null);
  assert.equal(shardName("Sales and Business Development"), "sales-and-business-development");
});
test("Careerjet search sends the visitor's IP and key", async () => {
  let seen;
  globalThis.fetch = async (url, init) => { seen = { url: String(url), auth: init.headers.authorization }; return Response.json({ type: "JOBS", jobs: [{ title: "Finance Analyst", company: "C", locations: "Mumbai", url: "https://www.careerjet.co.in/x", description: "<b>Excel</b>" }] }); };
  const r = await onRequestGet({ request: new Request("https://s.test/api/jobs?role=Finance&city=Mumbai&level=entry", { headers: { "cf-connecting-ip": "1.2.3.4", "user-agent": "UA" } }), env: { CAREERJET_API_KEY: "key" }, waitUntil });
  const body = await r.json();
  assert.equal(body.jobs[0].source, "Careerjet");
  assert.ok(seen.url.includes("user_ip=1.2.3.4") && seen.url.includes("locale_code=en_IN") && seen.url.includes("location=Mumbai"));
  assert.equal(seen.auth, `Basic ${btoa("key:")}`);
});
