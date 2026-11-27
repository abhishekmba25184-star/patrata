// Small DOM helpers shared by the tools. No page-specific code runs on import.
export const $ = (s, root = document) => root.querySelector(s);

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (k === "value") n.value = v;
    else if (k === "checked") n.checked = Boolean(v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  n.append(...kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false && k !== 0 && k !== "").map(k => (k instanceof Node ? k : String(k))));
  return n;
}

export async function copyText(text, button) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = el("textarea", { style: "position:fixed;left:-9999px" }); t.value = text;
    document.body.append(t); t.select(); document.execCommand("copy"); t.remove();
  }
  if (button) { const was = button.textContent; button.textContent = "Copied"; setTimeout(() => (button.textContent = was), 1500); }
}

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
};

export function downloadBlob(blob, name) {
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
