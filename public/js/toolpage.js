// Standalone tool pages: resume and job inputs, then the chosen tool.
import { readResume } from "./reader.js";
import { parseProfile, joinWrapped } from "./lib/profile.js";
import { el, $ } from "./lib/dom.js";
import { mountKit } from "./tools/kit.js";
import { mountInterview } from "./tools/interview.js";
import { mountBuilder } from "./tools/builder.js";

const shell = $(".tool-shell");
const which = shell.dataset.tool;
const state = { text: "", profile: null };
const msg = (t, err = false) => { $("#sh-msg").textContent = t; $("#sh-msg").classList.toggle("err", err); };

const ctx = () => ({
  text: state.text, profile: state.profile || {},
  job: (() => {
    const title = $("#sh-title")?.value.trim() || "", company = $("#sh-company")?.value.trim() || "", body = $("#sh-jd")?.value.trim() || "";
    if (!title && !company && !body) return null;
    return { title, company, text: [[title, company].filter(Boolean).join(" at "), body].filter(Boolean).join("\n") };
  })()
});

const tool = which === "kit" ? mountKit($("#toolroot"), ctx) : which === "interview" ? mountInterview($("#toolroot"), ctx) : mountBuilder($("#toolroot"), ctx);

function use(text, label) {
  state.text = joinWrapped(text);
  state.profile = parseProfile(state.text);
  try { sessionStorage.setItem("patrata:text", state.text); } catch {}
  $("#sh-have").hidden = false;
  $("#sh-have b").textContent = label;
  $("#sh-input").hidden = true;
  msg("");
  which === "builder" ? tool.rebuild() : tool.refresh();
}

function askConsent() {
  msg("Tick the box above first.", true);
  const row = $("#sh-consent"); row.classList.remove("nudge"); void row.offsetWidth; row.classList.add("nudge");
}

$("#sh-pick").addEventListener("click", () => ($("#sh-agree").checked ? $("#sh-file").click() : askConsent()));
$("#sh-file").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  msg("Reading your resume…");
  try { use(await readResume(f), f.name); } catch (err) { msg(err.message, true); }
});
$("#sh-pastebtn").addEventListener("click", () => { $("#sh-pastebox").hidden = false; $("#sh-text").focus(); });
$("#sh-usetext").addEventListener("click", () => {
  if (!$("#sh-agree").checked) return askConsent();
  const t = $("#sh-text").value.trim();
  if (t.length < 150) return msg("Paste the full resume text, not only a few lines.", true);
  use(t, "the pasted text");
});
$("#sh-change").addEventListener("click", () => { $("#sh-input").hidden = false; $("#sh-have").hidden = true; });
const drop = $("#sh-input");
["dragover", "dragenter"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", async e => {
  const f = e.dataTransfer.files[0];
  if (!f) return;
  if (!$("#sh-agree").checked) return askConsent();
  try { use(await readResume(f), f.name); } catch (err) { msg(err.message, true); }
});

// A resume added earlier in this visit (on any page) is reused, so students do not upload twice.
try {
  const carried = sessionStorage.getItem("patrata:text");
  if (carried && carried.length > 150) use(carried, "the resume you added earlier");
} catch {}

// A job passed in the link, for example from a company page.
const q = new URLSearchParams(location.search);
if (q.get("title") && $("#sh-title")) { $("#sh-title").value = q.get("title").slice(0, 120); $("#sh-company").value = (q.get("company") || "").slice(0, 80); }
