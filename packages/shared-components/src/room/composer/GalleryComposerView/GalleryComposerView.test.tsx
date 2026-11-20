/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen, within } from "@test-utils";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../../core/viewmodel/MockViewModel";
import {
    GalleryComposerView,
    type GalleryComposerViewActions,
    type GalleryComposerViewItem,
    type GalleryComposerViewModel,
    type GalleryComposerViewSnapshot,
} from "./GalleryComposerView";
import * as stories from "./GalleryComposerView.stories";

const { Default, WithVideo, Loading, Full, Empty, Disabled } = composeStories(stories);

function makeItems(count: number): GalleryComposerViewItem[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `item-${index}`,
        type: "image",
        name: `image-${index}.png`,
        previewUrl: `https://example.org/${index}.png`,
    }));
}

function makeViewModel(
    snapshot: Partial<GalleryComposerViewSnapshot> = {},
    actions: Partial<GalleryComposerViewActions> = {},
): GalleryComposerViewModel {
    const vm = new MockViewModel<GalleryComposerViewSnapshot>({
        items: makeItems(2),
        canAddMore: true,
        countLabel: "2 of 60 items",
        ...snapshot,
    }) as unknown as GalleryComposerViewModel;
    Object.assign(vm, {
        onAddFiles: vi.fn(),
        onRemoveItem: vi.fn(),
        ...actions,
    });
    return vm;
}

const imageFile = new File(["image"], "photo.png", { type: "image/png" });
const videoFile = new File(["video"], "clip.mp4", { type: "video/mp4" });

/** Build the `DataTransfer` of a drop or paste: of the given files, or of plain text when there are none. */
function makeDataTransfer(files: File[]): DataTransfer {
    const dataTransfer = new DataTransfer();
    if (files.length === 0) dataTransfer.setData("text/plain", "some text");
    for (const file of files) dataTransfer.items.add(file);
    return dataTransfer;
}

// The events are built by hand: Testing Library's `createEvent` replaces the `DataTransfer` it is
// given with an empty one.
function makeDragEvent(type: "dragover" | "drop", files: File[]): DragEvent {
    return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: makeDataTransfer(files) });
}

function makePasteEvent(files: File[]): ClipboardEvent {
    return new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: makeDataTransfer(files) });
}

describe("GalleryComposerView", () => {
    it("renders the default story", () => {
        const { container } = render(<Default />);

        expect(container).toMatchSnapshot();
        const list = screen.getByRole("list", { name: "3 of 60 items" });
        // Three items and the add tile
        expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    });

    it("previews every item with its name and a button to remove it", () => {
        render(<GalleryComposerView vm={makeViewModel()} />);

        for (const name of ["image-0.png", "image-1.png"]) {
            expect(screen.getByRole("img", { name })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: `Remove ${name}` })).toBeInTheDocument();
        }
        expect(screen.getByRole("img", { name: "image-1.png" })).toHaveAttribute("src", "https://example.org/1.png");
    });

    it("reports which item the user removes", async () => {
        const user = userEvent.setup();
        const onRemoveItem = vi.fn();
        render(<GalleryComposerView vm={makeViewModel({}, { onRemoveItem })} />);

        await user.click(screen.getByRole("button", { name: "Remove image-1.png" }));

        expect(onRemoveItem).toHaveBeenCalledTimes(1);
        expect(onRemoveItem).toHaveBeenCalledWith("item-1");
    });

    it("previews a video which has an image preview as an image", () => {
        const { container } = render(<WithVideo />);

        expect(screen.getByRole("img", { name: "clip.mp4" })).toBeInTheDocument();
        expect(container.querySelector("video")).toBeNull();
    });

    it("previews a video file with its first frame", () => {
        const items: GalleryComposerViewItem[] = [
            { id: "video", type: "video", name: "clip.mp4", previewUrl: "blob:clip", previewIsVideo: true },
        ];
        const { container } = render(<GalleryComposerView vm={makeViewModel({ items })} />);

        const video = container.querySelector("video");
        expect(video).toHaveAttribute("src", "blob:clip");
        expect(video).toHaveAttribute("aria-label", "clip.mp4");
        expect(screen.queryByRole("img", { name: "clip.mp4" })).not.toBeInTheDocument();
    });

    it("shows a spinner for an item whose preview is still loading", () => {
        render(<Loading />);

        expect(screen.getByRole("progressbar", { name: "Loading…" })).toBeInTheDocument();
        expect(screen.queryByRole("img", { name: "loading.png" })).not.toBeInTheDocument();
        // The item can still be removed while it loads.
        expect(screen.getByRole("button", { name: "Remove loading.png" })).toBeInTheDocument();
    });

    it("renders an item without a preview as an empty tile", () => {
        const items: GalleryComposerViewItem[] = [{ id: "bare", type: "video", name: "bare.mp4" }];
        const { container } = render(<GalleryComposerView vm={makeViewModel({ items })} />);

        expect(container.querySelector("img, video")).toBeNull();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Remove bare.mp4" })).toBeInTheDocument();
    });

    it("names the list by the count without spelling it out", () => {
        render(<Default />);

        expect(screen.getByRole("list", { name: "3 of 60 items" })).toBeInTheDocument();
        expect(screen.queryByText("3 of 60 items")).not.toBeInTheDocument();
    });

    it("has no field for text, which is written in the composer the view sits in", () => {
        render(<Default />);

        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("tells the user why files were left out", () => {
        render(<Full />);

        expect(screen.getByRole("status")).toHaveTextContent(
            "A gallery can hold up to 60 items. The rest were left out.",
        );
    });

    it("has no notice when there is nothing to report", () => {
        render(<Default />);

        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("only offers to add more while the gallery is not full", () => {
        const { unmount } = render(<Full />);
        expect(screen.queryByRole("button", { name: "Add photos or videos" })).not.toBeInTheDocument();
        unmount();

        render(<Empty />);
        expect(screen.getByRole("button", { name: "Add photos or videos" })).toBeInTheDocument();
        expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });

    it("shows only an icon on the add tile, which keeps its name", () => {
        render(<Default />);
        const add = screen.getByRole("button", { name: "Add photos or videos" });

        expect(add).toHaveTextContent("");
        // The name is also what sighted users get on hover.
        expect(add).toHaveAttribute("title", "Add photos or videos");
    });

    it("opens the file picker from the add tile", async () => {
        const user = userEvent.setup();
        render(<GalleryComposerView vm={makeViewModel()} />);
        const input = screen.getByTestId("gallery-composer-file-input") as HTMLInputElement;
        const click = vi.spyOn(input, "click").mockImplementation(() => {});

        await user.click(screen.getByRole("button", { name: "Add photos or videos" }));

        expect(click).toHaveBeenCalledTimes(1);
        expect(input).toHaveAttribute("accept", "image/*,video/*");
        expect(input.multiple).toBe(true);
    });

    it("reports the files the user picks and resets the picker", () => {
        const onAddFiles = vi.fn();
        render(<GalleryComposerView vm={makeViewModel({}, { onAddFiles })} />);
        const input = screen.getByTestId("gallery-composer-file-input") as HTMLInputElement;
        let value = "C:\\fakepath\\photo.png";
        Object.defineProperty(input, "value", {
            configurable: true,
            get: () => value,
            set: (newValue: string) => {
                value = newValue;
            },
        });

        fireEvent.change(input, { target: { files: [imageFile, videoFile] } });

        expect(onAddFiles).toHaveBeenCalledTimes(1);
        expect(onAddFiles).toHaveBeenCalledWith([imageFile, videoFile]);
        // So that picking the same file again is reported as a change.
        expect(value).toBe("");
    });

    it("ignores the picker being closed without a file", () => {
        const onAddFiles = vi.fn();
        render(<GalleryComposerView vm={makeViewModel({}, { onAddFiles })} />);

        fireEvent.change(screen.getByTestId("gallery-composer-file-input"), { target: { files: [] } });

        expect(onAddFiles).not.toHaveBeenCalled();
    });

    it("adds files which are dropped onto the view", () => {
        const onAddFiles = vi.fn();
        const { container } = render(<GalleryComposerView vm={makeViewModel({}, { onAddFiles })} />);
        const root = container.firstElementChild!;

        const dragOver = makeDragEvent("dragover", [imageFile]);
        fireEvent(root, dragOver);
        // Otherwise the browser would not deliver the drop.
        expect(dragOver.defaultPrevented).toBe(true);

        const drop = makeDragEvent("drop", [imageFile, videoFile]);
        fireEvent(root, drop);

        expect(drop.defaultPrevented).toBe(true);
        expect(onAddFiles).toHaveBeenCalledWith([imageFile, videoFile]);
    });

    it("leaves drags which carry no files to the browser", () => {
        const onAddFiles = vi.fn();
        const { container } = render(<GalleryComposerView vm={makeViewModel({}, { onAddFiles })} />);
        const root = container.firstElementChild!;

        const dragOver = makeDragEvent("dragover", []);
        fireEvent(root, dragOver);
        const drop = makeDragEvent("drop", []);
        fireEvent(root, drop);

        expect(dragOver.defaultPrevented).toBe(false);
        expect(drop.defaultPrevented).toBe(false);
        expect(onAddFiles).not.toHaveBeenCalled();
    });

    it("adds files which are pasted, and leaves pasted text alone", () => {
        const onAddFiles = vi.fn();
        const { container } = render(<GalleryComposerView vm={makeViewModel({}, { onAddFiles })} />);
        const root = container.firstElementChild!;

        const textPaste = makePasteEvent([]);
        fireEvent(root, textPaste);
        expect(textPaste.defaultPrevented).toBe(false);
        expect(onAddFiles).not.toHaveBeenCalled();

        const filePaste = makePasteEvent([imageFile]);
        fireEvent(root, filePaste);
        expect(filePaste.defaultPrevented).toBe(true);
        expect(onAddFiles).toHaveBeenCalledWith([imageFile]);
    });

    it("applies a custom className to the root", () => {
        const { container } = render(<GalleryComposerView vm={makeViewModel()} className="custom-composer" />);

        expect(container.firstElementChild).toHaveClass("custom-composer");
    });

    it("disables every control while disabled", () => {
        render(<Disabled />);

        expect(screen.getByRole("button", { name: "Add photos or videos" })).toBeDisabled();
        expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(3);
        for (const button of screen.getAllByRole("button", { name: /^Remove / })) {
            expect(button).toBeDisabled();
        }
    });

    it("does not take dropped or pasted files while disabled", () => {
        const onAddFiles = vi.fn();
        const { container } = render(<GalleryComposerView vm={makeViewModel({ disabled: true }, { onAddFiles })} />);
        const root = container.firstElementChild!;

        const drop = makeDragEvent("drop", [imageFile]);
        fireEvent(root, drop);
        const paste = makePasteEvent([imageFile]);
        fireEvent(root, paste);

        // The browser must still not open the file in place of the app.
        expect(drop.defaultPrevented).toBe(true);
        expect(paste.defaultPrevented).toBe(true);
        expect(onAddFiles).not.toHaveBeenCalled();
    });
});
