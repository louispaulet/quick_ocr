import { Buffer } from "node:buffer";
import OpenAI from "openai";

const MAX_FILE_COUNT = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface Env {
  OPENAI_API_KEY: string;
}

interface EncodedImage {
  dataUrl: string;
  mimeType: string;
}

interface GatewayResult {
  text: string;
  truncated: boolean;
}

export interface OcrGateway {
  extract(images: EncodedImage[]): Promise<GatewayResult>;
}

export type OcrGatewayFactory = (apiKey: string) => OcrGateway;

interface SafeError {
  status: number;
  code: string;
  message: string;
}

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function errorResponse(error: SafeError) {
  return json(
    {
      error: {
        code: error.code,
        message: error.message,
      },
    },
    error.status,
  );
}

function createOpenAIGateway(apiKey: string): OcrGateway {
  const client = new OpenAI({
    apiKey,
    maxRetries: 1,
    timeout: 90_000,
  });

  return {
    async extract(images) {
      const prompt = [
        `Transcribe all visible text from these ${images.length} document page image${images.length === 1 ? "" : "s"} in the exact order provided.`,
        "Preserve reading order, headings, paragraphs, line breaks, lists, and tables. Use Markdown tables when the visual table structure is clear.",
        "Begin every page with a separator exactly formatted as `--- Page N ---`, replacing N with its 1-based page number.",
        "Do not summarize, explain, translate, correct, or add commentary. Do not wrap the transcript in a code fence.",
        "Represent any illegible region as `[unreadable]`. Return only the transcription.",
      ].join("\n");

      const response = await client.responses.create({
        model: "gpt-5.6-luna",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              ...images.map((image) => ({
                type: "input_image" as const,
                image_url: image.dataUrl,
                detail: "original" as const,
              })),
            ],
          },
        ],
        reasoning: { effort: "none" },
        max_output_tokens: 20_000,
        store: false,
      });

      return {
        text: response.output_text.trim(),
        truncated: response.status === "incomplete",
      };
    },
  };
}

function inspectUpstreamError(error: unknown): SafeError {
  const candidate =
    error && typeof error === "object"
      ? (error as { name?: string; status?: number; code?: string })
      : {};

  if (
    candidate.name === "APIConnectionTimeoutError" ||
    candidate.name === "AbortError"
  ) {
    return {
      status: 504,
      code: "OPENAI_TIMEOUT",
      message: "OpenAI took too long to process the document. Try fewer pages.",
    };
  }

  if (candidate.status === 401 || candidate.status === 403) {
    return {
      status: 500,
      code: "OPENAI_CONFIGURATION_ERROR",
      message: "The OCR service is not configured correctly.",
    };
  }

  if (candidate.status === 429 && candidate.code === "insufficient_quota") {
    return {
      status: 429,
      code: "QUOTA_EXCEEDED",
      message: "The OCR service has reached its usage limit.",
    };
  }

  if (candidate.status === 429) {
    return {
      status: 429,
      code: "RATE_LIMITED",
      message: "The OCR service is busy. Please wait and try again.",
    };
  }

  if (candidate.status && candidate.status >= 500) {
    return {
      status: 502,
      code: "OPENAI_UNAVAILABLE",
      message: "OpenAI is temporarily unavailable. Please try again.",
    };
  }

  return {
    status: 502,
    code: "OCR_FAILED",
    message: "The document could not be processed. Please try again.",
  };
}

async function parseAndValidateFiles(request: Request): Promise<
  | { files: File[] }
  | {
      error: SafeError;
    }
> {
  if (!request.headers.get("Content-Type")?.startsWith("multipart/form-data")) {
    return {
      error: {
        status: 400,
        code: "INVALID_CONTENT_TYPE",
        message: "Send document pages as multipart form data.",
      },
    };
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return {
      error: {
        status: 400,
        code: "INVALID_FORM_DATA",
        message: "The uploaded form data could not be read.",
      },
    };
  }

  const values = formData.getAll("files");
  if (values.length === 0 || values.some((value) => typeof value === "string")) {
    return {
      error: {
        status: 400,
        code: "MISSING_FILES",
        message: "Add at least one document page.",
      },
    };
  }

  if (values.length > MAX_FILE_COUNT) {
    return {
      error: {
        status: 400,
        code: "TOO_MANY_FILES",
        message: `Upload no more than ${MAX_FILE_COUNT} pages at a time.`,
      },
    };
  }

  const files = values as File[];
  let totalBytes = 0;

  for (const file of files) {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      return {
        error: {
          status: 400,
          code: "INVALID_FILE_TYPE",
          message: "Only PNG, JPG, and WebP page images are supported.",
        },
      };
    }

    if (file.size === 0) {
      return {
        error: {
          status: 400,
          code: "EMPTY_FILE",
          message: "Uploaded page images cannot be empty.",
        },
      };
    }

    if (file.size > MAX_FILE_BYTES) {
      return {
        error: {
          status: 413,
          code: "FILE_TOO_LARGE",
          message: "Each page image must be 10 MB or smaller.",
        },
      };
    }

    totalBytes += file.size;
  }

  if (totalBytes > MAX_TOTAL_BYTES) {
    return {
      error: {
        status: 413,
        code: "DOCUMENT_TOO_LARGE",
        message: "The combined document must be 25 MB or smaller.",
      },
    };
  }

  return { files };
}

export async function handleOcrRequest(
  request: Request,
  env: Env,
  createGateway: OcrGatewayFactory = createOpenAIGateway,
): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse({
      status: 405,
      code: "METHOD_NOT_ALLOWED",
      message: "Use POST to submit document pages.",
    });
  }

  if (!env.OPENAI_API_KEY) {
    return errorResponse({
      status: 500,
      code: "SERVER_MISCONFIGURED",
      message: "The OCR service is not configured.",
    });
  }

  const parsed = await parseAndValidateFiles(request);
  if ("error" in parsed) {
    return errorResponse(parsed.error);
  }

  const images = await Promise.all(
    parsed.files.map(async (file) => ({
      mimeType: file.type,
      dataUrl: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`,
    })),
  );

  try {
    const result = await createGateway(env.OPENAI_API_KEY).extract(images);
    if (!result.text) {
      return errorResponse({
        status: 502,
        code: "EMPTY_OCR_RESULT",
        message: "OpenAI returned an empty transcript. Try clearer page images.",
      });
    }

    return json({
      text: result.text,
      pageCount: parsed.files.length,
      truncated: result.truncated,
    });
  } catch (error) {
    return errorResponse(inspectUpstreamError(error));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/ocr") {
      return handleOcrRequest(request, env);
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
