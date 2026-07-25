export interface OcrSuccess {
  text: string;
  pageCount: number;
  truncated: boolean;
}

export type OutputLanguage = "original" | "en" | "fr";

interface OcrRequestOptions {
  outputLanguage?: OutputLanguage;
  signal?: AbortSignal;
}

interface OcrErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

export class OcrRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "OcrRequestError";
    this.code = code;
    this.status = status;
  }
}

export async function requestOcr(
  files: File[],
  options: OcrRequestOptions = {},
): Promise<OcrSuccess> {
  const { outputLanguage = "original", signal } = options;
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file, file.name));
  formData.set("outputLanguage", outputLanguage);

  const response = await fetch("/api/ocr", {
    method: "POST",
    body: formData,
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as OcrErrorPayload | null;
    throw new OcrRequestError(
      payload?.error?.message ?? "OCR could not be completed. Please try again.",
      payload?.error?.code ?? "UNKNOWN_ERROR",
      response.status,
    );
  }

  return (await response.json()) as OcrSuccess;
}
