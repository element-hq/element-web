/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
// The viewer bundle reads the core library off a global the core sets on import.
import "pdfjs-dist";
import { EventBus } from "pdfjs-dist/web/pdf_viewer.mjs";

import { ElementPdfLinkService, isPdfLinkPermitted } from "./pdfLinkService";

function linkFor(url: string, newWindow?: boolean): HTMLAnchorElement {
    const service = new ElementPdfLinkService({ eventBus: new EventBus() });
    const link = document.createElement("a");
    service.addLinkAttributes(link, url, newWindow);
    return link;
}

describe("isPdfLinkPermitted", () => {
    it.each(["https://example.org/doc", "http://example.org", "mailto:someone@example.org"])("permits %s", (url) => {
        expect(isPdfLinkPermitted(url)).toBe(true);
    });

    it.each([
        // Permitted by pdf.js and by Element's message sanitiser, but Element Desktop would drop them.
        "ftp://example.org/file",
        "tel:+441234567890",
        // Element's own schemes and routes.
        "vector://vector/webapp/#/room/!room:example.org",
        "element://vector/webapp/#/room/!room:example.org",
        "#/room/!room:example.org",
        "/#/room/!room:example.org",
        // Never acceptable.
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "blob:http://localhost/abc",
        "",
        "not a url",
    ])("rejects %s", (url) => {
        expect(isPdfLinkPermitted(url)).toBe(false);
    });
});

describe("ElementPdfLinkService", () => {
    it("opens a permitted link in a new tab with no opener or referrer", () => {
        const link = linkFor("https://example.org/doc");

        expect(link.getAttribute("href")).toBe("https://example.org/doc");
        expect(link.target).toBe("_blank");
        expect(link.rel.split(" ")).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
        expect(link.title).toBe("https://example.org/doc");
    });

    it("ignores the document asking for the current window", () => {
        expect(linkFor("https://example.org/doc", false).target).toBe("_blank");
    });

    it("treats a link to Element itself like any other external link", () => {
        const link = linkFor("https://app.element.io/#/room/!room:example.org");

        expect(link.getAttribute("href")).toBe("https://app.element.io/#/room/!room:example.org");
        expect(link.target).toBe("_blank");
    });

    it("strips credentials from the hover text but not from the link", () => {
        const link = linkFor("https://user:secret@example.org/");

        expect(link.getAttribute("href")).toBe("https://user:secret@example.org/");
        expect(link.title).toBe("https://example.org/");
    });

    it.each(["vector://vector/webapp/#/room/!room:example.org", "javascript:alert(1)", "ftp://example.org/"])(
        "makes %s inert",
        (url) => {
            const link = linkFor(url);

            expect(link.hasAttribute("href")).toBe(false);
            // A `false` return from an inline handler cancels the click, as it does in pdf.js's own
            // disabled-link path.
            const onclick = link.onclick as unknown as (() => boolean) | null;
            expect(onclick?.()).toBe(false);
            expect(link.title).toBe(url);
        },
    );
});
