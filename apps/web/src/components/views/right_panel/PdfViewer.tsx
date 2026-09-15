/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { PdfViewerView, type PdfViewerStatus } from "@element-hq/web-shared-components";

import { type PdfMedia } from "../../../@types/pdf-viewer";
import { flushPdfViewerState, getPdfViewerState, setPdfViewerState } from "../../../utils/pdfViewerState";
import { type PdfHostMessage, parsePdfUsercontentMessage } from "../../../usercontent/pdf/protocol";
import { _t } from "../../../languageHandler";

const loggerPdf = logger.getChild("PdfViewer");

/** Served relative to the app; see the webpack config. */
export const PDF_USERCONTENT_URL = "usercontent/pdf/";

/** No `allow-same-origin`: the iframe gets an opaque origin. Popups let document links open new tabs. */
export const PDF_IFRAME_PERMISSIONS = "allow-scripts allow-popups allow-popups-to-escape-sandbox";

/** `%PDF-`, the signature every PDF carries. */
const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d];
/** How far in to look for the signature; the same distance pdf.js scans. */
const PDF_HEADER_SEARCH_LIMIT = 1024;

/** The whole file is held in memory while open. */
const MAX_PDF_BYTES = 256 * 1024 * 1024;

/** Whether the bytes carry a PDF signature. Not a security control; it just fails non-PDFs cleanly. */
function hasPdfHeader(data: Uint8Array): boolean {
    const lastStart = Math.min(data.length - PDF_HEADER.length, PDF_HEADER_SEARCH_LIMIT);

    for (let start = 0; start <= lastStart; start++) {
        if (PDF_HEADER.every((byte, offset) => data[start + offset] === byte)) return true;
    }

    return false;
}

/**
 * Shows a PDF attachment in the right panel. pdf.js runs in a usercontent iframe with an opaque origin
 * (see `src/usercontent/pdf/` and `docs/usercontent.md`); this side fetches and checks the attachment,
 * owns the toolbar, and remembers the reading position per MXC URI. Messages from the iframe are
 * validated before use.
 */
export function PdfViewer({ media }: { media: PdfMedia }): JSX.Element {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [status, setStatus] = useState<PdfViewerStatus>("loading");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageCount, setPageCount] = useState(0);
    const [pageInput, setPageInput] = useState("1");
    // Don't overwrite the page box while it is being typed in.
    const isEditingPageRef = useRef(false);
    // Escape blurs the box, and blur commits, so the cancellation must survive into the blur.
    const isPageEditCancelledRef = useRef(false);

    useEffect(() => {
        if (isEditingPageRef.current) return;

        setPageInput(String(currentPage));
    }, [currentPage]);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        setStatus("loading");
        setCurrentPage(1);
        setPageCount(0);

        let disposed = false;
        let isLoadStarted = false;
        let isLoaded = false;

        const send = (message: PdfHostMessage, transfer: Transferable[] = []): void => {
            // "*": an opaque origin cannot be named. The target is still only our iframe's window.
            iframe.contentWindow?.postMessage(message, "*", transfer);
        };

        const fail = (error: unknown): void => {
            if (disposed) return;

            loggerPdf.error("Unable to load PDF", error);
            setStatus("error");
        };

        const loadDocument = async (): Promise<void> => {
            // The declared size is a claim, but a large one saves the download.
            if (media.size !== undefined && media.size > MAX_PDF_BYTES) {
                throw new Error("PDF attachment is too large");
            }

            const blob = await media.blob();
            if (blob.size === 0) {
                throw new Error("PDF attachment is empty");
            }
            if (blob.size > MAX_PDF_BYTES) {
                throw new Error("PDF attachment is too large");
            }

            const data = new Uint8Array(await blob.arrayBuffer());
            if (!hasPdfHeader(data)) {
                throw new Error("Attachment is not a PDF");
            }

            if (disposed) return;

            const saved = getPdfViewerState(media.uri);
            const position = saved && { page: saved.page, scale: saved.scale, left: saved.left, top: saved.top };

            // Transferred, not copied.
            send({ type: "load", data: data.buffer, position }, [data.buffer]);
        };

        const onMessage = (event: MessageEvent): void => {
            // Only our iframe, and only with the "null" origin a sandboxed iframe has.
            if (disposed || event.source !== iframe.contentWindow || event.origin !== "null") return;

            const message = parsePdfUsercontentMessage(event.data);
            if (!message) return;

            switch (message.type) {
                case "ready":
                    // A second `ready` means the iframe reloaded itself; it does not get the document again.
                    if (isLoadStarted) return;
                    isLoadStarted = true;
                    void loadDocument().catch(fail);
                    break;
                case "loaded":
                    isLoaded = true;
                    setPageCount(message.pageCount);
                    setCurrentPage(message.page);
                    setStatus("ready");
                    break;
                case "page":
                    setCurrentPage(message.page);
                    break;
                case "position":
                    // Positions before `loaded` predate the restore.
                    if (!isLoaded) return;
                    setPdfViewerState(media.uri, message.position);
                    break;
                case "error":
                    fail(new Error(message.message));
                    break;
            }
        };

        // Listen before setting `src` so `ready` cannot be missed.
        window.addEventListener("message", onMessage);
        iframe.src = PDF_USERCONTENT_URL;

        return () => {
            disposed = true;
            window.removeEventListener("message", onMessage);

            // Don't leave the last position sitting in the debounce.
            flushPdfViewerState();
        };
    }, [media]);

    const commitPageInput = useCallback((): void => {
        const requestedPage = Number.parseInt(pageInput, 10);

        if (Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= pageCount) {
            // The iframe reports the new page back via `page`.
            const message: PdfHostMessage = { type: "go_to_page", page: requestedPage };
            iframeRef.current?.contentWindow?.postMessage(message, "*");
        } else {
            setPageInput(String(currentPage));
        }
    }, [currentPage, pageCount, pageInput]);

    const onPageInputChange = useCallback((value: string): void => {
        setPageInput(value);
    }, []);

    const onPageInputFocus = useCallback((): void => {
        isEditingPageRef.current = true;
        isPageEditCancelledRef.current = false;
    }, []);

    const onPageInputBlur = useCallback((): void => {
        isEditingPageRef.current = false;

        if (isPageEditCancelledRef.current) {
            isPageEditCancelledRef.current = false;
            setPageInput(String(currentPage));
            return;
        }

        commitPageInput();
    }, [commitPageInput, currentPage]);

    const onPageInputCancel = useCallback((): void => {
        // The View blurs the input next, which runs the guarded blur handler above.
        isPageEditCancelledRef.current = true;
        setPageInput(String(currentPage));
    }, [currentPage]);

    return (
        <PdfViewerView
            status={status}
            currentPage={currentPage}
            pageCount={pageCount}
            pageInput={pageInput}
            onPageInputChange={onPageInputChange}
            onPageInputFocus={onPageInputFocus}
            onPageInputBlur={onPageInputBlur}
            onPageInputCancel={onPageInputCancel}
            onPageSubmit={commitPageInput}
        >
            {/* Keyed on the file so a new document gets a fresh iframe. `src` is set by the effect above. */}
            <iframe
                key={media.uri}
                ref={iframeRef}
                className="mx_PdfViewer_iframe"
                data-testid="pdf-iframe"
                sandbox={PDF_IFRAME_PERMISSIONS}
                title={media.name ?? _t("pdf_viewer|title")}
            />
        </PdfViewerView>
    );
}
