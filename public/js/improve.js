import { reviewResume, bulletLines, guardNumbers } from "./lib/ats.js";
import { redact } from "./lib/profile.js";
import { findSkills } from "./lib/skills.js";
import { el } from "./app.js";
import { loadScript } from "./reader.js";

const $ = s => document.querySelector(s);
let getState, edits = [];

export function initImprove(fn) {
  getState = fn;
  document.addEventListener("tailor", e => {
    const j = e.detail.job;
    $("#jd").value = `${j.title} at ${j.company}\nSkills asked: ${j.skills.join(", ")}\n${j.summary}`;
    $("#jdnote").textContent = "Job summary added. For a sharper result, paste the full description from the source site.";
    keywordGap();
  });
  $("#jd").addEventListener("input", keywordGap);
  $("#ai").addEventListener("click", runAi);
  $("#download").addEventListener("click", download);
}

export function refreshImprove() {
  const { text, profile } = getState();
  const r = reviewResume(text, profile);
  $("#score").textContent = r.score;
  $("#scorebars").replaceChildren(...r.items.map(i => el("li", {},
    el("div", { class: "l" }, el("span", {}, i.name), el("span", {}, `${i.got} / ${i.max}`)),
    el("div", { class: "meter" }, el("span", { style: `width:${(i.got / i.max) * 100}%` })),
    i.got < i.max && el("div", {}, i.tip))));
  edits = [];
  $("#aiout").hidden = true;
  keywordGap();
}

function keywordGap() {
  const { profile } = getState();
  if (!profile) return;
  const want = findSkills($("#jd").value);
  $("#gap").replaceChildren(...(want.length ? [
    el("h3", {}, `Your resume covers ${want.filter(s => profile.skills.includes(s)).length} of ${want.length} skills in this job`),
    el("div", { class: "chips" }, want.map(s => el("span", { class: `chip ${profile.skills.includes(s) ? "have" : "miss"}` }, profile.skills.includes(s) ? `✓ ${s}` : `Missing: ${s}`))),
    el("p", {}, "Add a missing skill only if you have really used it. Otherwise treat it as something to learn.")
  ] : []));
}

async function runAi() {
  const { text, profile } = getState();
  const msg = $("#aimsg"), btn = $("#ai");
  if (!$("#aiagree").checked) { msg.textContent = "Tick the consent box to use the AI rewrite."; return; }
  const bullets = bulletLines(text).slice(0, 18);
  btn.disabled = true; msg.textContent = "Rewriting. This takes about half a minute.";
  try {
    const r = await fetch("/api/improve", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ resume: redact(text, profile.name).slice(0, 9000), bullets: bullets.map(b => redact(b, profile.name)), job: $("#jd").value.slice(0, 4000), roles: profile.roles, consent: true })
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data) throw new Error(data?.error || "AI rewrite is not available here yet. Your score and tips above still work.");
    showAi(data, bullets);
    msg.textContent = "Done. Check every line before using it.";
  } catch (e) { msg.textContent = e.message; }
  btn.disabled = false;
}

function showAi(data, bullets) {
  edits = (data.rewrites || []).filter(w => bullets[w.index] !== undefined).map(w => ({ original: bullets[w.index], improved: guardNumbers(bullets[w.index], w.improved), why: w.why, use: true }));
  const summary = guardNumbers(getState().text, data.summary || "");
  $("#summary").value = summary;
  $("#rewrites").replaceChildren(...edits.map(e => el("div", { class: "rewrite" },
    el("div", { class: "old" }, e.original),
    (() => { const t = el("textarea", { "aria-label": "Improved line, editable", oninput: ev => (e.improved = ev.target.value) }); t.value = e.improved; return t; })(),
    el("p", {}, e.why || ""),
    el("label", { class: "consent" }, (() => { const c = el("input", { type: "checkbox", onchange: ev => (e.use = ev.target.checked) }); c.checked = true; return c; })(), "Use this line"))));
  $("#advice").replaceChildren(...(data.advice || []).map(a => el("li", {}, a)));
  $("#aiout").hidden = false;
}

export function buildLines(text, summary, accepted) {
  const swap = new Map(accepted.filter(e => e.use).map(e => [e.original.trim(), e.improved]));
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    if (!swap.has(l)) return l;
    const mark = l.match(/^\s*[•▪●◦‣∙·\-–*]\s*/)?.[0] ? "• " : "";
    return mark + swap.get(l).replace(/^\s*[•▪●◦‣∙·\-–*]\s*/, "");
  });
  if (summary.trim()) {
    const first = lines.findIndex(l => /^(education|academic|experience|work experience|professional experience|summary|profile|objective|skills|internship|projects)/i.test(l));
    const at = first < 0 ? Math.min(3, lines.length) : first;
    if (first >= 0 && /^(summary|profile|objective)/i.test(lines[first])) {
      let end = first + 1;
      while (end < lines.length && !/^(education|academic|experience|work experience|professional experience|skills|internships?|projects)\b/i.test(lines[end])) end++;
      lines.splice(first, end - first, "Summary", summary.trim());
    } else lines.splice(at, 0, "Summary", summary.trim());
  }
  return lines;
}

async function download() {
  const pending = [$("#summary").value, ...edits.filter(e => e.use).map(e => e.improved)].some(s => s.includes("[add figure]"));
  if (pending) { $("#dlmsg").textContent = 'Replace every "[add figure]" with a true number, or delete it, before downloading.'; return; }
  await loadScript("/vendor/docx.umd.js");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;
  const lines = buildLines(getState().text, $("#summary").value, edits);
  const heading = /^(summary|profile|objective|education|academics?|experience|work experience|professional experience|internships?|projects|skills|technical skills|certifications?|achievements?|positions? of responsibility|extra.?curriculars?( activities)?)\s*:?$/i;
  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 21 } }, heading2: { run: { font: "Calibri", size: 24, bold: true, color: "14262B" }, paragraph: { spacing: { before: 200, after: 80 } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: lines.map((l, i) => i === 0 ? new Paragraph({ children: [new TextRun({ text: l, bold: true, size: 32 })] })
        : heading.test(l) ? new Paragraph({ text: l.replace(/:$/, ""), heading: HeadingLevel.HEADING_2 })
        : /^[•▪●◦‣∙·\-–*]\s*/.test(l) ? new Paragraph({ text: l.replace(/^[•▪●◦‣∙·\-–*]\s*/, ""), bullet: { level: 0 } })
        : new Paragraph({ text: l })) }]
  });
  const a = el("a", { href: URL.createObjectURL(await Packer.toBlob(doc)), download: "resume-improved.docx" });
  document.body.append(a); a.click(); a.remove();
  $("#dlmsg").textContent = "Downloaded. Open it in Word or Google Docs and tidy the layout.";
}
