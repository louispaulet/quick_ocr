// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  buildOcrPrompt,
  handleOcrRequest,
  type OcrGateway,
  type OcrGatewayFactory,
} from "./index";

const env = { OPENAI_API_KEY: "test-key" };

function page(name = "page.png", size = 4, type = "image/png") {
  return new File([new Uint8Array(size)], name, { type });
}

function requestWith(files: File[], outputLanguage?: string) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file, file.name));
  if (outputLanguage) formData.set("outputLanguage", outputLanguage);
  return new Request("https://example.com/api/ocr", {
    method: "POST",
    body: formData,
  });
}

function factoryFor(gateway: OcrGateway): OcrGatewayFactory {
  return () => gateway;
}

async function errorBody(response: Response) {
  return response.json() as Promise<{ error: { code: string; message: string } }>;
}

describe("handleOcrRequest", () => {
  it("returns an ordered OCR result", async () => {
    const extract = vi.fn().mockResolvedValue({
      text: "--- Page 1 ---\nHello",
      truncated: false,
    });
    const response = await handleOcrRequest(
      requestWith([page("one.png"), page("two.png")]),
      env,
      factoryFor({ extract }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      text: "--- Page 1 ---\nHello",
      pageCount: 2,
      truncated: false,
    });
    expect(extract).toHaveBeenCalledOnce();
    expect(extract.mock.calls[0][0]).toHaveLength(2);
    expect(extract.mock.calls[0][1]).toBe("original");
  });

  it("passes the selected translation language to the OCR gateway", async () => {
    const extract = vi.fn().mockResolvedValue({
      text: "--- Page 1 ---\nBonjour",
      truncated: false,
    });
    const response = await handleOcrRequest(
      requestWith([page()], "fr"),
      env,
      factoryFor({ extract }),
    );

    expect(response.status).toBe(200);
    expect(extract).toHaveBeenCalledWith(expect.any(Array), "fr");
  });

  it("rejects an unsupported output language", async () => {
    const createGateway = vi.fn();
    const response = await handleOcrRequest(
      requestWith([page()], "de"),
      env,
      createGateway,
    );

    expect(response.status).toBe(400);
    expect((await errorBody(response)).error.code).toBe(
      "INVALID_OUTPUT_LANGUAGE",
    );
    expect(createGateway).not.toHaveBeenCalled();
  });

  it.each([
    ["original", "Do not translate it."],
    ["en", "into English"],
    ["fr", "into French"],
  ] as const)("builds the %s language prompt", (language, expectedText) => {
    const prompt = buildOcrPrompt(2, language);

    expect(prompt).toContain(expectedText);
    expect(prompt).toContain("--- Page N ---");
    expect(prompt).toContain("[unreadable]");
  });

  it("returns partial output with a truncation flag", async () => {
    const response = await handleOcrRequest(
      requestWith([page()]),
      env,
      factoryFor({
        extract: vi.fn().mockResolvedValue({ text: "Partial", truncated: true }),
      }),
    );

    expect(await response.json()).toEqual({
      text: "Partial",
      pageCount: 1,
      truncated: true,
    });
  });

  it("rejects invalid uploads before creating a gateway", async () => {
    const createGateway = vi.fn();
    const response = await handleOcrRequest(
      requestWith([page("notes.txt", 4, "text/plain")]),
      env,
      createGateway,
    );

    expect(response.status).toBe(400);
    expect((await errorBody(response)).error.code).toBe("INVALID_FILE_TYPE");
    expect(createGateway).not.toHaveBeenCalled();
  });

  it.each([
    [401, "invalid_api_key", 500, "OPENAI_CONFIGURATION_ERROR"],
    [429, "rate_limit_exceeded", 429, "RATE_LIMITED"],
    [429, "insufficient_quota", 429, "QUOTA_EXCEEDED"],
    [500, "server_error", 502, "OPENAI_UNAVAILABLE"],
    [undefined, "timeout", 504, "OPENAI_TIMEOUT"],
  ])(
    "maps upstream status %s and code %s",
    async (upstreamStatus, upstreamCode, status, code) => {
      const response = await handleOcrRequest(
        requestWith([page()]),
        env,
        factoryFor({
          extract: vi.fn().mockRejectedValue(
            Object.assign(new Error("private upstream details"), {
              name: upstreamCode === "timeout" ? "APIConnectionTimeoutError" : "Error",
              status: upstreamStatus,
              code: upstreamCode,
            }),
          ),
        }),
      );

      expect(response.status).toBe(status);
      const body = await errorBody(response);
      expect(body.error.code).toBe(code);
      expect(body.error.message).not.toContain("private upstream details");
    },
  );

  it("returns a configuration error when the key is missing", async () => {
    const response = await handleOcrRequest(
      requestWith([page()]),
      { OPENAI_API_KEY: "" },
      vi.fn(),
    );

    expect(response.status).toBe(500);
    expect((await errorBody(response)).error.code).toBe("SERVER_MISCONFIGURED");
  });
});
