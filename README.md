# Quick OCR

Quick OCR is a small full-stack application that extracts editable text from document page images and can translate the result into English or French. The browser provides an ordered drag-and-drop workflow, GitHub Pages hosts the static frontend, and a Cloudflare Worker sends the pages to OpenAI's multimodal Responses API for transcription and optional translation.

The frontend and API are deployed separately:

```text
GitHub Pages frontend
        │ multipart/form-data over CORS
        ▼
POST https://quick-ocr.louispaulet13.workers.dev/api/ocr
        │ ordered image inputs
        ▼
OpenAI vision response
        ▼
Source-language transcript
        ├── original selected ───────────────► Result
        │ English or French selected
        ▼
OpenAI text response ───────────────────────► Translated result
```

## Features

- Drag, browse, preview, reorder, and remove document pages.
- Process up to five ordered PNG, JPG, or WebP images.
- Preserve the document's original language or translate the result into English or French.
- Use a dedicated text translation pass for reliable English and French output, including handwritten source documents.
- Preserve headings, paragraphs, lists, line breaks, and readable table structure.
- Edit and copy the resulting transcript.
- Keep the OpenAI API key entirely on the Worker.
- Use HashRouter for GitHub Pages-safe client-side navigation.
- Run the frontend and API together during local Vite development.

## Requirements

- Node.js 22.12 or newer
- npm
- A Cloudflare account authenticated with Wrangler
- An OpenAI project API key with access to `gpt-5.6-luna`

## Local setup

Install dependencies:

```sh
npm install
```

Copy the safe environment template:

```sh
cp .env.example .env
```

Set your existing OpenAI project key in the ignored `.env` file:

```dotenv
OPENAI_API_KEY=your_openai_api_key
```

Never prefix this value with `VITE_`, put it in source code, or commit `.env`.

The production frontend uses `https://quick-ocr.louispaulet13.workers.dev` as its API base URL. Set `VITE_API_BASE_URL` only when pointing a build at a different Worker; it is a public endpoint, not a secret.

Start the combined Vite and Workers development server:

```sh
npm run dev
```

The terminal prints the local URL, normally `http://localhost:5173`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the React app and Worker API with hot reload |
| `npm run lint` | Run Oxlint |
| `npm run typecheck` | Type-check browser, configuration, and Worker code |
| `npm run worker:types` | Regenerate Worker binding types from `wrangler.jsonc` |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Type-check and produce the static frontend bundle |
| `npm run build:pages` | Build the frontend with the production Worker URL |
| `npm run preview` | Preview the static frontend bundle |
| `npm run deploy:worker` | Deploy only the API Worker with Wrangler |
| `npm run deploy:pages` | Build and publish `dist/` to the GitHub Pages branch |
| `npm run deploy` | Deploy the Worker, then publish GitHub Pages |

## Upload limits

- Supported types: PNG, JPEG/JPG, and WebP
- Maximum pages: 5
- Maximum size per page: 10 MB
- Maximum combined document size: 25 MB

The application does not resize pages before OCR. Clear, upright images with legible text work best.

When English or French is selected, the Worker makes two OpenAI requests: one vision request that faithfully transcribes the source language, followed by one text-only request that translates the transcript. Original-language OCR uses only the vision request.

## API

### `POST /api/ocr`

Send `multipart/form-data` with one `files` field per page. Repeated fields are processed in their submitted order. Set the optional `outputLanguage` field to `original`, `en`, or `fr`; it defaults to `original`.

Example:

```sh
curl http://localhost:5173/api/ocr \
  -F "files=@page-1.png" \
  -F "files=@page-2.png" \
  -F "outputLanguage=fr"
```

Successful response:

```json
{
  "text": "--- Page 1 ---\nFirst page text\n\n--- Page 2 ---\nSecond page text",
  "pageCount": 2,
  "truncated": false
}
```

Error response:

```json
{
  "error": {
    "code": "INVALID_FILE_TYPE",
    "message": "Only PNG, JPG, and WebP page images are supported."
  }
}
```

The Worker returns `400` for invalid inputs, `413` for upload limits, `429` for OpenAI rate or quota limits, and safe `5xx` errors for configuration or upstream failures.

## Deploy

The production services are:

- Frontend: [http://quick-ocr.thefrenchartist.dev/](http://quick-ocr.thefrenchartist.dev/)
- Backend: [quick-ocr.louispaulet13.workers.dev](https://quick-ocr.louispaulet13.workers.dev/)

The frontend custom domain is stored in `public/CNAME` as `quick-ocr.thefrenchartist.dev`. GitHub Pages CNAME files contain only the hostname; the public URL includes the `http://` scheme.

Wrangler and GitHub CLI must already be authenticated:

```sh
npx wrangler whoami
gh auth status
```

Upload the production key as an encrypted Worker secret. Wrangler prompts for the value without adding it to the repository:

```sh
npx wrangler secret put OPENAI_API_KEY
```

Build and deploy:

```sh
npm run deploy
```

`npm run deploy` deploys the Worker with `wrangler.jsonc` first and then runs:

```text
gh-pages -d dist --remove '**/{*,.*}' --cname quick-ocr.thefrenchartist.dev
```

For a first GitHub Pages setup, select the `gh-pages` branch as the Pages source in repository settings, or use the authenticated GitHub CLI:

```sh
gh api --method POST repos/louispaulet/quick_ocr/pages \
  -f "source[branch]=gh-pages" \
  -f "source[path]=/"
```

HashRouter keeps client-side navigation working without server-side rewrite rules. The Worker configuration contains only the API entrypoint and does not deploy frontend assets.

## Security and privacy

- `.env` is ignored and used only for local development.
- The production key is stored as an encrypted Cloudflare Worker secret.
- The key is never returned to or bundled into the browser.
- The Worker does not persist uploaded images or OCR transcripts.
- OpenAI requests use `store: false`.
- Application logs must not include images, transcripts, credentials, authorization headers, or raw OpenAI error bodies.

> **Public endpoint warning:** `/api/ocr` intentionally has no authentication or rate limiting. Anyone who can reach the deployment can consume the associated OpenAI project's quota. Add access control and rate limiting before using this as a production service.

## Troubleshooting

### The Worker reports a configuration error

Confirm `OPENAI_API_KEY` exists in `.env` locally and as a Worker secret in production. Do not print the value while checking.

### OpenAI returns an authentication error

The project key may be invalid, revoked, scoped incorrectly, or unable to access the configured model. Replace the local and Worker secret with a valid project key.

### The API returns `429`

`RATE_LIMITED` means requests are arriving too quickly. Wait and retry. `QUOTA_EXCEEDED` means the OpenAI project has exhausted credits or reached a spend limit.

### The API returns `413`

Reduce the number or size of page images. The complete multipart request must remain within both the application limits above and the Cloudflare account's request-body limit.

### OCR is incomplete

When `truncated` is `true`, retry with fewer pages. For poor recognition, use a clearer, upright scan with larger text.

## Limitations

- Image inputs only; PDFs and camera capture are not included.
- No accounts, history, database, or persistent file storage.
- No authentication or rate limiting.
- OCR can be inaccurate on rotated pages, handwriting, very small text, or complex layouts.
