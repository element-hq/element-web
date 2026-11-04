/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import UploadConfirmDialog from "./UploadConfirmDialog.tsx";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";

/**
 * The shared media preview tile hides the image until it has loaded it once out of band, which jsdom
 * never does: it fires neither `load` nor `error` for a real element. Stub the loader so the preview
 * settles into its loaded state.
 */
class MockImage {
    public onload: (() => void) | null = null;
    public onerror: ((error: unknown) => void) | null = null;
    public naturalWidth = 320;
    public naturalHeight = 240;
    private internalSrc = "";

    public get src(): string {
        return this.internalSrc;
    }

    public set src(value: string) {
        this.internalSrc = value;
        setTimeout(() => this.onload?.(), 0);
    }
}

/**
 * The video and audio tiles probe their source the same way, through a detached element that
 * happy-dom never loads either. Resolve the probe as soon as a source is set.
 */
function mockMediaElement(element: HTMLElement): void {
    Object.defineProperties(element, {
        videoWidth: { configurable: true, value: 320 },
        videoHeight: { configurable: true, value: 240 },
        src: {
            configurable: true,
            get: () => element.getAttribute("src") ?? "",
            set: (value: string) => {
                element.setAttribute("src", value);
                setTimeout(() => (element as HTMLMediaElement).onloadedmetadata?.(new Event("loadedmetadata")), 0);
            },
        },
    });
}

describe("<UploadConfirmDialog />", () => {
    const originalImage = window.Image;
    const createElement = document.createElement.bind(document);

    beforeEach(() => {
        window.Image = MockImage as unknown as typeof window.Image;
        vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
            const element = createElement(tagName, options);
            if (tagName === "video" || tagName === "audio") mockMediaElement(element);
            return element;
        }) as typeof document.createElement);
    });

    afterEach(async () => {
        window.Image = originalImage;
        vi.mocked(document.createElement).mockRestore();
        await SettingsStore.setValue("feature_strip_upload_metadata", null, SettingLevel.DEVICE, null);
    });

    it("should display image preview", async () => {
        const url = "blob:null/1234-5678-9101-1121";
        vi.spyOn(URL, "createObjectURL").mockReturnValue(url);

        const file = new File([secureRandomString(1024 * 124)], "image.png", { type: "image/png" });
        const { asFragment, getByRole } = render(
            <UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} onFinished={vi.fn()} />,
        );

        // The preview labels the image with the file name.
        await waitFor(() => expect(getByRole("img", { name: "image.png" })).toHaveAttribute("src", url));
        expect(asFragment()).toMatchSnapshot();
    });
    it.each([
        ["video", "video/mp4", "clip.mp4"],
        ["audio", "audio/ogg", "voice.ogg"],
    ])("should display %s preview", async (tag, type, name) => {
        const url = "blob:null/1234-5678-9101-1121";
        vi.spyOn(URL, "createObjectURL").mockReturnValue(url);

        const file = new File([secureRandomString(1024 * 124)], name, { type });
        const { container } = render(
            <UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} onFinished={vi.fn()} />,
        );

        await waitFor(() => expect(container.querySelector(tag)).toHaveAttribute("src", url));
    });

    it("should display a file with no media preview", () => {
        const file = new File(["hello"], "notes.txt", { type: "text/plain" });
        const { container, getByText } = render(
            <UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} onFinished={vi.fn()} />,
        );

        expect(getByText("notes.txt")).toBeInTheDocument();
        expect(container.querySelector("img, video, audio")).toBeNull();
    });

    describe("metadata option", () => {
        const image = (): File => new File(["image"], "image.jpg", { type: "image/jpeg" });
        const checkbox = (): HTMLElement =>
            screen.getByRole("checkbox", { name: "Remove location and other metadata" });

        beforeEach(async () => {
            await SettingsStore.setValue("feature_strip_upload_metadata", null, SettingLevel.DEVICE, true);
        });

        it("is offered, ticked, for media whose metadata can be removed", () => {
            render(<UploadConfirmDialog file={image()} onFinished={vi.fn()} />);

            expect(checkbox()).toBeEnabled();
            expect(checkbox()).toBeChecked();
        });

        it("is not shown when the labs feature is disabled", async () => {
            await SettingsStore.setValue("feature_strip_upload_metadata", null, SettingLevel.DEVICE, false);
            const onFinished = vi.fn();
            render(<UploadConfirmDialog file={image()} onFinished={onFinished} />);

            expect(screen.queryByRole("checkbox")).toBeNull();
            await userEvent.click(screen.getByRole("button", { name: "Upload" }));
            expect(onFinished).toHaveBeenCalledWith(true, false, undefined);
        });

        it.each([
            ["media whose metadata can't be removed", new File(["audio"], "voice.ogg", { type: "audio/ogg" })],
            ["files which are not media", new File(["hello"], "notes.txt", { type: "text/plain" })],
        ])("is not shown for %s", async (_, file) => {
            const onFinished = vi.fn();
            render(<UploadConfirmDialog file={file} onFinished={onFinished} />);

            expect(screen.queryByRole("checkbox")).toBeNull();
            await userEvent.click(screen.getByRole("button", { name: "Upload" }));
            expect(onFinished).toHaveBeenCalledWith(true, false, undefined);
        });

        it("passes on the choice to keep the metadata", async () => {
            const onFinished = vi.fn();
            render(<UploadConfirmDialog file={image()} onFinished={onFinished} />);

            await userEvent.click(checkbox());
            await userEvent.click(screen.getByRole("button", { name: "Upload" }));

            expect(onFinished).toHaveBeenCalledWith(true, false, false);
        });

        it("passes on the choice when uploading all files", async () => {
            const onFinished = vi.fn();
            render(<UploadConfirmDialog file={image()} currentIndex={0} totalFiles={2} onFinished={onFinished} />);

            await userEvent.click(screen.getByRole("button", { name: "Upload all" }));

            expect(onFinished).toHaveBeenCalledWith(true, true, true);
        });
    });
});
