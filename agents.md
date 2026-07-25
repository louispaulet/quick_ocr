# Repository instructions

These instructions apply to the entire repository.

## Project structure

- `src/` contains the Vite, React, and Tailwind frontend.
- `worker/` contains the Cloudflare Worker API.
- `wrangler.jsonc` is the source configuration for Cloudflare.
- Tests live beside the code they cover and use the `*.test.ts` or `*.test.tsx` suffix.

## Development conventions

- Use TypeScript for application and Worker code.
- Keep browser-only code out of `worker/` and Worker-only bindings out of `src/`.
- Keep the OpenAI request on the Worker. Never expose API credentials to the browser.
- Regenerate `worker/env.d.ts` with `npm run worker:types` after changing Worker bindings.
- Prefer small, testable helpers for validation and external API boundaries.
- Preserve accessible labels, keyboard behavior, focus states, and live status messages when changing the UI.
- Do not add persistence, authentication, or new Cloudflare services without an explicit request.

## Required validation

Run these commands before completing a change:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

For Worker or deployment changes, also run:

```sh
npm run preview
```

Smoke-test the affected path after deployment.

## Secrets

- Never print, log, stage, commit, or expose `.env` values.
- Keep local secrets in the ignored `.env` file.
- Keep production secrets in Cloudflare Worker secrets, not `wrangler.jsonc`.
- Before staging, verify that `.env` is ignored and that generated browser assets do not contain secret values.
- Do not log uploaded documents, OCR transcripts, authorization headers, or raw upstream error bodies.

## Git and deployment

- After every completed change, always commit and push the current branch, including when the current branch is `main`.
- Do not skip the push merely because the current branch is `main`.
- Stage only files that belong to the completed change.
- If validation, authentication, or networking prevents a safe commit or push, report the blocker clearly.
- Deploy Worker changes with Wrangler only after local validation, and smoke-test the resulting URL.
