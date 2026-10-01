/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// pdf.js's viewer bundle reads the core library off a global that the core sets on import, so the core
// has to have been evaluated first. Importing it here keeps this module usable on its own.
import "pdfjs-dist";
import { type EventBus, LinkTarget, PDFLinkService } from "pdfjs-dist/web/pdf_viewer.mjs";
import { isUrlPermitted } from "@element-hq/element-web-shared-utils";

/**
 * Schemes a link in a document is allowed to open.
 *
 * pdf.js already drops anything but http, https, ftp, mailto and tel while parsing, both for link
 * annotations and for URLs it recognises in body text. This narrows that to what Element Desktop's own
 * window-open handler will pass to the system browser, so a link behaves the same on web and desktop
 * rather than silently doing nothing on one of them.
 */
const PDF_LINK_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/** Whether a URL taken from a document may be opened. Relative and malformed URLs are rejected. */
export function isPdfLinkPermitted(url: string): boolean {
    if (!isUrlPermitted(url)) return false;
    return PDF_LINK_SCHEMES.has(new URL(url).protocol);
}

/**
 * pdf.js's link service, with Element's policy for links that leave the document.
 *
 * Every external href pdf.js creates — from a link annotation or from a URL it spotted in the text —
 * goes through {@link addLinkAttributes}, so this is the one place that decides what a click does. The
 * policy is deliberately dumb: a permitted URL opens in a new tab with no opener and no referrer, and
 * nothing else happens. In particular a link is never routed inside Element, even when it points at an
 * Element or matrix.to permalink; a document should not be able to move the app to a room of its
 * choosing. Navigation within the document (go-to-page links, named actions) is left to pdf.js.
 */
export class ElementPdfLinkService extends PDFLinkService {
    public constructor({ eventBus }: { eventBus: EventBus }) {
        // Set on the service too, so a pdf.js code path that reaches these without going through
        // addLinkAttributes still gets a new tab and no referrer.
        super({
            eventBus,
            externalLinkTarget: LinkTarget.BLANK,
            externalLinkRel: "noreferrer noopener",
        });
    }

    public override addLinkAttributes(link: HTMLAnchorElement, url: string, newWindow?: boolean): void {
        if (!isPdfLinkPermitted(url)) {
            // Mirror what pdf.js does for a link it has been told to disable: keep the hit area so the
            // reader can see something was there, but make it inert.
            link.removeAttribute("href");
            link.title = url;
            link.onclick = (): boolean => false;
            return;
        }

        // `newWindow` is the document's preference; ours is not negotiable.
        super.addLinkAttributes(link, url, true);
    }
}
