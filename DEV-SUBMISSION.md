---
title: "StackScribe: technical dictation that keeps the important bits intact"
published: false
tags: devchallenge, hf26challenge, elevenlabs, gemma
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)*

## What I Built

I built **StackScribe**, a voice-first way to turn a rough support or incident note into a support ticket, engineering handoff, or customer update. It is for support engineers, DevOps teams, and small software companies that need to document incidents quickly without losing the details that make the note useful: `PHP-FPM`, `wp-cli`, `php:9000`, error strings, versions, hostnames, and timestamps.

The team keeps its own technical termbook. StackScribe passes those terms to ElevenLabs Scribe v2 as keyterm prompts, then lets the engineer review the transcript before drafting. Gemma turns the corrected note into the selected handoff format. The result stays editable, and a person has to review and copy it; the app does not file a ticket or send a message automatically.

The likely customer is a small software company or support consultancy whose engineers repeatedly translate voice notes into tickets and incident updates. The product would save time on that documentation while reducing the chance that an exact error, identifier, or operational boundary gets lost.

## Demo

[Try the live StackScribe demo](https://mahmudurlabib.com/stackscribe/). Click **Try sample**, then **Draft support ticket** to see the workflow.

The public demo currently runs its deterministic sample flow. Live transcription and model drafting are implemented in the project but need a configured API Worker and provider credentials; the public demo does not yet call those services. I am stating that limit clearly so the demo does not imply a live provider connection that is not configured.

## Code

[Public GitHub repository](https://github.com/mahmudurrahmanlabib/stackscribe)

The front end is static HTML, CSS, and JavaScript. A Cloudflare Worker holds provider keys, checks inputs and allowed origins, and applies daily request limits. Audio and transcript contents are not saved to an application database.

## How I Built It

The speech path uses ElevenLabs Scribe v2 with a user-editable list of technical keyterms. The drafting path calls an OpenAI-compatible endpoint, with Gemma 3 12B Instruct as the default open-weight model. The model prompt preserves exact tokens, separates observed facts from hypotheses, flags uncertain details, and avoids inventing a root cause, severity, or ETA.

There are three outputs: a support ticket, an engineering handoff, and a customer update. Each has different constraints: an internal incident handoff can keep log strings and investigation requests, while a customer update avoids exposing internal logs or unsupported promises. The sample is deterministic, and five Worker tests cover the request validation, provider payloads, output parsing, and rate limits.

## Why Does Open Innovation Matter?

Technical support has team-specific vocabulary and policy boundaries. An open-weight model gives a team room to change the drafting model, host inference on infrastructure it controls, and tune the prompt to its own support workflow without rebuilding the voice capture path around one closed model provider. It also makes the model choice a deployment decision: a small team can begin with a hosted open model and move to self-hosted inference if its privacy, cost, or volume needs change.

This is not a fully offline product: the current speech-recognition design uses ElevenLabs as a hosted service. The open model is responsible for shaping the transcript into a useful artifact, while ElevenLabs handles speech-to-text and keyterm prompting. That split lets the product use a specialist speech service while keeping the reasoning and formatting layer replaceable.

## My Agent Session

Optional. I did not save a DevRelay session for this build.

## Prize Categories

- Best Use of ElevenLabs
- Best Use of Gemma

