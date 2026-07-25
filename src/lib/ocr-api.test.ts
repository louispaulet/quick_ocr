import { afterEach, describe, expect, it, vi } from "vitest";
import { getApiBaseUrl, OcrRequestError, requestOcr } from "./ocr-api";

describe("requestOcr", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects the local and production API bases", () => {
    expect(getApiBaseUrl({ DEV: true })).toBe("");
    expect(getApiBaseUrl({ DEV: false })).toBe(
      "https://quick-ocr.louispaulet13.workers.dev",
    );
    expect(
      getApiBaseUrl({
        DEV: false,
        VITE_API_BASE_URL: "https://example.com/",
      }),
    ).toBe("https://example.com");
  });

  it("posts ordered files as multipart form data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ text: "Transcript", pageCount: 2, truncated: false }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = new File(["one"], "one.png", { type: "image/png" });
    const second = new File(["two"], "two.png", { type: "image/png" });
    const result = await requestOcr([first, second], { outputLanguage: "fr" });

    expect(result.pageCount).toBe(2);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/ocr$/);
    const body = options.body as FormData;
    expect(body.getAll("files")).toEqual([first, second]);
    expect(body.get("outputLanguage")).toBe("fr");
  });

  it("returns the safe API error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "RATE_LIMITED", message: "Please wait and try again." },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      requestOcr([new File(["one"], "one.png", { type: "image/png" })]),
    ).rejects.toEqual(
      expect.objectContaining<OcrRequestError>({
        code: "RATE_LIMITED",
        message: "Please wait and try again.",
        name: "OcrRequestError",
        status: 429,
      }),
    );
  });
});
