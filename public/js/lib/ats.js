// Instant resume review. No AI, no network.
import { splitSections } from "./profile.js";
import { findSkills } from "./skills.js";

const VERBS = /^(led|built|created|designed|developed|analy[sz]ed|launched|improved|increased|reduced|managed|drove|delivered|automated|conducted|prepared|researched|executed|implemented|achieved|generated|optimi[sz]ed|negotiated|organi[sz]ed|coordinated|initiated|streamlined|forecasted|modelled|modeled|presented|trained|mentored|established|identified|evaluated|collaborated|spearheaded|planned|wrote|tested|deployed|secured|won|ranked|headed|supported|assessed|devised|mapped|tracked)\b/i;
const WEAK = /\b(responsible for|worked on|helped (with|in)|involved in|duties included|participated in|assisted in)\b/i;
const BULLET = /^\s*[•▪●◦‣∙·\-–*]\s*/;

export function bulletLines(text) {
  const sec = splitSections(text);
  const body = [sec.experience, sec.internship, sec.projects].filter(Boolean).join("\n") || text;
  return body.split("\n").map(l => l.trim()).filter(l => (BULLET.test(l) || VERBS.test(l) || WEAK.test(l)) && l.replace(BULLET, "").length > 25);
}

export function reviewResume(text, profile) {
  const sec = splitSections(text);
  const bullets = bulletLines(text).map(l => l.replace(BULLET, ""));
  const words = text.split(/\s+/).filter(Boolean).length;
  const measured = bullets.filter(b => /\d/.test(b.replace(/\b(19|20)\d\d\b/g, ""))).length;
  const verbLed = bullets.filter(b => VERBS.test(b)).length;
  const weak = bullets.filter(b => WEAK.test(b));
  const share = (n) => (bullets.length ? n / bullets.length : 0);
  const items = [
    { name: "Contact details", max: 10, got: (profile.email ? 5 : 0) + (profile.phone ? 5 : 0), tip: "Put an email address and a mobile number at the top." },
    { name: "Standard sections", max: 20, got: [sec.education, sec.skills, sec.experience || sec.internship, sec.projects || sec.achievements || sec["positions of responsibility"]].filter(Boolean).length * 5, tip: "Use plain headings: Education, Experience or Internships, Projects, Skills." },
    { name: "Results with numbers", max: 25, got: Math.round(Math.min(1, share(measured) / 0.6) * 25), tip: `${measured} of ${bullets.length} points carry a number. Add scale, percentages, money or time saved where true.` },
    { name: "Strong opening verbs", max: 20, got: Math.round(Math.min(1, share(verbLed) / 0.8) * 20), tip: "Start each point with what you did: Built, Analysed, Led, Reduced." },
    { name: "Clear wording", max: 10, got: bullets.length ? Math.max(0, 10 - weak.length * 3) : 0, tip: weak.length ? `Rewrite phrases like "responsible for" or "worked on" (${weak.length} found).` : "Write your experience as short bullet points." },
    { name: "Length", max: 5, got: words >= 200 && words <= 900 ? 5 : 2, tip: `Your resume has about ${words} words. Students should aim for one page, 250 to 700 words.` },
    { name: "Skills listed", max: 10, got: Math.min(10, profile.skills.length), tip: "List the tools and methods you can defend in an interview." }
  ];
  return { score: items.reduce((a, i) => a + i.got, 0), items };
}

// Flags figures the AI added that the original line never contained.
export function guardNumbers(original, improved) {
  const nums = s => (s.match(/\d+(?:[.,]\d+)*/g) || []).map(n => n.replace(/,/g, ""));
  const have = new Set(nums(original));
  return String(improved).replace(/\d+(?:[.,]\d+)*/g, n => (have.has(n.replace(/,/g, "")) ? n : "[add figure]"));
}

// ---------- ATS score checker ----------
const STOP = new Set("about above after again against also among an and any are as at be been being below between both but by can candidate candidates company could did do does during each etc experience few for from further good great had has have having he her here his how in including into is it its job join just looking may more most must not of off on once only or other our out over own per plus preferred role roles same shall she should skills so some such team than that the their them then there these they this those through to under until up very was we well were what when where which while who will with within work working would year years you your strong ability knowledge understanding required requirements responsibilities qualification qualifications using across based new key related relevant ensure support provide various multiple level high day equal opportunity apply india".split(" "));
const ICONS = /[-☀-➿]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]/g;
const HEADINGS = { Education: /^\s*(education|academic (details|qualifications?|background)|academics|scholastic)/im, Experience: /^\s*(work experience|professional experience|experience|employment|internships?|work history)/im, Projects: /^\s*(projects?|academic projects|live projects?|case competitions?|achievements|positions? of responsibility|extra[- ]curricular)/im, Skills: /^\s*(skills|technical skills|key skills|core competencies|tools|certifications?)/im };
const DATE = /\b((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*'?\d{2,4}|\d{1,2}\/\d{4}|(19|20)\d\d)\b/gi;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Words and phrases a job description leans on: known skills first, then repeated terms.
export function jdKeywords(jd) {
  const skills = findSkills(jd);
  const counts = new Map();
  for (const w of String(jd).toLowerCase().match(/[a-z][a-z+#.&-]{2,}/g) || []) {
    const t = w.replace(/[.-]+$/, "");
    if (t.length < 4 || STOP.has(t)) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  const lowSkills = skills.map(s => s.toLowerCase()).join(" ");
  const stem = t => t.replace(/(ies|es|s)$/, "");
  const terms = [...counts].filter(([t, n]) => n >= 2 && !lowSkills.includes(stem(t))).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  return [...skills, ...terms].slice(0, 24);
}

export function hasKeyword(text, k, profile) {
  if (profile?.skills?.includes(k)) return true;
  return new RegExp(`(^|[^a-z])${esc(k.toLowerCase())}`, "i").test(text);
}

export function atsReport(text, profile, jd = "", file = {}) {
  const base = reviewResume(text, profile);
  const pick = n => base.items.find(i => i.name === n);
  const sec = Object.entries(HEADINGS).map(([n, re]) => [n, re.test(text)]);
  const icons = (text.match(ICONS) || []).length;
  const lines = text.split("\n").filter(l => l.trim());
  const wideGaps = lines.filter(l => /\S\s{6,}\S/.test(l)).length;
  const dates = (text.match(DATE) || []).length;
  const linkedin = /linkedin\.com\/in\//i.test(text);
  const words = text.split(/\s+/).filter(Boolean).length;
  const groups = [];
  const g = (name, max, got, ok, tip, extra) => groups.push({ name, max, got: Math.max(0, Math.min(max, Math.round(got))), state: got >= max * 0.85 ? "pass" : got >= max * 0.5 ? "warn" : "fail", ok, tip, ...extra });

  const fileOk = !file.ext || ["pdf", "docx"].includes(file.ext);
  g("Readable by ATS software", 20, 10 + (fileOk ? 5 : 2) + (icons === 0 ? 5 : icons < 4 ? 3 : 0) - Math.min(5, Math.floor(wideGaps / 4)),
    "The text came out cleanly, so software can read it.",
    [!fileOk && "Send a PDF or Word (.docx) file. Some portals cannot read other formats.", icons && `Remove ${icons} icon${icons > 1 ? "s" : ""} or special symbol${icons > 1 ? "s" : ""}. Write "Email:" and "Phone:" as plain words.`, wideGaps >= 4 && "Parts of the page look like side-by-side columns or tables. A single column reads in the right order."].filter(Boolean).join(" ") || "");
  const contact = (profile.email ? 4 : 0) + (profile.phone ? 4 : 0) + (linkedin ? 2 : 0);
  g("Contact details", 10, contact, "Email, phone and LinkedIn are all present.",
    [!profile.email && "Add an email address.", !profile.phone && "Add a mobile number.", !linkedin && "Add your LinkedIn profile link (linkedin.com/in/...)."].filter(Boolean).join(" "));
  const found = sec.filter(([, y]) => y).length;
  g("Standard section headings", 15, (found / 4) * 15, "Uses headings that ATS software looks for.",
    `Add plain headings for: ${sec.filter(([, y]) => !y).map(([n]) => n).join(", ")}. Avoid creative titles like "My Journey".`, { headings: sec });

  let keywords = null;
  const jdText = String(jd).trim();
  if (jdText.length > 60) {
    const want = jdKeywords(jdText);
    const have = want.filter(k => hasKeyword(text, k, profile));
    keywords = { want, have, missing: want.filter(k => !have.includes(k)) };
    g("Keyword match with the job", 25, want.length ? (have.length / want.length) * 25 * 1.15 : 12,
      "Covers most of the words this job uses.",
      keywords.missing.length ? `Missing from your resume: ${keywords.missing.slice(0, 8).join(", ")}. Add the ones you genuinely have, in the job's own wording.` : "");
  } else {
    g("Keyword match with the job", 25, Math.min(1, profile.skills.length / 12) * 18,
      "Lists plenty of recognisable skills.",
      "Paste a job description to see exactly which of its keywords your resume is missing. Without one, this part is scored on your skills list only.", { noJd: true });
  }
  const num = pick("Results with numbers"), verb = pick("Strong opening verbs"), clear = pick("Clear wording");
  g("Results with numbers", 10, (num.got / num.max) * 10, "Most points show a result or scale.", num.tip);
  g("Action verbs and clear wording", 10, (verb.got / verb.max) * 6 + (clear.got / clear.max) * 4, "Points start with what you did.", [verb.got < verb.max && verb.tip, clear.got < clear.max && clear.tip].filter(Boolean).join(" "));
  g("Dates on experience", 5, dates >= 4 ? 5 : dates >= 2 ? 3 : 0, "Dates are present and in a readable format.", "Give every role, internship and degree a date, written like Jun 2024 – May 2025.");
  g("Length", 5, words >= 250 && words <= 800 ? 5 : words >= 180 && words <= 1000 ? 3 : 1, `About ${words} words, a good length.`, `About ${words} words. For students, one page of 250 to 700 words works best.`);

  const score = groups.reduce((a, x) => a + x.got, 0);
  const grade = score >= 80 ? "Strong" : score >= 65 ? "Good" : score >= 45 ? "Needs work" : "Weak";
  return { score, grade, groups, keywords, words };
}
