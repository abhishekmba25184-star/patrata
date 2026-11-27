// Skill dictionary. Add a line here to teach the site a new skill.
// Format: "Display name": ["other spellings", ...]
export const SKILLS = {
  // Technology
  "Python": [], "Java": [], "C++": [], "C#": [], "JavaScript": [], "TypeScript": [], "Go": ["golang"],
  "SQL": ["mysql", "postgresql", "postgres"], "R": ["r programming", "rstudio", "r studio"],
  "HTML/CSS": ["html", "css", "html5", "css3"], "React": ["react.js", "reactjs"], "Node.js": ["nodejs", "node js"],
  "Django": [], "Spring Boot": ["springboot"], "Flutter": [], "Android": ["kotlin"], "iOS": ["swift"],
  "AWS": ["amazon web services"], "Azure": [], "Google Cloud": ["gcp"], "Docker": [], "Kubernetes": [],
  "Git": ["github", "gitlab"], "Linux": [], "REST APIs": ["rest api", "restful"], "System Design": [],
  "Data Structures": ["data structures and algorithms", "dsa"], "Testing": ["selenium", "test automation", "quality assurance"],
  "Cybersecurity": ["information security", "network security"], "DevOps": ["ci/cd"],
  // Data
  "Excel": ["ms excel", "microsoft excel", "advanced excel", "vlookup", "pivot tables"], "Power BI": ["powerbi"], "Tableau": [],
  "Data Analysis": ["data analytics", "business analytics", "analytics"], "Machine Learning": [], "Deep Learning": [],
  "Generative AI": ["genai", "gen ai", "llm", "large language models", "prompt engineering"], "Statistics": ["statistical modelling", "statistical modeling", "regression", "econometrics"],
  "Data Visualisation": ["data visualization", "dashboards", "dashboarding"], "SPSS": [], "SAS": [], "Spark": ["pyspark"], "NLP": ["natural language processing"],
  // Finance
  "Financial Modelling": ["financial modeling", "financial models", "three statement model"], "Valuation": ["dcf", "discounted cash flow", "comparable company analysis"],
  "Equity Research": [], "Financial Analysis": ["ratio analysis", "financial statement analysis"], "Corporate Finance": [], "Investment Banking": ["mergers and acquisitions", "m&a"],
  "Accounting": ["ind as", "ifrs", "gaap", "bookkeeping"], "Taxation": ["gst", "income tax", "direct tax"], "Audit": ["auditing", "internal audit", "statutory audit"],
  "Risk Management": ["credit risk", "market risk", "risk analysis"], "Portfolio Management": ["portfolio analysis", "investment management", "asset management"],
  "FP&A": ["financial planning", "budgeting", "forecasting"], "Derivatives": ["futures and options", "hedging"], "Bloomberg": [], "Tally": [], "SAP": ["sap fico", "sap mm"],
  "Credit Analysis": ["underwriting", "credit appraisal"],
  // Marketing and sales
  "Digital Marketing": ["performance marketing"], "SEO": ["search engine optimisation", "search engine optimization"], "SEM": ["google ads", "paid search"],
  "Social Media Marketing": ["social media", "meta ads", "instagram marketing"], "Content Writing": ["copywriting", "content creation", "content strategy"],
  "Market Research": ["consumer research", "consumer insights"], "Brand Management": ["branding", "brand strategy"], "Product Marketing": [], "Email Marketing": [],
  "Google Analytics": ["ga4"], "CRM": ["salesforce", "hubspot", "zoho crm"], "Business Development": ["lead generation"], "Sales": ["b2b sales", "inside sales", "channel sales"],
  "Key Account Management": ["account management", "client relationship management"], "Negotiation": [], "Go-to-Market Strategy": ["go to market", "gtm"],
  // Product, strategy, operations, people, design
  "Product Management": ["product roadmap", "prd", "product strategy"], "User Research": ["user interviews", "usability testing"], "Figma": [], "UI/UX Design": ["ux design", "ui design", "wireframing", "ui/ux"],
  "Graphic Design": ["photoshop", "illustrator", "canva"], "Video Editing": ["premiere pro", "after effects"],
  "Strategy": ["strategic planning", "business strategy", "corporate strategy"], "Consulting": ["management consulting"], "Case Analysis": ["case competition", "case study"],
  "Project Management": ["pmp", "scrum", "agile", "jira"], "Stakeholder Management": [], "PowerPoint": ["ms powerpoint", "presentation skills"],
  "Supply Chain": ["supply chain management", "scm"], "Operations": ["operations management", "process improvement"], "Logistics": ["warehouse management"],
  "Procurement": ["sourcing", "vendor management"], "Lean Six Sigma": ["six sigma", "lean manufacturing"], "Inventory Management": ["demand planning"],
  "Recruitment": ["talent acquisition", "recruiting", "campus hiring", "lateral hiring", "end-to-end hiring", "hiring process"], "HR Operations": ["human resources", "employee engagement", "payroll", "hrms"], "Learning and Development": ["training and development"],
  "AutoCAD": [], "MATLAB": [], "Communication": ["communication skills"], "Leadership": ["team leadership"]
};

export const ROLE_FAMILIES = {
  "Software Development": { title: /software|developer|\bsde\b|engineer(ing)?\b.*(back|front|full)|back.?end|front.?end|full.?stack|devops|\bqa\b|android|\bios\b|platform engineer/i, skills: ["Java","C++","JavaScript","TypeScript","React","Node.js","Spring Boot","Data Structures","Git","Django","Android","iOS","Flutter","Go","C#","System Design"], query: "software developer" },
  "Data and Analytics": { title: /\bdata\b|analytics|business intelligence|machine learning|\bml\b|\bai\b|statistic/i, skills: ["Python","SQL","Power BI","Tableau","Data Analysis","Machine Learning","Statistics","R","Data Visualisation","Deep Learning","NLP","Spark"], query: "data analyst" },
  "Finance": { title: /financ|invest|equity|treasury|credit|account(ant|s|ing)|audit|\btax|wealth|underwrit|fp&a|valuation|\brisk\b/i, skills: ["Financial Modelling","Valuation","Equity Research","Financial Analysis","Corporate Finance","Investment Banking","Accounting","Taxation","Audit","Risk Management","Portfolio Management","FP&A","Credit Analysis","Derivatives","Tally","Bloomberg"], query: "financial analyst" },
  "Marketing": { title: /marketing|brand|growth|\bseo\b|content|social media|communications?\b|public relations/i, skills: ["Digital Marketing","SEO","SEM","Social Media Marketing","Content Writing","Market Research","Brand Management","Product Marketing","Email Marketing","Google Analytics","Go-to-Market Strategy"], query: "marketing associate" },
  "Sales and Business Development": { title: /sales|business development|account (manager|executive)|key account|relationship manager|partnership|\bbdr\b|\bsdr\b/i, skills: ["Sales","Business Development","CRM","Key Account Management","Negotiation"], query: "business development" },
  "Product": { title: /product (manager|management|analyst|owner|intern|associate|operations)|associate product|\bapm\b/i, skills: ["Product Management","User Research","Go-to-Market Strategy","Figma"], query: "associate product manager" },
  "Strategy and Consulting": { title: /strategy|consult|founder.?s office|ceo.?s? office|chief of staff|business analyst|management trainee/i, skills: ["Strategy","Consulting","Case Analysis","PowerPoint","Stakeholder Management","Project Management"], query: "business analyst" },
  "Operations and Supply Chain": { title: /operations|supply chain|logistics|procurement|warehouse|fulfil|process|vendor/i, skills: ["Supply Chain","Operations","Logistics","Procurement","Lean Six Sigma","Inventory Management","SAP"], query: "operations executive" },
  "Human Resources": { title: /\bhr\b|human resource|talent|recruit|people (partner|operations)|learning and development/i, skills: ["Recruitment","HR Operations","Learning and Development"], query: "human resources" },
  "Design": { title: /design(er)?\b|\bux\b|\bui\b|illustrat|video editor|creative/i, skills: ["Figma","UI/UX Design","Graphic Design","Video Editing"], query: "ui ux designer" }
};

export const CITIES = ["Bengaluru","Mumbai","Delhi NCR","Hyderabad","Chennai","Pune","Kolkata","Ahmedabad","Jaipur","Lucknow","Indore","Chandigarh","Kochi","Coimbatore","Nagpur","Surat","Bhubaneswar","Patna","Guwahati","Visakhapatnam","Vadodara","Remote"];

export const CITY_ALIASES = {
  "Bengaluru": ["bangalore","bengaluru"], "Mumbai": ["mumbai","navi mumbai","thane"], "Delhi NCR": ["delhi","new delhi","gurgaon","gurugram","noida","faridabad","ghaziabad","ncr"],
  "Kochi": ["kochi","cochin"], "Visakhapatnam": ["visakhapatnam","vizag"], "Vadodara": ["vadodara","baroda"], "Remote": ["remote","work from home"]
};

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const GENERIC = new Set(["Sales", "Marketing", "Operations", "Finance", "Recruitment", "Procurement", "Logistics", "Testing", "Consulting", "Accounting", "Audit", "Taxation", "Compliance", "Customer Service"]);
const MATCHERS = Object.entries(SKILLS).map(([name, aliases]) => {
  // Short or ambiguous names are matched strictly.
  if (name === "R") return [name, [/\bR programming\b/i, /\bR ?Studio\b/i, /(?:^|[,|\/•(:]\s*)R(?=\s*(?:[,|\/•)]|$))/m, /\b(?:Python|SQL)\s*(?:,|and|&|\/)\s*R\b/]];
  if (name === "Go") return [name, [/\bgolang\b/i, /\bGo\b(?=\s*(?:,|\/|\)|lang))/]];
  if (name === "Leadership" || name === "Sales") {
    const words = [name, ...aliases];
    const notTeam = name === "Sales" ? "(?!\\s+(?:team|teams|department|dept|function|head|leadership|org|staff)\\b)" : "";
    return [name, words.map(w => new RegExp(`(?<![A-Za-z])${esc(w)}(?![A-Za-z])${notTeam}`, "i"))];
  }
  // "for the sales team" names a team, not a skill.
  const notTeam = GENERIC.has(name) ? "(?!\\s+(?:team|teams|department|dept|function|head|leadership|org|organisation|organization|staff|colleagues)\\b)" : "";
  return [name, [name, ...aliases].map(w => new RegExp(`(?<![A-Za-z0-9+#])${esc(w)}(?![A-Za-z0-9+#])${notTeam}`, "i"))];
});

export function findSkills(text) {
  return MATCHERS.filter(([, res]) => res.some(r => r.test(text))).map(([n]) => n);
}

export function findCities(text) {
  const t = String(text || "").toLowerCase();
  return CITIES.filter(c => (CITY_ALIASES[c] || [c.toLowerCase()]).some(a => new RegExp(`\\b${esc(a)}\\b`).test(t)));
}
