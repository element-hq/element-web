/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, useEffect, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type MediaHandle } from "@element-hq/element-web-module-api";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

import Spinner from "../elements/Spinner";
import pdfWorkerFactory from "../../../workers/pdfWorkerFactory";
import { useResizeObserver } from "./useResizeObserver";
import { PdfPage } from "./PdfPage";

/**
 * The cmaps, standard fonts, ICC profiles and wasm modules pdf.js loads on demand for PDFs which
 * need them. They are copied into the webapp by webpack, see `CopyWebpackPlugin` in webpack.config.ts.
 */
const assetUrl = (dir: string): string => new URL(`pdfjs/${dir}/`, document.baseURI).href;

interface Props {
    media: MediaHandle;
}

/**
 * Renders every page of a PDF into a scrollable column of canvases, scaled to the width of its container.
 */
export function PdfViewer({ media }: Props): JSX.Element {
    const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [container, width] = useResizeObserver();

    useEffect(() => {
        let disposed = false;
        let task: PDFDocumentLoadingTask | undefined;

        setDoc(null);
        setError(null);

        (async (): Promise<void> => {
            // pdf.js is a large dependency which is only needed once someone actually opens a PDF,
            // so it is pulled in as its own chunk here rather than at the top of the module.
            const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
            // pdf.js does all of its parsing and rasterising in a worker. The worker options are global,
            // so the worker is created once and shared between every document we open.
            GlobalWorkerOptions.workerPort ??= pdfWorkerFactory();

            let source: { url: string } | { data: ArrayBuffer };
            if (media.type === "remote") {
                source = { url: media.url };
            } else {
                if (!media.blob) throw new Error("The file viewer was given a file it cannot read");
                // The blob is already decrypted for us, if the file was encrypted.
                source = { data: await media.blob().then((blob) => blob.arrayBuffer()) };
            }
            if (disposed) return;

            task = getDocument({
                ...source,
                cMapUrl: assetUrl("cmaps"),
                cMapPacked: true,
                standardFontDataUrl: assetUrl("standard_fonts"),
                iccUrl: assetUrl("iccs"),
                wasmUrl: assetUrl("wasm"),
            });
            if (disposed) {
                await task.destroy();
                return;
            }

            const doc = await task.promise;
            if (!disposed) setDoc(doc);
        })().catch((e) => {
            if (disposed) return;
            logger.error("Failed to load PDF", e);
            setError(e);
        });

        return () => {
            disposed = true;
            // Destroying the loading task also destroys the document it produced.
            void task?.destroy();
        };
    }, [media]);

    let content: JSX.Element;
    if (error) {
        // TODO: translation
        content = <div className="mx_PdfViewer_message">This PDF could not be displayed.</div>;
    } else if (!doc) {
        content = <Spinner />;
    } else {
        content = (
            <>
                {Array.from({ length: doc.numPages }, (_, i) => (
                    <PdfPage key={i} doc={doc} pageNumber={i + 1} width={width} />
                ))}
            </>
        );
    }

    return (
        <div className="mx_PdfViewer" ref={container} aria-busy={!doc && !error}>
            {content}
        </div>
    );
}
