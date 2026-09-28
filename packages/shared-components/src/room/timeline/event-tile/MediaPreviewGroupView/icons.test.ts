/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { render } from "@test-utils";
import { describe, expect, it } from "vitest";

import { attachmentIcon, linkIcon } from "./icons";

describe("icons", () => {
    it("returns a decorative file icon for attachments", () => {
        const { icon, color } = attachmentIcon("image/png");

        expect(color).toEqual("var(--cpd-color-text-decorative-4)");
        const { container } = render(icon);
        expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("returns the same attachment icon regardless of mime type", () => {
        const { container: withMime } = render(attachmentIcon("application/pdf").icon);
        const { container: withoutMime } = render(attachmentIcon().icon);

        expect(withoutMime.innerHTML).toEqual(withMime.innerHTML);
    });

    it("returns a decorative link icon for URL previews", () => {
        const { icon, color } = linkIcon();

        expect(color).toEqual("var(--cpd-color-text-decorative-4)");
        const { container } = render(icon);
        expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("uses different icons for attachments and links", () => {
        const { container: attachment } = render(attachmentIcon().icon);
        const { container: link } = render(linkIcon().icon);

        expect(attachment.innerHTML).not.toEqual(link.innerHTML);
    });
});
