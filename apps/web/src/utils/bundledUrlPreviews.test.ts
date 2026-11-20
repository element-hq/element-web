/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, it, expect } from "vitest";
import { type EncryptedFile } from "matrix-js-sdk/src/types";

import { getBundledUrlPreviews } from "./bundledUrlPreviews";

describe("getBundledUrlPreviews", () => {
    const ENCRYPTED_FILE = { url: "mxc://example.org/encrypted" } as EncryptedFile;

    it("returns undefined when the event has no bundle", () => {
        expect(getBundledUrlPreviews({ msgtype: "m.text", body: "https://example.org" })).toBeUndefined();
    });

    it("reads a bundle in the stable format", () => {
        const entry = {
            "matrix:matched_url": "https://example.org",
            "matrix:image:encrypted": ENCRYPTED_FILE,
            "og:title": "Example",
        };
        expect(getBundledUrlPreviews({ "m.url_previews": [entry] })).toEqual([entry]);
    });

    it("converts a bundle in the unstable format to the stable field names", () => {
        expect(
            getBundledUrlPreviews({
                "com.beeper.linkpreviews": [
                    {
                        "matched_url": "https://example.org",
                        "beeper:image:encryption": ENCRYPTED_FILE,
                        "og:title": "Example",
                    },
                ],
            }),
        ).toEqual([
            {
                "matrix:matched_url": "https://example.org",
                "matrix:image:encrypted": ENCRYPTED_FILE,
                "og:title": "Example",
            },
        ]);
    });

    // An entry with nothing but a matched URL asks for the preview to be fetched from the server,
    // so converting one must not add any other field to it.
    it("keeps an unstable entry that only has a matched URL as a single field", () => {
        expect(getBundledUrlPreviews({ "com.beeper.linkpreviews": [{ matched_url: "https://example.org" }] })).toEqual([
            { "matrix:matched_url": "https://example.org" },
        ]);
    });

    it("uses the stable field when an event carries both", () => {
        expect(
            getBundledUrlPreviews({
                "m.url_previews": [{ "matrix:matched_url": "https://example.org/stable" }],
                "com.beeper.linkpreviews": [{ matched_url: "https://example.org/unstable" }],
            }),
        ).toEqual([{ "matrix:matched_url": "https://example.org/stable" }]);
    });

    it("falls back to the unstable field when the stable one is not a list", () => {
        expect(
            getBundledUrlPreviews({
                "m.url_previews": "not a list",
                "com.beeper.linkpreviews": [{ matched_url: "https://example.org" }],
            }),
        ).toEqual([{ "matrix:matched_url": "https://example.org" }]);
    });

    // An empty list is the sender asking for no previews, which is different from having no bundle.
    it.each(["m.url_previews", "com.beeper.linkpreviews"])("returns an empty list for an empty %s", (field) => {
        expect(getBundledUrlPreviews({ [field]: [] })).toEqual([]);
    });

    it("returns undefined when the bundle is not a list", () => {
        const content = { "m.url_previews": { "matrix:matched_url": "https://example.org" } };
        expect(getBundledUrlPreviews(content)).toBeUndefined();
    });

    it("leaves out entries that do not name a URL", () => {
        expect(
            getBundledUrlPreviews({
                "m.url_previews": [
                    null,
                    "https://example.org",
                    { "og:title": "No matched URL" },
                    { "matrix:matched_url": 1234 },
                    { "matrix:matched_url": "https://example.org" },
                ],
            }),
        ).toEqual([{ "matrix:matched_url": "https://example.org" }]);
    });
});
