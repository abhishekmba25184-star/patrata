// ATS score checker page. Everything runs in the browser.
import { readResume } from "./reader.js";
import { parseProfile, joinWrapped } from "./lib/profile.js";
import { atsReport } from "./lib/ats.js";

const $ = s => document.querySelector(s);
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k.startsWith("on") ? n.addEventListener(k.slice(2), v) : n.setAttribute(k, v);
  n.append(...kids.flat().filter(k => k !== null && k !== undefined && k !== false));
  return n;
};
const msg = (t, err = false) => { $("#atsmsg").textContent = t; $("#atsmsg").classList.toggle("err", err); };
let file = null, fileText = "", fileExt = "", last = null;

function askConsent() {
  msg("Tick the box above first.", true);
  const row = $("#atsconsent");
  row.classList.remove("nudge"); void row.offsetWidth; row.classList.add("nudge");
  $("#atsagree").focus();
}

async function takeFile(f) {
  if (!f) return;
  if (!$("#atsagree").checked) return askConsent();
  msg("Reading your resume…");
  try {
    fileText = await readResume(f);
    file = f; fileExt = f.name.split(".").pop().toLowerCase();
    $("#atsfilename").hidden = false;
    $("#atsfilename").textContent = `${f.name} is ready`;
    $("#atspastebox").hidden = true; $("#atstext").value = "";
    msg("");
    run();
  } catch (e) { msg(e.message || "The file could not be read.", true); }
}

function run() {
  if (!$("#atsagree").checked) return askConsent();
  const pasted = $("#atstext").value.trim();
  const raw = pasted.length >= 150 ? pasted : fileText;
  if (!raw) return msg(pasted ? "Paste the full resume text, not only a few lines." : "Choose your resume file first, or paste its text.", true);
  const text = joinWrapped(raw);
  const profile = parseProfile(text);
  last = { text, profile };
  render(atsReport(text, profile, $("#atsjd").value, { ext: pasted.length >= 150 ? "" : fileExt }));
  msg("");
  if (innerWidth < 900) $("#atsout").scrollIntoView({ behavior: still ? "auto" : "smooth" });
}

function render(r) {
  const g = $("#gauge");
  g.classList.remove("empty");
  g.dataset.grade = r.grade.toLowerCase().replace(/\s/g, "");
  const fill = $("#gaugefill");
  fill.style.strokeDasharray = `0 100`;
  requestAnimationFrame(() => requestAnimationFrame(() => (fill.style.strokeDasharray = `${r.score} 100`)));
  countTo($("#gscore"), r.score);
  const toFix = r.groups.filter(x => x.state !== "pass").length;
  $("#ggrade").textContent = toFix ? `${r.grade}. ${toFix} thing${toFix > 1 ? "s" : ""} to fix` : `${r.grade}. Every check passed`;
  g.setAttribute("aria-label", `ATS score ${r.score} out of 100, ${r.grade}`);

  const order = { fail: 0, warn: 1, pass: 2 };
  $("#atslist").replaceChildren(...[...r.groups].sort((a, b) => order[a.state] - order[b.state]).map((x, i) => el("li", { class: `item ${x.state}`, style: `--i:${i}` },
    el("span", { class: "mark", "aria-hidden": "true" }, x.state === "pass" ? "✓" : x.state === "warn" ? "!" : "✕"),
    el("div", { class: "body" },
      el("div", { class: "top" }, el("b", {}, x.name), el("span", { class: "pts" }, `${x.got} / ${x.max}`)),
      el("div", { class: "bar" }, el("span", { style: `--w:${(x.got / x.max) * 100}%` })),
      el("p", {}, x.state === "pass" || !x.tip ? x.ok : x.tip)))));

  const kw = r.keywords;
  $("#atskw").replaceChildren(...(kw ? [
    el("h3", {}, `Job keywords: ${kw.have.length} of ${kw.want.length} found`),
    el("div", { class: "chips" }, kw.want.map(k => el("span", { class: `chip ${kw.have.includes(k) ? "have" : "miss"}` }, kw.have.includes(k) ? `✓ ${k}` : k))),
    el("p", { class: "kwnote" }, "Add a missing keyword only where you have really done it.")
  ] : [el("p", { class: "kwnote" }, "Paste a job description on the left to see which of its keywords are missing.")]));
  $("#atsnext").hidden = false;
}

function countTo(node, to) {
  if (still) return (node.textContent = to);
  const t0 = performance.now();
  const tick = t => { const k = Math.min(1, (t - t0) / 1100); node.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

$("#atspick").addEventListener("click", () => ($("#atsagree").checked ? $("#atsfile").click() : askConsent()));
$("#atsfile").addEventListener("change", e => { takeFile(e.target.files[0]); e.target.value = ""; });
$("#atsagree").addEventListener("change", e => { if (e.target.checked) msg(""); });
$("#atspastebtn").addEventListener("click", () => { $("#atspastebox").hidden = false; $("#atstext").focus(); });
$("#atsgo").addEventListener("click", run);
let timer;
$("#atsjd").addEventListener("input", () => { if (!last) return; clearTimeout(timer); timer = setTimeout(run, 400); });
const drop = $("#atsdrop");
["dragover", "dragenter"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", e => takeFile(e.dataTransfer.files[0]));

// Carry the same resume to the job matcher so it is not uploaded twice.
const handOff = () => { if (last) try { sessionStorage.setItem("patrata:resume", last.text); } catch {} };
$("#atsjobs").addEventListener("click", () => { handOff(); location.href = "/#start"; });
$("#atsagain").addEventListener("click", () => {
  file = null; fileText = ""; fileExt = ""; last = null;
  $("#atsfilename").hidden = true; $("#atstext").value = ""; $("#atspastebox").hidden = true;
  $("#atsdrop").scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
  $("#atspick").focus({ preventScroll: true });
  msg("Choose the next resume. The job description stays as it is.");
});
