const STARTER_TERMS = ["FlyWP", "WordPress", "Nginx", "PHP-FPM", "Redis", "MariaDB", "Cloudflare", "Docker Compose", "wp-cli", "502 Bad Gateway"];
const FORMAT_LABELS = { ticket: "Draft support ticket", engineering: "Draft engineering handoff", customer: "Draft customer reply" };
const SAMPLE_TRANSCRIPT = "On the FlyWP site shop.acme.test, customers are seeing a 502 Bad Gateway after the deploy at 14:20 UTC. Nginx error log shows connect() failed while connecting to upstream, upstream is php:9000. The PHP-FPM container restarted twice after deploy; MariaDB is healthy and Redis is reachable. I did not change the server config. It recovers for about a minute after restarting the PHP container, then the 502s return. Need someone to check the PHP-FPM crash log and the deploy diff. Impact is checkout unavailable for all customers since 14:20 UTC.";
const SAMPLE_OUTPUTS = {
  ticket: { title: "Checkout unavailable after deploy — recurring 502 from PHP-FPM", body: "## Summary\nCustomers cannot complete checkout on shop.acme.test. 502 responses began after the deploy at 14:20 UTC.\n\n## Impact\nAll customers are affected; checkout has been unavailable since 14:20 UTC.\n\n## Observed\n- Nginx reports `connect() failed while connecting to upstream`; upstream is `php:9000`.\n- The PHP-FPM container restarted twice after deploy.\n- MariaDB is healthy and Redis is reachable.\n- Restarting the PHP container restores service for about one minute; 502s then return.\n\n## Requested next checks\n- Review the PHP-FPM crash log.\n- Compare the deploy diff.\n\n## Not changed\nServer configuration was not modified.\n\n## Unknowns to confirm\n- Exact deploy identifier / commit SHA.\n- PHP-FPM exit reason and crash timestamps." },
  engineering: { title: "[P1] Recurring 502s on checkout after deploy", body: "## Incident\nCheckout on `shop.acme.test` has returned 502 since 14:20 UTC, immediately after a deploy. Reported impact: all customers.\n\n## Evidence\n- Nginx: `connect() failed while connecting to upstream`; upstream `php:9000`.\n- PHP-FPM container restarted twice.\n- MariaDB healthy; Redis reachable.\n- Manual PHP container restart restores service for ~1 minute, then 502s recur.\n\n## Requested investigation\n1. Inspect PHP-FPM crash logs around 14:20 UTC and subsequent restarts.\n2. Review the deploy diff and identify changes affecting PHP-FPM or its upstream.\n\n## Safety note\nReporter did not modify server configuration.\n\n## Missing data\nDeploy commit / release ID and exact PHP-FPM exit reason are not yet known." },
  customer: { title: "Update: checkout issue under investigation", body: "We’re investigating an issue that is preventing checkout on your site. It began at approximately 14:20 UTC after a deployment.\n\nOur initial checks show that the database and Redis are responding, while the PHP application service is restarting and causing intermittent gateway errors. We’re reviewing the application logs and deployment changes now.\n\nWe’ll share another update as soon as we confirm the cause. We don’t have a confirmed resolution time yet." }
};
const $ = (id) => document.getElementById(id);
const ui = {
  connectionPill: $("connectionPill"), connectionLabel: $("connectionLabel"), recordButton: $("recordButton"), recordCaption: $("recordCaption"), recordSubcaption: $("recordSubcaption"), captureStatus: $("captureStatus"), uploadButton: $("uploadButton"), audioFile: $("audioFile"), dropZone: $("dropZone"), transcriptPanel: $("transcriptPanel"), transcriptInput: $("transcriptInput"), transcriptMeta: $("transcriptMeta"), contextInput: $("contextInput"), termList: $("termList"), termInput: $("termInput"), termForm: $("termForm"), clearTerms: $("clearTerms"), activeTerms: $("activeTerms"), emptyOutput: $("emptyOutput"), draftContent: $("draftContent"), draftTitle: $("draftTitle"), draftBody: $("draftBody"), draftState: $("draftState"), draftButton: $("draftButton"), copyButton: $("copyButton"), modelName: $("modelName"), toast: $("toast"), settingsModal: $("settingsModal"), apiBaseInput: $("apiBaseInput"),
};
let terms = loadTerms();
let format = "ticket";
let recorder = null;
let audioChunks = [];
let recordingStream = null;
let recordingStarted = 0;
let timer = null;
let drafts = 1;
let lastDraft = null;
let apiBase = localStorage.getItem("stackscribe-api-base") || window.STACKSCRIBE_API_BASE || "";

function loadTerms() { try { const saved = JSON.parse(localStorage.getItem("stackscribe-terms")); return Array.isArray(saved) ? saved : STARTER_TERMS.slice(); } catch { return STARTER_TERMS.slice(); } }
function saveTerms() { localStorage.setItem("stackscribe-terms", JSON.stringify(terms)); renderTerms(); }
function safeTerm(value) { return value.trim().replace(/[<>\[\]{}\\]/g, "").slice(0, 49); }
function renderTerms() {
  ui.termList.innerHTML = "";
  terms.forEach((term, index) => {
    const chip = document.createElement("button"); chip.type = "button"; chip.className = "term-chip"; chip.title = "Remove " + term;
    chip.append(document.createTextNode(term)); const x = document.createElement("span"); x.className = "remove"; x.textContent = "×"; chip.append(x);
    chip.addEventListener("click", () => { terms.splice(index, 1); saveTerms(); }); ui.termList.append(chip);
  });
  ui.activeTerms.innerHTML = "";
  terms.slice(0, 6).forEach(term => { const chip = document.createElement("span"); chip.className = "termbar-chip"; chip.textContent = term; ui.activeTerms.append(chip); });
  if (terms.length > 6) { const extra = document.createElement("span"); extra.className = "termbar-chip"; extra.textContent = "+" + (terms.length - 6); ui.activeTerms.append(extra); }
}
function toast(message) { ui.toast.textContent = message; ui.toast.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => ui.toast.classList.remove("show"), 2400); }
function setApiBase(value, persist = true) {
  apiBase = (value || "").trim().replace(/\/$/, "");
  if (persist) localStorage.setItem("stackscribe-api-base", apiBase);
  if (!apiBase) { ui.connectionLabel.textContent = "Demo mode"; ui.connectionPill.classList.remove("connected"); ui.modelName.textContent = "OPEN MODEL · DEMO"; return; }
  ui.connectionLabel.textContent = "Checking API"; ui.connectionPill.classList.remove("connected");
  fetch(apiBase + "/api/health").then(r => r.ok ? r.json() : Promise.reject()).then(data => {
    ui.connectionLabel.textContent = data.ready ? "Stack connected" : "API needs setup";
    ui.connectionPill.classList.toggle("connected", !!data.ready);
    ui.modelName.textContent = data.model ? ("OPEN · " + data.model).toUpperCase() : "OPEN MODEL · CONFIGURE API";
  }).catch(() => { ui.connectionLabel.textContent = "API unreachable"; ui.connectionPill.classList.remove("connected"); ui.modelName.textContent = "OPEN MODEL · API OFFLINE"; });
}
function setStatus(message, ready = false) { ui.draftState.innerHTML = "<i></i> " + message; ui.draftState.classList.toggle("ready", ready); }
function setTranscript(text, source = "Editable before drafting") {
  ui.transcriptInput.value = text; ui.transcriptPanel.hidden = false; ui.transcriptMeta.textContent = source;
  ui.draftButton.disabled = !text.trim(); setStatus(text.trim() ? "Transcript ready" : "Waiting for audio", !!text.trim());
  ui.recordCaption.textContent = text.trim() ? "Transcript ready to review" : "Click to start speaking";
  ui.recordSubcaption.textContent = text.trim() ? "Correct any technical terms, then draft your handoff." : "Talk naturally. We’ll keep the technical detail.";
  ui.captureStatus.textContent = text.trim() ? "TRANSCRIPT READY" : "READY TO CAPTURE";
}
function selectedFormat() { return document.querySelector(".format-tab.active")?.dataset.format || "ticket"; }
function showDraft(data, isDemo = false) {
  lastDraft = data; ui.emptyOutput.hidden = true; ui.draftContent.hidden = false;
  ui.draftTitle.value = data.title || "Technical support handoff"; ui.draftBody.value = data.body || "";
  ui.copyButton.disabled = false; ui.modelName.textContent = isDemo ? "GEMMA · DEMO DRAFT" : (data.model || "OPEN MODEL").toUpperCase();
  const unknowns = data.unknowns || [];
  $("reviewNote").innerHTML = unknowns.length ? `<span>!</span> Verify ${unknowns.length} open question${unknowns.length === 1 ? "" : "s"} before sending.` : "<span>!</span> Review technical details before sending. Unknowns are flagged.";
  ui.draftButton.innerHTML = `<span>✳</span> ${FORMAT_LABELS[selectedFormat()]} <span class="button-arrow">→</span>`;
  setStatus(isDemo ? "Sample draft ready" : "Draft ready for review", true);
}
async function transcribe(file) {
  if (!apiBase) { toast("Connect the Worker API to transcribe audio. Try the sample meanwhile."); return; }
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast("Audio must be 10 MB or smaller."); return; }
  setBusy(true, "TRANSCRIBING WITH SCRIBE…"); setStatus("Scribe is listening", false);
  try {
    const body = new FormData(); body.append("audio", file); body.append("keyterms", JSON.stringify(terms));
    const response = await fetch(apiBase + "/api/transcribe", { method: "POST", body });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "Transcription failed.");
    setTranscript(result.text || "", `Scribe v2 · ${result.keyterms_used || 0} keyterms applied`);
    toast("Transcription complete. Review it before drafting.");
  } catch (error) { toast(error.message || "Could not reach the transcription service."); setStatus("Transcription failed", false); }
  finally { setBusy(false); }
}
async function draftHandoff() {
  const transcript = ui.transcriptInput.value.trim(); if (!transcript) return;
  const target = selectedFormat(); ui.draftButton.disabled = true; ui.draftButton.innerHTML = "<span>✳</span> Structuring the handoff…"; setStatus("Open model is shaping the note", false);
  try {
    if (!apiBase) throw new Error("demo");
    const response = await fetch(apiBase + "/api/draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ transcript, terms, context: ui.contextInput.value.trim(), format: target }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "Drafting failed.");
    showDraft(result, false); drafts++; $("draftCount").textContent = String(drafts).padStart(2, "0"); toast("Open-model draft ready. Review before sending.");
  } catch (error) {
    if (error.message === "demo") { showDraft(SAMPLE_OUTPUTS[target], true); drafts++; $("draftCount").textContent = String(drafts).padStart(2, "0"); toast("Sample output shown. Connect the Worker for open-model drafting."); }
    else { toast(error.message || "Could not reach the drafting service."); setStatus("Draft failed", false); }
  } finally { ui.draftButton.disabled = false; ui.draftButton.innerHTML = `<span>✳</span> ${FORMAT_LABELS[selectedFormat()]} <span class="button-arrow">→</span>`; }
}
function setBusy(busy, label = "READY TO CAPTURE") {
  ui.recordButton.disabled = busy; ui.uploadButton.disabled = busy; ui.captureStatus.textContent = label;
  ui.recordButton.classList.toggle("recording", !!recorder && busy);
}
async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast("Microphone recording is not available here. Upload an audio file instead."); return; }
  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    audioChunks = []; recorder = new MediaRecorder(recordingStream);
    recorder.ondataavailable = event => { if (event.data.size) audioChunks.push(event.data); };
    recorder.onstop = async () => {
      clearInterval(timer); recordingStream?.getTracks().forEach(track => track.stop()); recordingStream = null;
      const blob = new Blob(audioChunks, { type: recorder.mimeType || "audio/webm" }); const duration = Math.round((Date.now() - recordingStarted) / 1000);
      recorder = null; ui.recordButton.classList.remove("recording"); ui.recordButton.setAttribute("aria-label", "Start voice recording"); ui.recordCaption.textContent = "Processing your voice note…";
      if (duration < 1 || blob.size < 1000) { toast("That recording was too short. Try again."); ui.recordCaption.textContent = "Click to start speaking"; return; }
      const extension = (blob.type.split("/")[1] || "webm").split(";")[0].replace("x-", "");
      await transcribe(new File([blob], `stackscribe-note.${extension}`, { type: blob.type }));
    };
    recorder.start(250); recordingStarted = Date.now(); ui.recordButton.classList.add("recording"); ui.recordButton.setAttribute("aria-label", "Stop recording"); ui.captureStatus.textContent = "RECORDING · 00:00"; ui.recordCaption.textContent = "Listening to your incident"; ui.recordSubcaption.textContent = "Click again when you’re done";
    document.querySelector(".record-center").classList.add("is-recording"); ui.draftButton.disabled = true;
    timer = setInterval(() => { const sec = Math.floor((Date.now() - recordingStarted) / 1000); ui.captureStatus.textContent = `RECORDING · ${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`; if (sec >= 180) stopRecording(); }, 500);
  } catch { toast("Allow microphone access, or upload a recording instead."); }
}
function stopRecording() { if (recorder && recorder.state !== "inactive") { recorder.stop(); ui.recordButton.classList.remove("recording"); document.querySelector(".record-center").classList.remove("is-recording"); ui.recordCaption.textContent = "Finishing your voice note…"; } }
function loadSample() {
  ui.contextInput.value = "FlyWP manages the host. Do not suggest direct server changes without a Support PIN. Clearly separate observed facts from hypotheses.";
  setTranscript(SAMPLE_TRANSCRIPT, "Sample incident · keyterms: FlyWP, Nginx, PHP-FPM");
  ui.transcriptInput.focus(); toast("Sample loaded. Choose an output and draft the handoff.");
}
function openSettings() { ui.apiBaseInput.value = apiBase; ui.settingsModal.hidden = false; ui.apiBaseInput.focus(); }

ui.termForm.addEventListener("submit", event => { event.preventDefault(); const term = safeTerm(ui.termInput.value); if (!term) return; if (terms.some(t => t.toLowerCase() === term.toLowerCase())) { toast("That term is already in your termbook."); return; } terms.push(term); saveTerms(); ui.termInput.value = ""; ui.termInput.focus(); });
ui.clearTerms.addEventListener("click", () => { terms = STARTER_TERMS.slice(); saveTerms(); toast("Starter termbook restored."); });
$("manageTerms").addEventListener("click", () => { ui.termInput.focus(); toast("Add or remove terms in the left sidebar."); });
ui.recordButton.addEventListener("click", () => recorder ? stopRecording() : startRecording());
ui.uploadButton.addEventListener("click", () => ui.audioFile.click());
ui.audioFile.addEventListener("change", () => { if (ui.audioFile.files[0]) transcribe(ui.audioFile.files[0]); ui.audioFile.value = ""; });
$("demoButton").addEventListener("click", loadSample);
ui.draftButton.addEventListener("click", draftHandoff);
document.querySelectorAll(".format-tab").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".format-tab").forEach(tab => { tab.classList.remove("active"); tab.setAttribute("aria-selected", "false"); }); button.classList.add("active"); button.setAttribute("aria-selected", "true");
  ui.draftButton.innerHTML = `<span>✳</span> ${FORMAT_LABELS[selectedFormat()]} <span class="button-arrow">→</span>`;
  if (ui.draftContent.hidden) return;
  if (lastDraft && ui.modelName.textContent.includes("DEMO")) showDraft(SAMPLE_OUTPUTS[selectedFormat()], true);
  else { setStatus("Choose Draft to change format", false); }
}));
ui.copyButton.addEventListener("click", async () => { const text = `${ui.draftTitle.value}\n\n${ui.draftBody.value}`; try { await navigator.clipboard.writeText(text); toast("Handoff copied to clipboard."); } catch { ui.draftBody.select(); document.execCommand("copy"); toast("Handoff copied."); } });
$("setupButton").addEventListener("click", openSettings); $("settingsButton").addEventListener("click", openSettings); $("closeSettings").addEventListener("click", () => ui.settingsModal.hidden = true);
ui.settingsModal.addEventListener("click", event => { if (event.target === ui.settingsModal) ui.settingsModal.hidden = true; });
$("saveApiBase").addEventListener("click", () => { setApiBase(ui.apiBaseInput.value); ui.settingsModal.hidden = true; toast("API endpoint saved in this browser."); });
$("helpButton").addEventListener("click", () => toast("Scribe keyterms guide transcription; an open model structures the note. Nothing is sent without your review."));
$("historyButton").addEventListener("click", () => toast("Draft history is not enabled in this first cut. Your audio is never retained."));
ui.dropZone.addEventListener("dragover", event => { event.preventDefault(); ui.dropZone.classList.add("dragover"); });
ui.dropZone.addEventListener("dragleave", () => ui.dropZone.classList.remove("dragover"));
ui.dropZone.addEventListener("drop", event => { event.preventDefault(); ui.dropZone.classList.remove("dragover"); const file = event.dataTransfer.files?.[0]; if (file) transcribe(file); });
document.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); startRecording(); } if (event.key === "Escape") ui.settingsModal.hidden = true; });
renderTerms(); setApiBase(apiBase, false);
