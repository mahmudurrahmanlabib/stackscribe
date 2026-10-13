# StackScribe

**Technical voice capture that knows your stack.** Speak a support incident, review the transcription, then shape it into a support ticket, engineering handoff, or customer update.

StackScribe is designed for support engineers, DevOps teams, and engineering teams who dictate names and terms that generic dictation routinely mangles. It uses ElevenLabs Scribe v2 **keyterm prompting** to bias transcription toward the team's own products, services, acronyms, and error phrases. An open-weight model (Gemma by default) then structures the transcript without inventing facts. A human reviews and copies the result; the app never files or sends a ticket for you.

## Why it exists

Support notes are often dictated between customer replies, log checks, and incident handoffs. The hard part is not turning speech into generic prose: it's retaining exact strings like `PHP-FPM`, `wp-cli`, `502 Bad Gateway`, `php:9000`, error excerpts, version numbers, and timestamps. StackScribe sends a focused team termbook to Scribe before transcription, keeps the raw transcript editable, and tells the open model to separate observations from hypotheses.

## Current workflow

1. Add team terms in the local termbook.
2. Record a voice note or upload an audio clip.
3. Scribe v2 transcribes it with those terms as keyterm prompts.
4. Review or correct the transcript.
5. Choose a support ticket, engineering handoff, or customer reply.
6. Gemma (or another configured open-weight model) drafts the artifact. Review, edit, and copy it.

The sample workflow works without API credentials so the interface can be reviewed immediately. Live audio and open-model drafting need a configured API Worker.

## Stack

- Static HTML/CSS/JavaScript front end (deployable on GitHub Pages).
- Cloudflare Worker API (`worker/index.js`) keeps provider keys off the public client.
- ElevenLabs Scribe v2 speech-to-text with keyterm prompting.
- OpenRouter-compatible chat completion endpoint; default model `google/gemma-3-12b-it`.
- Cloudflare Durable Objects apply per-IP daily limits (15 transcription requests and 40 drafts) plus a shared ceiling (40 transcriptions and 300 drafts per day).

The open-weight model handles the transformation that makes the product useful. ElevenLabs is the voice input layer and partner-category integration. Configure a different open-weight model through `OPENROUTER_MODEL` if Gemma is unavailable to your provider account. Do not use a closed model for a challenge submission claiming open-source AI at its core.

## Local preview

Serve the project directory over HTTP, for example:

```bash
python3 -m http.server 5173
```

Open `http://localhost:5173`. Click **Try sample** and draft any of the three outputs. This mode is deterministic and does not call a model.

## Run the API locally

Install Wrangler, then from `worker/`:

```bash
npm install --global wrangler
cp .dev.vars.example .dev.vars
# Replace both values in .dev.vars with your own secrets.
wrangler dev
```

The UI API endpoint setting should point to `http://localhost:8787`. Use provider keys in `.dev.vars` only; the file is ignored by Git. The local allowed origins in `wrangler.toml` cover the Python preview above.

For a deployed Worker, set secrets with Wrangler:

```bash
wrangler secret put ELEVENLABS_API_KEY
wrangler secret put OPENROUTER_API_KEY
```

Set `OPENROUTER_MODEL`, `ALLOWED_ORIGINS`, and `APP_URL` as Worker variables. `ALLOWED_ORIGINS` is a comma-separated list of exact origins, such as `https://labibrahmanlabib.github.io,https://your-domain.example`; avoid `*` for a public deployment. Deploy with `wrangler deploy`. Add the resulting Worker URL under **Connect your stack** in the app. Never commit API keys or place them in `config.js`.

The freeform team context and transcript are forwarded to the configured open-model provider. Audio is forwarded to ElevenLabs for transcription. StackScribe does not write audio or transcript contents to its database; the Worker keeps daily request counters keyed by the Cloudflare connecting IP to enforce quotas. Provider retention, privacy, and billing terms still apply. ElevenLabs documents a 20% base transcription surcharge when keyterm prompting is used; review current account pricing before enabling live transcription.

## GitHub Pages

Enable GitHub Pages with **GitHub Actions** as the source. The included workflow publishes the static app when changes land on `main`. Set a repository variable named `STACKSCRIBE_API_BASE` with the deployed Worker URL (no trailing slash); it is a public URL, not a secret. If it is unset, the production site remains in sample/demo mode.

## Security and operational notes

- Provider API keys stay in the Worker secret store.
- API CORS is restricted to the configured origins.
- Audio uploads are capped at 10 MB and do not pass through a durable object or object store.
- The Durable Object uses Cloudflare's connecting IP to enforce per-IP and shared daily quotas. Configure provider spend limits as an additional cost control.
- Do not dictate customer secrets, passwords, API tokens, or private keys. Review sensitive information before sending any generated handoff.
- The model is instructed to preserve exact technical strings, treat transcript contents as untrusted data, flag unclear facts, and avoid unsupported root-cause claims. Human review remains required.

## Challenge entry intent

- **DEV Hacktoberfest Open-Source AI Challenge — Week 2: Side Hustle**
- **Partner category:** Best Use of ElevenLabs
- **Open model:** Gemma by default (configurable to another open-weight model)
- **Potential additional category:** Best Use of Gemma only if Gemma remains the production model and the write-up demonstrates its use.

The shipped application is new challenge work. Keep the repository history and initial commits within the challenge window. The submission still needs a public production demo and a DEV write-up that explains who would pay for it, what the open model contributes, and what was learned from a real user test.

## License

MIT. See [LICENSE](LICENSE).
