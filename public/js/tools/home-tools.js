// Connects the kit, mock interview and resume builder to the matched jobs on the home page.
import { el, $ } from "../lib/dom.js";
import { jobText } from "../lib/aiclient.js";
import { mountKit } from "./kit.js";
import { mountInterview } from "./interview.js";
import { mountBuilder } from "./builder.js";

let getState, kit, iv, builder, current = null;

export function initTools(fn) {
  getState = fn;
  const ctx = () => { const s = getState(); return { text: s.text, profile: s.profile, job: jobCtx() }; };
  kit = mountKit($("#kitroot"), ctx);
  iv = mountInterview($("#ivroot"), ctx);
  builder = mountBuilder($("#builderroot"), () => { const s = getState(); return { text: s.text, profile: s.profile, job: current ? jobCtx() : null }; });
  $("#prepsel").addEventListener("change", e => {
    const v = e.target.value;
    $("#prepcustom").hidden = v !== "custom";
    if (v === "custom") { current = null; $("#prepjd").value = ""; showJob(); $("#prep-title").focus(); return; }
    choose(getState().ranked?.[+v]?.job);
  });
  for (const id of ["#prep-title", "#prep-company"]) $(id).addEventListener("input", showJob);
  document.querySelectorAll(".prep-switch button").forEach(b => b.addEventListener("click", () => sub(b.dataset.sub)));
}

function sub(name) {
  document.querySelectorAll(".prep-switch button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.sub === name)));
  $("#kitroot").hidden = name !== "kit"; $("#ivroot").hidden = name !== "interview";
}

function jobCtx() {
  const custom = !current;
  const title = custom ? $("#prep-title").value.trim() : current.title;
  const company = custom ? $("#prep-company").value.trim() : current.company;
  const body = $("#prepjd").value.trim();
  return { title, company, url: current?.url || "", text: [title && company ? `${title} at ${company}` : title || company, body].filter(Boolean).join("\n") };
}

function showJob() {
  const j = jobCtx();
  $("#prepnow").replaceChildren(j.title || j.company
    ? el("p", {}, "Preparing for ", el("b", {}, [j.title, j.company].filter(Boolean).join(" at ")), current?.url ? [". ", el("a", { href: current.url, target: "_blank", rel: "noopener nofollow" }, "Open the posting")] : "")
    : el("p", {}, "Choose a job above, or paste one."));
}

function choose(job) {
  current = job || null;
  $("#prepcustom").hidden = Boolean(job);
  $("#prepjd").value = job ? jobText({ ...job, location: job.location }).split("\n").slice(1).join("\n") : "";
  showJob();
}

// Fills the job list from the current matches; called after every search.
export function refreshTools() {
  const s = getState();
  const sel = $("#prepsel");
  const top = (s.ranked || []).slice(0, 60);
  sel.replaceChildren(el("option", { value: "custom" }, "Paste a different job…"), ...top.map((r, i) => el("option", { value: String(i) }, `${r.job.title} at ${r.job.company}`)));
  if (current) { const k = top.findIndex(r => r.job === current); sel.value = k >= 0 ? String(k) : "custom"; }
  else if (top.length) { sel.value = "0"; choose(top[0].job); }
  else { sel.value = "custom"; choose(null); }
  kit.refresh(); iv.refresh(); builder.refresh();
}

// From a job card: open the Prepare tab on that job.
export function prepareFor(job, which = "kit") {
  const s = getState();
  const k = (s.ranked || []).slice(0, 60).findIndex(r => r.job === job);
  $("#prepsel").value = k >= 0 ? String(k) : "custom";
  choose(job);
  sub(which);
  document.dispatchEvent(new CustomEvent("tab", { detail: "prepare" }));
}
