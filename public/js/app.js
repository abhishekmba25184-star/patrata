import { parseProfile, joinWrapped, DEGREES } from "./lib/profile.js";
import { rankJobs, normaliseJob, skillUnlocks } from "./lib/match.js";
import { SKILLS, ROLE_FAMILIES, CITIES, findSkills } from "./lib/skills.js";
import { readResume } from "./reader.js";
import { initImprove, refreshImprove } from "./improve.js";
import { portalLinks } from "./portals.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// Builds elements with textContent only, so job posts cannot inject HTML.
export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "class") n.className = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  n.append(...kids.flat().filter(k => k != null && k !== false));
  return n;
}
const safeUrl = u => (/^https?:\/\//i.test(u || "") ? u : "#");

const state = { text: "", profile: null, jobs: [], ranked: [], sample: false, updated: null, shown: 20, filter: { verdict: "", city: "", type: "", q: "" } };

/* ---------- upload ---------- */
const status = (msg, err = false) => { const s = $("#status"); s.textContent = msg; s.classList.toggle("err", err); };
function askConsent(msg) {
  status(msg, true);
  const row = $("#consentrow");
  row.classList.remove("nudge"); void row.offsetWidth; row.classList.add("nudge");
  $("#agree").focus();
}

const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = ms => new Promise(r => setTimeout(r, still ? 0 : ms));

// Shows what was found, one line at a time, before opening the details form.
async function useText(text) {
  state.text = joinWrapped(text);
  const p = state.profile = parseProfile(state.text);
  const label = id => DEGREES.find(d => d.id === id)?.label || id;
  const months = p.experienceMonths || 0;
  const lines = [
    `Read about ${state.text.split(/\s+/).length.toLocaleString("en-IN")} words`,
    p.degrees.length ? `Found ${p.degrees.map(label).join(", ")}${p.gradYear ? `, graduating ${p.gradYear}` : ""}` : "No degree found. You can add it below",
    months ? `${months} month${months === 1 ? "" : "s"} of full-time work${p.internshipMonths ? ` and ${p.internshipMonths} of internships` : ""}` : p.internshipMonths ? `${p.internshipMonths} months of internships` : "No full-time work found, so treated as a fresher",
    `${p.skills.length} skill${p.skills.length === 1 ? "" : "s"} recognised${p.cgpaPg || p.cgpaUg ? `, CGPA ${[p.cgpaUg && `UG ${p.cgpaUg}`, p.cgpaPg && `PG ${p.cgpaPg}`].filter(Boolean).join(" and ")}` : ""}`
  ];
  const box = $("#progress");
  box.replaceChildren();
  box.hidden = false;
  status("");
  for (const line of lines) { box.append(el("li", {}, line)); await wait(380); }
  status("Check your details below and correct anything we missed.");
  $("#workspace").hidden = false;
  fillProfile();
  await wait(250);
  $("#workspace").scrollIntoView();
}

async function handleFile(file) {
  if (!file) return;
  if (!$("#agree").checked) return askConsent("Tick the box above first, then choose your file.");
  status("Reading your resume…");
  try { await useText(await readResume(file)); } catch (e) { status(e.message || "The file could not be read.", true); }
}

$("#file").addEventListener("change", e => { handleFile(e.target.files[0]); e.target.value = ""; });
$("#pick").addEventListener("click", () => ($("#agree").checked ? $("#file").click() : askConsent("Tick the box above first, then choose your file.")));
$("#agree").addEventListener("change", e => { if (e.target.checked) status(""); });
const drop = $("#drop");
["dragover", "dragenter"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", e => handleFile(e.dataTransfer.files[0]));
$("#showpaste").addEventListener("click", () => { $("#pastebox").hidden = false; $("#paste").focus(); });
$("#usepaste").addEventListener("click", () => {
  if (!$("#agree").checked) return askConsent("Tick the box above first.");
  const t = $("#paste").value;
  if (t.trim().length < 150) return status("Paste the full resume text, not only a few lines.", true);
  useText(t);
});

/* ---------- profile ---------- */
function toggleChips(box, options, selected) {
  box.replaceChildren(...options.map(([value, label]) =>
    el("button", { type: "button", class: "chip", "aria-pressed": String(selected.includes(value)), onclick: e => {
      const i = selected.indexOf(value);
      i < 0 ? selected.push(value) : selected.splice(i, 1);
      e.target.setAttribute("aria-pressed", String(i < 0));
    } }, label)));
}
function skillChips() {
  const p = state.profile;
  $("#p-skills").replaceChildren(...p.skills.map(s =>
    el("button", { type: "button", class: "chip", "aria-label": `Remove ${s}`, onclick: () => { p.skills.splice(p.skills.indexOf(s), 1); skillChips(); } }, `${s}  ✕`)));
}
function fillProfile() {
  const p = state.profile;
  $("#p-year").value = p.gradYear || "";
  $("#p-exp").value = p.experienceMonths ?? Math.round((p.experienceYears || 0) * 12);
  $("#p-cgpa-ug").value = p.cgpaUg ?? "";
  $("#p-cgpa-pg").value = p.cgpaPg ?? "";
  $("#p-city").value = p.cities[0] || "";
  toggleChips($("#p-degrees"), DEGREES.map(d => [d.id, d.label]), p.degrees);
  toggleChips($("#p-roles"), Object.keys(ROLE_FAMILIES).map(r => [r, r]), p.roles);
  skillChips();
}
$("#addskill").addEventListener("submit", e => {
  e.preventDefault();
  const v = $("#newskill").value.trim();
  if (!v) return;
  const name = findSkills(v)[0] || Object.keys(SKILLS).find(s => s.toLowerCase() === v.toLowerCase()) || v;
  if (!state.profile.skills.includes(name)) state.profile.skills.push(name);
  $("#newskill").value = "";
  skillChips();
});

$("#find").addEventListener("click", async () => {
  const p = state.profile;
  p.gradYear = +$("#p-year").value || null;
  p.experienceMonths = Math.max(0, Math.round(+$("#p-exp").value || 0));
  p.experienceYears = Math.round((p.experienceMonths / 12) * 100) / 100;
  const score = id => { const v = +$(id).value; return v > 0 && v <= 10 ? v : null; };
  p.cgpaUg = score("#p-cgpa-ug"); p.cgpaPg = score("#p-cgpa-pg");
  const known = [p.cgpaUg, p.cgpaPg].filter(v => v != null);
  p.cgpa = known.length ? Math.min(...known) : null;
  p.cities = $("#p-city").value ? [$("#p-city").value] : [];
  if (!p.roles.length) { $("#findmsg").textContent = "Choose at least one kind of role."; return; }
  $("#findmsg").textContent = "";
  const btn = $("#find"); btn.disabled = true; btn.textContent = "Checking openings…";
  await loadJobs(p);
  state.ranked = rankJobs(p, state.jobs);
  state.shown = 20; state.filter.verdict = "";
  btn.disabled = false; btn.textContent = "Show my matching jobs";
  $("#output").hidden = false;
  state.fresh = true;
  render(); renderPortals(); refreshImprove();
  $("#output").scrollIntoView();
});

/* ---------- jobs ---------- */
async function getJson(url) {
  try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
}
async function loadJobs(p) {
  const city = p.cities[0] || "";
  const shard = r => (r ? r.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "other");
  const [shards, live] = await Promise.all([
    Promise.all([...p.roles, ""].map(r => getJson(`/data/jobs/${shard(r)}.json`))),
    Promise.all(p.roles.slice(0, 3).map(r => getJson(`/api/jobs?${new URLSearchParams({ role: r, city, level: p.experienceYears < 1 ? "entry" : "any" })}`)))
  ]);
  // Before the first daily refresh, the split files do not exist yet.
  const stored = shards.some(Boolean) ? { updated: shards.find(Boolean).updated, jobs: shards.flatMap(x => x?.jobs || []) } : await getJson("/data/jobs.json");
  let jobs = stored?.jobs || [];
  state.updated = stored?.updated || null;
  jobs = jobs.concat(live.flatMap(x => x?.jobs || []).map(normaliseJob));
  state.liveCount = live.reduce((n, x) => n + (x?.jobs?.length || 0), 0);
  state.sample = !jobs.length;
  if (state.sample) jobs = ((await getJson("/data/sample-jobs.json"))?.jobs || []).map(normaliseJob);
  const seen = new Set();
  state.jobs = jobs.filter(j => { const k = `${j.company}|${j.title}|${j.location}`.toLowerCase(); return !seen.has(k) && seen.add(k); });
}

const VERDICT = { eligible: "Eligible", check: "Check criteria", no: "Not eligible yet" };

function jobCard(r) {
  const j = r.job;
  const posted = j.posted ? new Date(j.posted).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;
  return el("article", { class: `job ${r.verdict}-v` },
    el("div", { class: "job-top" },
      el("div", {}, el("h3", {}, j.title), el("div", { class: "meta" }, el("strong", {}, j.company), el("span", {}, j.location), posted && el("span", {}, `Updated ${posted}`), el("span", {}, `Source: ${j.source}`))),
      el("div", {}, el("span", { class: `stamp ${r.verdict}` }, VERDICT[r.verdict]), el("div", { class: "fit" }, `${r.score}% fit`, el("div", { class: "meter", "aria-hidden": "true" }, el("span", { style: `width:${r.score}%` }))))),
    el("div", { class: "chips" }, r.matched.map(s => el("span", { class: "chip have" }, `✓ ${s}`)), r.missing.slice(0, 6).map(s => el("span", { class: "chip miss" }, `Not on resume: ${s}`))),
    el("details", {}, el("summary", {}, "Eligibility check and job summary"),
      el("ul", { class: "checks" }, r.checks.map(c => el("li", { class: c.state }, el("span", { class: "tick", "aria-label": c.state }), el("b", {}, c.name), el("span", {}, c.detail)))),
      j.summary && el("p", {}, j.summary.length >= 320 ? `${j.summary}…` : j.summary)),
    el("div", { class: "actions" },
      state.sample ? el("span", { class: "stamp check" }, "Example only") : el("a", { class: "btn small", href: safeUrl(j.url), target: "_blank", rel: "noopener nofollow" }, "Apply on source site"),
      el("button", { type: "button", class: "btn alt small", onclick: () => { selectTab("improve"); document.dispatchEvent(new CustomEvent("tailor", { detail: r })); } }, "Tailor my resume to this job")));
}

function filtered() {
  const f = state.filter, q = f.q.toLowerCase();
  return state.ranked.filter(r =>
    (!f.verdict || r.verdict === f.verdict) &&
    (!f.city || r.job.cities.includes(f.city)) &&
    (!f.type || (f.type === "intern") === r.job.criteria.internship) &&
    (!q || `${r.job.title} ${r.job.company}`.toLowerCase().includes(q)));
}
function render() {
  $("#samplenote").hidden = !state.sample;
  $("#freshness").textContent = state.updated ? `Career page openings last refreshed ${new Date(state.updated).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.` : "";
  $("#counts").replaceChildren(...Object.entries(VERDICT).map(([k, label]) =>
    el("button", { type: "button", class: k, "aria-pressed": String(state.filter.verdict === k), onclick: () => { state.filter.verdict = state.filter.verdict === k ? "" : k; state.shown = 20; render(); } },
      el("strong", { "data-n": state.ranked.filter(r => r.verdict === k).length }, String(state.ranked.filter(r => r.verdict === k).length)), label)));
  if (state.fresh && !still) {
    for (const n of $$("#counts strong")) {
      const target = +n.dataset.n, t0 = performance.now();
      const step = now => { const p = Math.min(1, (now - t0) / 700); n.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
  }
  const list = filtered();
  const cards = list.slice(0, state.shown).map(jobCard);
  if (state.fresh && !still) cards.slice(0, 8).forEach((c, k) => { c.classList.add("enter"); c.style.setProperty("--n", k); });
  state.fresh = false;
  $("#list").replaceChildren(...(list.length ? cards
    : [el("div", { class: "empty" }, el("h3", {}, "No jobs match these choices"), el("p", {}, "Clear a filter, add another kind of role, or open the More places to search tab."))]));
  $("#more").hidden = list.length <= state.shown;
  const unlocks = skillUnlocks(state.ranked);
  $("#unlockbox").hidden = !unlocks.length;
  $("#unlocks").replaceChildren(...unlocks.map(([s, n]) => el("li", {}, `${s}: asked in ${n} of your matches`)));
}
$("#more").addEventListener("click", () => { state.shown += 20; render(); });
$("#f-city").addEventListener("change", e => { state.filter.city = e.target.value; render(); });
$("#f-type").addEventListener("change", e => { state.filter.type = e.target.value; render(); });
$("#f-q").addEventListener("input", e => { state.filter.q = e.target.value; render(); });

function renderPortals() {
  $("#portals").replaceChildren(...portalLinks(state.profile).map(l =>
    el("a", { href: l.url, target: "_blank", rel: "noopener" }, el("strong", {}, l.name), el("span", {}, l.note))));
}

function selectTab(name) {
  $$(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  $$("[data-panel]").forEach(p => (p.hidden = p.dataset.panel !== name));
}
$$(".tabs button").forEach(b => b.addEventListener("click", () => selectTab(b.dataset.tab)));

for (const id of ["#p-city", "#f-city"]) $(id).append(...CITIES.map(c => el("option", { value: c }, c)));
$("#skilllist").append(...Object.keys(SKILLS).map(s => el("option", { value: s })));
initImprove(() => state);
