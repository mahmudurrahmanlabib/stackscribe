import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { RateLimiter } from "../index.js";

const limiterBinding = () => ({ idFromName: ip => ip, get: () => ({ fetch: async () => new Response("ok") }) });
const liveEnv = () => ({ ELEVENLABS_API_KEY: "test-eleven", OPENROUTER_API_KEY: "test-openrouter", OPENROUTER_MODEL: "google/gemma-3-12b-it", ALLOWED_ORIGINS: "https://app.test", RATE_LIMITER: limiterBinding() });
const request = (path, { method = "GET", body, origin = "https://app.test", headers = {} } = {}) => new Request(`https://api.test${path}`, { method, headers: { Origin: origin, ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...headers }, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) });

test("health reports missing provider setup without exposing secrets", async () => {
  const response = await worker.fetch(request("/api/health"), { OPENROUTER_MODEL: "google/gemma-3-12b-it" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ready: false, model: "google/gemma-3-12b-it" });
});

test("unlisted origins cannot call paid endpoints", async () => {
  const response = await worker.fetch(request("/api/draft", { method: "POST", body: {}, origin: "https://attacker.test" }), liveEnv());
  assert.equal(response.status, 403);
});

test("draft route sends the selected open model and parses the handoff", async t => {
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; });
  let requestBody;
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /openrouter\.ai\/api\/v1\/chat\/completions$/);
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: "TITLE: PHP-FPM restarts after deploy\nUNKNOWN: deploy SHA\nBODY:\n## Evidence\n`php:9000` returns `502 Bad Gateway`." } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const response = await worker.fetch(request("/api/draft", { method: "POST", body: { transcript: "PHP-FPM restarts, upstream php:9000 returned 502 Bad Gateway", terms: ["PHP-FPM"], format: "engineering" } }), liveEnv());
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(requestBody.model, "google/gemma-3-12b-it");
  assert.equal(result.title, "PHP-FPM restarts after deploy");
  assert.equal(result.unknowns[0], "deploy SHA");
  assert.match(result.body, /php:9000/);
});

test("transcription sends team terms to Scribe as keyterms", async t => {
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; });
  let sentKeyterms;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.elevenlabs.io/v1/speech-to-text");
    sentKeyterms = options.body.get("keyterms");
    assert.equal(options.body.get("model_id"), "scribe_v2");
    return new Response(JSON.stringify({ text: "FlyWP Nginx PHP-FPM 502", language_code: "en" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(2048)], { type: "audio/webm" }), "note.webm");
  form.append("keyterms", JSON.stringify(["FlyWP", "PHP-FPM"]));
  const response = await worker.fetch(request("/api/transcribe", { method: "POST", body: form }), liveEnv());
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(sentKeyterms), ["FlyWP", "PHP-FPM"]);
  assert.equal(result.keyterms_used, 2);
});

test("daily quota is route-specific and enforced", async () => {
  const values = new Map();
  const limiter = new RateLimiter({ storage: { get: async key => values.get(key), put: async (key, value) => values.set(key, value) } });
  const allowed = await limiter.fetch(new Request("https://limit/check", { method: "POST", body: JSON.stringify({ route: "/api/transcribe" }) }));
  assert.equal(allowed.status, 200);
  const day = new Date().toISOString().slice(0, 10);
  values.set(`${day}:transcribe`, 15);
  const limited = await limiter.fetch(new Request("https://limit/check", { method: "POST", body: JSON.stringify({ route: "/api/transcribe" }) }));
  assert.equal(limited.status, 429);
  values.set(`${day}:transcribe`, 40);
  const sharedLimit = await limiter.fetch(new Request("https://limit/check", { method: "POST", body: JSON.stringify({ route: "/api/transcribe", global: true }) }));
  assert.equal(sharedLimit.status, 429);
  const draft = await limiter.fetch(new Request("https://limit/check", { method: "POST", body: JSON.stringify({ route: "/api/draft" }) }));
  assert.equal(draft.status, 200);
});
