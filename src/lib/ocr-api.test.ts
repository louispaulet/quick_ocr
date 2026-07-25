import { afterEach, describe, expect, it, vi } from "vitest";
import { OcrRequestError, requestOcr } from "./ocr-api";

describe("requestOcr", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
    const result = await requestOcr([first, second]);

    expect(result.pageCount).toBe(2);
    const [, options] = fetchMock.mock.calls[0];
    const body = options.body as FormData;
    expect(body.getAll("files")).toEqual([first, second]);
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
