/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";
import { vi, describe, it, expect } from "vitest";

import UploadConfirmDialog from "./UploadConfirmDialog.tsx";

describe("<UploadConfirmDialog />", () => {
    it("should display image preview", () => {
        const url = "blob:null/1234-5678-9101-1121";
        vi.spyOn(URL, "createObjectURL").mockReturnValue(url);

        const file = new File([secureRandomString(1024 * 124)], "image.png", { type: "image/png" });
        const { asFragment, getByRole } = render(
            <UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} onFinished={vi.fn()} />,
        );

        expect(getByRole("img")).toHaveAttribute("src", url);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should collect an optional caption for an image", async () => {
        vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:null/1234-5678-9101-1121");
        const onFinished = vi.fn();
        const file = new File([secureRandomString(1024)], "image.png", { type: "image/png" });
        const { getByLabelText, getByRole } = render(
            <UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} allowCaption onFinished={onFinished} />,
        );

        const caption = getByLabelText("Caption");
        await userEvent.type(caption, "  A useful description  ");
        await userEvent.click(getByRole("button", { name: "Upload" }));

        expect(onFinished).toHaveBeenCalledWith(true, false, "A useful description");
    });

    it("should include an optional caption when uploading all images", async () => {
        vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:null/1234-5678-9101-1121");
        const onFinished = vi.fn();
        const file = new File([secureRandomString(1024)], "image.png", { type: "image/png" });
        const { getByLabelText, getByRole } = render(
            <UploadConfirmDialog file={file} currentIndex={0} totalFiles={2} allowCaption onFinished={onFinished} />,
        );

        await userEvent.type(getByLabelText("Caption"), "  A useful description  ");
        await userEvent.click(getByRole("button", { name: "Upload all" }));

        expect(onFinished).toHaveBeenCalledWith(true, true, "A useful description");
    });

    it("should not show a caption field for non-image files", () => {
        const file = new File([secureRandomString(1024)], "notes.txt", { type: "text/plain" });
        const { queryByLabelText } = render(
            <UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} allowCaption onFinished={vi.fn()} />,
        );

        expect(queryByLabelText("Caption")).not.toBeInTheDocument();
    });
});
