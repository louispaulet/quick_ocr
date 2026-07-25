import { useEffect, useRef, useState } from "react";
import {
  MAX_FILE_BYTES,
  MAX_FILE_COUNT,
  MAX_TOTAL_BYTES,
  formatFileSize,
  validateFiles,
} from "./lib/files";
import {
  OcrRequestError,
  requestOcr,
  type OutputLanguage,
} from "./lib/ocr-api";

interface SelectedPage {
  id: number;
  file: File;
  previewUrl: string;
}

let nextPageId = 1;

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 15.75V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18v-2.25M7.5 8.25 12 3.75m0 0 4.5 4.5M12 3.75V15"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25m0 12.75h7.5m-7.5 3h4.5m-1.5-15.75H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V10.5a8.25 8.25 0 0 0-8.25-8.25Z"
      />
    </svg>
  );
}

function ArrowIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 ${direction === "down" ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V10.875c0-.621.504-1.125 1.125-1.125H8.25m7.5 7.5h3.375c.621 0 1.125-.504 1.125-1.125V6.108c0-.298-.119-.585-.33-.796l-3.982-3.982a1.125 1.125 0 0 0-.796-.33H10.875c-.621 0-1.125.504-1.125 1.125v14c0 .621.504 1.125 1.125 1.125h4.875Z"
      />
    </svg>
  );
}

function App() {
  const [pages, setPages] = useState<SelectedPage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [resultText, setResultText] = useState("");
  const [outputLanguage, setOutputLanguage] =
    useState<OutputLanguage>("original");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy text");
  const inputRef = useRef<HTMLInputElement>(null);
  const pagesRef = useRef<SelectedPage[]>([]);
  const isTranslating = outputLanguage !== "original";
  const actionLabel = isTranslating ? "Extract and translate" : "Extract text";
  const resultLabel = isTranslating ? "Translated" : "Extracted";

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(
    () => () => {
      pagesRef.current.forEach((page) => URL.revokeObjectURL(page.previewUrl));
    },
    [],
  );

  const addFiles = (incoming: File[]) => {
    const combined = [...pages.map((page) => page.file), ...incoming];
    const error = validateFiles(combined);

    if (error) {
      setValidationError(error);
      return;
    }

    const additions = incoming.map((file) => ({
      id: nextPageId++,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPages((current) => [...current, ...additions]);
    setValidationError("");
    setRequestError("");
    setResultText("");
    setIsTruncated(false);
  };

  const removePage = (id: number) => {
    setPages((current) => {
      const removed = current.find((page) => page.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return current.filter((page) => page.id !== id);
    });
    setValidationError("");
    setResultText("");
    setIsTruncated(false);
  };

  const movePage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;

    setPages((current) => {
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
    setResultText("");
    setIsTruncated(false);
  };

  const reset = () => {
    pages.forEach((page) => URL.revokeObjectURL(page.previewUrl));
    setPages([]);
    setValidationError("");
    setRequestError("");
    setResultText("");
    setIsTruncated(false);
    setCopyLabel("Copy text");
    if (inputRef.current) inputRef.current.value = "";
  };

  const runOcr = async () => {
    const files = pages.map((page) => page.file);
    const error = validateFiles(files);

    if (error) {
      setValidationError(error);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 100_000);

    setIsSubmitting(true);
    setRequestError("");
    setValidationError("");
    setIsTruncated(false);

    try {
      const result = await requestOcr(files, {
        outputLanguage,
        signal: controller.signal,
      });
      setResultText(result.text);
      setIsTruncated(result.truncated);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setRequestError("OCR took too long. Try fewer or smaller page images.");
      } else if (caught instanceof OcrRequestError) {
        setRequestError(caught.message);
      } else {
        setRequestError("OCR could not be completed. Please try again.");
      }
    } finally {
      window.clearTimeout(timeout);
      setIsSubmitting(false);
    }
  };

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(resultText);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy text"), 1_500);
    } catch {
      setRequestError("Could not access the clipboard. Select and copy the text manually.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <DocumentIcon />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Quick OCR</p>
              <p className="text-xs text-slate-500">Document text extraction</p>
            </div>
          </div>
          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Powered by OpenAI
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="mb-8 max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Image to text
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Turn document images into editable text.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Add up to five page images, arrange them in reading order, and extract or
            translate a clean transcript while keeping the document structure.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <section
            aria-labelledby="upload-heading"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 id="upload-heading" className="text-lg font-semibold">
                  Document pages
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  PNG, JPG, or WebP · {MAX_FILE_COUNT} pages maximum
                </p>
              </div>
              {pages.length > 0 && (
                <button
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  onClick={reset}
                  type="button"
                >
                  Clear all
                </button>
              )}
            </div>

            <div
              className={`group relative flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-9 text-center transition ${
                dragActive
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-300 bg-slate-50/70 hover:border-indigo-400 hover:bg-indigo-50/50"
              }`}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (event.currentTarget === event.target) setDragActive(false);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                addFiles(Array.from(event.dataTransfer.files));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200 transition group-hover:-translate-y-0.5 group-hover:shadow">
                <UploadIcon />
              </div>
              <p className="font-semibold text-slate-900">
                Drop page images here or browse
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Each image can be up to {formatFileSize(MAX_FILE_BYTES)}. Keep the
                document under {formatFileSize(MAX_TOTAL_BYTES)} total.
              </p>
              <input
                ref={inputRef}
                accept="image/jpeg,image/png,image/webp"
                aria-label="Choose document page images"
                className="sr-only"
                multiple
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
                type="file"
              />
            </div>

            <div className="mt-5">
              <label
                className="text-sm font-semibold text-slate-800"
                htmlFor="output-language"
              >
                Output language
              </label>
              <select
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                disabled={isSubmitting}
                id="output-language"
                onChange={(event) => {
                  setOutputLanguage(event.target.value as OutputLanguage);
                  setRequestError("");
                  setResultText("");
                  setIsTruncated(false);
                  setCopyLabel("Copy text");
                }}
                value={outputLanguage}
              >
                <option value="original">Original language (no translation)</option>
                <option value="en">English</option>
                <option value="fr">French</option>
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Preserve the source language or translate the complete document while
                keeping its structure.
              </p>
            </div>

            {validationError && (
              <p
                className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                role="alert"
              >
                {validationError}
              </p>
            )}

            {pages.length > 0 && (
              <ol aria-label="Document page order" className="mt-5 space-y-3">
                {pages.map((page, index) => (
                  <li
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
                    key={page.id}
                  >
                    <img
                      alt={`Preview of page ${index + 1}`}
                      className="h-16 w-14 shrink-0 rounded-lg bg-slate-100 object-cover ring-1 ring-slate-200"
                      src={page.previewUrl}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                        Page {index + 1}
                      </p>
                      <p className="truncate text-sm font-medium text-slate-800">
                        {page.file.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatFileSize(page.file.size)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        aria-label={`Move ${page.file.name} up`}
                        className="icon-button"
                        disabled={index === 0}
                        onClick={() => movePage(index, -1)}
                        type="button"
                      >
                        <ArrowIcon direction="up" />
                      </button>
                      <button
                        aria-label={`Move ${page.file.name} down`}
                        className="icon-button"
                        disabled={index === pages.length - 1}
                        onClick={() => movePage(index, 1)}
                        type="button"
                      >
                        <ArrowIcon direction="down" />
                      </button>
                      <button
                        aria-label={`Remove ${page.file.name}`}
                        className="ml-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                        onClick={() => removePage(page.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <button
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              disabled={pages.length === 0 || isSubmitting}
              onClick={runOcr}
              type="button"
            >
              {isSubmitting ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                  />
                  Reading document…
                </>
              ) : (
                <>
                  <DocumentIcon />
                  {actionLabel}
                </>
              )}
            </button>
          </section>

          <section
            aria-labelledby="result-heading"
            className="flex min-h-[560px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 id="result-heading" className="text-lg font-semibold">
                  {resultLabel} text
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review, edit, and copy the transcript.
                </p>
              </div>
              <button
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                disabled={!resultText}
                onClick={copyResult}
                type="button"
              >
                <CopyIcon />
                {copyLabel}
              </button>
            </div>

            {requestError && (
              <p
                className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                role="alert"
              >
                {requestError}
              </p>
            )}

            {isTruncated && (
              <p
                className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                role="status"
              >
                The transcript reached the output limit. Try fewer pages for a complete
                result.
              </p>
            )}

            <div className="relative flex min-h-0 flex-1">
              <textarea
                aria-label={`${resultLabel} document text`}
                className="min-h-[420px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                onChange={(event) => setResultText(event.target.value)}
                placeholder={
                  isSubmitting
                    ? isTranslating
                      ? "Reading and translating your document…"
                      : "Reading your document…"
                    : `Your ${resultLabel.toLowerCase()} text will appear here.`
                }
                readOnly={isSubmitting}
                value={resultText}
              />
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Images are sent to OpenAI for processing. This app does not persist
              uploads or transcripts.
            </p>
            <div className="sr-only" aria-live="polite">
              {isSubmitting
                ? isTranslating
                  ? "OCR and translation are in progress."
                  : "OCR is in progress."
                : resultText
                  ? isTranslating
                    ? "OCR and translation are complete."
                    : "OCR is complete."
                  : requestError || validationError}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
