// One way to call the AI tools: contact details removed, consent checked, slow replies cut off.
import { redact } from "./profile.js";
import { el } from "./dom.js";

let enabled = null;
export async function aiEnabled() {
  if (enabled !== null) return enabled;
  try { const r = await fetch("/api/ai"); enabled = r.ok ? Boolean((await r.json()).enabled) : false; } catch { enabled = false; }
  return enabled;
}

const KEY = "patrata:aiconsent";
export const hasConsent = () => { try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; } };
const setConsent = v => { try { v ? sessionStorage.setItem(KEY, "1") : sessionStorage.removeItem(KEY); } catch {} };

// The consent line used by every tool. Ticking it once covers the other tools in this visit.
export function consentBox() {
  const box = el("input", { type: "checkbox", class: "aiconsent-box", checked: hasConsent(), onchange: e => {
    setConsent(e.target.checked);
    document.querySelectorAll(".aiconsent-box").forEach(b => (b.checked = e.target.checked));
  } });
  return el("label", { class: "consent aiconsent" }, box,
    el("span", {}, "Send my resume text to Google's Gemini AI to write this. Name, email, phone and links are removed first. Google may store and review the text. ", el("a", { href: "/privacy/" }, "Details")));
}

export class AiError extends Error {}

export async function callAi(task, { text = "", profile = {}, job = "", ...rest } = {}, ms = 70000) {
  if (!hasConsent()) throw new AiError("Tick the consent box to use the AI.");
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  const clean = s => redact(String(s || ""), profile.name || "");
  try {
    const r = await fetch("/api/ai", {
      method: "POST", signal: ctl.signal, headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, consent: true, resume: clean(text).slice(0, 9000), job: String(job || "").slice(0, 5000), ...rest })
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data) throw new AiError(data?.error || (r.status === 404 ? "The AI tools are not on this site yet." : "The AI did not reply. Try again in a minute."));
    return data;
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(e.name === "AbortError" ? "The AI took too long. Try again." : "No connection to the AI. Check your internet and try again.");
  } finally { clearTimeout(timer); }
}

// Fills the [Your name] style placeholders on the device, so personal details never leave it.
export function personalise(s, profile = {}) {
  return String(s || "")
    .replace(/\[(your )?name\]/gi, profile.name || "[Your name]")
    .replace(/\[(your )?email\]/gi, profile.email || "[Your email]")
    .replace(/\[(your )?phone( number)?\]/gi, profile.phone || "[Your phone]");
}

// A job as plain text for the AI, from a site job object or pasted text.
export function jobText(job) {
  if (!job) return "";
  if (typeof job === "string") return job;
  return [`${job.title} at ${job.company}`, job.location && `Location: ${job.location}`, job.skills?.length && `Skills asked: ${job.skills.join(", ")}`, job.description || job.summary].filter(Boolean).join("\n");
}
