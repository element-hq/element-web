/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen } from "jest-matrix-react";
import fs from "node:fs";
import path from "node:path";

import PendingAttachmentTray from "../../../../../src/components/views/rooms/PendingAttachmentTray";
import type { PendingComposerAttachment } from "../../../../../src/components/views/rooms/composer/PendingComposerAttachments";

describe("PendingAttachmentTray", () => {
    const firstFile = new File(["first"], "first.png", { type: "image/png" });
    const secondFile = new File(["second"], "second.jpg", { type: "image/jpeg" });

    const pending: PendingComposerAttachment[] = [
        { id: "first", file: firstFile, objectUrl: "blob:first" },
        { id: "second", file: secondFile, objectUrl: "blob:second" },
    ];

    it("renders pending image thumbnails above the composer", () => {
        render(<PendingAttachmentTray attachments={pending} onRemove={jest.fn()} />);

        expect(screen.getByRole("img", { name: "first.png" })).toHaveAttribute("src", "blob:first");
        expect(screen.getByRole("img", { name: "second.jpg" })).toHaveAttribute("src", "blob:second");
    });

    it("renders images inside an explicitly bounded thumbnail contract", () => {
        render(<PendingAttachmentTray attachments={pending} onRemove={jest.fn()} />);

        expect(screen.getByTestId("pending-attachment-tray")).toHaveClass("mx_PendingAttachmentTray_bounded");
        expect(screen.getByRole("img", { name: "first.png" })).toHaveClass("mx_PendingAttachmentTray_thumbnailImage");
        expect(screen.getByRole("img", { name: "second.jpg" })).toHaveClass("mx_PendingAttachmentTray_thumbnailImage");
    });

    it("keeps the thumbnail remove control accessible in the thumbnail frame", () => {
        render(<PendingAttachmentTray attachments={pending} onRemove={jest.fn()} />);

        const removeButton = screen.getByRole("button", { name: "Remove first.png" });
        expect(removeButton).toHaveClass("mx_PendingAttachmentTray_removeButton");
        expect(screen.getByRole("img", { name: "first.png" }).parentElement).toContainElement(removeButton);
    });

    it("has PCSS containment for large screenshot thumbnails", () => {
        const css = fs.readFileSync(
            path.join(__dirname, "../../../../../res/css/views/rooms/_MessageComposer.pcss"),
            "utf8",
        );

        expect(css).toContain(".mx_PendingAttachmentTray_bounded");
        expect(css).toContain("max-height: 180px");
        expect(css).toContain("overflow-x: auto");
        expect(css).toContain("overflow-y: auto");
        expect(css).toContain(".mx_PendingAttachmentTray_thumbnailImage");
        expect(css).toContain("max-width: 160px");
        expect(css).toContain("max-height: 120px");
        expect(css).toContain("object-fit: contain");
        expect(css).not.toContain(".mx_PendingAttachmentTray_caption");
    });

    it("has PCSS hover and keyboard focus polish for the thumbnail remove control", () => {
        const css = fs.readFileSync(
            path.join(__dirname, "../../../../../res/css/views/rooms/_MessageComposer.pcss"),
            "utf8",
        );

        expect(css).toContain(".mx_PendingAttachmentTray_removeButton");
        expect(css).toContain("border-radius: 50%");
        expect(css).toContain("background-color: rgb(0 0 0 / 60%)");
        expect(css).toContain("opacity: 0");
        expect(css).toContain("pointer-events: none");
        expect(css).toContain("&:hover,");
        expect(css).toContain("&:focus-within");
        expect(css).toContain("&:focus-visible");
        expect(css).toContain("pointer-events: auto");
    });

    it("keeps tray controls from bubbling clicks to the composer focus wrapper", () => {
        const onParentClick = jest.fn();
        render(
            <div onClick={onParentClick}>
                <PendingAttachmentTray attachments={pending} onRemove={jest.fn()} />
            </div>,
        );

        fireEvent.click(screen.getByRole("img", { name: "first.png" }));
        fireEvent.click(screen.getByRole("button", { name: "Remove first.png" }));

        expect(onParentClick).not.toHaveBeenCalled();
    });

    it("does not render per-image caption textboxes", () => {
        render(<PendingAttachmentTray attachments={pending} onRemove={jest.fn()} />);

        expect(screen.queryByRole("textbox")).toBeNull();
        expect(screen.queryByLabelText("Caption for first.png")).toBeNull();
        expect(screen.queryByLabelText("Caption for second.jpg")).toBeNull();
    });

    it("removes an image before send", () => {
        const onRemove = jest.fn();
        render(<PendingAttachmentTray attachments={pending} onRemove={onRemove} />);

        fireEvent.click(screen.getByRole("button", { name: "Remove first.png" }));

        expect(onRemove).toHaveBeenCalledWith("first");
    });

    it("keeps send button/composer available without a side caption field", () => {
        render(
            <>
                <PendingAttachmentTray attachments={pending} onRemove={jest.fn()} />
                <button type="button">Send</button>
            </>,
        );

        expect(screen.queryByRole("textbox")).toBeNull();
        expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    });
});
