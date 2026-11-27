// Live filter for the companies directory.
const box = document.getElementById("cofind");
const items = [...document.querySelectorAll(".co-grid li")];
const groups = [...document.querySelectorAll(".co-group")];
const count = document.getElementById("cocount");
const none = document.getElementById("conone");
function apply() {
  const q = box.value.trim().toLowerCase();
  let shown = 0;
  for (const li of items) { const hit = !q || li.dataset.q.includes(q); li.hidden = !hit; if (hit) shown++; }
  for (const g of groups) g.hidden = !g.querySelector("li:not([hidden])");
  none.hidden = shown > 0;
  count.textContent = q ? `${shown} of ${items.length} companies` : "";
}
box.addEventListener("input", apply);
const start = new URLSearchParams(location.search).get("q");
if (start) { box.value = start; apply(); }
