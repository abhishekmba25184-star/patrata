// Hand-written page content. Edit freely: unique, useful writing is what helps search ranking.
export const ROLE_PAGES = {
  "Software Development": { slug: "software-developer", h: "Software developer jobs for freshers and students",
    intro: "Developers build and maintain the applications a company runs on. Entry openings are usually titled software engineer, SDE 1, backend developer or frontend developer.",
    who: "Most employers look for B.Tech, B.E., BCA or MCA candidates, though a strong set of working projects can carry other degrees.",
    prove: ["Two or three deployed projects with a public code link", "One language known well, with data structures practice", "A line on what you tested, measured or made faster"],
    interview: "Expect an online coding round, then one or two interviews on data structures, your projects and basic database and networking concepts." },
  "Data and Analytics": { slug: "data-analyst", h: "Data analyst jobs for freshers and students",
    intro: "Analysts turn raw records into answers a business can act on: why sales dipped, which customers leave, where cost is leaking.",
    who: "Open to engineering, statistics, mathematics, economics, commerce and MBA candidates. Proof of SQL and spreadsheet skill matters more than the degree name.",
    prove: ["A dashboard you built, with the question it answers", "SQL joins and grouping that you can write without help", "One analysis that ended in a recommendation"],
    interview: "Expect a SQL or Excel test and a short case where you explain what data you would pull and why." },
  "Finance": { slug: "finance", h: "Finance jobs for MBA, B.Com and BBA freshers",
    intro: "Finance openings span financial analysis, credit, equity research, treasury, audit and business finance. The daily work and exams that help differ widely between them.",
    who: "MBA Finance, B.Com, BBA, CA and CFA candidates are the usual fit. Check each post, because audit roles often ask for CA articleship while analyst roles may not.",
    prove: ["A three statement or valuation model you built yourself", "Internship work described with deal size, portfolio size or time saved", "Certifications such as NISM or CFA level progress, if you hold them"],
    interview: "Expect accounting linkages, valuation basics, a view on one listed company and a spreadsheet exercise." },
  "Marketing": { slug: "marketing", h: "Marketing jobs and internships for students",
    intro: "Marketing roles cover brand, digital and performance marketing, content, product marketing and research.",
    who: "Open to most degrees. MBA Marketing candidates are preferred for brand management, while digital and content roles reward a visible portfolio.",
    prove: ["A campaign you ran, with spend, reach and result", "Writing or creative samples in one linked folder", "Comfort with Google Analytics or an ad platform"],
    interview: "Expect to critique a campaign and to plan how you would launch a product to a defined audience on a fixed budget." },
  "Sales and Business Development": { slug: "business-development", h: "Business development and sales jobs for freshers",
    intro: "These roles find customers and keep them: inside sales, relationship management, enterprise sales and partnerships. They are among the most common first jobs after graduation.",
    who: "Usually open to any graduate. Read the pay structure carefully and ask how much is fixed and how much depends on targets.",
    prove: ["Sponsorship or fundraising amounts you secured", "Targets you carried and how far you met them", "Languages you can sell in"],
    interview: "Expect a role play, questions on handling rejection and a short pitch for the company's product." },
  "Product": { slug: "product-management", h: "Associate product manager jobs and internships",
    intro: "Product managers decide what gets built and why, working between users, engineers and business teams. Entry seats are few and competitive.",
    who: "Often filled by engineering or MBA graduates, though some posts ask for one or two years of experience even at associate level.",
    prove: ["A product teardown or requirements document", "User interviews you ran and what changed afterwards", "Any product, app or process you took from idea to use"],
    interview: "Expect product design, metrics and prioritisation questions." },
  "Strategy and Consulting": { slug: "business-analyst", h: "Business analyst, strategy and consulting jobs",
    intro: "Roles include business analyst, management trainee, founder's office and consulting analyst. The work is structured problem solving for leadership teams.",
    who: "MBA candidates and strong undergraduates. Founder's office posts often welcome any degree with clear ownership experience.",
    prove: ["Case competition results with the number of teams", "A problem you sized, analysed and recommended a fix for", "Clear slides and a working spreadsheet"],
    interview: "Expect case interviews, guesstimates and detailed questions on your own projects." },
  "Operations and Supply Chain": { slug: "operations", h: "Operations and supply chain jobs for freshers",
    intro: "Operations teams keep goods and services moving: warehousing, procurement, planning, process quality and vendor management.",
    who: "Engineering and MBA Operations candidates are common, and many execution roles take any graduate. Check shift timing and plant or field location.",
    prove: ["A process you shortened or an error rate you reduced", "Event or inventory planning with real volumes", "Lean or Six Sigma training if completed"],
    interview: "Expect situational questions on delays and bottlenecks, plus basic inventory and process measures." },
  "Human Resources": { slug: "human-resources", h: "HR jobs and internships for freshers",
    intro: "HR openings include talent acquisition, HR operations, learning and development and business partnering.",
    who: "MBA HR candidates are preferred for generalist and partner tracks. Recruitment roles often take BBA and other graduates.",
    prove: ["Hiring drives you coordinated, with applicant numbers", "Engagement or training sessions you ran", "Comfort with spreadsheets and HR software"],
    interview: "Expect scenarios on conflict, hiring funnels and basic labour law awareness." },
  "Design": { slug: "ui-ux-design", h: "UI/UX and design jobs for freshers",
    intro: "Design openings range from product interface design to graphics, illustration and video.",
    who: "Your portfolio decides most outcomes, whatever the degree.",
    prove: ["Three case studies showing problem, options and result", "Figma files or finished work behind a single link", "What users or clients said and what you changed"],
    interview: "Expect a portfolio walkthrough and often a timed design task." }
};

export const GUIDES = [
  { slug: "ats-resume-for-freshers", title: "ATS resume for freshers: a practical format guide", desc: "How to write a one page resume that applicant tracking systems can read and recruiters want to finish.",
    body: `<p>Many employers collect applications in an applicant tracking system, usually shortened to ATS. It stores your resume as text and lets recruiters search and filter it. A resume that loses its text, or never uses the words a recruiter searches for, is easy to miss.</p>
<h2>Make the file readable</h2><ul><li>Export a PDF from a word processor. Do not submit a scan or a photo.</li><li>Use one column. Tables, text boxes and sidebars can scramble the reading order.</li><li>Write headings as plain words: Education, Experience, Projects, Skills.</li><li>Keep contact details in the page body, not in the header area.</li></ul>
<h2>Write points that show a result</h2><p>Use this pattern: action, what you did it to, and what changed. "Responsible for social media" says little. "Planned 24 posts for a college festival page and grew followers from 800 to 1,400" gives a recruiter something to ask about. Use only numbers you can explain.</p>
<h2>Use the job's own words, honestly</h2><p>If a post asks for financial modelling and you have built models, say financial modelling. Never paste hidden keywords or list tools you have not used. Interviews expose it quickly.</p>
<h2>Order for a fresher</h2><ol><li>Name and contact details</li><li>Two line summary naming your target role</li><li>Education with year and CGPA or percentage</li><li>Internships and work</li><li>Projects</li><li>Skills and certifications</li><li>Positions of responsibility and achievements</li></ol>` },
  { slug: "mba-fresher-resume", title: "MBA fresher resume: what to put first and what to cut", desc: "A guide for MBA and PGDM students preparing a placement or off-campus resume.",
    body: `<p>An MBA resume has little room and much to say. The goal is not to list everything. It is to make one target role look like the obvious next step.</p>
<h2>Pick the role before editing</h2><p>Keep a separate version for finance, marketing, consulting and operations. Move the most relevant internship, project and competition to the top of each.</p>
<h2>Summer internship</h2><p>Give it the most space. State the business problem, your method, and what the team did with your work. If results are confidential, describe scale with ranges you are permitted to share.</p>
<h2>Case competitions and live projects</h2><p>Name the organiser, your position and the number of participating teams if you know it. A live project is worth including when you can say what you delivered.</p>
<h2>Cut these</h2><ul><li>School level activities, unless exceptional</li><li>Long lists of soft skills</li><li>Photo, parents' names, date of birth and home address</li><li>Declarations and signatures, unless an employer asks</li></ul>` },
  { slug: "off-campus-job-search", title: "Off-campus job search: a weekly plan for students", desc: "A repeatable weekly routine to find and apply for off-campus jobs and internships in India.",
    body: `<p>Applying to everything feels productive and rarely is. A small, steady routine does better.</p>
<h2>Choose your target</h2><p>Write down two role types, three cities and the eligibility you hold: batch, degree, CGPA and months of experience. Skip posts that fail a stated hard requirement.</p>
<h2>A week that works</h2><ol><li>Monday: collect fifteen suitable openings, preferring company career pages.</li><li>Tuesday and Wednesday: tailor your resume for the best eight and apply.</li><li>Thursday: write to alumni at those companies with a short, specific question.</li><li>Friday: practise one test or case.</li><li>Saturday: record what replied and adjust.</li></ol>
<h2>Track it</h2><p>A simple sheet with company, role, date, link and status stops duplicate applications and shows which resume version gets replies.</p>` },
  { slug: "avoid-fake-job-offers", title: "How to spot fake job offers", desc: "Warning signs of recruitment fraud and what students in India can do about it.",
    body: `<p>Students are frequent targets of recruitment fraud. Pause when you see any of these.</p>
<h2>Warning signs</h2><ul><li>Any request for money: registration, training, security deposit, laptop or verification fee.</li><li>An offer without an interview.</li><li>Mail from a free email address claiming to be a large company.</li><li>Pressure to act within hours.</li><li>Requests for one time passwords, bank details or identity documents before a real offer process.</li></ul>
<h2>Check before you share anything</h2><p>Find the role on the company's own website, typed into your browser by you. If it is not there, contact the company through details listed on that site.</p>
<h2>If you have been targeted</h2><p>In India you can report online fraud at <a href="https://cybercrime.gov.in/" rel="noopener">cybercrime.gov.in</a> or call the national cyber crime helpline 1930. Contact your bank at once if money has moved.</p>` }
];

export const FAQ = [
  ["Is it free for students?", "Yes. Uploading a resume, seeing matched jobs, the eligibility check and the resume score are free. The AI rewrite has a daily limit."],
  ["Do you store my resume?", "No. Your file is read inside your browser. If you ask for an AI rewrite, the text is sent to the AI service after email, phone number, links and name are removed as far as the software can detect them."],
  ["Do you show jobs from LinkedIn and Naukri?", "Matched openings come from company career pages and, where live search is switched on, from Google for Jobs listings that may point to large job sites. We also give you ready-made searches that open on LinkedIn, Naukri, Indeed and others."],
  ["How is eligibility decided?", "The site reads experience, batch year, degree and CGPA requirements from the job text and compares them with your profile. It can miss or misread a condition, so always read the full post before applying."],
  ["Will this guarantee me a job?", "No. It helps you find suitable openings and present your real experience well. Employers make every hiring decision."]
];
