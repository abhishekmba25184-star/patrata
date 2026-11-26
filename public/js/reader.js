// Reads PDF, Word and text files inside the browser. The file is never uploaded.
export async function readResume(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error("This file is larger than 5 MB. Export a smaller PDF and try again.");
  const ext = file.name.split(".").pop().toLowerCase();
  let text = "";
  if (ext === "pdf") text = await readPdf(await file.arrayBuffer());
  else if (ext === "docx") {
    await loadScript("/vendor/mammoth.browser.min.js");
    text = (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  } else if (ext === "txt") text = await file.text();
  else throw new Error("Use a PDF, DOCX or TXT file. Old .doc files need to be saved as .docx first.");
  if (text.replace(/\s/g, "").length < 150) throw new Error("No readable text found. This looks like a scanned image. Upload the original PDF or paste the text.");
  return text;
}

async function readPdf(buffer) {
  const pdfjs = await import("/vendor/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let n = 1; n <= Math.min(doc.numPages, 5); n++) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    // Rebuild lines from text positions.
    const rows = [];
    for (const it of items) {
      if (!it.str.trim()) continue;
      const y = it.transform[5];
      let row = rows.find(r => Math.abs(r.y - y) < 3);
      if (!row) rows.push((row = { y, parts: [] }));
      row.parts.push({ x: it.transform[4], w: it.width, s: it.str });
    }
    pages.push(rows.sort((a, b) => b.y - a.y).map(r => {
      let out = "", end = null;
      for (const p of r.parts.sort((a, b) => a.x - b.x)) {
        out += (end !== null && p.x - end > 1.5 ? " " : "") + p.s;
        end = p.x + p.w;
      }
      return out;
    }).join("\n"));
  }
  return pages.join("\n");
}

export function loadScript(src) {
  return new Promise((ok, no) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = Object.assign(document.createElement("script"), { src, onload: ok, onerror: () => no(new Error("A file failed to load. Check your connection and try again.")) });
    document.head.append(s);
  });
}
