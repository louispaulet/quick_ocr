import { describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES,
  MAX_FILE_COUNT,
  formatFileSize,
  validateFiles,
} from "./files";

function file(name: string, type: string, size = 4) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("validateFiles", () => {
  it("requires at least one file", () => {
    expect(validateFiles([])).toBe("Add at least one document page.");
  });

  it("accepts supported image files", () => {
    expect(
      validateFiles([
        file("one.png", "image/png"),
        file("two.webp", "image/webp"),
      ]),
    ).toBeNull();
  });

  it("rejects too many files and unsupported types", () => {
    const tooMany = Array.from({ length: MAX_FILE_COUNT + 1 }, (_, index) =>
      file(`${index}.png`, "image/png"),
    );
    expect(validateFiles(tooMany)).toContain(`up to ${MAX_FILE_COUNT}`);
    expect(validateFiles([file("notes.txt", "text/plain")])).toContain(
      "is not a supported image",
    );
  });

  it("rejects empty, oversized, and oversized-total uploads", () => {
    expect(validateFiles([file("empty.png", "image/png", 0)])).toContain("is empty");
    expect(
      validateFiles([file("large.png", "image/png", MAX_FILE_BYTES + 1)]),
    ).toContain("larger than");

    const underPerFileLimit = MAX_FILE_BYTES - 1;
    expect(
      validateFiles([
        file("one.png", "image/png", underPerFileLimit),
        file("two.png", "image/png", underPerFileLimit),
        file("three.png", "image/png", underPerFileLimit),
      ]),
    ).toContain("combined document");
  });
});

describe("formatFileSize", () => {
  it("formats byte values for the interface", () => {
    expect(formatFileSize(1_024)).toBe("1 KB");
    expect(formatFileSize(10 * 1_024 * 1_024)).toBe("10 MB");
  });
});
