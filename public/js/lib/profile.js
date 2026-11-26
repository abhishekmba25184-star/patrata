// Turns resume text into a profile. Runs entirely in the student's browser.
import { findSkills, findCities, ROLE_FAMILIES } from "./skills.js";

const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

export const DEGREES = [
  { id: "mba", label: "MBA / PGDM", level: "pg", re: /\bM\.?B\.?A\b|\bPGDM\b|\bPGPM?\b|post ?graduate (diploma|program(me)?) in management|master of business/i },
  { id: "mtech", label: "M.Tech / M.E.", level: "pg", re: /\bM\.?\s?Tech\b|\bMaster of (Technology|Engineering)\b/i },
  { id: "mca", label: "MCA", level: "pg", re: /\bMCA\b|master of computer applications/i },
  { id: "msc", label: "M.Sc / M.Com / M.A.", level: "pg", re: /\bM\.\s?Sc\b|\bMSc\b|\bM\.\s?Com\b|\bMCom\b|\bM\.A\.|\bmaster of (science|commerce|arts)\b/i },
  { id: "btech", label: "B.Tech / B.E.", level: "ug", re: /\bB\.?\s?Tech\b|\bB\.E\.|\bbachelor of (technology|engineering)\b/i },
  { id: "bca", label: "BCA", level: "ug", re: /\bBCA\b|bachelor of computer applications/i },
  { id: "bba", label: "BBA / BMS", level: "ug", re: /\bBBA\b|\bBMS\b|bachelor of (business|management)/i },
  { id: "bcom", label: "B.Com", level: "ug", re: /\bB\.?\s?Com\b|bachelor of commerce/i },
  { id: "bsc", label: "B.Sc", level: "ug", re: /\bB\.?\s?Sc\b|bachelor of science/i },
  { id: "ba", label: "B.A.", level: "ug", re: /\bB\.A\b|\bbachelor of arts\b/i },
  { id: "ca", label: "CA", level: "pro", re: /\bchartered accountan(t|cy)\b|\bCA (final|inter|intermediate)\b/i }
];

const HEADING = /^\s*(education|academics?|academic (qualifications?|background|details)|work experience|professional experience|experience|employment( history)?|internships?|summer internship|projects?|skills|technical skills|key skills|certifications?|achievements?|awards?|positions? of responsibility|extra.?curriculars?( activities)?|activities|summary|profile|objective|publications?|interests|languages)\s*:?\s*$/i;

// PDF text breaks long points over several lines. Join them back together.
export function joinWrapped(text) {
  const out = [];
  let inBullet = false;
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[•▪●◦‣∙·*]|^[-–]\s/.test(line);
    if (!bullet && inBullet && /^[a-z0-9(%&]/.test(line)) out[out.length - 1] += ` ${line}`;
    else { out.push(line); inBullet = bullet; }
  }
  return out.join("\n");
}

export function splitSections(text) {
  const out = { top: [] };
  let key = "top";
  for (const line of text.split("\n")) {
    const m = line.length < 60 && line.match(HEADING);
    if (m) {
      const h = m[1].toLowerCase();
      key = /intern/.test(h) ? "internship" : /experience|employment/.test(h) ? "experience" : /educat|academic/.test(h) ? "education" : /project/.test(h) ? "projects" : /skill/.test(h) ? "skills" : /summary|profile|objective/.test(h) ? "summary" : h;
      out[key] ||= [];
    } else out[key].push(line);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join("\n")]));
}

// Month ranges such as "Jun 2023 - Present", "April 2025 – June 2025", "06/2022 to 08/2023".
export function dateRanges(text, now = new Date()) {
  const mon = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
  const point = `(?:${mon}\\s*['’,-]?\\s*(\\d{4}|\\d{2})|(\\d{1,2})\\/(\\d{4}))`;
  const re = new RegExp(`${point}\\s*(?:-|–|—|to)\\s*(?:${point}|(present|current|till date|ongoing|now))`, "gi");
  const year = y => (y.length === 2 ? 2000 + +y : +y);
  const found = [];
  for (const line of text.split("\n")) {
    for (const m of line.matchAll(re)) {
      const s = m[1] ? year(m[2]) * 12 + MONTHS.indexOf(m[1].toLowerCase()) : +m[4] * 12 + (+m[3] - 1);
      const e = m[9] ? now.getFullYear() * 12 + now.getMonth() : m[5] ? year(m[6]) * 12 + MONTHS.indexOf(m[5].toLowerCase()) : +m[8] * 12 + (+m[7] - 1);
      if (e >= s && e - s < 480) found.push({ start: s, end: e, intern: /intern|trainee|summer/i.test(line) });
    }
  }
  return found;
}

function totalMonths(ranges) {
  let total = 0, lastEnd = -1;
  for (const r of [...ranges].sort((a, b) => a.start - b.start)) {
    const start = Math.max(r.start, lastEnd + 1);
    if (r.end >= start) { total += r.end - start + 1; lastEnd = r.end; }
  }
  return total;
}

function guessName(lines) {
  for (const l of lines.slice(0, 6)) {
    const t = l.replace(/\s{2,}.*/, "").trim();
    if (/^[A-Za-z][A-Za-z.' ]{2,40}$/.test(t) && t.split(/\s+/).length <= 4 && !/resume|curriculum|vitae|profile|institute|university|college/i.test(t)) return t;
  }
  return "";
}

export function parseProfile(text, now = new Date()) {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);
  const sec = splitSections(lines.join("\n"));
  const email = clean.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || "";
  const phone = clean.match(/(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/)?.[0] || "";

  const eduText = sec.education || clean;
  const degrees = DEGREES.filter(d => d.re.test(eduText) || d.re.test(sec.top || "")).map(d => d.id);

  // Graduation year: the latest plausible year mentioned under education.
  const years = [...eduText.matchAll(/\b(20[0-3]\d)\b(?:\s*[-–]\s*(\d{2})\b)?/g)]
    .map(m => (m[2] ? 2000 + +m[2] : +m[1]))
    .filter(y => y >= 2000 && y <= now.getFullYear() + 5);
  const gradYear = years.length ? Math.max(...years) : null;

  const cgpaMatch = eduText.match(/(?:CGPA|CPI|GPA)\s*[:\-–]?\s*(\d(?:\.\d{1,2})?)\s*(?:\/\s*(10|4))?/i) || eduText.match(/\b(\d\.\d{1,2})\s*\/\s*(10)\b/);
  const cgpa = cgpaMatch && cgpaMatch[2] !== "4" ? +cgpaMatch[1] : null;

  const workRanges = dateRanges([sec.experience, sec.internship].filter(Boolean).join("\n"), now);
  const internRanges = [...dateRanges(sec.internship || "", now), ...dateRanges(sec.experience || "", now).filter(r => r.intern)];
  const internKeys = new Set(internRanges.map(r => `${r.start}-${r.end}`));
  const fullTime = workRanges.filter(r => !internKeys.has(`${r.start}-${r.end}`));
  const experienceYears = Math.round((totalMonths(fullTime) / 12) * 2) / 2;
  const internshipMonths = totalMonths(internRanges);

  const skills = findSkills(clean);
  const roles = Object.entries(ROLE_FAMILIES)
    .map(([name, f]) => {
      const hits = f.skills.filter(s => skills.includes(s)).length;
      const titleHit = f.title.test([sec.experience, sec.internship, sec.summary].filter(Boolean).join(" ")) ? 0.5 : 0;
      return [name, hits + titleHit];
    })
    .filter(([, s]) => s >= 1.5).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);

  return {
    name: guessName(lines), email, phone, degrees, gradYear, cgpa,
    experienceYears, internshipMonths, skills, roles,
    cities: findCities(sec.top || "").slice(0, 1)
  };
}

// Removes personal identifiers before any text leaves the browser.
export function redact(text, name = "") {
  let t = text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/(?:https?:\/\/|www\.)\S+|\b(?:linkedin|github)\.com\/\S+/gi, "[link]")
    .replace(/(?:\+?\d{1,3}[\s-]?)?\b\d{5}[\s-]?\d{5}\b/g, "[phone]")
    .replace(/^.*\b(date of birth|d\.?o\.?b|father'?s name|mother'?s name|address|aadhaar|pan (no|number)|passport)\b.*$/gim, "");
  for (const part of name.split(/\s+/).filter(p => p.length > 2))
    t = t.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "[name]");
  return t;
}
