import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const requestOcrMock = vi.hoisted(() => vi.fn());

vi.mock("./lib/ocr-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/ocr-api")>()),
  requestOcr: requestOcrMock,
}));

const createObjectURL = vi.fn((file: File) => `blob:${file.name}`);
const revokeObjectURL = vi.fn();

function image(name: string, content = "image") {
  return new File([content], name, { type: "image/png", lastModified: 1 });
}

describe("App", () => {
  beforeEach(() => {
    window.location.hash = "";
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    requestOcrMock.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it("adds, reorders, and removes document pages", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByLabelText("Output language")).toHaveValue("original");
    const input = screen.getByLabelText("Choose document page images");
    await user.upload(input, [image("page-one.png"), image("page-two.png")]);

    expect(screen.getByText("page-one.png")).toBeInTheDocument();
    expect(screen.getByText("page-two.png")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move page-two.png up" }));
    const orderedItems = screen.getAllByRole("listitem");
    expect(orderedItems[0]).toHaveTextContent("page-two.png");

    await user.click(screen.getByRole("button", { name: "Remove page-one.png" }));
    expect(screen.queryByText("page-one.png")).not.toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:page-one.png");
  });

  it("opens the About page from the navbar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "About" }));

    expect(
      screen.getByRole("heading", { name: "A quick path from document images to usable text." }),
    ).toBeInTheDocument();
    expect(screen.getByText("gpt-5.6-luna")).toBeInTheDocument();
    expect(screen.getByText(/working demonstration of an OCR and translation flow/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View source on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/louispaulet/quick_ocr",
    );

    await user.click(screen.getByRole("link", { name: "Back to Quick OCR" }));
    expect(screen.getByRole("heading", { name: /Turn document images into editable text/i })).toBeInTheDocument();
  });

  it("renders a link to the main website in the sticky footer", () => {
    render(<App />);

    expect(
      screen.getByRole("link", { name: "Visit Louis Paulet's main website" }),
    ).toHaveAttribute("href", "https://louispaulet.github.io/");
  });

  it("submits files and copies the OCR result", async () => {
    const user = userEvent.setup();
    const clipboardWrite = vi.spyOn(navigator.clipboard, "writeText");
    let resolveRequest!: (result: {
      text: string;
      pageCount: number;
      truncated: boolean;
    }) => void;
    requestOcrMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(<App />);
    const page = image("page.png");
    await user.upload(
      screen.getByLabelText("Choose document page images"),
      page,
    );
    await user.selectOptions(screen.getByLabelText("Output language"), "fr");
    await user.click(
      screen.getByRole("button", { name: "Extract and translate" }),
    );

    await waitFor(() => {
      expect(requestOcrMock).toHaveBeenCalledOnce();
      expect(requestOcrMock).toHaveBeenCalledWith([page], {
        outputLanguage: "fr",
        signal: expect.any(AbortSignal),
      });
    });

    expect(
      screen.getByRole("button", { name: "Reading document…" }),
    ).toBeDisabled();

    await act(async () => {
      resolveRequest({
        text: "--- Page 1 ---\nHello world",
        pageCount: 1,
        truncated: false,
      });
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Extract and translate" }),
      ).not.toBeDisabled();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Translated document text")).toHaveValue(
        "--- Page 1 ---\nHello world",
      );
    });

    await user.click(screen.getByRole("button", { name: "Copy text" }));
    expect(clipboardWrite).toHaveBeenCalledWith("--- Page 1 ---\nHello world");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("accepts dropped files and cleans preview URLs on unmount", async () => {
    const { unmount } = render(<App />);
    const dropzone = screen.getByRole("button", {
      name: /drop page images here or browse/i,
    });

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [image("dropped.png")] },
    });

    expect(await screen.findByText("dropped.png")).toBeInTheDocument();
    unmount();

    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:dropped.png");
    });
  });
});
