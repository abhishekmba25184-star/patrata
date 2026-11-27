// Application kit: cover letter, HR email, LinkedIn notes, referral finder and follow-up.
import { el, copyText, downloadBlob } from "../lib/dom.js";
import { callAi, consentBox, personalise, aiEnabled } from "../lib/aiclient.js";
import { loadScript } from "../reader.js";

const COLLEGE = /\b(IIM|IIT|NIT|IIIT|XLRI|ISB|FMS|MDI|SPJIMR|NMIMS|SIBM|IMT|TAPMI|JBIMS|IIFT|Institute|University|College|School of)\b/;

// The student's institute, from the education lines.
export function guessCollege(text) {
  for (const line of String(text).split("\n")) {
    if (!COLLEGE.test(line) || line.length > 160) continue;
    let s = line.replace(/^[•▪●◦‣∙·*\-–\s]+/, "");
    const parts = s.split(/\s*[|,–—]\s*|\s{2,}/).filter(p => COLLEGE.test(p));
    s = (parts[0] || s).replace(/\b(19|20)\d\d\b.*$/, "").replace(/\b(MBA|PGDM|PGP|B\.?\s?Tech|B\.?\s?Com|BBA|BMS|M\.?\s?Tech|CGPA|GPA)\b.*$/i, "").trim();
    if (s.length >= 3 && s.length <= 90) return s;
  }
  return "";
}

// An HR email address written in the job post, if any.
export function emailIn(text) {
  return (String(text).match(/[\w.+-]+@[\w-]+\.[\w.-]+\w/g) || []).find(e => !/no-?reply|example\.com/i.test(e)) || "";
}

const linkedInSearch = q => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
const googleSearch = q => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

function area(value, label, rows = 6, max = 0) {
  const t = el("textarea", { "aria-label": label, rows: 3 });
  t.value = value;
  // Grows with its text, so short notes stay short and letters show in full.
  const fit = () => { t.style.height = "auto"; t.style.height = `${t.scrollHeight + 4}px`; };
  t.addEventListener("input", fit); requestAnimationFrame(fit);
  if (!max) return { node: t, get: () => t.value };
  const count = el("span", { class: "charcount" });
  const upd = () => { count.textContent = `${t.value.length} / ${max} characters`; count.classList.toggle("over", t.value.length > max); };
  t.addEventListener("input", upd); upd();
  return { node: el("div", {}, t, count), get: () => t.value };
}

const placeholders = s => (String(s).match(/\[[^\]\n]{2,40}\]/g) || []).length;

export function mountKit(root, getCtx) {
  let out = null;
  const recipient = el("input", { type: "text", placeholder: "For example Ms Sharma (optional)", "aria-label": "Recipient name" });
  const college = el("input", { type: "text", placeholder: "Your college", "aria-label": "Your college" });
  const tone = el("select", { "aria-label": "Tone" }, el("option", { value: "professional" }, "Professional"), el("option", { value: "warm" }, "Warm and personal"), el("option", { value: "concise" }, "Short and direct"));
  const go = el("button", { type: "button", class: "btn" }, "Write my application kit");
  const msg = el("p", { class: "status", role: "status" });
  const result = el("div", { class: "kit-out" });
  const off = el("p", { class: "warnline", hidden: true }, "The AI writer is switched off on this site right now. The referral search links below still work.");

  const form = el("div", { class: "tool-form" },
    el("div", { class: "grid3" },
      el("label", { class: "f" }, "Address the letter to", recipient),
      el("label", { class: "f" }, "Your college, for alumni search", college),
      el("label", { class: "f" }, "Tone", tone)),
    consentBox(), el("div", { class: "row" }, go), msg, off);
  root.replaceChildren(el("div", { class: "tool kit" },
    el("div", { class: "tool-head" }, el("h3", {}, "Application kit"), el("p", {}, "A cover letter, an email to HR, LinkedIn notes and a referral request, written for this job from your resume. Edit anything before you send it.")),
    form, result));

  aiEnabled().then(on => { if (!on) { off.hidden = false; go.disabled = true; } });
  const refreshCollege = () => { const c = getCtx(); if (c?.text && !college.value) college.value = guessCollege(c.text); };
  refreshCollege();

  go.addEventListener("click", async () => {
    const c = getCtx();
    if (!c?.text) return (msg.textContent = "Add your resume first.");
    if (!c.job?.text || c.job.text.length < 40) return (msg.textContent = "Add the job: its title, company and description.");
    go.disabled = true; msg.textContent = "Writing your kit. This takes about 20 seconds.";
    try {
      out = await callAi("kit", { text: c.text, profile: c.profile, job: c.job.text, tone: tone.value, recipient: recipient.value, college: college.value });
      render(c);
      msg.textContent = "Done. Read every line and fill in anything in [brackets] before sending.";
    } catch (e) { msg.textContent = e.message; }
    go.disabled = false;
  });

  function render(c) {
    const p = s => personalise(s, c.profile);
    const job = c.job, company = job.company || "the company", role = job.title || "the role";
    const coll = college.value.trim();

    const letter = area(p(out.coverLetter), "Cover letter", 14);
    const to = el("input", { type: "email", value: emailIn(job.text), placeholder: "HR email address", "aria-label": "Send to" });
    const subject = el("input", { type: "text", value: p(out.email.subject), "aria-label": "Subject" });
    const body = area(p(out.email.body), "Email body", 8);
    const note = area(p(out.linkedinNote), "LinkedIn note to a recruiter", 4, 300);
    const refNote = area(p(out.referralNote), "Referral connection note", 4, 300);
    const refMsg = area(p(out.referralMessage), "Message after they accept", 7);
    const fuSubject = el("input", { type: "text", value: p(out.followUp.subject), "aria-label": "Follow-up subject" });
    const fuBody = area(p(out.followUp.body), "Follow-up email", 5);
    const mailto = (addr, subj, text) => `mailto:${encodeURIComponent(addr || "")}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(text)}`;
    const copyBtn = get => { const b = el("button", { type: "button", class: "btn alt small" }, "Copy"); b.addEventListener("click", () => copyText(get(), b)); return b; };
    const open = (get) => el("button", { type: "button", class: "btn small", onclick: () => { location.href = get(); } }, "Open in my email app");
    const n = placeholders([out.coverLetter, out.email.body, out.referralMessage].join(" "));

    const alumni = coll ? `${company} ${coll}` : company;
    const titleWord = role.replace(/\b(intern(ship)?|senior|junior|i{1,3}|associate|executive|trainee)\b/gi, "").replace(/[^\w ]+/g, " ").trim().split(/\s+/).slice(0, 2).join(" ");
    result.replaceChildren(
      n ? el("p", { class: "warnline" }, `${n} ${n === 1 ? "part is" : "parts are"} in [brackets]. Replace them with true details, or delete them, before you send anything.`) : "",
      el("section", { class: "kit-card" }, el("h4", {}, "Cover letter"), letter.node,
        el("div", { class: "row" }, copyBtn(letter.get), el("button", { type: "button", class: "btn alt small", onclick: () => saveLetter(letter.get(), c, role, company) }, "Download as Word"))),
      el("section", { class: "kit-card" }, el("h4", {}, "Email to HR"),
        el("label", { class: "f" }, "To", to), el("label", { class: "f" }, "Subject", subject), body.node,
        el("p", { class: "hint" }, "Attach your resume yourself after the email opens. It is never uploaded here."),
        el("div", { class: "row" }, open(() => mailto(to.value, subject.value, body.get())), copyBtn(() => `Subject: ${subject.value}\n\n${body.get()}`))),
      el("section", { class: "kit-card" }, el("h4", {}, `LinkedIn note to a recruiter at ${company}`), note.node,
        el("div", { class: "row" }, copyBtn(note.get), el("a", { class: "btn alt small", href: linkedInSearch(`${company} recruiter talent acquisition`), target: "_blank", rel: "noopener" }, `Find recruiters at ${company}`))),
      el("section", { class: "kit-card referral" }, el("h4", {}, "Ask for a referral"),
        el("p", {}, "Employees can refer you, and a referred resume is usually read by a person. Search for people at the company, start with your own college, and send a short, specific request."),
        el("ul", { class: "reflinks" },
          coll && el("li", {}, el("a", { href: linkedInSearch(alumni), target: "_blank", rel: "noopener" }, `${coll} alumni at ${company}`), el("span", {}, "LinkedIn people search")),
          el("li", {}, el("a", { href: linkedInSearch(`${company} ${titleWord}`), target: "_blank", rel: "noopener" }, `${titleWord || "People"} at ${company}`), el("span", {}, "People in or near the team you want")),
          el("li", {}, el("a", { href: googleSearch(`site:linkedin.com/in "${company}"${coll ? ` "${coll}"` : ""}`), target: "_blank", rel: "noopener" }, `Search Google for ${company} profiles${coll ? ` from ${coll}` : ""}`), el("span", {}, "Finds profiles LinkedIn search can miss"))),
        el("h5", {}, "Connection note"), refNote.node, el("div", { class: "row" }, copyBtn(refNote.get)),
        el("h5", {}, "Message once they accept"), refMsg.node, el("div", { class: "row" }, copyBtn(refMsg.get)),
        el("ul", { class: "tips" },
          el("li", {}, "Write to two or three people, not twenty. People one to five years senior to you reply most."),
          el("li", {}, "Share the exact job link and job ID so they can refer you in one step."),
          el("li", {}, "Follow up once after a week. If there is no reply, thank them and move on."))),
      el("section", { class: "kit-card" }, el("h4", {}, "Follow-up email, about a week after applying"),
        el("label", { class: "f" }, "Subject", fuSubject), fuBody.node,
        el("div", { class: "row" }, open(() => mailto(to.value, fuSubject.value, fuBody.get())), copyBtn(() => `Subject: ${fuSubject.value}\n\n${fuBody.get()}`)))
    );
  }

  return { refresh: () => { result.replaceChildren(); out = null; msg.textContent = ""; refreshCollege(); } };
}

async function saveLetter(text, c, role, company) {
  await loadScript("/vendor/docx.umd.js");
  const { Document, Packer, Paragraph, TextRun } = window.docx;
  const p = c.profile || {};
  const head = [p.name, [p.email, p.phone].filter(Boolean).join("  |  ")].filter(Boolean);
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      children: [
        ...head.map((h, i) => new Paragraph({ children: [new TextRun({ text: h, bold: i === 0, size: i === 0 ? 30 : 20 })] })),
        new Paragraph({ text: "" }), new Paragraph({ text: date }), new Paragraph({ text: "" }),
        ...text.split(/\n/).map(l => new Paragraph({ text: l, spacing: { after: l.trim() ? 120 : 0 } }))
      ] }]
  });
  downloadBlob(await Packer.toBlob(doc), `Cover letter - ${role} - ${company}.docx`.replace(/[\\/:*?"<>|]+/g, " "));
}
