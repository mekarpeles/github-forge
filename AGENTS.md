# AGENTS.md — setting up github-forge

You are an AI agent helping someone stand up **github-forge**: a local runner
that reacts to a GitHub repo's webhooks. Walk them through the steps below,
running what you can and asking only when you must. Keep it simple.

## Ground rules

- **Never commit secrets.** The signing secret belongs in `.env` (gitignored),
  never in `forge.yml`, a job, or any tracked file. This repo is meant to be public.
- **Don't guess the target repo.** Ask which `OWNER/REPO` to watch, and confirm
  they have **admin** on it (required to create the webhook).
- **Default to safe.** Keep `FORGE_DRY_RUN=1` while wiring up any job that acts
  (comments on GitHub, spawns agents, sends messages) until the user has seen it
  match real events correctly.

## Steps

1. **Prerequisites.** Check `node --version` (≥ 18) and `gh --version`. Confirm
   auth with `gh auth status`. Install the forwarder extension if missing:
   `gh extension install cli/gh-webhook`. If creating the webhook later fails on
   permissions, run `gh auth refresh -h github.com -s admin:repo_hook`.

2. **Install deps.** `npm install`.

3. **Configure `.env`.** `cp .env.example .env`. Set `FORGE_REPO=OWNER/REPO` and
   generate a secret: `openssl rand -hex 20` → `FORGE_SECRET`. Do not print the
   secret back in full or commit it.

4. **Configure `forge.yml`.** Set the `events` you care about and the `routes`
   (event → job). The default routes just log to `logs/events.jsonl` — good for a
   first run. Add more jobs under `jobs/` as needed.

5. **Run it.** Start the forge (`set -a; . ./.env; set +a; node forge.js`) and,
   in another terminal, the forwarder (`./forward.sh`). Confirm the forge prints
   `listening` and `signature verification: ON`, and that a real event (or the
   initial `ping`) shows up in `logs/events.jsonl`.

6. **Verify, then hand off.** Show the user a logged event as proof it works.
   Remind them the forwarder holds a temporary webhook open only while running.

## Connecting to the `agents` CLI (optional)

If the user runs the `agents` CLI, the forge can drive an agent fleet. Two
example jobs ship here:

- `jobs/assign-to-agent.js` — issue assigned → `agents register` + `agents up`.
- `jobs/forward-comment.js` — teammate comments on a bot PR → `agents send` to
  the agent that owns the PR (resolved via `agents ls --json --meta pr=<N>`).

Wire them in `forge.yml` under the matching `on:` with a `config:` block (see the
commented examples there). Keep `FORGE_DRY_RUN=1` until the user confirms the
routing, then unset it to go live.
