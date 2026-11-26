// Pre-filled searches on other job sites. These are ordinary links: nothing is scraped.
import { ROLE_FAMILIES } from "./lib/skills.js";
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function portalLinks(p) {
  const roles = p.roles.length ? p.roles : ["Strategy and Consulting"];
  const q = ROLE_FAMILIES[roles[0]].query;
  const city = p.cities[0] && p.cities[0] !== "Remote" ? p.cities[0].replace(" NCR", "") : "";
  const place = city || "India";
  const fresher = p.experienceYears < 1;
  const links = roles.map(r => {
    const rq = ROLE_FAMILIES[r].query;
    return { name: `LinkedIn: ${rq}`, note: `${fresher ? "Internship and entry level roles" : "Roles"} in ${place}`,
      url: `https://www.linkedin.com/jobs/search/?${new URLSearchParams({ keywords: rq, location: city ? `${city}, India` : "India", ...(fresher ? { f_E: "1,2" } : {}) })}` };
  });
  links.push(
    { name: "Naukri", note: `${q} jobs in ${place}`, url: `https://www.naukri.com/${slug(q)}-jobs-in-${slug(place)}` },
    { name: "Indeed", note: `${q} jobs in ${place}`, url: `https://in.indeed.com/jobs?${new URLSearchParams({ q: fresher ? `${q} fresher` : q, l: place })}` },
    { name: "Internshala", note: `Internships for ${q}`, url: `https://internshala.com/internships/keywords-${slug(q)}/` },
    { name: "foundit", note: `${q} openings`, url: `https://www.foundit.in/srp/results?${new URLSearchParams({ query: q, locations: city })}` },
    { name: "Google Jobs", note: "Listings from across company career pages", url: `https://www.google.com/search?${new URLSearchParams({ q: `${q} ${fresher ? "fresher " : ""}jobs in ${place}`, udm: "8" })}` },
    { name: "Unstop", note: "Hiring challenges and case competitions", url: "https://unstop.com/jobs" },
    { name: "National Career Service", note: "Government of India job portal", url: "https://www.ncs.gov.in/" },
    { name: "AICTE Internship Portal", note: "Internships for students", url: "https://internship.aicte-india.org/" }
  );
  return links;
}
