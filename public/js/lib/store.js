// Saved jobs, kept in this browser only (no account, nothing sent to a server).
const KEY = "patrata.saved.v1";
export const STATUSES = ["Saved", "Applied", "Test or interview", "Offer", "Not selected"];

export function readSaved() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 300))); } catch { /* storage full or blocked */ }
  document.dispatchEvent(new CustomEvent("saved-change"));
}
export const isSaved = id => readSaved().some(j => j.id === id);
export function toggleSaved(job) {
  const list = readSaved();
  const i = list.findIndex(j => j.id === job.id);
  if (i >= 0) list.splice(i, 1);
  else list.unshift({ id: job.id, title: job.title, company: job.company, location: job.location, url: job.url, source: job.source, status: "Saved", savedAt: new Date().toISOString() });
  write(list);
  return i < 0;
}
export function setStatus(id, status) {
  const list = readSaved();
  const j = list.find(x => x.id === id);
  if (j) { j.status = status; j.changedAt = new Date().toISOString(); write(list); }
}
export function removeSaved(id) { write(readSaved().filter(j => j.id !== id)); }
export const shareLink = j => `https://wa.me/?text=${encodeURIComponent(`${j.title} at ${j.company} (${j.location})\n${j.url}\n\nCheck if you are eligible: ${location.origin}`)}`;
