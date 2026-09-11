/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * The postMessage protocol between the app and the PDF usercontent iframe. Neither side trusts the
 * other: each message is parsed before use.
 */

/**
 * Where the reader is in the document, as pdf.js reports it on `updateviewarea` and accepts it back as
 * an `XYZ` destination. `left` and `top` are in PDF user-space units on `page`.
 */
export interface PdfPosition {
    /** 1-based page at the top of the view. */
    page: number;
    /** A percentage, or one of pdf.js's named scales such as `"page-width"`. */
    scale: number | string;
    left: number;
    top: number;
}

export const PDF_NAMED_SCALES: ReadonlySet<string> = new Set([
    "auto",
    "page-actual",
    "page-fit",
    "page-width",
    "page-height",
]);

/** Messages the app sends to the iframe: the document (transferred) and where to open it, or a page to go to. */
export type PdfHostMessage =
    | { type: "load"; data: ArrayBuffer; position?: PdfPosition }
    | { type: "go_to_page"; page: number };

/** Messages the iframe sends to the app. */
export type PdfUsercontentMessage =
    /** Listening; the app may send `load`. */
    | { type: "ready" }
    /** Laid out, saved position applied. */
    | { type: "loaded"; pageCount: number; page: number }
    /** The page at the top of the view changed. */
    | { type: "page"; page: number }
    | { type: "position"; position: PdfPosition }
    /** For the log, not the reader. */
    | { type: "error"; message: string };

/** Cap on an error message from the iframe. */
export const MAX_ERROR_MESSAGE_LENGTH = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
    return Number.isInteger(value) && (value as number) >= 1;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

export function isPdfPosition(value: unknown): value is PdfPosition {
    if (!isRecord(value)) return false;

    const scaleIsValid =
        (isFiniteNumber(value.scale) && value.scale > 0) ||
        (typeof value.scale === "string" && PDF_NAMED_SCALES.has(value.scale));

    return isPositiveInteger(value.page) && scaleIsValid && isFiniteNumber(value.left) && isFiniteNumber(value.top);
}

/** Parse a message received by the iframe; `undefined` if malformed. */
export function parsePdfHostMessage(data: unknown): PdfHostMessage | undefined {
    if (!isRecord(data)) return;

    switch (data.type) {
        case "load": {
            if (!(data.data instanceof ArrayBuffer)) return;
            if (data.position !== undefined && !isPdfPosition(data.position)) return;
            return { type: "load", data: data.data, position: data.position };
        }
        case "go_to_page":
            if (!isPositiveInteger(data.page)) return;
            return { type: "go_to_page", page: data.page };
    }
}

/** Parse a message received by the app; `undefined` if malformed. Only known fields are copied out. */
export function parsePdfUsercontentMessage(data: unknown): PdfUsercontentMessage | undefined {
    if (!isRecord(data)) return;

    switch (data.type) {
        case "ready":
            return { type: "ready" };
        case "loaded":
            if (!isPositiveInteger(data.pageCount) || !isPositiveInteger(data.page) || data.page > data.pageCount)
                return;
            return { type: "loaded", pageCount: data.pageCount, page: data.page };
        case "page":
            if (!isPositiveInteger(data.page)) return;
            return { type: "page", page: data.page };
        case "position": {
            if (!isPdfPosition(data.position)) return;
            const { page, scale, left, top } = data.position;
            return { type: "position", position: { page, scale, left, top } };
        }
        case "error":
            if (typeof data.message !== "string") return;
            return { type: "error", message: data.message.slice(0, MAX_ERROR_MESSAGE_LENGTH) };
    }
}
