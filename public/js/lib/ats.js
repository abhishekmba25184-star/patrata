// Instant resume review. No AI, no network.
import { splitSections } from "./profile.js";

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
