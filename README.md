# Ayuda

**Give your time. Find where it matters.**

Ayuda is a voice-first, location-aware volunteering app. You say what you can offer ("two hours on Sunday morning, I can teach English to kids, no money"), and Ayuda finds verified organisations nearby that need exactly that. Then it gets out of your way so you can go and help.

> Most AI products optimise for more screen time. Ayuda optimises for the opposite: the shortest safe path from one sentence to real-world action.
> Success metric: **real-world volunteering minutes per minute spent in Ayuda.**

---

## Architecture

```
 Voice ──► ElevenLabs STT ─┐            (server-side; key never reaches the browser)
 Text  ────────────────────┤
                           ▼
                 Gemma 3 4B intent extraction ──► strict Zod schema ──► closed taxonomy
                           │                       lexical grounding guard + rule cross-checks
                           │                       (any failure → labelled keyword fallback)
                           ▼
   rounded location ─► PostgreSQL + PostGIS  ST_DWithin / ST_Distance, VERIFIED-only by default
                           ▼
                 Deterministic matcher (hard filters → weighted score → near misses)
                           ▼
                 Gemma 3 4B one-paragraph summary (top 3 facts only; number/claim-grounded,
                           │                       else a template)
                           ▼
                 ElevenLabs TTS (only server-signed summaries) ──► details ──► 🚶 Go Help
```

| Layer | Where | Notes |
|---|---|---|
| Web | `web/` React 19 + TypeScript + Vite + Tailwind v4 | 12 screens, mobile-first, Leaflet + OSM map |
| API | `server/` Node + TypeScript + Express 5 | `createApp(deps)`: all providers injected, so they are testable |
| AI | `server/src/ai/` | `AIProvider` interface → `OllamaGemmaProvider`, `OpenAICompatibleGemmaProvider`, `DisabledProvider` |
| Voice | `server/src/voice/` | `VoiceProvider` interface → `ElevenLabsVoice`, `NoVoiceProvider` |
| Geo | `server/src/repo/opportunities.ts`, `server/src/geo/` | PostGIS queries; Nominatim for manual search |
| Matching | `server/src/matching/matcher.ts` | Pure function, deterministic, explainable weights |

### What the model does and does not do

Gemma 3 4B is used for: (1) volunteer-intent extraction, (2) organisation-need extraction (a suggestion that an admin reviews), (3) taxonomy normalisation, and (4) a short spoken summary.

Gemma is **never** the source of truth for organisation existence, address, coordinates, distance, contact details, verification, availability or eligibility. Those come only from the database. Gemma never receives coordinates, database rows or user identity: it gets the request text and, for summaries, at most three compact fact objects.

Small-model safeguards (all in `server/src/ai/`), measured with `npm run eval:gemma`:
- **Constrained decoding** (Ollama JSON-schema `format`), then **strict Zod validation**: wrong types or extra keys are rejected.
- **Closed vocabularies**: anything outside `domain/taxonomy.ts` is dropped.
- **Lexical grounding guard** (`grounding.ts`): a slot such as day, time, duration, distance or money is kept only if the request actually mentions it (English, Hindi and Spanish lexicons). This stops "120 minutes" being invented.
- **Rule cross-checks**: precise English duration ("half an hour") and money-refusal ("I will not pay") rules overrule the model.
- **Injection handling**: user text is fenced as data with unforgeable delimiters. Off-topic or instruction-like input is reported as "not understood", and its output can only ever be taxonomy tags.
- **Summary grounding**: every number in a Gemma summary must appear in the facts, and travel-time claims are rejected. Otherwise a template is used.
- **Honest labelling**: every response says whether Gemma or the keyword fallback produced it, and the UI shows it.

Live eval on local `gemma3:4b` (12 labelled cases: English, Hindi, Spanish, injection, off-topic): **12/12, median ~4 s**. Before the guards it was 9/12.

---

## Setup (local)

Requires Node ≥ 20, Docker and [Ollama](https://ollama.com).

```bash
cp .env.example .env               # fill ELEVENLABS_API_KEY, ADMIN_TOKEN (>= 24 chars)
docker compose up -d               # PostGIS on localhost:5433
ollama pull gemma3:4b              # open-weight model, ~3.3 GB
npm install
npm run db:migrate && npm run db:seed
npm run dev:server                 # API on :8787
npm run dev:web                    # app on http://localhost:5173
```

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `DATABASE_SSL` | PostgreSQL with PostGIS |
| `FRONTEND_ORIGIN` | Comma-separated exact origins allowed by CORS |
| `GEMMA_PROVIDER` | `ollama` (local), `openai` (any OpenAI-compatible Gemma host) or `off` |
| `GEMMA_BASE_URL`, `GEMMA_MODEL`, `GEMMA_API_KEY`, `GEMMA_TIMEOUT_MS` | Model endpoint |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_STT_MODEL`, `ELEVENLABS_TTS_MODEL` | Voice. The voice ID must exist in your ElevenLabs account |
| `NOMINATIM_URL`, `GEOCODER_USER_AGENT`, `GEOCODER_COUNTRY_CODES` | Manual location search (default `in`, so PIN codes resolve in India) |
| `ADMIN_TOKEN` | Admin routes are **disabled** unless this is ≥ 24 characters |
| `VITE_API_URL` (web build) | API origin when the web app is hosted separately (empty = same origin / dev proxy) |

## Database

`server/src/db/migrations/001_init.sql` creates `organisations` (with a `GEOGRAPHY(Point,4326)` column and GIST index), `volunteer_opportunities`, the lookup tables `skills`, `assistance_types` and `beneficiary_types`, `volunteer_profiles` (only a SHA-256 hash of a random device token) and `volunteer_actions`. The verification enum is `VERIFIED | PENDING | UNVERIFIED`. New organisations always start `UNVERIFIED`.

**Demo data** (`server/src/db/demoData.ts`): 13 fictional organisations around Bandra, Mumbai. Names end in "(Demo)", contacts use `example.org` and `+91 555` numbers, and every row has `is_demo = true`. Demo Mode sees only demo rows; real mode never sees them. The seed deletes and recreates demo rows only. Two demo organisations are deliberately `PENDING` and `UNVERIFIED`, and one is 24 km away, to show filtering.

## Location and privacy

- Geolocation is requested only after the user taps "Use my location". If it is denied or times out, the user gets manual search (locality, landmark, PIN code or city).
- Coordinates are rounded to 3 decimals (~110 m) on the device **and** again on the server. They are never stored, logged or sent to Gemma, and never exposed to organisations.
- The map shows the user as a 400 m "approximate area" circle, never a pin.
- Raw audio is held in memory only: it is sent to ElevenLabs and then zeroed. Nothing is written to disk.
- Volunteer history uses an anonymous random token, with no name, email or phone. **Settings → Delete my history and data** erases it.

## Demo Mode

Demo Mode is the evaluator view. Only in Demo Mode does the results screen show the technical evidence: the model name and latency, the fields the guards corrected or dropped, and the raw structured-intent JSON. Real users see only the plain-language chips. Demo Mode is on by default and labelled everywhere: a purple banner, a "Demo · fictional" badge on every card, and a warning on the exit screen. It uses a fixed demo location, so it works from anywhere. Matching is deterministic. Gemma runs for real when it is available. If it isn't, the labelled keyword fallback keeps the whole flow working, including with no AI and no voice at all (`GEMMA_PROVIDER=off`, no ElevenLabs key).

### 90-second demo script
1. Open Ayuda and tap **🎙 Tell Ayuda How You Can Help**.
2. Say: *"I have two hours this Sunday morning. I can teach English and would like to help children. I don't want to donate money."*
3. Show the transcript, then **What Ayuda understood** → *Show structured intent (JSON)*. It reads "Understood by gemma3:4b (open-weight)".
4. Listen to the spoken summary. Switch to **Map**.
5. Open #1 and read **Why it matches you** (distance + time + skill + beneficiary).
6. Tap **I'll do this** → **I'm going to help**. The exit screen says *"You're ready to help. Your next step is outside the app."* Tap **Go Help**.
7. Then show the architecture, `npm run eval:gemma`, and the injection case.

## Testing

```bash
npm test                         # server (82) + web (17)
npm run typecheck && npm run build
npm run eval:gemma -w server     # live Gemma 3 4B evaluation (real model, no mocks)
```

- **Server unit tests**: intent extraction (normal, missing duration, multiple skills, negative money, ambiguous, multilingual, malformed JSON, schema violation, extra keys, timeout, prompt injection, no coordinates sent), grounding and cross-checks, fallback parser, need extraction, summary grounding, matcher, ElevenLabs failure modes, speech tokens and rounding.
- **Server integration tests** (real PostGIS, `ayuda_test` DB; Gemma and ElevenLabs faked): radius, PostGIS distance accuracy, verification filtering, demo/real separation, zero results, invalid coordinates, Gemma-down end to end, quick match, contact withholding, voice 503 and forged TTS, volunteer access control and erasure, admin auth and verification lifecycle, `javascript:` URLs, headers, CORS, malformed JSON, geocoder and database outages.
- **Web tests**: CTAs and honest status, skip link, voice-unavailable fallback, microphone denial, geolocation denial and timeout, manual PIN search and geocoder failure, rounded coordinates, zero results and near misses, fallback labelling, not-understood state, keyboard radius radio group, server-down retry, exit screen links.

## Security

Server-side API keys only. Zod validation on every input (strict objects). Parameterised SQL everywhere. Helmet headers with a `default-src 'none'` CSP on the API. Exact-origin CORS. Per-route rate limits (AI 20/min, voice 10/min, geocode 30/min, global 120/min). A 16 KB JSON body limit. Audio uploads are capped at 2 MB with an audio MIME allow-list. Admin uses a timing-safe token compare and stays disabled when the token is weak. Volunteer actions are scoped by owner in SQL. TTS only accepts HMAC-signed, expiring server summaries, so it can't be used as a free TTS proxy. Organisation websites must be `https://`. All organisation and model text renders as React text, never HTML. Errors never return stack traces or upstream bodies.

## Render deployment

`render.yaml` defines `ayuda-db` (Postgres; PostGIS is enabled by the migration's `CREATE EXTENSION`), `ayuda-api` (Node: `preDeployCommand` runs migrations, health check `/api/health`) and `ayuda-web` (static site with SPA rewrite, CSP and a `Permissions-Policy` that allows only geolocation and microphone).

1. Push this repo to GitHub, then **New → Blueprint** in Render.
2. Fill the `sync: false` secrets: `FRONTEND_ORIGIN` (the `ayuda-web` URL), the Gemma endpoint values and the ElevenLabs key and voice ID.
3. After the first deploy, seed the demo data from the `ayuda-api` Shell: `npm run db:seed:prod -w server`.

**Gemma on Render.** The web service can't run Ollama, so point `GEMMA_PROVIDER=openai` at any OpenAI-compatible server hosting Gemma 3 4B (vLLM, llama.cpp, or Ollama's `/v1`). `deploy/ollama/Dockerfile` bakes `gemma3:4b` into an Ollama image for a Render private service (the commented block in `render.yaml`, ≥ 4 GB RAM). If no endpoint is configured, the app still works using the labelled fallback.

## Future LoRA / QLoRA fine-tuning

1. Collect anonymised, **consented** request → corrected-intent pairs. The admin and UI flows already give a correction surface.
2. Build 1,000–3,000 taxonomy-consistent examples. The prompt contract (`ai/prompts.ts`, `PROMPT_VERSION`) and the JSON schema are the training format.
3. Use QLoRA on Gemma 3 4B for intent extraction and normalisation only. Never put organisation facts in the weights.
4. Compare base and tuned models on the held-out set with `scripts/eval-gemma.ts`.
5. Serve the adapter through Ollama (`ADAPTER` in a Modelfile) or vLLM and change `GEMMA_MODEL`. No code changes are needed.

## Honest status

- **Verified working locally**: real Gemma 3 4B via Ollama, real ElevenLabs STT and TTS (round-trip tested), real PostGIS, real Nominatim search, and the full UI flow in Chrome.
- **Not verified**: an actual Render deployment, and the `deploy/ollama` image build.
- **Real verified organisations**: none are listed yet. Real mode will honestly show zero results until an admin adds and verifies organisations.
