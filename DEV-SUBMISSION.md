---
title: "StackScribe: technical voice notes into support-ready handoffs"
published: false
tags: devchallenge, hf26challenge, elevenlabs, gemma
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)*

## What I Built

StackScribe turns a spoken support or incident note into a support ticket, engineering handoff, or customer update. It is for support engineers, DevOps teams, and small product teams who need to capture incidents quickly without losing exact details such as `PHP-FPM`, `wp-cli`, hostnames, error messages, versions, and timestamps.

The team keeps a small termbook of product names and technical vocabulary. StackScribe sends those terms to ElevenLabs Scribe v2 as keyterm prompts, then lets the user review and correct the transcript. A Gemma model structures the note into the selected format. The user reviews and copies the result; StackScribe does not file a ticket or send a customer message automatically.

The people most likely to pay are small software companies and support consultancies where engineers spend time turning voice notes into usable tickets and incident handoffs. The useful outcome is faster documentation with fewer lost technical details, while keeping a human approval step before anything enters a system of record.

## Demo

**Demo video or deployed URL:** [add after publishing the live demo]

The repository includes a deterministic sample flow that can be tried without API credentials. Live transcription and model drafting require the API Worker and provider credentials described in the README. I will replace this note with a working demo link or a short recording before submitting.

## Code

**Repository:** [add public GitHub repository URL]

The front end is static HTML, CSS, and JavaScript. The Cloudflare Worker keeps provider credentials server-side, validates requests, restricts CORS origins, and applies daily request limits. The project is original work started during the Week 2 challenge window.

## How I Built It

The speech path uses ElevenLabs Scribe v2 with a team-maintained keyterm list. The handoff path calls an open-weight model through an OpenAI-compatible endpoint; Gemma 3 12B Instruct is the default. The prompt preserves technical tokens, separates observations from hypotheses, marks unclear details for verification, and forbids invented root causes or unsupported severity claims.

I used a small format-specific prompt for support tickets, engineering handoffs, and customer updates. The generated draft remains editable. API keys stay in Worker secrets; audio and transcripts are not written to an application database. The Worker keeps request counters for rate limiting.

## Why Does Open Innovation Matter?

The open-weight model is the part that reshapes the transcript into a useful artifact. Keeping that model choice configurable lets a small team select a model based on its own cost, hosting, and privacy requirements instead of locking the product to one closed model API. A team could move inference to infrastructure it controls or swap in another open-weight model without changing the voice capture workflow.

The speech recognition is a paid hosted service, so this is not an offline or fully self-hosted product. ElevenLabs provides the transcription and technical term prompting; the open model provides the editable handoff structure. That separation keeps the product replaceable where model choice matters while using a specialist speech service for voice input.

## My Agent Session

Optional. Add a DevRelay session link if one is available.

## Prize Categories

- Best Use of ElevenLabs
- Best Use of Gemma

## Before Publishing

- Replace the demo and repository placeholders with working public links.
- Confirm the deployed Worker is configured with ElevenLabs and Gemma, then test an actual audio note end to end.
- Add one real user test and report what happened; do not claim a user or payment that has not happened.
- Keep `published: false` until the links and live demo are ready.
