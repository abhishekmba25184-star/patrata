// Writes every HTML page, the sitemap and robots.txt. Run: node scripts/build-pages.mjs
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { ROLE_PAGES, GUIDES, FAQ } from "./content.mjs";
import { checkEligibility, normaliseJob } from "../public/js/lib/match.js";

const root = new URL("../", import.meta.url);
const cfg = JSON.parse(await readFile(new URL("site.config.json", root)));
const data = JSON.parse(await readFile(new URL("public/data/jobs.json", root)));
const home = await readFile(new URL("scripts/home.html", root), "utf8");
const BASE = cfg.url.replace(/\/$/, "");
const CITY_PAGES = ["Bengaluru", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad", "Jaipur"];
const MIN_CITY_JOBS = 5;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pages = [];

function layout({ path, title, desc, body, schema = [], index = true, script = "" }) {
  const url = BASE + path;
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${index ? "" : '<meta name="robots" content="noindex,follow">\n'}<link rel="canonical" href="${url}">
${cfg.googleVerification ? `<meta name="google-site-verification" content="${esc(cfg.googleVerification)}">\n` : ""}<meta property="og:type" content="website">
<meta property="og:locale" content="en_IN">
<meta property="og:site_name" content="${esc(cfg.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1f3fa8">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/bricolage-grotesque-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/styles.css">
${schema.map(ld).join("\n")}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap">
<a class="logo" href="/"><span class="mark" aria-hidden="true"></span>${esc(cfg.name)}</a>
<nav aria-label="Main"><a href="/#start">Match my resume</a><a href="/jobs/">Jobs by role</a><a href="/resume-checker/">ATS score</a>${cfg.community ? '<a href="/community/">Community posts</a>' : ""}<a href="/guides/">Guides</a><a href="/#saved" id="navsaved" hidden>Saved jobs <b id="navcount"></b></a></nav>
</div></header>
<main id="main">
${body}
</main>
<footer><div class="wrap">
<div class="cols">
<div><h2>${esc(cfg.name)}</h2><p>Resume-based job matching for students and freshers across India. Applications happen on the employer's or job site's own page.</p></div>
<div><h2>Jobs by role</h2><ul>${Object.values(ROLE_PAGES).slice(0, 6).map(r => `<li><a href="/jobs/${r.slug}-jobs/">${esc(r.slug.replace(/-/g, " "))} jobs</a></li>`).join("")}</ul></div>
<div><h2>Guides</h2><ul>${GUIDES.map(g => `<li><a href="/guides/${g.slug}/">${esc(g.title.split(":")[0])}</a></li>`).join("")}</ul></div>
<div><h2>About</h2><ul><li><a href="/about/">About us</a></li><li><a href="/privacy/">Privacy</a></li><li><a href="/terms/">Terms of use</a></li>${/example\.com$/.test(cfg.email) ? "" : `<li><a href="mailto:${esc(cfg.email)}">Contact</a></li>`}</ul></div>
</div>
<p class="fine">${esc(cfg.name)} is not affiliated with LinkedIn, Naukri or any employer listed. Never pay anyone to apply for a job.</p>
</div></footer>
<script type="module" src="/js/saved.js"></script>
${script}
</body>
</html>
`;
}

async function write(path, opts) {
  const file = path.endsWith("/") ? `public${path}index.html` : `public${path}`;
  await mkdir(new URL(file.replace(/[^/]+$/, ""), root), { recursive: true });
  await writeFile(new URL(file, root), layout({ path, ...opts }));
  if (opts.index !== false) pages.push(path);
}
const crumbs = list => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [["Home", "/"], ...list].map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, item: BASE + p })) });
const trail = list => `<p class="crumbs"><a href="/">Home</a>${list.map(([n, p], i) => (i === list.length - 1 ? ` / ${esc(n)}` : ` / <a href="${p}">${esc(n)}</a>`)).join("")}</p>`;
const cta = `<p><a class="btn" href="/#start">Check which jobs I am eligible for</a></p>`;

// Live numbers and real example openings for the home page.
const jobsList = data.jobs || [];
const byEmployer = {};
for (const j of jobsList) byEmployer[j.company] = (byEmployer[j.company] || 0) + 1;
const SAMPLE = { degrees: ["mba", "bcom"], gradYear: 2027, cgpa: 7.5, cgpaUg: 7.5, cgpaPg: 7.5, experienceYears: 0, experienceMonths: 0, skills: ["Excel", "SQL", "PowerPoint", "Market Research", "Financial Modelling"], roles: [], cities: [] };
const ENTRYISH = /\b(intern|analyst|associate|trainee|executive|graduate|junior|specialist|officer|coordinator)\b/i;
const samples = jobsList
  .map(j => ({ j, r: checkEligibility(SAMPLE, j) }))
  .filter(({ j, r }) => r.checks.some(c => c.name !== "Criteria") && j.title.length < 60 && j.skills.length >= 2)
  .sort((a, b) => (ENTRYISH.test(b.j.title) - ENTRYISH.test(a.j.title)) || (b.r.checks.length - a.r.checks.length));
const picked = [], seenCo = new Set();
for (const want of ["eligible", "check", "eligible", "eligible", "no", "eligible", "check", "eligible"]) {
  const hit = samples.find(x => x.r.verdict === want && !seenCo.has(x.j.company)) || samples.find(x => x.r.verdict === want && !picked.includes(x));
  if (hit && !picked.includes(hit)) { picked.push(hit); seenCo.add(hit.j.company); }
}
const highlights = {
  updated: data.updated, openings: jobsList.length, employers: Object.keys(byEmployer).length,
  cities: new Set(jobsList.flatMap(j => j.cities)).size,
  top: Object.entries(byEmployer).sort((a, b) => b[1] - a[1]).slice(0, 16),
  samples: picked.map(({ j, r }) => ({ title: j.title, company: j.company, location: String(j.location).split(/[;,]/)[0].trim().replace(/\b[a-z]/g, c => c.toUpperCase()), url: j.url, verdict: r.verdict,
    checks: [...r.checks.filter(c => c.name !== "Criteria"),
      (() => { const have = j.skills.filter(x => SAMPLE.skills.includes(x)); const ask = j.skills.slice(0, 4);
        return { name: "Skills", state: have.length ? "pass" : "check", detail: `Asks for ${ask.join(", ")}. ${have.length ? `You have ${have.slice(0, 2).join(" and ")}.` : "None on this resume yet."}` }; })(),
      { name: "Location", state: "pass", detail: `${String(j.location).split(/[;]/)[0].replace(/(\s*,\s*)+/g, ", ").replace(/,\s*$/, "")}${j.cities.includes("Remote") ? ", remote possible" : ""}.` }
    ].slice(0, 4), have: j.skills.filter(s => SAMPLE.skills.includes(s)).slice(0, 3), miss: j.skills.filter(s => !SAMPLE.skills.includes(s)).slice(0, 2) }))
};
await writeFile(new URL("public/data/highlights.json", root), JSON.stringify(highlights));
const hasEmail = !/example\.com$/.test(cfg.email);
const mail = hasEmail ? `<a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>` : "the contact address that will be listed here";
const fmt = n => Number(n).toLocaleString("en-IN");

const tidyPlace = s => String(s || "").split(/;/)[0].replace(/(\s*,\s*)+/g, ", ").replace(/^,\s*|,\s*$/g, "").trim().replace(/\b[a-z]/g, c => c.toUpperCase()) || "India";
// Specialisation hub: live openings per field, fresher-friendly first.
const seniorTitle = j => /\b(senior|sr\.?|lead|head|director|principal|staff|vp|vice president|manager)\b/i.test(j.title) || (j.criteria.minExp ?? 0) > 2;
const ago = d => { const days = Math.floor((Date.now() - Date.parse(d)) / 864e5); return !d || isNaN(days) ? "" : days <= 1 ? "today" : days < 7 ? `${days} days ago` : days < 14 ? "1 week ago" : days < 60 ? `${Math.floor(days / 7)} weeks ago` : ""; };
const specs = Object.entries(ROLE_PAGES).map(([name, r]) => {
  const all = jobsList.filter(j => j.roles.includes(name));
  const entry = all.filter(j => !seniorTitle(j)).sort((a, b) => (a.criteria.minExp ?? 1.5) - (b.criteria.minExp ?? 1.5) || String(b.posted).localeCompare(String(a.posted)));
  return { name, slug: r.slug, total: all.length, entry: entry.length, list: entry.slice(0, 6) };
}).filter(x => x.total);
const SPEC_ORDER = ["Finance", "Marketing", "Data and Analytics", "Sales and Business Development", "Strategy and Consulting", "Operations and Supply Chain", "Human Resources", "Product", "Software Development", "Design"];
specs.sort((a, b) => (SPEC_ORDER.indexOf(a.name) + 1 || 99) - (SPEC_ORDER.indexOf(b.name) + 1 || 99));
const specTabs = specs.map((x, k) => `<button type="button" role="tab" id="spt-${x.slug}" aria-controls="spp-${x.slug}" aria-selected="${k === 0}"><span>${esc(x.name)}</span><b>${fmt(x.total)}</b></button>`).join("");
const specPanels = specs.map((x, k) => `<div role="tabpanel" id="spp-${x.slug}" aria-labelledby="spt-${x.slug}"${k ? " hidden" : ""}>
<p class="spec-sum"><b>${fmt(x.total)}</b> openings in ${esc(x.name.toLowerCase())}, <b>${fmt(x.entry)}</b> of them open to freshers or early-career applicants.</p>
<ol class="spec-list">${x.list.map(j => `<li><a href="${esc(/^https?:/.test(j.url) ? j.url : "/#start")}" target="_blank" rel="noopener nofollow"><span class="t">${esc(j.title)}</span><span class="c">${esc(j.company)}</span><span class="l">${esc(tidyPlace(j.location))}</span>${ago(j.posted) ? `<span class="a">${ago(j.posted)}</span>` : ""}</a></li>`).join("")}</ol>
<p class="spec-cta"><a class="btn" href="/#start">Check my eligibility for these</a><a class="btn alt" href="/jobs/${x.slug}-jobs/">All ${esc(x.name.toLowerCase())} openings</a></p>
</div>`).join("\n");

const DOMAIN_OPTIONS = ["auto", ...Object.keys(ROLE_PAGES)].map(d => `<option value="${esc(d)}">${d === "auto" ? "Detect from the post" : esc(d)}</option>`).join("");
if (cfg.community) await write("/community/", {
  title: `Hiring posts shared by students and recruiters | ${cfg.name}`,
  desc: "Fresh job and internship openings shared by students and recruiters, sorted by specialisation. Every post is reviewed and stays up for 3 days.",
  schema: [crumbs([["Community posts", "/community/"]])],
  body: `<section class="band white"><div class="wrap">
<p class="crumbs"><a href="/">Home</a> / Community posts</p>
<div class="sec-head"><h1>Hiring posts shared by the community</h1><p>Openings that students and recruiters spotted on LinkedIn, in WhatsApp groups and by email. Each post is reviewed before it appears and stays up for 3 days.</p></div>
<div id="cm-off" class="notice" hidden><strong>The community board is opening soon.</strong> Meanwhile, paste any post into "Check a job post" after you upload your resume on the <a href="/#start">home page</a>.</div>
<div id="cm-on" hidden>
<p class="spec-cta" style="margin:0 0 20px"><a class="btn" href="#share">Share a hiring post</a><a class="btn alt" href="/#start">Check my eligibility</a></p>
<div class="chips" id="cm-tabs" role="tablist" aria-label="Filter by specialisation"></div>
<div id="cm-list" class="cm-list" aria-live="polite"></div>
</div>
</div></section>
<section class="band" id="share"><div class="wrap">
<div class="sec-head"><h2>Share a hiring post</h2><p>Open to college and company email addresses. Paste the post and we fill in the details for you; check them before sending.</p></div>
<form class="panel cm-form" id="cm-form" novalidate>
<div class="formgrid">
<div class="wide"><label class="f" for="cm-name">Your name</label><input type="text" id="cm-name" autocomplete="name" maxlength="60"></div>
<div class="wide"><label class="f" for="cm-email">Your college or company email</label><input type="text" id="cm-email" autocomplete="email" inputmode="email" maxlength="120" placeholder="name@college.ac.in"></div>
<div class="full"><label class="f" for="cm-text">Post text</label><textarea id="cm-text" placeholder="Paste the full hiring post here"></textarea></div>
<div class="wide"><label class="f" for="cm-role">Role</label><input type="text" id="cm-role" maxlength="120"></div>
<div><label class="f" for="cm-company">Company</label><input type="text" id="cm-company" maxlength="80"></div>
<div><label class="f" for="cm-location">Location</label><input type="text" id="cm-location" maxlength="120"></div>
<div><label class="f" for="cm-domain">Specialisation</label><select id="cm-domain">${DOMAIN_OPTIONS}</select></div>
<div class="wide"><label class="f" for="cm-apply">Apply link</label><input type="text" id="cm-apply" inputmode="url" placeholder="https://"></div>
<div class="wide"><label class="f" for="cm-applyemail">Or apply by email</label><input type="text" id="cm-applyemail" inputmode="email"></div>
<div class="full"><label class="f" for="cm-source">Link to the original post (optional)</label><input type="text" id="cm-source" inputmode="url" placeholder="https://www.linkedin.com/posts/..."></div>
<div class="hp" aria-hidden="true"><label for="cm-website">Website</label><input type="text" id="cm-website" tabindex="-1" autocomplete="off"></div>
<label class="consent full"><input type="checkbox" id="cm-confirm"><span>This is a genuine opening that was shared publicly, and it does not ask candidates to pay anything.</span></label>
</div>
<p style="margin-top:18px"><button class="btn" id="cm-send">Send for review</button></p>
<p class="status" id="cm-msg" role="status"></p>
</form>
</div></section>`,
  script: '<script type="module" src="/js/community.js"></script>'
});
if (cfg.community) await write("/admin/", {
  title: `Review community posts | ${cfg.name}`, desc: "Private review page.", index: false,
  body: `<section class="band white"><div class="wrap">
<div class="sec-head"><h1>Review community posts</h1><p>Approve genuine openings. Approved posts go live for 3 days, then disappear.</p></div>
<form class="addrow" id="ad-login"><input type="password" id="ad-token" placeholder="Admin password" aria-label="Admin password" autocomplete="current-password"><button class="btn small">Open</button></form>
<p class="status" id="ad-msg" role="status"></p>
<div id="ad-panel" hidden><h2 style="margin-top:20px">Waiting for review <span id="ad-pcount"></span></h2><div id="ad-pending" class="cm-list"></div>
<h2 style="margin-top:34px">Live now <span id="ad-lcount"></span></h2><div id="ad-live" class="cm-list"></div></div>
</div></section>`,
  script: '<script type="module" src="/js/admin.js"></script>'
});

const faq = list => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: list.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
const ATS_FAQ = [
  ["What is an ATS score?", "It estimates how well applicant tracking software can read your resume and how closely it matches a job. Recruiters often search and filter resumes inside this software before reading any of them."],
  ["What is a good ATS score?", "Aim for 80 or more against the job you are applying to. Between 65 and 80 is workable. Below 65, fix the items marked in red first, since they cost the most points."],
  ["Is my resume uploaded?", "No. The file is read inside your browser and is not sent to our server or stored."],
  ["Should I copy every missing keyword into my resume?", "Only add a keyword if you have really used that skill and can talk about it in an interview. Use the job's own wording for things you have done."],
  ["Do columns, tables and icons hurt an ATS score?", "Often, yes. Some systems read two-column layouts in the wrong order and skip icons. A single-column resume with plain headings is the safest choice."]
];

// Home
const faqHtml = FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n");
await write("/", {
  title: `${cfg.name}: Match your resume to jobs and check eligibility | Freshers India`,
  desc: "Upload your resume and find fresher jobs and internships in India that fit it. See eligibility for each opening, score your resume and improve it. Free for students.",
  body: home.replace("{{OPENINGS}}", fmt(highlights.openings)).replace("{{EMPLOYERS}}", fmt(highlights.employers)).replace("{{CITIES}}", fmt(highlights.cities))
    .replaceAll("{{MARQUEE}}", Object.entries(byEmployer).sort((a, b) => b[1] - a[1]).slice(0, 36).map(([n, c]) => `<li><b>${esc(n)}</b><span>${fmt(c)} open</span></li>`).join(""))
    .replace("{{EMPLOYER_LIST}}", highlights.top.map(([n, c]) => `<li><b>${esc(n)}</b><span>${fmt(c)}</span></li>`).join(""))
    .replace(/<!--community-->[\s\S]*?<!--\/community-->/, cfg.community ? "$&" : "").replace("{{SPEC_TABS}}", specTabs).replace("{{SPEC_PANELS}}", specPanels).replace("{{FAQ}}", faqHtml).replace("{{DIRECTORY}}", Object.entries(ROLE_PAGES).map(([n, r]) => `<li><a href="/jobs/${r.slug}-jobs/">${esc(n)} jobs</a></li>`).join("")),
  schema: [
    { "@context": "https://schema.org", "@type": "Organization", name: cfg.name, url: BASE, logo: `${BASE}/favicon.svg`, ...(hasEmail ? { email: cfg.email } : {}) },
    { "@context": "https://schema.org", "@type": "WebSite", name: cfg.name, url: BASE, inLanguage: "en-IN" },
    { "@context": "https://schema.org", "@type": "WebApplication", name: cfg.name, url: BASE, applicationCategory: "BusinessApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "INR" } }
  ],
  script: '<script type="module" src="/js/app.js"></script>\n<script type="module" src="/js/hero.js"></script>'
});

// Role and city pages
await rm(new URL("public/jobs/", root), { recursive: true, force: true });
const fresherFirst = (a, b) => (a.criteria.minExp ?? 1.5) - (b.criteria.minExp ?? 1.5) || String(b.posted).localeCompare(String(a.posted));
const isSenior = j => /\b(senior|sr\.?|lead|head|director|principal|staff|vp|vice president)\b/i.test(j.title) || (j.criteria.minExp ?? 0) > 3;
const updated = data.updated ? new Date(data.updated).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }) : null;
const jobTable = jobs => `<div style="overflow-x:auto"><table><thead><tr><th>Role</th><th>Company</th><th>Location</th><th>Experience asked</th></tr></thead><tbody>${jobs.map(j => `<tr><td><a href="${esc(/^https?:/.test(j.url) ? j.url : "#")}" rel="nofollow noopener" target="_blank">${esc(j.title)}</a></td><td>${esc(j.company)}</td><td>${esc(j.location)}</td><td>${j.criteria.internship ? "Internship" : j.criteria.minExp === null ? "Not stated" : `${j.criteria.minExp}+ years`}</td></tr>`).join("")}</tbody></table></div>`;
const topSkills = jobs => { const m = new Map(); jobs.forEach(j => j.skills.forEach(s => m.set(s, (m.get(s) || 0) + 1))); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 8); };
const hub = [];

for (const [role, r] of Object.entries(ROLE_PAGES)) {
  const all = data.jobs.filter(j => j.roles.includes(role) && !isSenior(j)).sort(fresherFirst);
  const cityLinks = [];
  for (const city of CITY_PAGES) {
    const jobs = all.filter(j => j.cities.includes(city));
    if (jobs.length < MIN_CITY_JOBS) continue; // no thin pages
    const path = `/jobs/${r.slug}-jobs-in-${slugify(city)}/`;
    cityLinks.push([city, path, jobs.length]);
    const skills = topSkills(jobs), companies = [...new Set(jobs.map(j => j.company))];
    const list = [["Jobs by role", "/jobs/"], [role, `/jobs/${r.slug}-jobs/`], [city, path]];
    await write(path, {
      title: `${role} jobs in ${city} for freshers and early careers | ${cfg.name}`,
      desc: `${jobs.length} ${role.toLowerCase()} openings in ${city} from ${companies.length} employers, with experience asked and common skills. Updated ${updated}.`,
      schema: [crumbs(list)],
      body: `<div class="wrap article" style="max-width:960px">${trail(list)}<h1>${esc(role)} jobs in ${esc(city)}</h1>
<p>${jobs.length} openings outside senior grades were listed on ${esc(updated)}, from ${esc(companies.join(", "))}.${skills.length ? ` Skills named most often: ${esc(skills.map(([s, n]) => `${s} (${n})`).join(", "))}.` : ""}</p>${cta}
<h2>Current openings</h2>${jobTable(jobs.slice(0, 40))}
<h2>Who should apply</h2><p>${esc(r.who)}</p><p><a href="/jobs/${r.slug}-jobs/">How to prepare for ${esc(role.toLowerCase())} roles</a></p></div>`
    });
  }
  const path = `/jobs/${r.slug}-jobs/`;
  const skills = topSkills(all);
  hub.push([role, path, all.length]);
  const list = [["Jobs by role", "/jobs/"], [role, path]];
  await write(path, {
    title: `${r.h} in India | ${cfg.name}`,
    desc: `${r.intro.split(". ")[0]}. See eligibility, skills to show, interview preparation and current openings.`,
    schema: [crumbs(list)],
    body: `<div class="wrap article" style="max-width:960px">${trail(list)}<h1>${esc(r.h)}</h1><p>${esc(r.intro)}</p>${cta}
<h2>Who is eligible</h2><p>${esc(r.who)}</p>
<h2>What your resume should show</h2><ul>${r.prove.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
<h2>Interview preparation</h2><p>${esc(r.interview)}</p>
${skills.length ? `<h2>Skills employers are naming now</h2><p>Counted across ${all.length} current openings: ${esc(skills.map(([s, n]) => `${s} (${n})`).join(", "))}.</p>` : ""}
${cityLinks.length ? `<h2>Openings by city</h2><ul>${cityLinks.map(([c, p, n]) => `<li><a href="${p}">${esc(role)} jobs in ${esc(c)}</a>: ${n} openings</li>`).join("")}</ul>` : ""}
<h2>Current openings</h2>${all.length ? `<p>Updated ${esc(updated)}.</p>${jobTable(all.slice(0, 30))}` : "<p>No openings are listed from tracked career pages right now. Upload your resume to get ready-made searches on other job sites.</p>"}</div>`
  });
}
await write("/jobs/", {
  title: `Fresher jobs by role in India | ${cfg.name}`, desc: "Browse fresher and early career openings in India by role: software, data, finance, marketing, sales, product, consulting, operations, HR and design.",
  schema: [crumbs([["Jobs by role", "/jobs/"]])],
  body: `<div class="wrap article">${trail([["Jobs by role", "/jobs/"]])}<h1>Fresher jobs by role</h1><p>Pick a role to see who is eligible, what to show on your resume and which openings are listed now.</p><ul>${hub.map(([r, p, n]) => `<li><a href="${p}">${esc(r)} jobs</a>${n ? `: ${n} listed` : ""}</li>`).join("")}</ul>${cta}</div>`
});

// Guides
for (const g of GUIDES) {
  const list = [["Guides", "/guides/"], [g.title.split(":")[0], `/guides/${g.slug}/`]];
  await write(`/guides/${g.slug}/`, { title: `${g.title} | ${cfg.name}`, desc: g.desc,
    schema: [crumbs(list), { "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.desc, inLanguage: "en-IN", author: { "@type": "Organization", name: cfg.name }, publisher: { "@type": "Organization", name: cfg.name }, image: `${BASE}/og.png`, mainEntityOfPage: `${BASE}/guides/${g.slug}/` }],
    body: `<article class="wrap article">${trail(list)}<h1>${esc(g.title)}</h1>${g.body}${cta}</article>` });
}
await write("/guides/", { title: `Resume and job search guides for students | ${cfg.name}`, desc: "Practical guides on ATS resumes, MBA fresher resumes, off-campus job search and avoiding fake job offers.",
  body: `<div class="wrap article"><h1>Guides for students</h1>${GUIDES.map(g => `<h2><a href="/guides/${g.slug}/">${esc(g.title)}</a></h2><p>${esc(g.desc)}</p>`).join("")}</div>` });

await write("/resume-checker/", { title: `Free ATS resume score checker for students and freshers in India | ${cfg.name}`, desc: "Check your resume's ATS score for free. See if software can read it, which job keywords are missing, and exactly what to fix. Runs in your browser; your file is not uploaded.",
  schema: [crumbs([["ATS score checker", "/resume-checker/"]]), { "@context": "https://schema.org", "@type": "WebApplication", name: `${cfg.name} ATS resume score checker`, url: `${BASE}/resume-checker/`, applicationCategory: "BusinessApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "INR" } }, faq(ATS_FAQ)],
  script: `<script type="module" src="/js/atscheck.js"></script>`,
  body: `<section class="ats-top"><div class="wrap">${trail([["ATS score checker", "/resume-checker/"]])}
<h1>ATS resume score checker</h1>
<p class="lead">Most companies run resumes through applicant tracking software before a recruiter reads them. Check whether yours can be read, whether it uses the job's keywords, and what to fix first.</p>
<div class="ats-grid">
<div class="ats-in">
<div class="drop" id="atsdrop">
<div class="drop-head"><span class="drop-icon" aria-hidden="true"></span><div><h2>Your resume</h2><p>PDF or Word file. It is read on your device and is not stored.</p></div></div>
<label class="consent" id="atsconsent"><input type="checkbox" id="atsagree"><span>I am 18 or older and I agree to the <a href="/terms/">terms</a> and <a href="/privacy/">privacy notice</a>.</span></label>
<div class="row"><button type="button" class="btn" id="atspick">Choose resume file</button><button type="button" class="btn alt" id="atspastebtn">Paste text instead</button></div>
<input type="file" id="atsfile" accept=".pdf,.docx,.txt" hidden>
<p class="filechip" id="atsfilename" hidden></p>
<div id="atspastebox" hidden><label class="f" for="atstext">Resume text</label><textarea id="atstext"></textarea></div>
</div>
<div class="jdbox"><label class="f" for="atsjd">Job description <span class="opt">optional, for a keyword match</span></label><textarea id="atsjd" placeholder="Paste the full job description from the company or job site"></textarea></div>
<button type="button" class="btn big" id="atsgo">Check my ATS score</button>
<p class="status" id="atsmsg" role="status"></p>
</div>
<div class="ats-out" id="atsout" aria-live="polite">
<div class="gauge empty" id="gauge"><svg viewBox="0 0 220 130" aria-hidden="true"><path class="track" d="M20 115 A90 90 0 0 1 200 115"/><path class="fill" id="gaugefill" d="M20 115 A90 90 0 0 1 200 115" pathLength="100"/></svg><div class="gnum"><b id="gscore">?</b><span id="ggrade">out of 100</span></div></div>
<ul class="ats-list" id="atslist">
<li class="ghost"><span></span>Readable by ATS software</li><li class="ghost"><span></span>Contact details</li><li class="ghost"><span></span>Standard section headings</li><li class="ghost"><span></span>Keyword match with the job</li><li class="ghost"><span></span>Results with numbers</li><li class="ghost"><span></span>Action verbs and clear wording</li><li class="ghost"><span></span>Dates on experience</li><li class="ghost"><span></span>Length</li>
</ul>
<div id="atskw"></div>
<div class="row" id="atsnext" hidden><button type="button" class="btn" id="atsjobs">See jobs this resume fits</button><button type="button" class="btn alt" id="atsagain">Check another resume</button></div>
</div>
</div></div></section>
<div class="wrap article">
<h2>What the ATS score looks at</h2><table><thead><tr><th>Check</th><th>Points</th><th>What earns them</th></tr></thead><tbody>
<tr><td>Keyword match with the job</td><td>25</td><td>Your resume uses the skills and terms the job description repeats</td></tr>
<tr><td>Readable by ATS software</td><td>20</td><td>PDF or Word file, one column, no icons in place of words</td></tr>
<tr><td>Standard section headings</td><td>15</td><td>Education, Experience, Projects and Skills under plain headings</td></tr>
<tr><td>Contact details</td><td>10</td><td>Email, mobile number and LinkedIn link</td></tr>
<tr><td>Results with numbers</td><td>10</td><td>Points show scale, percentages, money or time saved</td></tr>
<tr><td>Action verbs and clear wording</td><td>10</td><td>Points start with what you did, without "responsible for"</td></tr>
<tr><td>Dates on experience</td><td>5</td><td>Each role and degree has a date such as Jun 2024</td></tr>
<tr><td>Length</td><td>5</td><td>About one page for students</td></tr></tbody></table>
<p>Each company's software is set up differently, so no outside tool can show the exact score an employer sees. This check follows what these systems commonly read, and a high score does not guarantee a shortlist.</p>
${ATS_FAQ.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}
<p>Read the <a href="/guides/ats-resume-for-freshers/">ATS resume guide for freshers</a>.</p></div>` });

await write("/about/", { title: `About ${cfg.name}`, desc: `Why ${cfg.name} was built for students and freshers in India.`,
  body: `<div class="wrap article"><h1>About ${esc(cfg.name)}</h1><p>Students often apply to openings they are not eligible for and miss the ones they are. ${esc(cfg.name)} reads your resume, compares it with the conditions written in each job post and shows the result openly, so you can spend your effort where it counts.</p><h2>How we work</h2><ul><li>Every listing links to its source, where you apply.</li><li>We do not charge students to apply.</li><li>The AI is instructed never to invent experience, and you approve each change.</li></ul><h2>Contact</h2><p>${mail}</p></div>` });

await write("/privacy/", { title: `Privacy notice | ${cfg.name}`, desc: "What happens to your resume and personal data.",
  body: `<div class="wrap article"><h1>Privacy notice</h1><p>This notice explains what ${esc(cfg.owner)} does with your information. Contact: ${mail}.</p>
<h2>Your resume</h2><p>The file is read inside your browser. We do not upload or save it, and we run no accounts or resume database. Closing the page clears it.</p>
<h2>Job search</h2><p>When live search is on, our server receives the role type, city and experience level you chose, and passes a search phrase to the job search providers we use (Careerjet and OpenWeb Ninja JSearch). Careerjet also requires your IP address and browser type with each search. Your resume is not sent.</p>
<h2>AI rewrite</h2><p>Only if you tick the consent box and press the button, resume text and any job description you pasted go through our server to Google's Gemini API. The software first removes email addresses, phone numbers, links, your detected name and some personal lines. Automatic removal can miss details, so delete anything private before using it. Depending on the plan used, Google may keep this text, have people review it and use it to improve its services. See Google's Gemini API terms.</p>
${cfg.community ? `<h2>Sharing a hiring post</h2><p>When you share a post, we receive your name and college or company email, the post text and the links you add. Your name and email are used only to review the submission; they are never shown on the site and are deleted when the post expires, within 7 days at most. The post itself, without your details, is shown for 3 days after approval. Only share posts that were made public by the employer or recruiter.</p>` : ""}
<h2>Technical records</h2><p>Our host (Cloudflare) processes IP addresses to deliver and protect the site. For the daily AI limit we store a scrambled code made from your IP address and the date for up to one day.</p>
<h2>Your choices</h2><p>You can use job matching and the resume score without the AI rewrite. To withdraw consent, simply stop using that feature. For questions, requests or complaints, email us. You may also approach the Data Protection Board of India where the law provides for it.</p>
<h2>Age</h2><p>This service is for people aged 18 or older.</p></div>` });

await write("/terms/", { title: `Terms of use | ${cfg.name}`, desc: "Terms for using the service.",
  body: `<div class="wrap article"><h1>Terms of use</h1><ul><li>You must be 18 or older and upload only your own resume.</li><li>Job details come from third parties and may be out of date or wrong. Confirm everything on the source page.</li><li>Eligibility results and resume scores are automated guidance, not promises.</li><li>Check every AI suggestion. You are responsible for the truth of your resume.</li><li>We never ask students to pay to apply. Report any such request to ${mail}.</li><li>Do not misuse, overload or copy the service by automated means.</li><li>The service is provided as it is and may change or stop.</li></ul></div>` });

await write("/404.html", { title: `Page not found | ${cfg.name}`, desc: "This page does not exist.", index: false, body: `<div class="wrap article"><h1>This page is not here</h1><p>The opening list may have changed.</p><p><a class="btn" href="/jobs/">Browse jobs by role</a></p></div>` });

const day = (data.updated || new Date().toISOString()).slice(0, 10);
await writeFile(new URL("public/sitemap.xml", root), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `<url><loc>${BASE}${p}</loc>${p.startsWith("/jobs/") && data.updated ? `<lastmod>${day}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`);
await writeFile(new URL("public/robots.txt", root), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\n\nSitemap: ${BASE}/sitemap.xml\n`);
console.log(`Built ${pages.length} indexable pages.`);
