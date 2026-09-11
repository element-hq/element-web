/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";

import { PdfViewer, PDF_IFRAME_PERMISSIONS, PDF_USERCONTENT_URL } from "./PdfViewer";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import { flushPdfViewerState } from "../../../utils/pdfViewerState";
import { type PdfMedia } from "../../../@types/pdf-viewer";
import { type PdfHostMessage, type PdfUsercontentMessage } from "../../../usercontent/pdf/protocol";

function media(name = "spec.pdf", body = "%PDF-1.7\n", uri = `mxc://example.org/${name}`, size?: number): PdfMedia {
    return {
        uri,
        name,
        size,
        blob: vi.fn(async () => new Blob([body], { type: "application/pdf" })),
    };
}

/** The iframe's window, as far as the component can tell. */
interface IframeWindow {
    postMessage: ReturnType<typeof vi.fn>;
}

/** Give the iframe a window, since nothing loads it under test. */
function attachIframeWindow(): IframeWindow {
    const iframeWindow: IframeWindow = { postMessage: vi.fn() };
    Object.defineProperty(screen.getByTestId("pdf-iframe"), "contentWindow", {
        configurable: true,
        value: iframeWindow,
    });
    return iframeWindow;
}

/** Deliver a message as if `source` had posted it. */
function receive(data: unknown, source: unknown): void {
    act(() => {
        window.dispatchEvent(new MessageEvent("message", { data, source: source as Window }));
    });
}

/** Everything the app posted into the iframe. */
function sent(iframeWindow: IframeWindow): PdfHostMessage[] {
    return iframeWindow.postMessage.mock.calls.map(([message]) => message as PdfHostMessage);
}

/** Say ready and wait for the document. */
async function loadIntoIframe(iframeWindow: IframeWindow): Promise<PdfHostMessage & { type: "load" }> {
    receive({ type: "ready" } satisfies PdfUsercontentMessage, iframeWindow);
    await waitFor(() => expect(sent(iframeWindow).some((message) => message.type === "load")).toBe(true));
    return sent(iframeWindow).find((message) => message.type === "load") as PdfHostMessage & { type: "load" };
}

/** Render, load and lay out. */
async function renderLoaded(
    pdfMedia: PdfMedia = media(),
    { pageCount = 100, page = 1 } = {},
): Promise<{ iframeWindow: IframeWindow; unmount: () => void }> {
    const { unmount } = render(<PdfViewer media={pdfMedia} />);
    const iframeWindow = attachIframeWindow();
    await loadIntoIframe(iframeWindow);
    receive({ type: "loaded", pageCount, page } satisfies PdfUsercontentMessage, iframeWindow);
    return { iframeWindow, unmount };
}

/** The setting write resolves a tick after unmount. */
async function waitForStateWritten(name = "spec.pdf"): Promise<void> {
    await waitFor(() => expect(SettingsStore.getValue("pdfViewerState")[`mxc://example.org/${name}`]).toBeDefined());
}

describe("PdfViewer", () => {
    beforeEach(async () => {
        flushPdfViewerState();
        await SettingsStore.setValue("pdfViewerState", null, SettingLevel.DEVICE, {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("the iframe", () => {
        it("renders the document in a usercontent iframe with an opaque origin", () => {
            render(<PdfViewer media={media()} />);

            const iframe = screen.getByTestId("pdf-iframe");
            expect(iframe.tagName).toBe("IFRAME");
            expect(iframe.getAttribute("src")).toBe(PDF_USERCONTENT_URL);
            expect(iframe.getAttribute("src")).toBe("usercontent/pdf/");
            expect(iframe).toHaveAttribute("sandbox", PDF_IFRAME_PERMISSIONS);
            // Otherwise the iframe would share the app's origin.
            expect(PDF_IFRAME_PERMISSIONS.split(" ")).not.toContain("allow-same-origin");
            expect(PDF_IFRAME_PERMISSIONS.split(" ")).toEqual(
                expect.arrayContaining(["allow-scripts", "allow-popups", "allow-popups-to-escape-sandbox"]),
            );
            expect(iframe).toHaveAttribute("title", "spec.pdf");
        });

        it("sends the document only once the iframe is listening, handing over the bytes", async () => {
            const pdfMedia = media();
            render(<PdfViewer media={pdfMedia} />);
            const iframeWindow = attachIframeWindow();

            expect(iframeWindow.postMessage).not.toHaveBeenCalled();

            const load = await loadIntoIframe(iframeWindow);
            expect(new TextDecoder().decode(new Uint8Array(load.data))).toBe("%PDF-1.7\n");
            expect(load.position).toBeUndefined();
            // "*" is the only target for an opaque origin; the bytes are transferred.
            expect(iframeWindow.postMessage).toHaveBeenCalledWith(load, "*", [load.data]);
        });

        it("does not send the document again if the iframe says it is ready twice", async () => {
            const { iframeWindow } = await renderLoaded();

            receive({ type: "ready" } satisfies PdfUsercontentMessage, iframeWindow);
            await act(async () => {});

            expect(sent(iframeWindow).filter((message) => message.type === "load")).toHaveLength(1);
        });

        it("ignores messages that do not come from its own iframe", async () => {
            await renderLoaded();

            receive({ type: "page", page: 7 } satisfies PdfUsercontentMessage, window);
            receive({ type: "page", page: 8 } satisfies PdfUsercontentMessage, { postMessage: vi.fn() });
            receive({ type: "error", message: "boom" } satisfies PdfUsercontentMessage, null);

            expect(screen.getByTestId("pdf-page-input")).toHaveValue("1");
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });

        it("ignores messages from its iframe that do not fit the protocol", async () => {
            const { iframeWindow } = await renderLoaded();

            receive({ type: "page", page: "7" }, iframeWindow);
            receive({ type: "page", page: -1 }, iframeWindow);
            receive({ type: "loaded", pageCount: "lots" }, iframeWindow);
            receive("page 7", iframeWindow);
            receive({ type: "error" }, iframeWindow);

            expect(screen.getByTestId("pdf-page-input")).toHaveValue("1");
            expect(screen.getByTestId("pdf-page-total")).toHaveTextContent("100");
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });

        it("shows a clear error when the iframe cannot show the document", async () => {
            const { iframeWindow } = await renderLoaded();

            receive(
                { type: "error", message: "InvalidPDFException: bad xref" } satisfies PdfUsercontentMessage,
                iframeWindow,
            );

            expect(screen.getByRole("alert")).toHaveTextContent("Unable to load PDF.");
        });

        it("stops listening to the iframe once closed", async () => {
            const { iframeWindow, unmount } = await renderLoaded();
            unmount();

            // Must not throw or write state.
            receive({ type: "position", position: { page: 9, scale: 100, left: 0, top: 0 } }, iframeWindow);
            flushPdfViewerState();
            await act(async () => {});

            expect(SettingsStore.getValue("pdfViewerState")).toEqual({});
        });
    });

    describe("checking the attachment", () => {
        it("refuses a file the sender declares as too large without downloading it", async () => {
            const tooLarge = media("huge.pdf", "%PDF-1.7\n", "mxc://example.org/huge", 257 * 1024 * 1024);
            render(<PdfViewer media={tooLarge} />);
            const iframeWindow = attachIframeWindow();

            receive({ type: "ready" }, iframeWindow);

            await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to load PDF"));
            expect(tooLarge.blob).not.toHaveBeenCalled();
            expect(iframeWindow.postMessage).not.toHaveBeenCalled();
        });

        it("refuses a file that turns out to be too large once downloaded", async () => {
            const claimedSmall = media("huge.pdf", "%PDF-1.7\n", "mxc://example.org/huge", 1024);
            vi.mocked(claimedSmall.blob).mockResolvedValue({
                size: 257 * 1024 * 1024,
                arrayBuffer: vi.fn(),
            } as unknown as Blob);
            render(<PdfViewer media={claimedSmall} />);
            const iframeWindow = attachIframeWindow();

            receive({ type: "ready" }, iframeWindow);

            await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to load PDF"));
            expect(iframeWindow.postMessage).not.toHaveBeenCalled();
        });

        it("shows a clear error when the attachment is empty", async () => {
            render(<PdfViewer media={media("empty.pdf", "")} />);
            const iframeWindow = attachIframeWindow();

            receive({ type: "ready" }, iframeWindow);

            expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load PDF.");
            expect(iframeWindow.postMessage).not.toHaveBeenCalled();
        });

        it("rejects an attachment with no PDF signature without handing it to the iframe", async () => {
            render(<PdfViewer media={media("not-really.pdf", "GIF89a this is not a PDF at all")} />);
            const iframeWindow = attachIframeWindow();

            receive({ type: "ready" }, iframeWindow);

            expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load PDF.");
            expect(iframeWindow.postMessage).not.toHaveBeenCalled();
        });

        it("accepts a signature that is not at the very start, as pdf.js does", async () => {
            // pdf.js searches the first 1024 bytes for the header.
            render(<PdfViewer media={media("padded.pdf", "\n\n%PDF-1.7\n")} />);
            const iframeWindow = attachIframeWindow();

            const load = await loadIntoIframe(iframeWindow);

            expect(new TextDecoder().decode(new Uint8Array(load.data))).toBe("\n\n%PDF-1.7\n");
        });

        it("rejects a signature sitting beyond the range pdf.js searches", async () => {
            render(<PdfViewer media={media("late.pdf", "x".repeat(2000) + "%PDF-1.7\n")} />);
            const iframeWindow = attachIframeWindow();

            receive({ type: "ready" }, iframeWindow);

            expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load PDF.");
            expect(iframeWindow.postMessage).not.toHaveBeenCalled();
        });
    });

    describe("pages", () => {
        it("shows the current page and total once the iframe has laid the document out", async () => {
            render(<PdfViewer media={media()} />);
            const iframeWindow = attachIframeWindow();

            expect(screen.getByRole("status")).toHaveTextContent("Loading PDF");
            expect(screen.queryByTestId("pdf-page-input")).not.toBeInTheDocument();

            await loadIntoIframe(iframeWindow);
            receive({ type: "loaded", pageCount: 100, page: 1 } satisfies PdfUsercontentMessage, iframeWindow);

            expect(screen.queryByRole("status")).not.toBeInTheDocument();
            expect(screen.getByTestId("pdf-page-input")).toHaveValue("1");
            expect(screen.getByTestId("pdf-page-total")).toHaveTextContent("100");
        });

        it("follows the document as it is scrolled", async () => {
            const { iframeWindow } = await renderLoaded();

            receive({ type: "page", page: 5 } satisfies PdfUsercontentMessage, iframeWindow);

            await waitFor(() => expect(screen.getByTestId("pdf-page-input")).toHaveValue("5"));
            expect(screen.getByRole("group")).toHaveAccessibleName("Page 5 of 100");
        });

        it("asks the iframe to jump to a page typed into the selector", async () => {
            const user = userEvent.setup();
            const { iframeWindow } = await renderLoaded();

            const input = screen.getByTestId("pdf-page-input");
            await user.clear(input);
            await user.type(input, "42{Enter}");

            expect(iframeWindow.postMessage).toHaveBeenCalledWith({ type: "go_to_page", page: 42 }, "*");
        });

        it("reverts an out-of-range or unparseable page instead of jumping", async () => {
            const user = userEvent.setup();
            const { iframeWindow } = await renderLoaded();

            const input = screen.getByTestId("pdf-page-input");
            receive({ type: "page", page: 7 } satisfies PdfUsercontentMessage, iframeWindow);
            await waitFor(() => expect(input).toHaveValue("7"));

            await user.clear(input);
            await user.type(input, "500{Enter}");
            await waitFor(() => expect(input).toHaveValue("7"));

            await user.clear(input);
            await user.type(input, "abc{Enter}");
            await waitFor(() => expect(input).toHaveValue("7"));

            expect(sent(iframeWindow).filter((message) => message.type === "go_to_page")).toEqual([]);
        });

        it("does not overwrite the box while it is being edited", async () => {
            const user = userEvent.setup();
            const { iframeWindow } = await renderLoaded();

            const input = screen.getByTestId("pdf-page-input");
            await user.clear(input);
            await user.type(input, "12");

            // Scrolling must not clobber a half-typed entry.
            receive({ type: "page", page: 3 } satisfies PdfUsercontentMessage, iframeWindow);

            expect(input).toHaveValue("12");
        });

        it("abandons an edit on Escape", async () => {
            const user = userEvent.setup();
            const { iframeWindow } = await renderLoaded();

            const input = screen.getByTestId("pdf-page-input");
            receive({ type: "page", page: 9 } satisfies PdfUsercontentMessage, iframeWindow);
            await waitFor(() => expect(input).toHaveValue("9"));

            await user.clear(input);
            await user.type(input, "40{Escape}");

            await waitFor(() => expect(input).toHaveValue("9"));
            expect(sent(iframeWindow).filter((message) => message.type === "go_to_page")).toEqual([]);
        });
    });

    describe("reading position", () => {
        it("restores the reading position when the same PDF is reopened", async () => {
            const { iframeWindow, unmount } = await renderLoaded();

            receive(
                {
                    type: "position",
                    position: { page: 12, scale: 150, left: 40, top: 260 },
                } satisfies PdfUsercontentMessage,
                iframeWindow,
            );
            unmount();
            await waitForStateWritten();

            // Switching rooms rebuilds the media handle, so the position is keyed on the MXC URI.
            render(<PdfViewer media={media()} />);
            const load = await loadIntoIframe(attachIframeWindow());

            expect(load.position).toEqual({ page: 12, scale: 150, left: 40, top: 260 });
        });

        it("keeps a fit-to-panel zoom by name, so the iframe recomputes it", async () => {
            const { iframeWindow, unmount } = await renderLoaded();

            receive(
                {
                    type: "position",
                    position: { page: 3, scale: "page-width", left: 0, top: 80 },
                } satisfies PdfUsercontentMessage,
                iframeWindow,
            );
            unmount();
            await waitForStateWritten();

            render(<PdfViewer media={media()} />);
            const load = await loadIntoIframe(attachIframeWindow());

            expect(load.position).toEqual({ page: 3, scale: "page-width", left: 0, top: 80 });
        });

        it("keeps reading positions separate for different attachments", async () => {
            const { iframeWindow, unmount } = await renderLoaded(media("first.pdf"));

            receive(
                {
                    type: "position",
                    position: { page: 30, scale: 100, left: 0, top: 900 },
                } satisfies PdfUsercontentMessage,
                iframeWindow,
            );
            unmount();
            await waitForStateWritten("first.pdf");

            render(<PdfViewer media={media("second.pdf")} />);
            const load = await loadIntoIframe(attachIframeWindow());

            expect(load.position).toBeUndefined();
        });

        it("does not record a position the iframe reports before it has laid the document out", async () => {
            render(<PdfViewer media={media()} />);
            const iframeWindow = attachIframeWindow();
            await loadIntoIframe(iframeWindow);

            // A fresh layout reports page 1 before the restore; it must not win.
            receive(
                {
                    type: "position",
                    position: { page: 1, scale: "page-width", left: 0, top: 0 },
                } satisfies PdfUsercontentMessage,
                iframeWindow,
            );
            receive({ type: "loaded", pageCount: 100, page: 12 } satisfies PdfUsercontentMessage, iframeWindow);
            receive(
                {
                    type: "position",
                    position: { page: 12, scale: 150, left: 40, top: 260 },
                } satisfies PdfUsercontentMessage,
                iframeWindow,
            );
            flushPdfViewerState();
            await waitForStateWritten();

            expect(SettingsStore.getValue("pdfViewerState")["mxc://example.org/spec.pdf"]).toMatchObject({ page: 12 });
        });

        it("stores nothing but the position the iframe reported", async () => {
            const { iframeWindow, unmount } = await renderLoaded();

            receive(
                {
                    type: "position",
                    position: { page: 2, scale: 100, left: 0, top: 0, evil: "payload" },
                    extra: "payload",
                },
                iframeWindow,
            );
            unmount();
            await waitForStateWritten();

            const stored = SettingsStore.getValue("pdfViewerState")["mxc://example.org/spec.pdf"];
            expect(Object.keys(stored).sort()).toEqual(["left", "page", "scale", "top", "updatedAt"]);
        });
    });
});
