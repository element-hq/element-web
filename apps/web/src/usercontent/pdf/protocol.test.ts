/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { isPdfPosition, MAX_ERROR_MESSAGE_LENGTH, parsePdfHostMessage, parsePdfUsercontentMessage } from "./protocol";

const position = { page: 3, scale: 150, left: 10, top: 20 };

describe("isPdfPosition", () => {
    it.each([
        position,
        { ...position, scale: "page-width" },
        { ...position, scale: "auto" },
        { ...position, left: -5.5, top: 0 },
    ])("accepts %j", (value) => {
        expect(isPdfPosition(value)).toBe(true);
    });

    it.each([
        null,
        "page 3",
        { ...position, page: 0 },
        { ...position, page: 1.5 },
        { ...position, scale: 0 },
        { ...position, scale: -100 },
        { ...position, scale: Number.NaN },
        { ...position, scale: "huge" },
        { ...position, left: Number.POSITIVE_INFINITY },
        { ...position, top: "20" },
        { page: 3, scale: 150 },
    ])("rejects %j", (value) => {
        expect(isPdfPosition(value)).toBe(false);
    });
});

describe("parsePdfHostMessage", () => {
    it("accepts a document with or without a saved position", () => {
        const data = new ArrayBuffer(8);

        expect(parsePdfHostMessage({ type: "load", data })).toEqual({ type: "load", data, position: undefined });
        expect(parsePdfHostMessage({ type: "load", data, position })).toEqual({ type: "load", data, position });
    });

    it("rejects a document that is not an ArrayBuffer or comes with a bad position", () => {
        expect(parsePdfHostMessage({ type: "load", data: new Uint8Array(8) })).toBeUndefined();
        expect(parsePdfHostMessage({ type: "load", data: "bytes" })).toBeUndefined();
        expect(parsePdfHostMessage({ type: "load", data: new ArrayBuffer(8), position: { page: 0 } })).toBeUndefined();
    });

    it("accepts a page to go to, and only a real one", () => {
        expect(parsePdfHostMessage({ type: "go_to_page", page: 7 })).toEqual({ type: "go_to_page", page: 7 });
        expect(parsePdfHostMessage({ type: "go_to_page", page: 0 })).toBeUndefined();
        expect(parsePdfHostMessage({ type: "go_to_page", page: "7" })).toBeUndefined();
    });

    it("accepts a zoom step in either direction, and nothing else", () => {
        expect(parsePdfHostMessage({ type: "zoom", direction: "in" })).toEqual({ type: "zoom", direction: "in" });
        expect(parsePdfHostMessage({ type: "zoom", direction: "out" })).toEqual({ type: "zoom", direction: "out" });
        expect(parsePdfHostMessage({ type: "zoom", direction: "sideways" })).toBeUndefined();
        expect(parsePdfHostMessage({ type: "zoom" })).toBeUndefined();
    });

    it.each([undefined, null, 42, "load", {}, { type: "ready" }, { type: "explode" }])("rejects %j", (value) => {
        expect(parsePdfHostMessage(value)).toBeUndefined();
    });
});

describe("parsePdfUsercontentMessage", () => {
    it("accepts the lifecycle messages", () => {
        expect(parsePdfUsercontentMessage({ type: "ready" })).toEqual({ type: "ready" });
        expect(parsePdfUsercontentMessage({ type: "loaded", pageCount: 12, page: 4 })).toEqual({
            type: "loaded",
            pageCount: 12,
            page: 4,
        });
        expect(parsePdfUsercontentMessage({ type: "page", page: 9 })).toEqual({ type: "page", page: 9 });
        expect(parsePdfUsercontentMessage({ type: "position", position })).toEqual({ type: "position", position });
        expect(parsePdfUsercontentMessage({ type: "error", message: "boom" })).toEqual({
            type: "error",
            message: "boom",
        });
    });

    it("rejects page numbers that are not positive integers or exceed the page count", () => {
        expect(parsePdfUsercontentMessage({ type: "loaded", pageCount: 0, page: 1 })).toBeUndefined();
        expect(parsePdfUsercontentMessage({ type: "loaded", pageCount: 3, page: 4 })).toBeUndefined();
        expect(parsePdfUsercontentMessage({ type: "loaded", pageCount: 3.5, page: 1 })).toBeUndefined();
        expect(parsePdfUsercontentMessage({ type: "page", page: -1 })).toBeUndefined();
        expect(parsePdfUsercontentMessage({ type: "page", page: Number.NaN })).toBeUndefined();
    });

    it("copies only the known fields out of a position", () => {
        const parsed = parsePdfUsercontentMessage({
            type: "position",
            position: { ...position, __proto__: { admin: true }, extra: "x" },
            extra: "y",
        });

        expect(parsed).toEqual({ type: "position", position });
        expect(Object.keys(parsed!)).toEqual(["type", "position"]);
        expect(Object.keys((parsed as { position: object }).position)).toEqual(["page", "scale", "left", "top"]);
    });

    it("rejects a malformed position", () => {
        expect(
            parsePdfUsercontentMessage({ type: "position", position: { ...position, scale: "enormous" } }),
        ).toBeUndefined();
        expect(parsePdfUsercontentMessage({ type: "position" })).toBeUndefined();
    });

    it("truncates an error message and refuses one that is not a string", () => {
        const long = "x".repeat(MAX_ERROR_MESSAGE_LENGTH * 3);

        expect(parsePdfUsercontentMessage({ type: "error", message: long })).toEqual({
            type: "error",
            message: "x".repeat(MAX_ERROR_MESSAGE_LENGTH),
        });
        expect(parsePdfUsercontentMessage({ type: "error", message: { toString: () => "boom" } })).toBeUndefined();
    });

    it.each([undefined, null, "ready", {}, { type: "load" }, { type: "go_to_page", page: 1 }])(
        "rejects %j",
        (value) => {
            expect(parsePdfUsercontentMessage(value)).toBeUndefined();
        },
    );
});
