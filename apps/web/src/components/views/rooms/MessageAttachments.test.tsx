/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "test-utils-rtl";
import { tearDownAfterTest } from "test-utils";

import { MessageAttachments } from "./MessageAttachments";
import { GalleryComposerViewModel } from "../../../viewmodels/composer/GalleryComposerViewModel";

describe("<MessageAttachments />", () => {
    const photo = new File(["photo"], "photo.png", { type: "image/png" });

    beforeEach(() => {
        vi.spyOn(URL, "createObjectURL").mockImplementation((file) => `blob:${(file as File).name}`);
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function createVm(items: File[] = []): GalleryComposerViewModel {
        return tearDownAfterTest(new GalleryComposerViewModel({ items }));
    }

    it("shows nothing while nothing is attached", () => {
        const { container } = render(<MessageAttachments vm={createVm()} />);

        expect(container).toBeEmptyDOMElement();
    });

    it("shows the attachments and the tile to add more", () => {
        render(<MessageAttachments vm={createVm([photo])} className="custom-attachments" />);

        expect(screen.getByRole("img", { name: "photo.png" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Remove photo.png" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Add photos or videos" })).toBeInTheDocument();
        expect(screen.getByRole("list").parentElement).toHaveClass("custom-attachments");
    });

    it("appears as soon as something is attached, and goes once it is all removed", () => {
        const vm = createVm();
        render(<MessageAttachments vm={vm} />);
        expect(screen.queryByRole("list")).not.toBeInTheDocument();

        act(() => vm.onAddFiles([photo]));
        expect(screen.getByRole("img", { name: "photo.png" })).toBeInTheDocument();

        act(() => vm.onRemoveItem(vm.getSnapshot().items[0].id));
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("appears to explain why files which cannot be attached were left out", () => {
        const vm = createVm();
        render(<MessageAttachments vm={vm} />);

        act(() => vm.onAddFiles([new File(["%PDF"], "report.pdf", { type: "application/pdf" })]));

        expect(screen.getByRole("status")).toHaveTextContent("Only images and videos can be added");
        expect(screen.queryAllByRole("img")).toHaveLength(0);
    });

    it("can always be shown, so that the add tile is there with nothing attached", () => {
        render(<MessageAttachments vm={createVm()} alwaysShow />);

        expect(screen.getByRole("list")).toBeInTheDocument();
        expect(screen.queryAllByRole("img")).toHaveLength(0);
        expect(screen.getByRole("button", { name: "Add photos or videos" })).toBeInTheDocument();
    });
});
