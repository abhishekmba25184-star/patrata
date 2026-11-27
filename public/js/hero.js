// Home page motion: counts up the live numbers once, and cycles the eligibility slip
// through real openings checked against a sample 2027 MBA fresher.
const $ = s => document.querySelector(s);
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const VERDICT = { eligible: "Eligible", check: "Check criteria", no: "Not eligible yet" };
const TICK = { pass: "met", check: "please check", fail: "not met" };

function make(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function countUp() {
  if (still) return;
  for (const el of document.querySelectorAll("[data-count]")) {
    const target = Number(el.textContent.replace(/[^\d]/g, ""));
    if (!target) continue;
    const t0 = performance.now(), dur = 1100;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-IN");
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = "0";
    requestAnimationFrame(step);
  }
}

async function slip() {
  let data;
  try { const r = await fetch("/data/highlights.json"); data = r.ok ? await r.json() : null; } catch { data = null; }
  const list = data?.samples || [];
  if (!list.length) return;

  const box = $("#slip"), dots = $("#slipdots");
  $("#slipcap").textContent = "Live check: a 2027 MBA fresher against real openings";
  $("#slipnav").hidden = false;
  let i = 0, timer = null, paused = false;

  const buttons = list.map((s, k) => {
    const b = make("button", "dot");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-label", `${s.title} at ${s.company}`);
    b.addEventListener("click", () => { show(k); restart(); });
    dots.append(b);
    return b;
  });

  function show(k) {
    i = (k + list.length) % list.length;
    const s = list[i];
    box.classList.remove("in");
    void box.offsetWidth; // restart the stamp animation
    $("#sliptitle").textContent = s.title;
    $("#slipco").textContent = `${s.company}, ${s.location}`;
    const stamp = $("#slipstamp");
    stamp.className = `stamp ${s.verdict}`;
    stamp.textContent = VERDICT[s.verdict];
    $("#slipchecks").replaceChildren(...s.checks.map((c, n) => {
      const li = make("li", c.state);
      li.style.setProperty("--n", n);
      const t = make("span", "tick"); t.setAttribute("aria-label", TICK[c.state] || c.state);
      li.append(t, make("b", "", c.name), make("span", "", c.detail));
      return li;
    }));
    $("#slipchips").replaceChildren(...s.have.map(x => make("span", "chip have", `✓ ${x}`)), ...s.miss.map(x => make("span", "chip miss", `Not on resume: ${x}`)));
    const link = $("#sliplink");
    link.href = /^https?:\/\//.test(s.url) ? s.url : "/#start";
    link.textContent = `View this opening at ${s.company}`;
    buttons.forEach((b, k2) => b.setAttribute("aria-selected", String(k2 === i)));
    box.classList.add("in");
  }
  function restart() {
    clearInterval(timer);
    if (!still) timer = setInterval(() => { if (!paused && !document.hidden) show(i + 1); }, 5200);
  }
  box.addEventListener("mouseenter", () => (paused = true));
  box.addEventListener("mouseleave", () => (paused = false));
  box.addEventListener("focusin", () => (paused = true));
  box.addEventListener("focusout", () => (paused = false));
  show(0);
  restart();
}

// Specialisation tabs, with arrow-key support.
function specTabs() {
  const tabs = [...document.querySelectorAll(".spec-tabs [role=tab]")];
  const pick = t => {
    tabs.forEach(x => { const on = x === t; x.setAttribute("aria-selected", String(on)); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute("aria-controls")).hidden = !on; });
  };
  tabs.forEach((t, k) => {
    t.tabIndex = k ? -1 : 0;
    t.addEventListener("click", () => pick(t));
    t.addEventListener("keydown", e => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const n = tabs[(k + d + tabs.length) % tabs.length]; n.focus(); pick(n);
    });
  });
}

// Latest community posts on the home page (the section stays hidden when there are none).
async function community() {
  if (!$("#cm-home")) return; // board switched off
  let d = null;
  try { const r = await fetch("/api/community"); d = r.ok ? await r.json() : null; } catch { d = null; }
  const list = (d?.posts || []).slice(0, 4);
  if (!list.length || !$("#cm-home")) return;
  $("#cm-home").replaceChildren(...list.map(p => {
    const a = make("a", "cm-mini-item");
    a.href = "/community/";
    a.append(make("b", "", p.title), make("span", "", `${p.company}, ${p.location}`), make("span", "tag", (p.roles || [])[0] || "General"));
    return a;
  }));
  $("#community").hidden = false;
}

// Sections glide in once as they scroll into view.
function reveal() {
  if (still || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("motion");
  const targets = document.querySelectorAll(".sec-head, .steps li, .spec-wrap, .emplist li, .faq details, .dir li, .stats div");
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("shown"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  targets.forEach((t, k) => { t.classList.add("reveal"); t.style.setProperty("--d", `${(k % 6) * 70}ms`); io.observe(t); });
}

reveal();
countUp();
slip();
community();
specTabs();
