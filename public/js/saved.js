// Header link and the saved jobs tracker on the home page.
import { readSaved, setStatus, removeSaved, STATUSES, shareLink } from "./lib/store.js";

const $ = s => document.querySelector(s);
function make(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "class") n.className = v;
    else n.setAttribute(k, v);
  }
  n.append(...kids.filter(k => k != null));
  return n;
}
const safe = u => (/^https?:\/\//.test(u || "") ? u : "/#start");

function render() {
  const list = readSaved();
  const nav = $("#navsaved");
  if (nav) { nav.hidden = !list.length; $("#navcount").textContent = list.length ? String(list.length) : ""; }
  const box = $("#saved");
  if (!box) return;
  box.hidden = !list.length;
  if (!list.length) return;
  const counts = STATUSES.map(s => [s, list.filter(j => j.status === s).length]).filter(([, n]) => n);
  $("#savedlist").replaceChildren(
    make("p", { class: "saved-sum" }, counts.map(([s, n]) => `${n} ${s.toLowerCase()}`).join(", ")),
    make("ul", { class: "saved-list" }, ...list.map(j => make("li", { class: `st-${STATUSES.indexOf(j.status)}` },
      make("div", { class: "sj" }, make("a", { href: safe(j.url), target: "_blank", rel: "noopener nofollow" }, j.title), make("span", {}, `${j.company}, ${String(j.location || "").split(/[;]/)[0]}`)),
      make("label", { class: "sr" , for: `st-${j.id}` }, "Status"),
      (() => { const sel = make("select", { id: `st-${j.id}`, onchange: e => setStatus(j.id, e.target.value) }, ...STATUSES.map(s => { const o = make("option", { value: s }, s); if (s === j.status) o.selected = true; return o; })); return sel; })(),
      make("a", { class: "btn alt small", href: shareLink(j), target: "_blank", rel: "noopener" }, "Share on WhatsApp"),
      make("button", { type: "button", class: "btn alt small", onclick: () => removeSaved(j.id) }, "Remove"))))
  );
}
document.addEventListener("saved-change", render);
addEventListener("storage", render);
render();

// On phones the menu scrolls sideways, so the tools list opens below the header instead.
const tools = document.querySelector(".navtools");
if (tools) {
  tools.addEventListener("toggle", () => {
    const h = document.querySelector("header.top");
    if (h) document.documentElement.style.setProperty("--navbottom", `${Math.round(h.getBoundingClientRect().bottom) + 6}px`);
  });
  document.addEventListener("click", e => { if (tools.open && !tools.contains(e.target)) tools.open = false; });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && tools.open) { tools.open = false; tools.querySelector("summary").focus(); } });
}
