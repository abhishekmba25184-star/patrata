// Resume builder: editable sections, ATS-safe templates, live A4 preview, AI help, PDF and Word downloads.
import { el, store, downloadBlob } from "../lib/dom.js";
import { HEADING, joinWrapped, parseProfile } from "../lib/profile.js";
import { atsReport } from "../lib/ats.js";
import { callAi, consentBox, aiEnabled, hasConsent, personalise } from "../lib/aiclient.js";
import { loadScript } from "../reader.js";

const DRAFT = "patrata:resume-doc";
const PAGE_H = 1123, PAGE_W = 794; // A4 at 96 dpi
const BULLET = /^[•▪●◦‣∙·*]\s*|^[-–]\s+/;
const MON = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const WHEN = `(?:${MON}\\s*'?\\d{2,4}|(?:19|20)\\d\\d)`;
const RANGE = new RegExp(`\\s*[|,(]?\\s*(${WHEN}\\s*(?:[-–—]|to)\\s*(?:${WHEN}|present|current|now|till date|ongoing)|${WHEN})\\s*\\)?\\s*(\\(\\s*\\d[^)]*\\))?\\s*$`, "i");

export const TEMPLATES = [
  { id: "modern", name: "Modern", note: "Blue headings, clean sans-serif" },
  { id: "classic", name: "Classic", note: "Serif, ruled headings, formal" },
  { id: "compact", name: "Compact", note: "Dense, fits more on one page" }
];
const ADDABLE = ["Summary", "Education", "Work Experience", "Internships", "Projects", "Skills", "Achievements", "Positions of Responsibility", "Certifications", "Extra-curricular Activities"];

const kindOf = h => (/summary|profile|objective/i.test(h) ? "text" : /skill|languages|interests|tools/i.test(h) ? "lines" : "entries");
const title = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\bOf\b/g, "of").replace(/\bAnd\b/g, "and");
const uid = () => Math.random().toString(36).slice(2, 9);

const MID = new RegExp(`[\\s,|(]*(${WHEN}\\s*(?:[-–—]|to)\\s*(?:${WHEN}|present|current|now|ongoing))[\\s)]*(?=,|\\||$)`, "i");
export function splitDate(line) {
  const m = line.match(RANGE);
  if (!m || m.index < 3) {
    const r = line.match(MID); // a range in the middle: "MBA, Finance, 2025-2027, CGPA 8.1"
    if (r && r.index > 2) return { title: (line.slice(0, r.index) + line.slice(r.index + r[0].length)).replace(/\s*,\s*,\s*/g, ", ").replace(/^[\s,|]+|[\s,|]+$/g, "").trim(), date: r[1].replace(/\s*[-–—]\s*|\s+to\s+/i, " – ") };
    return { title: line.trim(), date: "" };
  }
  return { title: line.slice(0, m.index).replace(/[\s|,–—-]+$/, "").trim(), date: [m[1], m[2]].filter(Boolean).join(" ").replace(/\s*[-–—]\s*|\s+to\s+/i, " – ").trim() };
}

// Turns resume text into the builder's sections.
export function docFromText(text, profile = {}) {
  const lines = joinWrapped(String(text || "")).split("\n").map(l => l.trim()).filter(Boolean);
  const linkedin = (String(text).match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w%-]+\/?/i) || [""])[0].replace(/^https?:\/\/(www\.)?/i, "");
  const doc = { template: "modern", density: "normal", header: { name: profile.name || "", headline: "", email: profile.email || "", phone: profile.phone || "", linkedin, city: "" }, sections: [] };
  let cur = null;
  for (const line of lines) {
    const base = line.replace(/[\s|:(\[–—-]*\d{1,2}(?:\.\d+)?\s*\+?\s*(years?|yrs?|months?)[^\n]*$/i, "");
    if (base.length < 60 && HEADING.test(base)) {
      const h = title(base.replace(/:\s*$/, "").trim());
      cur = { id: uid(), heading: h, kind: kindOf(h), text: "", entries: [] };
      doc.sections.push(cur);
      continue;
    }
    if (!cur) continue; // name and contact lines at the top
    if (cur.kind === "text" || cur.kind === "lines") { cur.text += (cur.text ? "\n" : "") + line.replace(BULLET, ""); continue; }
    if (BULLET.test(line)) {
      if (!cur.entries.length) cur.entries.push({ id: uid(), title: "", date: "", points: [] });
      cur.entries.at(-1).points.push(line.replace(BULLET, "").trim());
    } else cur.entries.push({ id: uid(), ...splitDate(line), points: [] });
  }
  if (!doc.sections.length) return blankDoc(doc.header);
  return doc;
}

export function blankDoc(header = {}) {
  const s = (heading, extra = {}) => ({ id: uid(), heading, kind: kindOf(heading), text: "", entries: [], ...extra });
  return { template: "modern", density: "normal", header: { name: "", headline: "", email: "", phone: "", linkedin: "", city: "", ...header },
    sections: [
      s("Education", { entries: [{ id: uid(), title: "MBA, [Specialisation], [Institute] | CGPA [x.x]", date: "2025 – 2027", points: [] }] }),
      s("Work Experience", { entries: [{ id: uid(), title: "[Role], [Company], [City]", date: "Jul 2022 – Aug 2023", points: ["[Action verb] [what you did] for [who], resulting in [result with a number]"] }] }),
      s("Projects", { entries: [{ id: uid(), title: "[Project name]", date: "", points: ["[What you built or analysed] using [tools], finding [result]"] }] }),
      s("Skills", { text: "Tools: Excel, PowerPoint\nLanguages: English, Hindi" })
    ] };
}

// Plain text in reading order: used for the ATS score and as the AI's view of the resume.
export function plainText(doc) {
  const h = doc.header, out = [h.name, h.headline, [h.email, h.phone, h.linkedin, h.city].filter(Boolean).join(" | ")].filter(Boolean);
  for (const s of doc.sections) {
    out.push("", s.heading);
    if (s.kind !== "entries") out.push(...s.text.split("\n").filter(Boolean));
    else for (const e of s.entries) { if (e.title || e.date) out.push([e.title, e.date].filter(Boolean).join(" | ")); out.push(...e.points.filter(Boolean).map(p => `• ${p}`)); }
  }
  return out.join("\n");
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const mark = s => esc(s).replace(/\[[^\]\n]{1,40}\]/g, m => `<mark>${m}</mark>`);

export function pageHtml(doc) {
  const h = doc.header;
  const contact = [h.email, h.phone, h.linkedin, h.city].filter(Boolean).map(mark).join('<span class="sep"> | </span>');
  const sec = s => {
    let body = "";
    if (s.kind === "text") body = `<p>${mark(s.text).replace(/\n/g, "<br>")}</p>`;
    else if (s.kind === "lines") body = `<ul class="rz-lines">${s.text.split("\n").filter(Boolean).map(l => { const m = l.match(/^([^:]{2,30}):\s*(.+)$/); return `<li>${m ? `<b>${mark(m[1])}:</b> ${mark(m[2])}` : mark(l)}</li>`; }).join("")}</ul>`;
    else body = s.entries.map(e => `<div class="rz-entry">${e.title || e.date ? `<div class="rz-row"><b>${mark(e.title)}</b><span>${mark(e.date)}</span></div>` : ""}${e.points.filter(Boolean).length ? `<ul>${e.points.filter(Boolean).map(p => `<li>${mark(p)}</li>`).join("")}</ul>` : ""}</div>`).join("");
    return `<section><h2>${mark(s.heading)}</h2>${body}</section>`;
  };
  return `<header><h1>${mark(h.name || "Your Name")}</h1>${h.headline ? `<p class="rz-headline">${mark(h.headline)}</p>` : ""}${contact ? `<p class="rz-contact">${contact}</p>` : ""}</header>${doc.sections.map(sec).join("")}`;
}

export function mountBuilder(root, getCtx) {
  let doc = store.get(DRAFT)?.doc || null;
  let fromDraft = Boolean(doc), timer = null, lastFixes = [];
  const editor = el("div", { class: "rz-editor" });
  const page = el("div", { class: "rz-page" });
  const frame = el("div", { class: "rz-frame" }, page);
  const fit = el("p", { class: "rz-fit", role: "status" });
  const ats = el("div", { class: "rz-ats" });
  const msg = el("p", { class: "status", role: "status" });
  const banner = el("div", { class: "rz-banner" });
  const tabs = el("div", { class: "rz-switch", role: "tablist" },
    el("button", { type: "button", role: "tab", "aria-selected": "true", onclick: () => view("edit") }, "Edit"),
    el("button", { type: "button", role: "tab", "aria-selected": "false", onclick: () => view("preview") }, "Preview"));
  const wrap = el("div", { class: "rz-wrap", "data-view": "edit" },
    el("div", { class: "rz-left" }, editor),
    el("div", { class: "rz-right" }, el("div", { class: "rz-tools" }, ats, fit,
      el("div", { class: "row" },
        el("button", { type: "button", class: "btn", onclick: () => exportPdf() }, "Download PDF"),
        el("button", { type: "button", class: "btn alt", onclick: () => exportWord() }, "Download Word")), msg), frame));
  root.replaceChildren(el("div", { class: "tool builder" },
    el("div", { class: "tool-head" }, el("h3", {}, "Resume builder"), el("p", {}, "Your resume as clean sections you can edit, in one-column templates that applicant tracking software reads correctly. Changes save on this device as you type.")),
    banner, tabs, wrap));

  function view(v) { wrap.dataset.view = v; tabs.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", String(b.textContent.toLowerCase() === v))); if (v === "preview") preview(); }

  function start(fresh) {
    const c = getCtx?.();
    if (fresh || !doc) doc = c?.text ? docFromText(c.text, c.profile) : blankDoc();
    banner.replaceChildren(
      fromDraft && !fresh ? el("p", { class: "note" }, "Continuing your saved draft. ", c?.text ? el("button", { type: "button", class: "linkbtn", onclick: () => { fromDraft = false; start(true); } }, "Start again from my resume") : el("button", { type: "button", class: "linkbtn", onclick: () => { fromDraft = false; doc = blankDoc(); start(false); } }, "Start a blank resume"))
        : c?.text ? el("p", { class: "note" }, "Filled in from your resume. Check each section: layouts can be read imperfectly.") : el("p", { class: "note" }, "A blank template with examples in [brackets]. Replace them with your own details."));
    drawEditor(); preview();
  }

  const save = () => { store.set(DRAFT, { doc, at: Date.now() }); };
  const changed = () => { clearTimeout(timer); timer = setTimeout(() => { save(); preview(); }, 180); };

  function field(label, value, set, attrs = {}) {
    const i = el(attrs.multiline ? "textarea" : "input", { type: "text", "aria-label": label, placeholder: attrs.placeholder || "", rows: attrs.rows || 3 });
    i.value = value || "";
    i.addEventListener("input", () => { set(i.value); changed(); });
    return attrs.bare ? i : el("label", { class: "f" }, label, i);
  }

  function drawEditor() {
    const h = doc.header;
    const tplBtns = el("div", { class: "rz-tpls", role: "group", "aria-label": "Template" }, TEMPLATES.map(t =>
      el("button", { type: "button", class: `rz-tpl t-${t.id}`, "aria-pressed": String(doc.template === t.id), onclick: () => { doc.template = t.id; save(); drawEditor(); preview(); } },
        el("span", { class: "sw", "aria-hidden": "true" }, el("i"), el("i"), el("i")), el("b", {}, t.name), el("small", {}, t.note))));
    const density = el("label", { class: "consent" }, el("input", { type: "checkbox", checked: doc.density === "tight", onchange: e => { doc.density = e.target.checked ? "tight" : "normal"; save(); preview(); } }), el("span", {}, "Tighter spacing, to fit one page"));
    const addSel = el("select", { "aria-label": "Add a section" }, el("option", { value: "" }, "Add a section…"), ADDABLE.filter(a => !doc.sections.some(s => s.heading.toLowerCase() === a.toLowerCase())).map(a => el("option", { value: a }, a)));
    addSel.addEventListener("change", () => {
      if (!addSel.value) return;
      const s = { id: uid(), heading: addSel.value, kind: kindOf(addSel.value), text: "", entries: [] };
      if (s.kind === "entries") s.entries.push({ id: uid(), title: "", date: "", points: [""] });
      if (s.kind === "text") doc.sections.unshift(s); else doc.sections.push(s);
      save(); drawEditor(); preview();
    });
    const aiOn = el("div", { class: "rz-ai" }, consentBox(), el("p", { class: "hint" }, "Needed only for the AI buttons. Everything else works without it."));

    editor.replaceChildren(
      el("fieldset", { class: "rz-block" }, el("legend", {}, "Template"), tplBtns, density),
      el("fieldset", { class: "rz-block" }, el("legend", {}, "Your details"),
        el("div", { class: "grid2" },
          field("Full name", h.name, v => (h.name = v)), field("Headline", h.headline, v => (h.headline = v), { placeholder: "e.g. MBA (Finance), 2027 batch" }),
          field("Email", h.email, v => (h.email = v)), field("Phone", h.phone, v => (h.phone = v)),
          field("LinkedIn", h.linkedin, v => (h.linkedin = v), { placeholder: "e.g. linkedin.com/in/yourname" }), field("City", h.city, v => (h.city = v)))),
      aiOn,
      ...doc.sections.map((s, k) => sectionEditor(s, k)),
      el("div", { class: "row" }, addSel));
    aiEnabled().then(on => { if (!on) { aiOn.hidden = true; editor.querySelectorAll(".aibtn").forEach(b => (b.hidden = true)); } });
  }

  function sectionEditor(s, k) {
    const move = d => { const j = k + d; if (j < 0 || j >= doc.sections.length) return; [doc.sections[k], doc.sections[j]] = [doc.sections[j], doc.sections[k]]; save(); drawEditor(); preview(); };
    const head = el("div", { class: "rz-sechead" },
      field("Section heading", s.heading, v => (s.heading = v), { bare: true }),
      el("button", { type: "button", class: "iconbtn", "aria-label": `Move ${s.heading} up`, disabled: k === 0, onclick: () => move(-1) }, "↑"),
      el("button", { type: "button", class: "iconbtn", "aria-label": `Move ${s.heading} down`, disabled: k === doc.sections.length - 1, onclick: () => move(1) }, "↓"),
      el("button", { type: "button", class: "iconbtn", "aria-label": `Remove ${s.heading}`, onclick: () => { if (confirm(`Remove the ${s.heading} section?`)) { doc.sections.splice(k, 1); save(); drawEditor(); preview(); } } }, "✕"));
    const box = el("fieldset", { class: "rz-block rz-sec" }, el("legend", { class: "vh" }, s.heading), head);
    if (s.kind === "text") {
      const t = field("Text", s.text, v => (s.text = v), { multiline: true, rows: 4, bare: true });
      box.append(t, el("div", { class: "row" }, aiButton("Write my summary with AI", async b => {
        const d = await callAi("summary", ctxFor({}));
        s.text = personalise(d.summary, getCtx?.()?.profile); t.value = s.text; save(); preview();
      })));
    } else if (s.kind === "lines") {
      box.append(field("One line each, for example Tools: Excel, SQL", s.text, v => (s.text = v), { multiline: true, rows: 4 }));
    } else {
      s.entries.forEach((e, n) => box.append(entryEditor(s, e, n)));
      box.append(el("button", { type: "button", class: "btn alt small", onclick: () => { s.entries.push({ id: uid(), title: "", date: "", points: [""] }); save(); drawEditor(); preview(); } }, `Add to ${s.heading}`));
    }
    return box;
  }

  function entryEditor(s, e, n) {
    const pts = el("textarea", { "aria-label": "Points, one per line", rows: Math.max(2, e.points.length + 1) });
    pts.value = e.points.join("\n");
    pts.addEventListener("input", () => { e.points = pts.value.split("\n"); changed(); });
    let undo = null;
    const undoBtn = el("button", { type: "button", class: "linkbtn", hidden: true, onclick: () => { e.points = undo; pts.value = undo.join("\n"); undoBtn.hidden = true; save(); preview(); } }, "Undo AI change");
    return el("div", { class: "rz-entry-ed" },
      el("div", { class: "grid-title" },
        field("Title line", e.title, v => (e.title = v), { placeholder: /educat|academ/i.test(s.heading) ? "e.g. MBA (Finance), IIM Kashipur, CGPA 8.1" : /project/i.test(s.heading) ? "e.g. Equity research on an IT company" : /achiev|award|certif/i.test(s.heading) ? "e.g. Winner, national case competition" : /position|responsib|extra/i.test(s.heading) ? "e.g. Coordinator, Finance Club" : "e.g. Analyst, ABC Financial Services, Mumbai" }),
        field("Dates", e.date, v => (e.date = v), { placeholder: "e.g. 2025 – 2027" })),
      el("label", { class: "f" }, "Points, one per line", pts),
      el("div", { class: "row" },
        aiButton("Improve these points with AI", async () => {
          const lines = e.points.map(p => p.trim()).filter(Boolean);
          if (!lines.length) throw new Error("Write at least one point first.");
          const d = await callAi("points", ctxFor({ heading: e.title || s.heading, points: lines }));
          if (!d.points?.length) throw new Error("The AI returned nothing. Try again.");
          undo = e.points.slice(); e.points = d.points; pts.value = d.points.join("\n"); undoBtn.hidden = false; save(); preview();
        }), undoBtn,
        el("button", { type: "button", class: "linkbtn danger", onclick: () => { s.entries.splice(n, 1); save(); drawEditor(); preview(); } }, "Remove")));
  }

  function ctxFor(extra) {
    const c = getCtx?.() || {};
    return { text: plainText(doc), profile: c.profile || { name: doc.header.name }, job: c.job?.text || "", ...extra };
  }
  function aiButton(label, run) {
    const b = el("button", { type: "button", class: "btn alt small aibtn" }, label);
    b.addEventListener("click", async () => {
      if (!hasConsent()) { msg.textContent = "Tick the AI consent box above first."; b.closest(".rz-editor").querySelector(".aiconsent")?.scrollIntoView({ block: "center" }); return; }
      const was = b.textContent; b.disabled = true; b.textContent = "Working…"; msg.textContent = "";
      try { await run(b); msg.textContent = "Done. Check the new wording is true before you keep it."; }
      catch (err) { msg.textContent = err.message; }
      b.disabled = false; b.textContent = was;
    });
    return b;
  }

  function preview() {
    page.className = `rz-page t-${doc.template} d-${doc.density}`;
    page.innerHTML = pageHtml(doc);
    const w = frame.clientWidth || PAGE_W, scale = Math.min(1, w / PAGE_W);
    page.style.transform = `scale(${scale})`;
    const h = Math.max(PAGE_H, page.scrollHeight);
    frame.style.height = `${h * scale}px`;
    const pages = Math.ceil((page.scrollHeight - 2) / PAGE_H);
    fit.className = `rz-fit ${pages > 1 ? "over" : "ok"}`;
    fit.textContent = pages > 1 ? `Runs to ${pages} pages. Students usually keep to one: try tighter spacing, the Compact template, or cut older points.` : "Fits on one page.";
    const text = plainText(doc), c = getCtx?.() || {};
    const r = atsReport(text, parseProfile(text), c.job?.text || "", { ext: "pdf" });
    lastFixes = r.groups.filter(g => g.state !== "pass" && g.tip).slice(0, 2);
    const holes = (text.match(/\[[^\]\n]{1,40}\]/g) || []).length;
    ats.replaceChildren(el("div", { class: `rz-score ${r.score >= 80 ? "hi" : r.score >= 65 ? "mid" : "lo"}` }, el("b", {}, String(r.score)), el("span", {}, `ATS score, ${r.grade.toLowerCase()}`)),
      el("ul", {}, holes && el("li", {}, `${holes} ${holes === 1 ? "part" : "parts"} in [brackets] to fill in, highlighted on the page.`), lastFixes.map(f => el("li", {}, f.tip))));
  }
  window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(preview, 150); });

  function guard() {
    const holes = (plainText(doc).match(/\[[^\]\n]{1,40}\]/g) || []).length;
    if (holes) { msg.textContent = `Fill in or delete the ${holes} highlighted [bracketed] ${holes === 1 ? "part" : "parts"} first, so nothing unfinished goes to an employer.`; return false; }
    if (!doc.header.name.trim()) { msg.textContent = "Add your name first."; return false; }
    msg.textContent = ""; return true;
  }

  function exportPdf() {
    if (!guard()) return;
    const holder = el("div", { id: "rz-print" }, el("div", { class: `rz-page t-${doc.template} d-${doc.density}` }));
    holder.firstChild.innerHTML = pageHtml(doc);
    document.body.append(holder);
    document.documentElement.classList.add("printing-resume");
    const was = document.title; document.title = `${doc.header.name} Resume`;
    const done = () => { document.documentElement.classList.remove("printing-resume"); holder.remove(); document.title = was; window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { window.print(); setTimeout(() => { if (document.getElementById("rz-print")) done(); }, 1500); }, 50);
    msg.textContent = 'In the print window, choose "Save as PDF" as the printer.';
  }

  async function exportWord() {
    if (!doc.header.name.trim()) { msg.textContent = "Add your name first."; return; }
    try { await loadScript("/vendor/docx.umd.js"); } catch (e) { msg.textContent = e.message; return; }
    const { Document, Packer, Paragraph, TextRun, TabStopType, BorderStyle, AlignmentType } = window.docx;
    const t = doc.template, tight = doc.density === "tight";
    const font = t === "classic" ? "Cambria" : t === "compact" ? "Arial" : "Calibri";
    const size = t === "compact" || tight ? 19 : 21, color = t === "modern" ? "1F3FA8" : "111111";
    const W = 11906 - 2 * 760;
    const para = (children, o = {}) => new Paragraph({ children, spacing: { after: tight ? 20 : 40, ...(o.spacing || {}) }, ...o });
    const R = (text, o = {}) => String(text).split(/(\[[^\]\n]{1,40}\])/).filter(Boolean).map(part => new TextRun({ text: part, font, size, ...o, ...(/^\[[^\]]+\]$/.test(part) ? { highlight: "yellow" } : {}) }));
    const h = doc.header, kids = [];
    kids.push(para([...R(h.name, { bold: true, size: 36, color: t === "modern" ? "0F1A3C" : "111111" })], { alignment: t === "classic" ? AlignmentType.CENTER : AlignmentType.LEFT }));
    if (h.headline) kids.push(para([...R(h.headline, { size: size + 1 })], { alignment: t === "classic" ? AlignmentType.CENTER : AlignmentType.LEFT }));
    const contact = [h.email, h.phone, h.linkedin, h.city].filter(Boolean).join("  |  ");
    if (contact) kids.push(para([...R(contact, { size: size - 1 })], { alignment: t === "classic" ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 120 } }));
    for (const s of doc.sections) {
      kids.push(para([...R(t === "compact" ? s.heading.toUpperCase() : s.heading, { bold: true, size: size + 3, color })], {
        spacing: { before: tight ? 120 : 200, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: t === "modern" ? "A9C6F7" : "333333", space: 2 } },
        shading: t === "compact" ? { fill: "E3EDFD" } : undefined }));
      if (s.kind === "text") kids.push(para([...R(s.text)]));
      else if (s.kind === "lines") for (const l of s.text.split("\n").filter(Boolean)) {
        const m = l.match(/^([^:]{2,30}):\s*(.+)$/);
        kids.push(para(m ? [...R(`${m[1]}: `, { bold: true }), ...R(m[2])] : [...R(l)]));
      } else for (const e of s.entries) {
        if (e.title || e.date) kids.push(para([...R(e.title, { bold: true }), ...(e.date ? [...R(`\t${e.date}`)] : [])], { tabStops: [{ type: TabStopType.RIGHT, position: W }] }));
        for (const p of e.points.filter(x => x.trim())) kids.push(new Paragraph({ children: [...R(p)], bullet: { level: 0 }, spacing: { after: tight ? 10 : 30 } }));
      }
    }
    const file = new Document({ styles: { default: { document: { run: { font, size } } } }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, bottom: 720, left: 760, right: 760 } } }, children: kids }] });
    downloadBlob(await Packer.toBlob(file), `${h.name || "Resume"} Resume.docx`.replace(/[\\/:*?"<>|]+/g, " "));
    const holes = (plainText(doc).match(/\[[^\]\n]{1,40}\]/g) || []).length;
    msg.textContent = holes ? `Downloaded. ${holes} ${holes === 1 ? "gap is" : "gaps are"} highlighted in yellow for you to fill in.` : "Downloaded. It opens in Word and Google Docs.";
  }

  start(false);
  return {
    refresh: () => { const c = getCtx?.(); if (!fromDraft && c?.text) start(true); else start(false); },
    rebuild: () => { fromDraft = false; start(true); }
  };
}
