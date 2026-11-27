// AI mock interview: questions from the job and resume, typed or spoken answers, a score and a better answer for each.
import { el, store, downloadBlob } from "../lib/dom.js";
import { callAi, consentBox, personalise, aiEnabled } from "../lib/aiclient.js";

const HISTORY = "patrata:interviews";
const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
const canSpeak = "speechSynthesis" in window;
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const band = s => (s >= 8 ? "strong" : s >= 6 ? "good" : s >= 4 ? "fair" : "weak");
const BAND = { strong: "Strong", good: "Good", fair: "Needs work", weak: "Weak" };

function scoreRing(score, size = "") {
  return el("div", { class: `iv-ring ${band(score)} ${size}`, style: `--p:${score * 10}`, role: "img", "aria-label": `${score} out of 10` }, el("b", {}, String(score)), el("span", {}, "/10"));
}

export function mountInterview(root, getCtx) {
  let qs = [], idx = 0, results = [], timer = null, secs = 0, rec = null, listening = false, jobLabel = "";
  const voice = el("input", { type: "checkbox", checked: store.get("patrata:ivvoice", false), onchange: e => store.set("patrata:ivvoice", e.target.checked) });
  const style = el("select", { "aria-label": "Interview type" }, ["Mixed", "HR and behavioural", "Role and technical", "Resume deep-dive", "Case and guesstimate"].map(v => el("option", { value: v }, v === "Mixed" ? "Mixed, like a real interview" : v)));
  const level = el("select", { "aria-label": "Level" },
    el("option", { value: "a campus placement interview for a fresher" }, "Campus placement or fresher"),
    el("option", { value: "an interview for a candidate with 1 to 3 years of experience" }, "1 to 3 years of experience"),
    el("option", { value: "an internship interview" }, "Internship"));
  const count = el("select", { "aria-label": "Number of questions" }, el("option", { value: "5" }, "5 questions, about 15 minutes"), el("option", { value: "8" }, "8 questions, about 25 minutes"));
  const start = el("button", { type: "button", class: "btn" }, "Start the interview");
  const msg = el("p", { class: "status", role: "status" });
  const stage = el("div", { class: "iv-stage" });
  const off = el("p", { class: "warnline", hidden: true }, "The AI interviewer is switched off on this site right now.");
  const hist = el("div", { class: "iv-history" });

  const setup = el("div", { class: "tool-form" },
    el("div", { class: "grid3" }, el("label", { class: "f" }, "Interview type", style), el("label", { class: "f" }, "Level", level), el("label", { class: "f" }, "Length", count)),
    canSpeak && el("label", { class: "consent" }, voice, el("span", {}, "Read each question aloud, like a real interviewer")),
    consentBox(), el("div", { class: "row" }, start), msg, off, hist);
  root.replaceChildren(el("div", { class: "tool interview" },
    el("div", { class: "tool-head" }, el("h3", {}, "Mock interview"), el("p", {}, `An AI interviewer asks questions built from this job and your resume. Answer by typing${Speech ? " or speaking" : ""}, and get a score, what worked, what was missing and a stronger answer after each one.`)),
    setup, stage));
  aiEnabled().then(on => { if (!on) { off.hidden = false; start.disabled = true; } });
  showHistory();

  start.addEventListener("click", async () => {
    const c = getCtx();
    if (!c?.text) return (msg.textContent = "Add your resume first.");
    if (!c.job?.text || c.job.text.length < 40) return (msg.textContent = "Add the job: its title, company and description.");
    start.disabled = true; msg.textContent = "Preparing your interviewer. This takes about 15 seconds.";
    try {
      const d = await callAi("questions", { text: c.text, profile: c.profile, job: c.job.text, style: style.value, level: level.value, count: +count.value });
      qs = d.questions; idx = 0; results = []; jobLabel = [c.job.title, c.job.company].filter(Boolean).join(" at ") || "this job";
      msg.textContent = ""; setup.hidden = true; ask();
    } catch (e) { msg.textContent = e.message; }
    start.disabled = false;
  });

  function say(text) {
    if (!canSpeak || !voice.checked) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = speechSynthesis.getVoices().find(v => /en-IN/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^en/i.test(v.lang));
    if (v) u.voice = v;
    u.rate = 0.98; speechSynthesis.speak(u);
  }
  function startClock(node) {
    clearInterval(timer); secs = 0; node.textContent = "0:00";
    timer = setInterval(() => { secs++; node.textContent = fmtTime(secs); node.classList.toggle("long", secs > 150); }, 1000);
  }
  function stopListening() { listening = false; try { rec?.stop(); } catch {} }

  function ask() {
    const q = qs[idx];
    const answer = el("textarea", { rows: 7, "aria-label": "Your answer", placeholder: "Answer as you would in the room. Aim for one to two minutes: the situation, what you did, and the result." });
    const words = el("span", { class: "charcount" }, "0 words");
    answer.addEventListener("input", () => { const n = answer.value.trim().split(/\s+/).filter(Boolean).length; words.textContent = `${n} word${n === 1 ? "" : "s"}`; });
    const clock = el("span", { class: "iv-clock", "aria-label": "Time on this question" }, "0:00");
    const submit = el("button", { type: "button", class: "btn" }, "Submit answer");
    const status = el("p", { class: "status", role: "status" });
    const feedback = el("div", { class: "iv-feedback" });
    const hint = el("details", { class: "iv-hint" }, el("summary", {}, "What a strong answer covers"), el("p", {}, q.why), el("ul", {}, q.lookFor.map(x => el("li", {}, x))));

    let mic = null;
    if (Speech) {
      mic = el("button", { type: "button", class: "btn alt mic", "aria-pressed": "false" }, el("span", { class: "dot", "aria-hidden": "true" }), "Answer by speaking");
      mic.addEventListener("click", () => {
        if (listening) { stopListening(); return; }
        rec = new Speech(); rec.lang = "en-IN"; rec.continuous = true; rec.interimResults = true;
        let base = answer.value ? `${answer.value.trim()} ` : "";
        rec.onresult = ev => {
          let fin = "", interim = "";
          for (let i = ev.resultIndex; i < ev.results.length; i++) (ev.results[i].isFinal ? (fin += ev.results[i][0].transcript) : (interim += ev.results[i][0].transcript));
          if (fin) base += `${fin.trim()} `;
          answer.value = base + interim; answer.dispatchEvent(new Event("input"));
        };
        rec.onerror = ev => { status.textContent = ev.error === "not-allowed" ? "Allow microphone access in your browser to answer by speaking." : ev.error === "no-speech" ? "No speech heard. Try again closer to the microphone." : "Speech input stopped. You can keep typing."; };
        rec.onend = () => { if (listening) { try { rec.start(); } catch { listening = false; } } if (!listening) { mic.classList.remove("on"); mic.setAttribute("aria-pressed", "false"); mic.lastChild.textContent = "Answer by speaking"; } };
        try { rec.start(); listening = true; mic.classList.add("on"); mic.setAttribute("aria-pressed", "true"); mic.lastChild.textContent = "Stop recording"; status.textContent = "Listening. Speak your answer; it appears in the box."; }
        catch { status.textContent = "Speech input could not start. You can type your answer."; }
      });
    }

    submit.addEventListener("click", async () => {
      stopListening();
      const c = getCtx();
      submit.disabled = true; status.textContent = "Your interviewer is reviewing the answer…";
      try {
        const g = await callAi("grade", { text: c.text, profile: c.profile, job: c.job.text, question: q.q, answer: answer.value, lookFor: q.lookFor });
        clearInterval(timer);
        results[idx] = { q: q.q, kind: q.kind, answer: answer.value, secs, ...g, better: personalise(g.better, c.profile) };
        status.textContent = "";
        showFeedback(results[idx], feedback, () => ask(), next);
        submit.hidden = true; skip.hidden = true; answer.readOnly = true; if (mic) mic.hidden = true;
      } catch (e) { status.textContent = e.message; submit.disabled = false; }
    });
    const skip = el("button", { type: "button", class: "btn alt" }, idx === qs.length - 1 ? "Skip and finish" : "Skip question");
    skip.addEventListener("click", () => { stopListening(); clearInterval(timer); results[idx] = { q: q.q, kind: q.kind, skipped: true, score: 0 }; next(); });

    stage.replaceChildren(el("div", { class: "iv-q" },
      el("div", { class: "iv-top" },
        el("span", { class: "iv-step" }, `Question ${idx + 1} of ${qs.length}`), el("span", { class: "iv-kind" }, q.kind), clock,
        canSpeak && el("button", { type: "button", class: "linkbtn", onclick: () => { const was = voice.checked; voice.checked = true; say(q.q); voice.checked = was; } }, "Hear the question")),
      el("div", { class: "iv-bar" }, el("span", { style: `width:${(idx / qs.length) * 100}%` })),
      el("p", { class: "iv-text" }, q.q), hint, answer,
      el("div", { class: "row iv-actions" }, submit, mic, skip, words), status, feedback,
      el("p", { class: "iv-for" }, `Interview for ${jobLabel}`)));
    startClock(clock); say(q.q);
    stage.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    answer.focus({ preventScroll: true });
  }

  function next() {
    idx++;
    if (idx < qs.length) ask(); else finish();
  }

  function showFeedback(r, box, retry, goNext) {
    box.replaceChildren(el("div", { class: `iv-fb ${band(r.score)}` },
      el("div", { class: "iv-fb-head" }, scoreRing(r.score), el("div", {}, el("b", {}, BAND[band(r.score)]), el("p", {}, r.tip))),
      el("div", { class: "iv-cols" },
        el("div", {}, el("h5", {}, "What worked"), r.strengths.length ? el("ul", { class: "good" }, r.strengths.map(s => el("li", {}, s))) : el("p", {}, "Nothing stood out yet.")),
        el("div", {}, el("h5", {}, "What was missing"), r.gaps.length ? el("ul", { class: "gap" }, r.gaps.map(s => el("li", {}, s))) : el("p", {}, "No major gaps."))),
      el("details", { class: "iv-better", open: r.score < 7 }, el("summary", {}, "A stronger answer, built from your resume"), el("p", {}, r.better), el("p", { class: "hint" }, "Use it as a model, in your own words. Fill in anything in [brackets] with what really happened.")),
      el("div", { class: "row" },
        el("button", { type: "button", class: "btn", onclick: goNext }, idx === qs.length - 1 ? "See my interview report" : "Next question"),
        el("button", { type: "button", class: "btn alt", onclick: retry }, "Try this question again"))));
    box.querySelector(".btn").focus({ preventScroll: true });
    box.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  }

  function finish() {
    clearInterval(timer); stopListening(); if (canSpeak) speechSynthesis.cancel();
    const done = results.filter(r => r && !r.skipped);
    const avg = done.length ? Math.round((done.reduce((a, r) => a + r.score, 0) / done.length) * 10) / 10 : 0;
    const gaps = done.flatMap(r => r.gaps).slice(0, 6);
    const weak = results.map((r, i) => ({ r, i })).filter(({ r }) => r && (r.skipped || r.score < 6));
    if (done.length) {
      const h = store.get(HISTORY, []);
      h.unshift({ at: new Date().toISOString(), job: jobLabel, avg, n: done.length });
      store.set(HISTORY, h.slice(0, 12));
    }
    stage.replaceChildren(el("div", { class: "iv-report" },
      el("div", { class: "iv-report-head" }, scoreRing(Math.round(avg), "big"),
        el("div", {}, el("h4", {}, `Interview report: ${avg} out of 10`), el("p", {}, done.length ? `${BAND[band(avg)]} overall across ${done.length} answered question${done.length === 1 ? "" : "s"} for ${jobLabel}.` : "No questions were answered."))),
      el("ol", { class: "iv-rows" }, results.map((r, i) => el("li", {},
        el("span", { class: "t" }, r?.q || qs[i].q),
        el("span", { class: "k" }, r?.kind || qs[i].kind),
        el("span", { class: `s ${r?.skipped ? "skip" : band(r?.score || 0)}` }, r?.skipped ? "Skipped" : `${r.score}/10`),
        el("span", { class: "bar" }, el("span", { style: `width:${r?.skipped ? 0 : (r?.score || 0) * 10}%` }))))),
      gaps.length && el("div", {}, el("h5", {}, "Work on these before the real interview"), el("ul", { class: "gap" }, gaps.map(g => el("li", {}, g)))),
      el("div", { class: "row" },
        weak.length && el("button", { type: "button", class: "btn", onclick: () => { qs = weak.map(({ i }) => qs[i]); idx = 0; results = []; ask(); } }, `Retry my ${weak.length} weakest question${weak.length === 1 ? "" : "s"}`),
        el("button", { type: "button", class: "btn alt", onclick: () => { stage.replaceChildren(); setup.hidden = false; showHistory(); setup.scrollIntoView({ block: "start" }); } }, "New interview"),
        el("button", { type: "button", class: "btn alt", onclick: () => downloadReport(avg) }, "Download report"))));
    stage.scrollIntoView({ block: "start" });
  }

  function downloadReport(avg) {
    const lines = [`Mock interview report: ${jobLabel}`, `Date: ${new Date().toLocaleString("en-IN")}`, `Average score: ${avg} / 10`, ""];
    results.forEach((r, i) => {
      lines.push(`Q${i + 1} (${r?.kind || qs[i].kind}): ${r?.q || qs[i].q}`);
      if (!r || r.skipped) { lines.push("Skipped", ""); return; }
      lines.push(`Score: ${r.score}/10`, `Your answer: ${r.answer}`, `What worked: ${r.strengths.join("; ") || "-"}`, `What was missing: ${r.gaps.join("; ") || "-"}`, `Stronger answer: ${r.better}`, `Tip: ${r.tip}`, "");
    });
    downloadBlob(new Blob([lines.join("\n")], { type: "text/plain" }), `Mock interview - ${jobLabel}.txt`.replace(/[\\/:*?"<>|]+/g, " "));
  }

  function showHistory() {
    const h = store.get(HISTORY, []);
    hist.replaceChildren(...(h.length ? [el("h5", {}, "Your recent practice"), el("ul", {}, h.slice(0, 5).map(x => el("li", {},
      el("span", {}, new Date(x.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })), el("span", {}, x.job), el("b", {}, `${x.avg}/10`))))] : []));
  }

  return { refresh: () => { stopListening(); clearInterval(timer); stage.replaceChildren(); setup.hidden = false; msg.textContent = ""; showHistory(); } };
}
