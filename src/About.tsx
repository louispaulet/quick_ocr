import { Link } from "react-router-dom";

function StepNumber({ number }: { number: number }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-100">
      {number}
    </span>
  );
}

function AboutPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
        to="/"
      >
        <span aria-hidden="true">←</span>
        Back to Quick OCR
      </Link>

      <section className="mt-8 max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
          About the demo
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          A quick path from document images to usable text.
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
          Quick OCR turns images of document pages into an editable transcript. Upload
          up to five pages, arrange them in reading order, and keep the source language
          or translate the finished document into English or French.
        </p>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section
          aria-labelledby="how-it-works-heading"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">
            How it works
          </p>
          <h2 id="how-it-works-heading" className="mt-2 text-2xl font-semibold tracking-tight">
            Three focused steps
          </h2>

          <ol className="mt-7 space-y-6">
            <li className="flex gap-4">
              <StepNumber number={1} />
              <div>
                <h3 className="font-semibold text-slate-900">Upload and arrange</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Add PNG, JPG, or WebP page images, then reorder them so the transcript
                  follows the document’s reading order.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <StepNumber number={2} />
              <div>
                <h3 className="font-semibold text-slate-900">Read with OpenAI</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  A Cloudflare Worker sends the images to OpenAI’s Responses API using
                  the multimodal <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">gpt-5.6-luna</code> model. It transcribes visible text while keeping headings,
                  paragraphs, lists, and readable tables in order.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <StepNumber number={3} />
              <div>
                <h3 className="font-semibold text-slate-900">Translate if needed</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  For English or French output, the Worker makes a second text-only
                  request to translate the completed transcript while preserving its
                  structure. Original-language OCR uses the vision step only.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <div className="space-y-6">
          <section
            aria-labelledby="demo-heading"
            className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6 sm:p-7"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">
              Why “demo”?
            </p>
            <h2 id="demo-heading" className="mt-2 text-2xl font-semibold tracking-tight">
              Small, transparent, and intentionally limited
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-700">
              This project is a working demonstration of an OCR and translation flow,
              not a document-management service. There are no accounts, saved history,
              PDF uploads, camera capture, or background processing.
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
              <li className="flex gap-2"><span aria-hidden="true" className="text-indigo-600">•</span>Up to five pages per request.</li>
              <li className="flex gap-2"><span aria-hidden="true" className="text-indigo-600">•</span>10 MB per image and 25 MB per document.</li>
              <li className="flex gap-2"><span aria-hidden="true" className="text-indigo-600">•</span>Output in the original language, English, or French.</li>
            </ul>
          </section>

          <section
            aria-labelledby="privacy-heading"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">
              Privacy and limits
            </p>
            <h2 id="privacy-heading" className="mt-2 text-2xl font-semibold tracking-tight">
              What happens to your files?
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Images are sent to OpenAI for processing through the Worker. The API key
              stays on the server, requests use <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">store: false</code>, and this app does not persist uploaded images or transcripts.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              OCR can still be inaccurate for rotated pages, handwriting, tiny text, or
              complex layouts. Please avoid uploading sensitive documents to this demo.
            </p>
          </section>
        </div>
      </div>

      <div className="mt-8">
        <Link
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          to="/"
        >
          Start extracting
        </Link>
      </div>
    </main>
  );
}

export default AboutPage;
