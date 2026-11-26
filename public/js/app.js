import { parseProfile, joinWrapped, DEGREES } from "./lib/profile.js";
import { rankJobs, normaliseJob, skillUnlocks, scoreJob } from "./lib/match.js";
import { SKILLS, ROLE_FAMILIES, CITIES, findSkills } from "./lib/skills.js";
import { readResume } from "./reader.js";
import { initImprove, refreshImprove } from "./improve.js";
import { portalLinks } from "./portals.js";
import { isSaved, toggleSaved, shareLink } from "./lib/store.js";

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

const state = { text: "", profile: null, jobs: [], ranked: [], sample: false, updated: null, shown: 20, filter: { verdict: "", city: "", type: "", q: "", role: "" } };

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
  const fresh = j.posted && Date.now() - Date.parse(j.posted) < 7 * 864e5;
  return el("article", { class: `job ${r.verdict}-v` },
    el("div", { class: "job-top" },
      el("div", {}, el("h3", {}, fresh && el("span", { class: "new" }, "New"), j.title), el("div", { class: "meta" }, el("strong", {}, j.company), el("span", {}, j.location), posted && el("span", {}, `Updated ${posted}`), el("span", {}, `Source: ${j.source}`))),
      el("div", {}, el("span", { class: `stamp ${r.verdict}` }, VERDICT[r.verdict]), el("div", { class: "fit" }, `${r.score}% fit`, el("div", { class: "meter", "aria-hidden": "true" }, el("span", { style: `width:${r.score}%` }))))),
    el("div", { class: "chips" }, r.matched.map(s => el("span", { class: "chip have" }, `✓ ${s}`)), r.missing.slice(0, 6).map(s => el("span", { class: "chip miss" }, `Not on resume: ${s}`))),
    el("details", {}, el("summary", {}, "Eligibility check and job summary"),
      el("ul", { class: "checks" }, r.checks.map(c => el("li", { class: c.state }, el("span", { class: "tick", "aria-label": c.state }), el("b", {}, c.name), el("span", {}, c.detail)))),
      j.summary && el("p", {}, j.summary.length >= 320 ? `${j.summary}…` : j.summary)),
    el("div", { class: "actions" },
      state.sample ? el("span", { class: "stamp check" }, "Example only") : el("a", { class: "btn small", href: safeUrl(j.url), target: "_blank", rel: "noopener nofollow" }, "Apply on source site"),
      el("button", { type: "button", class: "btn alt small", onclick: () => { selectTab("improve"); document.dispatchEvent(new CustomEvent("tailor", { detail: r })); } }, "Tailor my resume to this job"),
      !state.sample && el("button", { type: "button", class: `btn alt small save${isSaved(j.id) ? " on" : ""}`, "aria-pressed": String(isSaved(j.id)), onclick: e => {
        const on = toggleSaved(j); e.currentTarget.classList.toggle("on", on); e.currentTarget.setAttribute("aria-pressed", String(on)); e.currentTarget.textContent = on ? "Saved ✓" : "Save";
      } }, isSaved(j.id) ? "Saved ✓" : "Save"),
      !state.sample && el("a", { class: "btn alt small", href: shareLink(j), target: "_blank", rel: "noopener" }, "Share on WhatsApp")));
}

function filtered() {
  const f = state.filter, q = f.q.toLowerCase();
  return state.ranked.filter(r =>
    (!f.verdict || r.verdict === f.verdict) &&
    (!f.city || r.job.cities.includes(f.city)) &&
    (!f.type || (f.type === "intern") === r.job.criteria.internship) &&
    (!f.role || r.job.roles.includes(f.role)) &&
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
  // Specialisation chips: counts within the current verdict filter.
  const roleCount = new Map();
  for (const r of state.ranked) if (!state.filter.verdict || r.verdict === state.filter.verdict) for (const x of r.job.roles) roleCount.set(x, (roleCount.get(x) || 0) + 1);
  const roles = [...roleCount].sort((a, b) => b[1] - a[1]);
  $("#specbox").hidden = roles.length < 2;
  $("#specchips").replaceChildren(
    el("button", { type: "button", class: "chip", "aria-pressed": String(!state.filter.role), onclick: () => { state.filter.role = ""; state.shown = 20; render(); } }, "All"),
    ...roles.map(([name, n]) => el("button", { type: "button", class: "chip", "aria-pressed": String(state.filter.role === name), onclick: () => { state.filter.role = state.filter.role === name ? "" : name; state.shown = 20; render(); } }, `${name} (${n})`)));
  const unlocks = skillUnlocks(state.ranked);
  $("#unlockbox").hidden = !unlocks.length;
  const learn = sk => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${sk} full course for beginners`)}`;
  $("#unlocks").replaceChildren(...unlocks.map(([sk, n]) => el("li", {}, el("b", {}, sk), ` asked in ${n} of your matches. `, el("a", { href: learn(sk), target: "_blank", rel: "noopener" }, "Learn free"))));
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

/* ---------- check a pasted job post ---------- */
// Reads criteria from any pasted post and compares them with the student's details.
$("#postcheck").addEventListener("click", () => {
  const text = $("#posttext").value.trim();
  const msg = $("#postmsg");
  if (text.length < 60) { msg.textContent = "Paste the full post, including the role and requirements."; msg.classList.add("err"); return; }
  msg.textContent = ""; msg.classList.remove("err");
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const titleLine = lines.find(l => /analyst|associate|intern|manager|engineer|executive|trainee|developer|consultant|officer|specialist|lead|designer/i.test(l)) || lines[0];
  const title = titleLine.replace(/^[^\w]+/, "").slice(0, 90);
  const links = [...new Set(text.match(/https?:\/\/[^\s)>\]]+/g) || [])].slice(0, 8);
  const job = normaliseJob({ id: "post", title, company: "From pasted post", location: text, url: links[0] || "", source: "Pasted post", description: text });
  const r = scoreJob(state.profile, job);
  const VERD = { eligible: "Eligible", check: "Check criteria", no: "Not eligible yet" };
  $("#postout").hidden = false;
  $("#postout").replaceChildren(el("div", { class: "slip in" },
    el("header", {}, el("div", {}, el("h2", {}, title), el("p", {}, job.cities.length ? job.cities.join(", ") : "Location not stated")), el("span", { class: `stamp ${r.verdict}` }, VERD[r.verdict])),
    el("div", { class: "body" },
      el("ul", { class: "checks" }, r.checks.map((c, n) => el("li", { class: c.state, style: `--n:${n}` }, el("span", { class: "tick", "aria-label": c.state }), el("b", {}, c.name), el("span", {}, c.detail)))),
      el("div", { class: "chips", style: "margin-top:14px" }, r.matched.map(s => el("span", { class: "chip have" }, `✓ ${s}`)), r.missing.slice(0, 8).map(s => el("span", { class: "chip miss" }, `Not on resume: ${s}`))),
      emailApply(text, title),
      links.length && el("div", { class: "postlinks" }, el("h3", {}, "Links in the post"), el("ul", {}, links.map(u => el("li", {}, el("a", { href: safeUrl(u), target: "_blank", rel: "noopener nofollow" }, u))))),
      el("p", { class: "actions", style: "margin-top:16px" }, el("button", { type: "button", class: "btn alt small", onclick: () => { selectTab("improve"); $("#jd").value = text; $("#jd").dispatchEvent(new Event("input")); } }, "Tailor my resume to this post")))));
});

// Posts that ask candidates to email a CV: find the address, the details asked for,
// and draft the email in the student's own mail app.
const FREE_MAIL = /@(gmail|yahoo|outlook|hotmail|rediffmail|ymail|live|icloud|proton(mail)?)\./i;
const ASKS = [
  [/current\s*ctc|present\s*ctc|current\s*salary/i, "Current CTC", () => "[your current CTC, or Fresher]"],
  [/expected\s*ctc|expected\s*salary/i, "Expected CTC", () => "[your expected CTC]"],
  [/notice\s*period/i, "Notice period", p => (p.experienceMonths ? "[your notice period]" : "Available to join immediately after graduation")],
  [/current\s*location|present\s*location/i, "Current location", p => p.cities[0] || "[your city]"],
  [/contact\s*(number|no)|mobile|phone/i, "Contact number", p => p.phone || "[your mobile number]"],
  [/total\s*experience|years? of experience/i, "Total experience", p => (p.experienceMonths ? `${p.experienceMonths} months` : "Fresher")],
  [/qualification|education/i, "Qualification", p => p.degrees.map(id => DEGREES.find(d => d.id === id)?.label || id).join(", ") || "[your degree]"]
];
function emailApply(text, title) {
  const emails = [...new Set((text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).map(e => e.replace(/[.,;]+$/, "")))];
  if (!emails.length) return null;
  const p = state.profile || {};
  const to = emails[0];
  const asked = ASKS.filter(([re]) => re.test(text));
  const name = p.name || "[your name]";
  const subject = `Application for ${title.split("|")[0].trim()} – ${name}`;
  const body = [
    "Dear Hiring Team,", "",
    `I came across your post for ${title.split("|")[0].trim()} and would like to apply. My resume is attached.`, "",
    ...(asked.length ? [...asked.map(([, label, fill]) => `${label}: ${fill(p)}`), ""] : []),
    `Education: ${(p.degrees || []).map(id => DEGREES.find(d => d.id === id)?.label || id).join(", ") || "[your degree]"}${p.gradYear ? ` (${p.gradYear})` : ""}`,
    `Key skills: ${(p.skills || []).slice(0, 6).join(", ") || "[your skills]"}`, "",
    "I would be glad to discuss how I can contribute. Thank you for your time.", "",
    "Regards,", name, p.phone || "[your mobile number]", p.email || ""
  ].join("\n");
  const free = FREE_MAIL.test(to);
  return el("div", { class: "mailapply" },
    el("h3", {}, "This post asks you to apply by email"),
    el("p", {}, "Send to: ", el("b", {}, to), emails.length > 1 ? ` (also mentioned: ${emails.slice(1).join(", ")})` : ""),
    asked.length && el("p", {}, `The recruiter asked for: ${asked.map(([, l]) => l.toLowerCase()).join(", ")}. These are in the draft below; fill in the parts in brackets.`),
    free && el("p", { class: "warnline" }, "Careful: this is a personal email address, not a company one. Check the recruiter's profile, and never pay any fee to apply."),
    el("label", { class: "f", for: "maildraft", style: "margin-top:10px" }, "Draft email"),
    el("textarea", { id: "maildraft" }, body),
    el("p", { class: "actions", style: "margin-top:10px" },
      el("a", { class: "btn small", href: "#", onclick: e => { e.preventDefault(); location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent($("#maildraft").value)}`; } }, "Open in my email app"),
      el("button", { type: "button", class: "btn alt small", onclick: async e => { try { await navigator.clipboard.writeText($("#maildraft").value); e.target.textContent = "Copied ✓"; } catch { $("#maildraft").select(); } } }, "Copy the email")),
    el("p", { class: "fineprint" }, "Attach your resume yourself in your email app before sending."));
}
