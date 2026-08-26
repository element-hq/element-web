/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render, waitFor } from "test-utils-rtl";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import UploadConfirmDialog from "./UploadConfirmDialog.tsx";

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

describe("<UploadConfirmDialog />", () => {
    const originalImage = window.Image;

    beforeEach(() => {
        window.Image = MockImage as unknown as typeof window.Image;
    });

    afterEach(() => {
        window.Image = originalImage;
    });

    it("should display image preview", async () => {
        const url = "blob:null/1234-5678-9101-1121";
        vi.spyOn(URL, "createObjectURL").mockReturnValue(url);

        const file = new File([secureRandomString(1024 * 124)], "image.png", { type: "image/png" });
        const { asFragment, container } = render(
            <UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} onFinished={vi.fn()} />,
        );

        // The preview renders the image with an empty alt attribute, so it is exposed as presentational
        // rather than under the "img" role.
        await waitFor(() => expect(container.querySelector("img")).toHaveAttribute("src", url));
        expect(asFragment()).toMatchSnapshot();
    });
});
